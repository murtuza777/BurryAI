import type { AgentContextData, AgentToolName, AgentToolOutput } from "../state"
import { executeTools } from "../../tools"

export async function runSelectedTools(params: {
  db: D1Database
  userId: string
  selectedTools: AgentToolName[]
  context: AgentContextData
  userMessage: string
  searchEnv?: {
    provider?: string
    tavilyApiKey?: string
    serperApiKey?: string
  }
}): Promise<AgentToolOutput[]> {
  return executeTools({
    db: params.db,
    userId: params.userId,
    context: params.context,
    selectedTools: params.selectedTools,
    userMessage: params.userMessage,
    searchEnv: params.searchEnv
  })
}
