import type {
  AgentContextData,
  AgentIntent,
  AgentKnowledgeChunk,
  AgentToolOutput,
  AgentWebResult
} from "../state"
import { resolveModelRoute, selectModel } from "../model-router"

function formatContext(context: AgentContextData): string {
  const topCategories =
    context.topExpenseCategories.length > 0
      ? context.topExpenseCategories
          .map((item) => `${item.category}: $${item.amount.toLocaleString()}`)
          .join(", ")
      : "No categories yet"

  return [
    `Monthly income: $${context.monthlyIncome.toLocaleString()}`,
    `Monthly expenses: $${context.monthlyExpenses.toLocaleString()}`,
    `Monthly loan payments: $${context.monthlyLoanPayments.toLocaleString()}`,
    `Remaining monthly balance: $${context.remainingBalance.toLocaleString()}`,
    `Expense ratio: ${context.expenseRatio.toFixed(1)}%`,
    `Debt-to-income ratio: ${context.debtToIncomeRatio.toFixed(1)}%`,
    `Financial health score: ${context.financialHealthScore}/100`,
    `Top categories: ${topCategories}`
  ].join("\n")
}

function formatKnowledge(chunks: AgentKnowledgeChunk[]): string {
  if (chunks.length === 0) {
    return "No internal knowledge retrieved."
  }

  return chunks.map((chunk) => `- ${chunk.title}: ${chunk.content} (source: ${chunk.source})`).join("\n")
}

function formatToolOutputs(toolOutputs: AgentToolOutput[]): string {
  if (toolOutputs.length === 0) {
    return "No tool output available."
  }

  return toolOutputs
    .map((tool) => {
      let serialized = ""
      try {
        serialized = JSON.stringify(tool.output)
      } catch {
        serialized = "[unserializable output]"
      }

      const trimmed = serialized.length > 1800 ? `${serialized.slice(0, 1800)}...` : serialized
      return `- ${tool.name}: ${tool.summary}\n  structured_output: ${trimmed}`
    })
    .join("\n")
}

function buildFallbackResponse(
  intent: AgentIntent,
  context: AgentContextData,
  toolOutputs: AgentToolOutput[],
  knowledgeChunks: AgentKnowledgeChunk[],
  webResults: AgentWebResult[]
): string {
  const sections: string[] = []
  const intentLabels: Record<string, string> = {
    budgeting: "budget optimization",
    debt: "debt management",
    savings: "savings strategy",
    income: "income growth",
    general: "financial overview"
  }

  sections.push(`${intentLabels[intent] || "Financial Analysis"}:\n`)

  if (context.monthlyIncome > 0 || context.monthlyExpenses > 0) {
    const savingsRate =
      context.monthlyIncome > 0
        ? Math.round(
            ((context.monthlyIncome - context.monthlyExpenses - context.monthlyLoanPayments) /
              context.monthlyIncome) *
              100
          )
        : 0

    sections.push(
      `**Your Financial Snapshot:**\n` +
        `- Monthly income: **$${context.monthlyIncome.toLocaleString()}**\n` +
        `- Monthly expenses: **$${context.monthlyExpenses.toLocaleString()}**\n` +
        `- Loan payments: **$${context.monthlyLoanPayments.toLocaleString()}**\n` +
        `- Financial health score: **${context.financialHealthScore}/100**\n` +
        `- Current savings rate: **${savingsRate}%**\n`
    )
  }

  if (toolOutputs.length > 0) {
    sections.push("Key Insights:\n")
    for (const tool of toolOutputs) {
      sections.push(`- ${tool.summary}`)
    }
    sections.push("")
  }

  if (knowledgeChunks.length > 0) {
    sections.push("Recommendations:\n")
    for (const chunk of knowledgeChunks) {
      sections.push(`**${chunk.title}:** ${chunk.content}\n`)
    }
  }

  if (webResults.length > 0) {
    sections.push("Opportunities Found:\n")
    for (const result of webResults) {
      sections.push(`- **${result.title}** - ${result.snippet || "View details"} (${result.url})`)
    }
    sections.push("")
  }

  sections.push(
    "Action Steps:\n" +
      "1. Set a strict weekly spending cap and track daily\n" +
      "2. Protect minimum loan payments before discretionary spending\n" +
      "3. Auto-transfer savings on payday to avoid spending them\n" +
      "4. Review and cancel unused subscriptions\n"
  )

  return sections.join("\n")
}

type WorkersAiBinding = {
  run: (model: string, input: unknown) => Promise<unknown>
}

type GenerationResult = {
  text: string
  modelUsed: string
}

function extractWorkersAiText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null
  }

  const response = (payload as { response?: unknown }).response
  if (typeof response === "string" && response.trim().length > 0) {
    return response.trim()
  }

  const result = (payload as { result?: unknown }).result
  if (typeof result === "string" && result.trim().length > 0) {
    return result.trim()
  }

  return null
}

