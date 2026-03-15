export type AgentIntent = "budgeting" | "debt" | "savings" | "income" | "general"

export type AgentToolName =
  | "getFinancialProfile"
  | "getExpenses"
  | "costCutter"
  | "financialHealth"
  | "loanOptimizer"

export type AgentContextData = {
  monthlyIncome: number
  monthlyExpenses: number
  monthlyLoanPayments: number
  remainingBalance: number
  expenseRatio: number
  debtToIncomeRatio: number
  financialHealthScore: number
  topExpenseCategories: Array<{
    category: string
    amount: number
  }>
  totalLoanBalance: number
}

export type AgentToolOutput = {
  name: AgentToolName
  summary: string
  output: unknown
}

export type AgentKnowledgeChunk = {
  id: string
  title: string
  source: string
  content: string
  score: number
}

export type AgentWebResult = {
  title: string
  url: string
  snippet: string
  source: "tavily" | "serper" | "none"
}

export type AgentState = {
  userId: string
  userMessage: string
  intent: AgentIntent
  context: AgentContextData
  selectedTools: AgentToolName[]
  toolOutputs: AgentToolOutput[]
  knowledgeChunks: AgentKnowledgeChunk[]
  webResults: AgentWebResult[]
  webSearchTriggered: boolean
  response: string
  modelUsed: string
}
