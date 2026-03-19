import type { AgentIntent, AgentToolName } from "../state"

export function selectToolsByIntent(intent: AgentIntent): AgentToolName[] {
  switch (intent) {
    case "budgeting":
      return ["getFinancialProfile", "getExpenses", "costCutter", "financialHealth"]
    case "debt":
      return ["getFinancialProfile", "loanOptimizer", "financialHealth"]
    case "savings":
      return ["getFinancialProfile", "costCutter", "financialHealth"]
    case "income":
      return ["getFinancialProfile", "financialHealth", "costCutter", "incomeOpportunities"]
    default:
      return ["getFinancialProfile", "getExpenses", "loanOptimizer", "financialHealth"]
  }
}
