import { z } from "zod"
import type { AgentContextData, AgentToolName, AgentToolOutput } from "../agent/state"
import type { SearchProviderEnv } from "../web/search.provider"

export const baseToolInputSchema = z.object({
  userId: z.string().trim().min(1),
  context: z.custom<AgentContextData>(),
  userMessage: z.string().optional()
})

export type ToolExecutionContext = {
  db: D1Database
  searchEnv?: SearchProviderEnv
  expenseCategoriesOverride?: AgentContextData["topExpenseCategories"]
}

export type ToolDefinition<TInput extends z.ZodType, TOutput extends z.ZodType> = {
  name: AgentToolName
  description: string
  inputSchema: TInput
  outputSchema: TOutput
  run: (input: z.infer<TInput>, ctx: ToolExecutionContext) => Promise<z.infer<TOutput>>
  summarize: (output: z.infer<TOutput>) => string
}

export type ToolRegistry = Record<AgentToolName, ToolDefinition<z.ZodType, z.ZodType>>

export function createToolOutput(
  name: AgentToolName,
  summary: string,
  output: unknown
): AgentToolOutput {
  return {
    name,
    summary,
    output
  }
}
