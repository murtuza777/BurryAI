import type { AgentContextData, AgentToolName, AgentToolOutput } from "../agent/state"
import { costCutterTool } from "./cost-cutter"
import { financialHealthTool } from "./financial-health"
import { getExpensesTool } from "./get-expenses"
import { getFinancialProfileTool } from "./get-financial-profile"
import { incomeOpportunitiesTool } from "./income-opportunities"
import { loanOptimizerTool } from "./loan-optimizer"
import { createToolOutput, type ToolRegistry } from "./types"

const toolRegistry: ToolRegistry = {
  getFinancialProfile: getFinancialProfileTool,
  getExpenses: getExpensesTool,
  costCutter: costCutterTool,
  financialHealth: financialHealthTool,
  loanOptimizer: loanOptimizerTool,
  incomeOpportunities: incomeOpportunitiesTool
}

export function getToolRegistry(): ToolRegistry {
  return toolRegistry
}

export async function executeTools(params: {
  db: D1Database
  userId: string
  context: AgentContextData
  selectedTools: AgentToolName[]
  userMessage: string
  expenseCategoriesOverride?: AgentContextData["topExpenseCategories"]
  searchEnv?: {
    provider?: string
    tavilyApiKey?: string
    serperApiKey?: string
  }
}): Promise<AgentToolOutput[]> {
  const registry = getToolRegistry()
  const outputs: AgentToolOutput[] = []

  for (const name of params.selectedTools) {
    const tool = registry[name]
    const input = tool.inputSchema.parse({
      userId: params.userId,
      context: params.context,
      userMessage: params.userMessage
    })
    const rawOutput = await tool.run(input, {
      db: params.db,
      searchEnv: params.searchEnv,
      expenseCategoriesOverride: params.expenseCategoriesOverride
    })
    const parsedOutput = tool.outputSchema.parse(rawOutput)
    const summary = tool.summarize(parsedOutput)
    outputs.push(createToolOutput(name, summary, parsedOutput))
  }

  return outputs
}
