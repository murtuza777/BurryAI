import { Hono } from "hono"
import { z } from "zod"
import { runFinancialAgent } from "../agent/graph"
import { requireAuth } from "../middleware/auth"
import {
  createAdvisorThread,
  deleteAdvisorThread,
  getAdvisorConversationHistory,
  getAdvisorThread,
  insertAdvisorMessage,
  listAdvisorThreads,
  renameAdvisorThreadIfDefault,
  type AdvisorMessageMeta
} from "../services/advisor-chat"
import {
  getLatestCostCutterPlan,
  saveCostCutterPlan,
  setCostPlanStepCompletion
} from "../services/cost-plans"
import type { AppEnv } from "../types"

const adviceSchema = z
  .object({
    message: z.string().trim().min(1).max(4000)
  })
  .strict()

const createThreadSchema = z
  .object({
    title: z.string().trim().max(120).optional()
  })
  .strict()

const sendChatMessageSchema = z
  .object({
    message: z.string().trim().min(1).max(4000)
  })
  .strict()

const updatePlanStepSchema = z
  .object({
    completed: z.boolean()
  })
  .strict()

const costAnalysisSchema = z
  .object({
    monthlyIncome: z.coerce.number().nonnegative().optional(),
    categories: z
      .array(
        z.object({
          category: z.string().trim().min(1).max(80),
          amount: z.coerce.number().nonnegative()
        })
      )
      .max(20)
      .optional()
  })
  .strict()

async function readJsonBody<TSchema extends z.ZodTypeAny>(
  req: Request,
  schema: TSchema
): Promise<
  | {
      ok: true
      value: z.infer<TSchema>
    }
  | {
      ok: false
      error: string
    }
> {
  let payload: unknown

  try {
    payload = await req.json()
  } catch {
    return { ok: false, error: "Invalid JSON body" }
  }

  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    return { ok: false, error: "Invalid request body" }
  }

  return { ok: true, value: parsed.data }
}

async function readCostAnalysisBody(req: Request): Promise<
  | {
      ok: true
      value: z.infer<typeof costAnalysisSchema>
    }
  | {
      ok: false
      error: string
    }
> {
  let raw = ""

  try {
    raw = await req.text()
  } catch {
    return { ok: false, error: "Invalid request body" }
  }

  if (raw.trim().length === 0) {
    return { ok: true, value: {} }
  }

  let payload: unknown

  try {
    payload = JSON.parse(raw)
  } catch {
    return { ok: false, error: "Invalid JSON body" }
  }

  const parsed = costAnalysisSchema.safeParse(payload)
  if (!parsed.success) {
    return { ok: false, error: "Invalid request body" }
  }

  return { ok: true, value: parsed.data }
}

function buildCostAnalysisPrompt(input: z.infer<typeof costAnalysisSchema>): string {
  const categories = (input.categories ?? [])
    .filter((item) => item.category.trim().length > 0 && item.amount > 0)
    .sort((a, b) => b.amount - a.amount)

  if (categories.length === 0 && input.monthlyIncome === undefined) {
    return (
      "Analyze my spending in detail. For each expense category, give specific actionable tips to reduce costs. " +
      "Calculate how much I can realistically save per category. Provide a personalized savings plan."
    )
  }

  const lines = [
    "Analyze my monthly spending using the numbers below.",
    "Calculate which categories are consuming too much of my income.",
    "For each category, estimate a realistic monthly cut and explain how to save money without making the budget unrealistic.",
    "End with a prioritized savings plan for this month."
  ]

  lines.push(
    "Return plain text only.",
    "Do not use markdown headings with #, do not use tables, and do not use separator lines like ---.",
    "Use this structure with short labels ending in a colon: Snapshot:, Pressure points:, Recommended cuts:, Monthly plan:, Action steps:.",
    "Under each label, use short bullet points or a short numbered list.",
    "Keep every recommendation concise and calculation-driven, not story-like."
  )

  if (input.monthlyIncome !== undefined) {
    lines.push(`Monthly income: $${input.monthlyIncome.toFixed(2)}`)
  }

  if (categories.length > 0) {
    lines.push(
      `Expense categories: ${categories
        .map((item) => `${item.category} $${item.amount.toFixed(2)}`)
        .join(", ")}`
    )
  } else {
    lines.push("Use my saved expenses for category-level analysis.")
  }

  return lines.join("\n")
}

const agentRoutes = new Hono<AppEnv>()
agentRoutes.use("*", requireAuth)

agentRoutes.get("/chats", async (c) => {
  try {
    const threads = await listAdvisorThreads(c.env.DB, c.get("userId"))
    return c.json({ threads })
  } catch {
    return c.json({ error: "Failed to load advisor chats" }, 500)
  }
})

