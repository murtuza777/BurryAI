const API_BASE = (() => {
  const directApiBase =
    process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_WORKER_API_BASE_URL
  const useDirectWorkerApi = process.env.NEXT_PUBLIC_USE_DIRECT_WORKER_API === "true"
  const base = useDirectWorkerApi && directApiBase ? directApiBase : "/api"
  return base.replace(/\/+$/, "")
})()

export type RiskTolerance = "low" | "moderate" | "high"
export type WorkMode = "local" | "remote" | "hybrid"

export interface FinancialProfile {
  full_name: string
  country: string
  student_status: string
  university: string
  profession: string
  skills: string[]
  other_talents: string[]
  preferred_work_mode: WorkMode
  city: string
  state_region: string
  remote_regions: string[]
  opportunity_radius_km: number
  min_hourly_rate: number
  onboarding_completed: boolean
  monthly_income: number
  currency: string
  savings_goal: number
  risk_tolerance: RiskTolerance
}

export interface FinancialSummary {
  total_income: number
  total_expenses: number
  monthly_loan_payments: number
  remaining_balance: number
  expense_ratio: number
  debt_to_income_ratio: number
  total_loan_balance: number
  loans_count: number
  expenses_count: number
  financial_health_score: number
}

export interface ExpenseItem {
  id: string
  user_id: string
  amount: number
  category: string
  description: string | null
  date: string
  created_at: string
  updated_at: string
}

export interface LoanItem {
  id: string
  user_id: string
  loan_name: string
  principal_amount: number
  interest_rate: number
  minimum_payment: number
  remaining_balance: number
  due_date: string | null
  created_at: string
  updated_at: string
}

export interface DashboardExpenseSummary {
  summary: {
    total_expenses: number
    monthly_income: number
    remaining_balance: number
    by_category: Array<{
      category: string
      amount: number
      percentage: number
    }>
  }
}

export interface DashboardFinancialScore {
  score: number
  grade: "A" | "B" | "C" | "D" | "F"
  metrics: {
    total_income: number
    total_expenses: number
    monthly_loan_payments: number
    remaining_balance: number
    expense_ratio: number
    debt_to_income_ratio: number
  }
}

export interface DashboardCharts {
  charts: {
    expenseByCategory: Array<{ name: string; value: number }>
    monthlyTrend: Array<{ month: string; expenses: number; income: number; loanPayments: number; net: number }>
    cashflowBreakdown: Array<{ name: string; value: number }>
  }
}

export interface DashboardTimeline {
  timeline: Array<{
    id: string
    type: "loan_payment_due" | "expense_logged"
    date: string
    title: string
    amount: number
    status: "upcoming" | "recorded"
  }>
}

export interface AgentAdviceResponse {
  response: string
  model_used: string
  intent: "budgeting" | "debt" | "savings" | "income" | "general"
  used_tools: Array<
    | "getFinancialProfile"
    | "getExpenses"
    | "costCutter"
    | "financialHealth"
    | "loanOptimizer"
    | "incomeOpportunities"
  >
  knowledge_sources: Array<{ title: string; source: string }>
  web_sources: Array<{ title: string; url: string; source: "tavily" | "serper" | "none" }>
  tool_summaries: Array<{ name: string; summary: string }>
  rag: {
    vectorize_enabled: boolean
    knowledge_count: number
    web_count: number
    web_search_triggered: boolean
  }
}

type ErrorResponse = {
  error?: string
}

const NETWORK_RETRY_DELAYS_MS = [250, 500]

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function parseError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as ErrorResponse
    if (payload.error) return payload.error
  } catch {
    // Ignore and use fallback.
  }

  return `Request failed with status ${response.status}`
}

async function requestWithRetry(input: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; attempt <= NETWORK_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await fetch(input, init)
    } catch (error) {
      if (attempt === NETWORK_RETRY_DELAYS_MS.length) {
        break
      }
      await sleep(NETWORK_RETRY_DELAYS_MS[attempt])
    }
  }

  throw new Error("Unable to load data right now. Please retry in a few seconds.")
}

async function apiRequest(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await requestWithRetry(`${API_BASE}/${path}`, {
      credentials: "include",
      ...init
    })
  } catch (error) {
    if (error instanceof Error) throw error
    throw new Error("Unable to load data right now. Please retry in a few seconds.")
  }
}

export async function getFinancialProfile(): Promise<FinancialProfile> {
  const response = await apiRequest("profile", { method: "GET" })
  if (!response.ok) throw new Error(await parseError(response))
  const payload = (await response.json()) as { profile: FinancialProfile }
  return payload.profile
}

export async function updateFinancialProfile(
  updates: Partial<FinancialProfile>
): Promise<FinancialProfile> {
  const response = await apiRequest("profile", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(updates)
  })
  if (!response.ok) throw new Error(await parseError(response))
  const payload = (await response.json()) as { profile: FinancialProfile }
  return payload.profile
}

export async function getFinancialSummary(): Promise<FinancialSummary> {
  const response = await apiRequest("financial-summary", { method: "GET" })
  if (!response.ok) throw new Error(await parseError(response))
  const payload = (await response.json()) as { summary: FinancialSummary }
  return payload.summary
}