async function generateWithWorkersAi(params: {
  aiBinding: WorkersAiBinding
  userInput: string
  systemPrompt: string
  prompt: string
  chatModel?: string
  reasoningModel?: string
  fallbackModel?: string
}): Promise<GenerationResult | null> {
  const route = resolveModelRoute(params.userInput, {
    chatModel: params.chatModel,
    reasoningModel: params.reasoningModel,
    fallbackModel: params.fallbackModel
  })
  const selectedByHeuristic = selectModel(params.userInput)
  const errors: string[] = []

  for (const model of route.modelsToTry) {
    try {
      const payload = await params.aiBinding.run(model, {
        messages: [
          { role: "system", content: params.systemPrompt },
          { role: "user", content: params.prompt }
        ],
        max_tokens: route.taskType === "reasoning" ? 3072 : 2048,
        temperature: route.taskType === "reasoning" ? 0.2 : 0.45
      })

      const text = extractWorkersAiText(payload)
      if (text) {
        const routeLabel = model === route.primaryModel ? route.taskType : "fallback"
        return {
          text,
          modelUsed: `workers-ai:${model}|route:${routeLabel}|selected:${selectedByHeuristic}`
        }
      }

      errors.push(`${model}: empty response`)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`[BurryAI] Workers AI generation error for ${model}: ${msg}`)
      errors.push(`${model}: ${msg}`)
    }
  }

  if (errors.length > 0) {
    console.error(`[BurryAI] Workers AI model chain failed: ${errors.join(" | ")}`)
  }

  return null
}

export async function generateAgentResponse(params: {
  aiBinding?: WorkersAiBinding
  chatModel?: string
  reasoningModel?: string
  fallbackModel?: string
  intent: AgentIntent
  userMessage: string
  context: AgentContextData
  toolOutputs: AgentToolOutput[]
  knowledgeChunks: AgentKnowledgeChunk[]
  webResults: AgentWebResult[]
}): Promise<{ response: string; modelUsed: string }> {
  const incomeSpecificInstruction =
    params.intent === "income"
      ? "For income opportunities, lead with the strongest personalized matches from niche, direct, Reddit/X, campus, and hidden-source listings before mentioning LinkedIn or Indeed. Mention source sites, fit reasons, and direct links when available."
      : "Keep recommendations tightly grounded in the supplied context and tools."

  const systemPrompt =
    "You are BurryAI, a finance assistant for students and early-career users. Give concise, actionable advice. Use short paragraphs, bullet points, and numbered action steps. Do not use markdown heading syntax (#). Show calculations clearly when relevant and keep recommendations grounded in the provided data."

  const prompt = [
    "You are BurryAI, a financial advisor for students.",
    "Use the provided structured context and tool outputs to produce concise, actionable advice.",
    "Use a clean chat style: short paragraphs, bullet points, and numbered action steps.",
    "Do not use markdown heading syntax like #, ##, or ###.",
    "When citing links, write full URLs directly.",
    "Do not mention hidden reasoning or internal system details.",
    incomeSpecificInstruction,
    "",
    `User question: ${params.userMessage}`,
    `Detected intent: ${params.intent}`,
    "",
    "Context:",
    formatContext(params.context),
    "",
    "Tool outputs:",
    formatToolOutputs(params.toolOutputs),
    "",
    "Knowledge summary:",
    formatKnowledge(params.knowledgeChunks),
    "",
    "Knowledge snippets:",
    ...params.knowledgeChunks.map(
      (chunk) => `- ${chunk.title}: ${chunk.content} (source: ${chunk.source}, score: ${chunk.score})`
    ),
    "",
    "Web retrieval results:",
    ...params.webResults.map((result) => `- ${result.title} | ${result.url} | ${result.snippet}`),
    "",
    "Return clear recommendations in plain text with short action steps, and cite knowledge/web sources inline when used."
  ].join("\n")

  if (params.aiBinding) {
    try {
      const workersAiResult = await generateWithWorkersAi({
        aiBinding: params.aiBinding,
        userInput: params.userMessage,
        systemPrompt,
        prompt,
        chatModel: params.chatModel,
        reasoningModel: params.reasoningModel,
        fallbackModel: params.fallbackModel
      })

      if (workersAiResult) {
        return {
          response: workersAiResult.text,
          modelUsed: workersAiResult.modelUsed
        }
      }
    } catch (workersAiError) {
      const msg = workersAiError instanceof Error ? workersAiError.message : String(workersAiError)
      console.error(`[BurryAI] Workers AI generation pipeline error: ${msg}`)
    }
  }

  return {
    response: buildFallbackResponse(
      params.intent,
      params.context,
      params.toolOutputs,
      params.knowledgeChunks,
      params.webResults
    ),
    modelUsed: "fallback:rule-based"
  }
}
