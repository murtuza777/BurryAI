import type {
  AgentContextData,
  AgentIntent,
  AgentKnowledgeChunk,
  AgentToolOutput,
  AgentWebResult
} from "../state"

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

function buildFallbackResponse(
  intent: AgentIntent,
  context: AgentContextData,
  toolOutputs: AgentToolOutput[],
  knowledgeChunks: AgentKnowledgeChunk[],
  webResults: AgentWebResult[]
): string {
  const sections: string[] = []

  // Opening
  const intentLabels: Record<string, string> = {
    budgeting: "budget optimization",
    debt: "debt management",
    savings: "savings strategy",
    income: "income growth",
    general: "financial overview"
  }
  sections.push(`${intentLabels[intent] || "Financial Analysis"}:\n`)

  // Context summary
  if (context.monthlyIncome > 0 || context.monthlyExpenses > 0) {
    const savingsRate = context.monthlyIncome > 0
      ? Math.round(((context.monthlyIncome - context.monthlyExpenses - context.monthlyLoanPayments) / context.monthlyIncome) * 100)
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

  // Tool insights
  if (toolOutputs.length > 0) {
    sections.push("Key Insights:\n")
    for (const tool of toolOutputs) {
      sections.push(`- ${tool.summary}`)
    }
    sections.push("")
  }

  // Knowledge-based recommendations
  if (knowledgeChunks.length > 0) {
    sections.push("Recommendations:\n")
    for (const chunk of knowledgeChunks) {
      sections.push(`**${chunk.title}:** ${chunk.content}\n`)
    }
  }

  // Web results
  if (webResults.length > 0) {
    sections.push("Opportunities Found:\n")
    for (const result of webResults) {
      sections.push(`- **${result.title}** - ${result.snippet || "View details"} (${result.url})`)
    }
    sections.push("")
  }

  // Action steps
  sections.push(
    "Action Steps:\n" +
    "1. Set a strict weekly spending cap and track daily\n" +
    "2. Protect minimum loan payments before discretionary spending\n" +
    "3. Auto-transfer savings on payday to avoid spending them\n" +
    "4. Review and cancel unused subscriptions\n"
  )

  return sections.join("\n")
}

type GeminiGenerationResult = {
  text: string
  modelUsed: string
}

type GeminiPart = {
  text?: string
}

type GeminiCandidate = {
  content?: {
    parts?: GeminiPart[]
  }
}

type GeminiResponsePayload = {
  candidates?: GeminiCandidate[]
}

function extractGeminiText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null

  const candidates = (payload as GeminiResponsePayload).candidates
  const firstText = candidates?.[0]?.content?.parts?.[0]?.text
  return typeof firstText === "string" && firstText.trim().length > 0 ? firstText.trim() : null
}

async function generateWithGemini(
  apiKey: string,
  preferredModel: string | undefined,
  prompt: string
): Promise<GeminiGenerationResult | null> {
  const modelCandidates = [preferredModel, "gemini-2.0-flash", "gemini-1.5-flash"]
    .filter((model): model is string => typeof model === "string" && model.length > 0)

  const errors: string[] = []

  for (const model of modelCandidates) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }]
              }
            ],
            generationConfig: {
              maxOutputTokens: 4096,
              temperature: 0.7
            }
          })
        }
      )

      if (!response.ok) {
        let errorBody = ""
        try {
          errorBody = await response.text()
        } catch {
          errorBody = "Could not read error body"
        }
        const errorMsg = `${model}: HTTP ${response.status} – ${errorBody.slice(0, 200)}`
        console.error(`[BurryAI] Gemini API error: ${errorMsg}`)
        errors.push(errorMsg)

        // On rate limit (429) or server error (5xx), wait before trying the next model
        if (response.status === 429 || response.status >= 500) {
          await new Promise((resolve) => setTimeout(resolve, 1500))
        }
        continue
      }

      const payload = (await response.json()) as unknown
      const text = extractGeminiText(payload)
      if (text) {
        return {
          text,
          modelUsed: `gemini:${model}`
        }
      }

      errors.push(`${model}: empty response body`)
    } catch (fetchError) {
      const msg = fetchError instanceof Error ? fetchError.message : String(fetchError)
      console.error(`[BurryAI] Gemini fetch error for ${model}: ${msg}`)
      errors.push(`${model}: ${msg}`)
    }
  }

  // If all models failed, include error details so we know why
  if (errors.length > 0) {
    console.error(`[BurryAI] All Gemini models failed: ${errors.join(" | ")}`)
  }

  return null
}

export async function generateAgentResponse(params: {
  apiKey?: string
  preferredModel?: string
  aiBinding?: {
    run: (model: string, input: unknown) => Promise<unknown>
  }
  intent: AgentIntent
  userMessage: string
  context: AgentContextData
  toolOutputs: AgentToolOutput[]
  knowledgeChunks: AgentKnowledgeChunk[]
  webResults: AgentWebResult[]
}): Promise<{ response: string; modelUsed: string }> {
  const prompt = [
    "You are BurryAI, a financial advisor for students.",
    "Use the provided structured context and tool outputs to produce concise, actionable advice.",
    "Use a clean chat style: short paragraphs, bullet points, and numbered action steps.",
    "Do not use markdown heading syntax like #, ##, or ###.",
    "When citing links, write full URLs directly.",
    "Do not mention hidden reasoning or internal system details.",
    "",
    `User question: ${params.userMessage}`,
    `Detected intent: ${params.intent}`,
    "",
    "Context:",
    formatContext(params.context),
    "",
    "Tool outputs:",
    ...params.toolOutputs.map((tool) => `- ${tool.name}: ${tool.summary}`),
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

  // Try Gemini first
  if (params.apiKey) {
    try {
      const geminiResult = await generateWithGemini(params.apiKey, params.preferredModel, prompt)
      if (geminiResult) {
        return {
          response: geminiResult.text,
          modelUsed: geminiResult.modelUsed
        }
      }
    } catch {
      console.error("[BurryAI] Gemini generation threw, falling through to Workers AI")
    }
  }

  // Try Cloudflare Workers AI as fallback
  if (params.aiBinding) {
    try {
      const cfModel = "@cf/meta/llama-3.1-8b-instruct"
      const cfResult = await params.aiBinding.run(cfModel, {
        messages: [
          { role: "system", content: "You are BurryAI, a financial advisor for students. Give concise, actionable advice. Use short paragraphs, bullet points, and numbered action steps. Do not use markdown heading syntax (#)." },
          { role: "user", content: prompt }
        ],
        max_tokens: 2048,
        temperature: 0.7
      }) as { response?: string }

      if (cfResult?.response && cfResult.response.trim().length > 0) {
        return {
          response: cfResult.response.trim(),
          modelUsed: "workers-ai:llama-3.1-8b-instruct"
        }
      }
    } catch (cfError) {
      const msg = cfError instanceof Error ? cfError.message : String(cfError)
      console.error(`[BurryAI] Workers AI fallback error: ${msg}`)
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