agentRoutes.post("/chats", async (c) => {
  const body = await readJsonBody(c.req.raw, createThreadSchema)
  if (!body.ok) {
    return c.json({ error: body.error }, 400)
  }

  try {
    const thread = await createAdvisorThread(c.env.DB, c.get("userId"), body.value.title)
    return c.json({ thread }, 201)
  } catch {
    return c.json({ error: "Failed to create advisor chat" }, 500)
  }
})

agentRoutes.delete("/chats/:threadId", async (c) => {
  try {
    const deleted = await deleteAdvisorThread(c.env.DB, c.get("userId"), c.req.param("threadId"))
    if (!deleted) {
      return c.json({ error: "Chat not found" }, 404)
    }

    return c.json({ ok: true })
  } catch {
    return c.json({ error: "Failed to delete advisor chat" }, 500)
  }
})

agentRoutes.post("/chats/:threadId/messages", async (c) => {
  const body = await readJsonBody(c.req.raw, sendChatMessageSchema)
  if (!body.ok) {
    return c.json({ error: body.error }, 400)
  }

  const userId = c.get("userId")
  const threadId = c.req.param("threadId")
  const existingThread = await getAdvisorThread(c.env.DB, userId, threadId)

  if (!existingThread) {
    return c.json({ error: "Chat not found" }, 404)
  }

  const useVectorize = c.env.ENABLE_VECTORIZE_RAG === "true"
  const conversationHistory = await getAdvisorConversationHistory(c.env.DB, userId, threadId)

  await insertAdvisorMessage({
    db: c.env.DB,
    userId,
    threadId,
    role: "user",
    content: body.value.message
  })
  await renameAdvisorThreadIfDefault(c.env.DB, userId, threadId, body.value.message)

  try {
    const result = await runFinancialAgent({
      db: c.env.DB,
      userId,
      userMessage: body.value.message,
      conversationHistory,
      knowledgeIndex: useVectorize ? c.env.FINANCE_KB_INDEX : undefined,
      aiBinding: c.env.AI,
      chatModel: c.env.AI_PRIMARY_MODEL,
      reasoningModel: c.env.AI_REASONING_MODEL,
      fallbackModel: c.env.AI_FALLBACK_MODEL,
      embeddingModel: c.env.EMBEDDING_MODEL,
      webSearchProvider: c.env.WEB_SEARCH_PROVIDER,
      tavilyApiKey: c.env.TAVILY_API_KEY,
      serperApiKey: c.env.SERPER_API_KEY
    })

    const meta: AdvisorMessageMeta = {
      intent: result.intent,
      used_tools: result.selectedTools,
      tool_summaries: result.toolOutputs.map((tool) => ({
        name: tool.name,
        summary: tool.summary
      })),
      knowledge_sources: result.knowledgeChunks.map((chunk) => ({
        title: chunk.title,
        source: chunk.source
      })),
      web_sources: result.webResults.map((item) => ({
        title: item.title,
        url: item.url,
        source: item.source
      })),
      rag: {
        vectorize_enabled: useVectorize,
        knowledge_count: result.knowledgeChunks.length,
        web_count: result.webResults.length,
        web_search_triggered: result.webSearchTriggered
      }
    }

    await insertAdvisorMessage({
      db: c.env.DB,
      userId,
      threadId,
      role: "assistant",
      content: result.response,
      modelUsed: result.modelUsed,
      meta
    })

    await c.env.DB.prepare(
      "INSERT INTO ai_logs (id, user_id, query, response, model_used) VALUES (?1, ?2, ?3, ?4, ?5)"
    )
      .bind(crypto.randomUUID(), userId, body.value.message, result.response, result.modelUsed)
      .run()

    const thread = await getAdvisorThread(c.env.DB, userId, threadId)
    return c.json({ thread })
  } catch {
    const fallbackError = "Unable to generate advice now."
    await insertAdvisorMessage({
      db: c.env.DB,
      userId,
      threadId,
      role: "assistant",
      content: fallbackError,
      modelUsed: "error"
    })

    const thread = await getAdvisorThread(c.env.DB, userId, threadId)
    return c.json({ error: "Failed to generate financial advice", thread }, 500)
  }
})

agentRoutes.get("/cost-plan", async (c) => {
  try {
    const plan = await getLatestCostCutterPlan(c.env.DB, c.get("userId"))
    return c.json({ plan })
  } catch {
    return c.json({ error: "Failed to load cost cutter plan" }, 500)
  }
})

agentRoutes.patch("/cost-plan/steps/:stepId", async (c) => {
  const body = await readJsonBody(c.req.raw, updatePlanStepSchema)
  if (!body.ok) {
    return c.json({ error: body.error }, 400)
  }

  try {
    const plan = await setCostPlanStepCompletion({
      db: c.env.DB,
      userId: c.get("userId"),
      stepId: c.req.param("stepId"),
      completed: body.value.completed
    })

    if (!plan) {
      return c.json({ error: "Plan step not found" }, 404)
    }

    return c.json({ plan })
  } catch {
    return c.json({ error: "Failed to update plan step" }, 500)
  }
})