export async function getExpenses(): Promise<{ monthly_income: number; expenses: ExpenseItem[] }> {
  const response = await apiRequest("expenses", { method: "GET" })
  if (!response.ok) throw new Error(await parseError(response))
  return (await response.json()) as { monthly_income: number; expenses: ExpenseItem[] }
}

export async function createExpense(input: {
  amount: number
  category: string
  description?: string
  date?: string
}): Promise<ExpenseItem> {
  const response = await apiRequest("expenses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  })
  if (!response.ok) throw new Error(await parseError(response))
  const payload = (await response.json()) as { expense: ExpenseItem }
  return payload.expense
}

export async function getLoans(): Promise<{ monthly_income: number; loans: LoanItem[] }> {
  const response = await apiRequest("loans", { method: "GET" })
  if (!response.ok) throw new Error(await parseError(response))
  return (await response.json()) as { monthly_income: number; loans: LoanItem[] }
}

export async function createLoan(input: {
  loan_name?: string
  loan_amount: number
  interest_rate: number
  monthly_payment: number
  remaining_balance?: number
  next_payment_date?: string
}): Promise<LoanItem> {
  const response = await apiRequest("loans", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  })
  if (!response.ok) throw new Error(await parseError(response))
  const payload = (await response.json()) as { loan: LoanItem }
  return payload.loan
}

export async function getDashboardExpenseSummary(): Promise<DashboardExpenseSummary> {
  const response = await apiRequest("dashboard/expense-summary", { method: "GET" })
  if (!response.ok) throw new Error(await parseError(response))
  return (await response.json()) as DashboardExpenseSummary
}

export async function getDashboardFinancialScore(): Promise<DashboardFinancialScore> {
  const response = await apiRequest("dashboard/financial-score", { method: "GET" })
  if (!response.ok) throw new Error(await parseError(response))
  return (await response.json()) as DashboardFinancialScore
}

export async function getDashboardCharts(): Promise<DashboardCharts> {
  const response = await apiRequest("dashboard/charts", { method: "GET" })
  if (!response.ok) throw new Error(await parseError(response))
  return (await response.json()) as DashboardCharts
}

export async function getDashboardTimeline(): Promise<DashboardTimeline> {
  const response = await apiRequest("dashboard/timeline", { method: "GET" })
  if (!response.ok) throw new Error(await parseError(response))
  return (await response.json()) as DashboardTimeline
}

export async function getAgentAdvice(message: string): Promise<AgentAdviceResponse> {
  const response = await apiRequest("agent/advice", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ message })
  })
  if (!response.ok) throw new Error(await parseError(response))
  return (await response.json()) as AgentAdviceResponse
}

export interface CostAnalysisResponse {
  analysis: string
  model_used: string
  context: {
    monthlyIncome: number
    monthlyExpenses: number
    remainingBalance: number
    expenseRatio: number
    financialHealthScore: number
    topExpenseCategories: Array<{ category: string; amount: number }>
  }
  used_tools: string[]
  knowledge_sources: Array<{ title: string; source: string }>
}

export interface OpportunitySearchInput {
  query?: string
  mode?: "auto" | WorkMode
  include_internships?: boolean
  include_part_time?: boolean
  include_freelance?: boolean
  remote_regions?: string[]
  radius_km?: number
  max_results?: number
}

export interface OpportunitySearchResponse {
  opportunities: Array<{
    id: string
    title: string
    url: string
    source: "tavily" | "serper" | "none"
    snippet: string
    location: string
    work_mode: "local" | "remote" | "hybrid" | "unknown"
    opportunity_type: "internship" | "part-time" | "freelance" | "job" | "gig" | "unknown"
    score: number
    matched_skills: string[]
    match_reasons: string[]
    near_user_location: boolean
    remote_friendly: boolean
  }>
  filters_applied: {
    mode: "local" | "remote" | "hybrid"
    include_internships: boolean
    include_part_time: boolean
    include_freelance: boolean
    remote_regions: string[]
    radius_km: number
  }
  profile_summary: {
    profession: string
    skills: string[]
    location: {
      city: string
      state_region: string
      country: string
      university: string
    }
    preferred_work_mode: WorkMode
  }
  generated_queries: string[]
}

export async function getCostAnalysis(): Promise<CostAnalysisResponse> {
  const response = await apiRequest("agent/cost-analysis", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    }
  })
  if (!response.ok) throw new Error(await parseError(response))
  return (await response.json()) as CostAnalysisResponse
}

export async function searchOpportunities(
  input: OpportunitySearchInput
): Promise<OpportunitySearchResponse> {
  const response = await apiRequest("opportunities/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  })
  if (!response.ok) throw new Error(await parseError(response))
  return (await response.json()) as OpportunitySearchResponse
}

export async function deleteExpense(id: string): Promise<void> {
  const response = await apiRequest(`expenses/${id}`, { method: "DELETE" })
  if (!response.ok) throw new Error(await parseError(response))
}

export async function deleteLoan(id: string): Promise<void> {
  const response = await apiRequest(`loans/${id}`, { method: "DELETE" })
  if (!response.ok) throw new Error(await parseError(response))
}
