import { Hono } from "hono"
import { z } from "zod"
import { runFinancialAgent } from "../agent/graph"
import { requireAuth } from "../middleware/auth"
import type { AppEnv } from "../types"

const adviceSchema = z
  .object({
    message: z.string().trim().min(1).max(4000)
  })
  .strict()

async function readAdviceBody(req: Request): Promise<
  | {
      ok: true
      value: z.infer<typeof adviceSchema>
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

  const parsed = adviceSchema.safeParse(payload)
  if (!parsed.success) {
    return { ok: false, error: "Invalid request body" }
  }

  return { ok: true, value: parsed.data }
}

const agentRoutes = new Hono<AppEnv>()
agentRoutes.use("*", requireAuth)

agentRoutes.post("/advice", async (c) => {
  const body = await readAdviceBody(c.req.raw)
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
  try {
    const userId = c.get("userId")
    const useVectorize = c.env.ENABLE_VECTORIZE_RAG === "true"
    const result = await runFinancialAgent({
      db: c.env.DB,
      userId,
      userMessage:
        "Analyze my spending in detail. For each expense category, give specific actionable tips to reduce costs. Calculate how much I can realistically save per category. Provide a personalized savings plan.",
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
      }))
    })
  } catch {
    return c.json({ error: "Failed to generate cost analysis" }, 500)
  }
})

export default agentRoutes