agentRoutes.post("/advice", async (c) => {
  const body = await readJsonBody(c.req.raw, adviceSchema)
  if (!body.ok) {
    return c.json({ error: body.error }, 400)
  }

  try {
    const userId = c.get("userId")
    const useVectorize = c.env.ENABLE_VECTORIZE_RAG === "true"
    const result = await runFinancialAgent({
      db: c.env.DB,
      userId,
      userMessage: body.value.message,
      knowledgeIndex: useVectorize ? c.env.FINANCE_KB_INDEX : undefined,
      aiBinding: c.env.AI,
      chatModel: c.env.AI_PRIMARY_MODEL,
      reasoningModel: c.env.AI_REASONING_MODEL,
      fallbackModel: c.env.AI_FALLBACK_MODEL,
      embeddingModel: c.env.EMBEDDING_MODEL,
      webSearchProvider: c.env.WEB_SEARCH_PROVIDER,
      tavilyApiKey: c.env.TAVILY_API_KEY,
      serperApiKey: c.env.SERPER_API_KEY
    })

    await c.env.DB.prepare(
      "INSERT INTO ai_logs (id, user_id, query, response, model_used) VALUES (?1, ?2, ?3, ?4, ?5)"
    )
      .bind(crypto.randomUUID(), userId, body.value.message, result.response, result.modelUsed)
      .run()

    return c.json({
      response: result.response,
      model_used: result.modelUsed,
      intent: result.intent,
      used_tools: result.selectedTools,
      tool_summaries: result.toolOutputs.map((tool) => ({
        name: tool.name,
        summary: tool.summary
      })),
      knowledge_sources: result.knowledgeChunks.map((chunk) => ({
        title: chunk.title,
        source: chunk.source
      })),
      web_sources: result.webResults.map((item) => ({
        title: item.title,
        url: item.url,
        source: item.source
      })),
      rag: {
        vectorize_enabled: useVectorize,
        knowledge_count: result.knowledgeChunks.length,
        web_count: result.webResults.length,
        web_search_triggered: result.webSearchTriggered
      }
    })
  } catch {
    return c.json({ error: "Failed to generate financial advice" }, 500)
  }
})

agentRoutes.post("/cost-analysis", async (c) => {
  const body = await readCostAnalysisBody(c.req.raw)
  if (!body.ok) {
    return c.json({ error: body.error }, 400)
  }

  try {
    const userId = c.get("userId")
    const useVectorize = c.env.ENABLE_VECTORIZE_RAG === "true"
    const normalizedCategories = (body.value.categories ?? [])
      .filter((item) => item.category.trim().length > 0 && item.amount > 0)
      .sort((a, b) => b.amount - a.amount)
    const result = await runFinancialAgent({
      db: c.env.DB,
      userId,
      userMessage: buildCostAnalysisPrompt(body.value),
      contextOverride:
        normalizedCategories.length > 0 || body.value.monthlyIncome !== undefined
          ? {
              monthlyIncome: body.value.monthlyIncome,
              topExpenseCategories: normalizedCategories.length > 0 ? normalizedCategories : undefined
            }
          : undefined,
      knowledgeIndex: useVectorize ? c.env.FINANCE_KB_INDEX : undefined,
      aiBinding: c.env.AI,
      chatModel: c.env.AI_PRIMARY_MODEL,
      reasoningModel: c.env.AI_REASONING_MODEL,
      fallbackModel: c.env.AI_FALLBACK_MODEL,
      embeddingModel: c.env.EMBEDDING_MODEL,
      webSearchProvider: c.env.WEB_SEARCH_PROVIDER,
      tavilyApiKey: c.env.TAVILY_API_KEY,
      serperApiKey: c.env.SERPER_API_KEY
    })

    const plan = await saveCostCutterPlan({
      db: c.env.DB,
      userId,
      analysis: result.response,
      modelUsed: result.modelUsed,
      context: result.context,
      toolOutputs: result.toolOutputs
    })

    return c.json({
      analysis: result.response,
      model_used: result.modelUsed,
      context: {
        monthlyIncome: result.context.monthlyIncome,
        monthlyExpenses: result.context.monthlyExpenses,
        remainingBalance: result.context.remainingBalance,
        expenseRatio: result.context.expenseRatio,
        financialHealthScore: result.context.financialHealthScore,
        topExpenseCategories: result.context.topExpenseCategories
      },
      used_tools: result.selectedTools,
      knowledge_sources: result.knowledgeChunks.map((chunk) => ({
        title: chunk.title,
        source: chunk.source
      })),
      plan
    })
  } catch {
    return c.json({ error: "Failed to generate cost analysis" }, 500)
  }
})

export default agentRoutes
