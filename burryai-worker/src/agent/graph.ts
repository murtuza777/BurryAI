import { buildAgentContext } from "./nodes/build-context"
import { detectIntent } from "./nodes/detect-intent"
import { generateAgentResponse } from "./nodes/generate-response"
import { runSelectedTools } from "./nodes/run-tools"
import { selectToolsByIntent } from "./nodes/select-tools"
import { retrieveKnowledgeContext } from "../rag/retrieve"
import { searchWebForIncomeIdeas } from "../web/search.provider"
import type { AgentState } from "./state"

export async function runFinancialAgent(params: {
  db: D1Database
  userId: string
  userMessage: string
  geminiApiKey?: string
  geminiModel?: string
  knowledgeIndex?: Vectorize
  aiBinding?: {
    run: (model: string, input: unknown) => Promise<unknown>
  }
  embeddingModel?: string
  webSearchProvider?: string
  tavilyApiKey?: string
  serperApiKey?: string
}): Promise<AgentState> {
  const intent = detectIntent(params.userMessage)
  const context = await buildAgentContext(params.db, params.userId)
  const selectedTools = selectToolsByIntent(intent)
  const toolOutputs = await runSelectedTools({
    db: params.db,
    userId: params.userId,
    selectedTools,
    context,
    userMessage: params.userMessage,
    searchEnv: {
      provider: params.webSearchProvider,
      tavilyApiKey: params.tavilyApiKey,
      serperApiKey: params.serperApiKey
    }
  })
  const knowledgeChunks = await retrieveKnowledgeContext({
    query: params.userMessage,
    index: params.knowledgeIndex,
    ai: params.aiBinding,
    embeddingModel: params.embeddingModel,
    topK: 3
  })
  const webSearchTriggered = intent === "income" || knowledgeChunks.length === 0
  const webResults = await searchWebForIncomeIdeas({
    intent,
    message: params.userMessage,
    forceSearch: webSearchTriggered,
    env: {
      provider: params.webSearchProvider,
      tavilyApiKey: params.tavilyApiKey,
      serperApiKey: params.serperApiKey
    },
    topK: 3
  })
  const generation = await generateAgentResponse({
    apiKey: params.geminiApiKey,
    preferredModel: params.geminiModel,
    aiBinding: params.aiBinding,
    intent,
    userMessage: params.userMessage,
    context,
    toolOutputs,
    knowledgeChunks,
    webResults
  })

  return {
    userId: params.userId,
    userMessage: params.userMessage,
    intent,
    context,
    selectedTools,
    toolOutputs,
    knowledgeChunks,
    webResults,
    webSearchTriggered,
    response: generation.response,
    modelUsed: generation.modelUsed
  }
}
