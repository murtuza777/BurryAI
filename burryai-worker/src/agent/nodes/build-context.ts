import type { AgentContextData } from "../state"
import { buildFinancialSummary, calculateFinancialHealthScore } from "../../services/analytics"

type CategoryRow = {
  category: string
  amount: number
}

type ContextOverride = {
  monthlyIncome?: number
  topExpenseCategories?: Array<{
    category: string
    amount: number
  }>
}

function normalizeCategories(
  categories: Array<{
    category: string
    amount: number
  }>
): AgentContextData["topExpenseCategories"] {
  return categories
    .map((item) => ({
      category: item.category.trim(),
      amount: Number(item.amount.toFixed(2))
    }))
    .filter((item) => item.category.length > 0 && item.amount > 0)
    .sort((a, b) => b.amount - a.amount)
}

export function applyContextOverrides(
  baseContext: AgentContextData,
  overrides?: ContextOverride
): AgentContextData {
  if (!overrides) {
    return baseContext
  }

  const monthlyIncome = overrides.monthlyIncome ?? baseContext.monthlyIncome
  const topExpenseCategories = overrides.topExpenseCategories
    ? normalizeCategories(overrides.topExpenseCategories)
    : baseContext.topExpenseCategories
  const monthlyExpenses = overrides.topExpenseCategories
    ? Number(topExpenseCategories.reduce((sum, item) => sum + item.amount, 0).toFixed(2))
    : baseContext.monthlyExpenses
  const remainingBalance = Number(
    (monthlyIncome - monthlyExpenses - baseContext.monthlyLoanPayments).toFixed(2)
  )
  const expenseRatio = Number(
    (monthlyIncome > 0 ? (monthlyExpenses / monthlyIncome) * 100 : 0).toFixed(2)
  )
  const debtToIncomeRatio = Number(
    (monthlyIncome > 0 ? (baseContext.monthlyLoanPayments / monthlyIncome) * 100 : 0).toFixed(2)
  )
  const financialHealthScore = calculateFinancialHealthScore({
    monthlyIncome,
    monthlyExpenses,
    monthlyLoanPayments: baseContext.monthlyLoanPayments
  })

  return {
    ...baseContext,
    monthlyIncome: Number(monthlyIncome.toFixed(2)),
    monthlyExpenses,
    remainingBalance,
    expenseRatio,
    debtToIncomeRatio,
    financialHealthScore,
    topExpenseCategories
  }
}

export async function buildAgentContext(db: D1Database, userId: string): Promise<AgentContextData> {
  const [summary, categories] = await Promise.all([
    buildFinancialSummary(db, userId),
    db.prepare(
      "SELECT category, COALESCE(SUM(amount), 0) AS amount FROM expenses WHERE user_id = ?1 GROUP BY category ORDER BY amount DESC LIMIT 5"
    )
      .bind(userId)
      .all<CategoryRow>()
  ])

  return {
    monthlyIncome: summary.total_income,
    monthlyExpenses: summary.total_expenses,
    monthlyLoanPayments: summary.monthly_loan_payments,
    remainingBalance: summary.remaining_balance,
    expenseRatio: summary.expense_ratio,
    debtToIncomeRatio: summary.debt_to_income_ratio,
    financialHealthScore: summary.financial_health_score,
    topExpenseCategories: (categories.results ?? []).map((row) => ({
      category: row.category,
      amount: Number(row.amount.toFixed(2))
    })),
    totalLoanBalance: summary.total_loan_balance
  }
}
