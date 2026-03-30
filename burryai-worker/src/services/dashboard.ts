import { buildFinancialSummary, type FinancialSummary } from "./analytics"

type ExpenseByCategoryRow = {
  category: string
  amount: number
}

type MonthlyExpenseRow = {
  month: string
  amount: number
}

type LoanDueRow = {
  id: string
  loan_name: string
  due_date: string | null
  minimum_payment: number
}

function nextMonthPlanningDate(): string {
  const today = new Date()
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1)
  return nextMonth.toISOString().slice(0, 10)
}

type RecentExpenseRow = {
  id: string
  category: string
  date: string
  amount: number
}

function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7)
}

function monthsBack(count: number): string[] {
  const items: string[] = []
  const now = new Date()
  for (let i = count - 1; i >= 0; i -= 1) {
    const cursor = new Date(now.getFullYear(), now.getMonth() - i, 1)
    items.push(monthKey(cursor))
  }
  return items
}

function scoreGrade(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 85) return "A"
  if (score >= 70) return "B"
  if (score >= 55) return "C"
  if (score >= 40) return "D"
  return "F"
}

export async function getExpenseSummary(db: D1Database, userId: string): Promise<{
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
}> {
  const summary = await buildFinancialSummary(db, userId)

  const categoryRows = await db
    .prepare(
      "SELECT category, COALESCE(SUM(amount), 0) AS amount FROM expenses WHERE user_id = ?1 GROUP BY category ORDER BY amount DESC"
    )
    .bind(userId)
    .all<ExpenseByCategoryRow>()

  const categories = (categoryRows.results ?? []).map((row) => ({
    category: row.category,
    amount: Number(row.amount.toFixed(2)),
    percentage:
      summary.total_expenses > 0 ? Number(((row.amount / summary.total_expenses) * 100).toFixed(2)) : 0
  }))

  return {
    summary: {
      total_expenses: summary.total_expenses,
      monthly_income: summary.total_income,
      remaining_balance: summary.remaining_balance,
      by_category: categories
    }
  }
}

export async function getFinancialScore(db: D1Database, userId: string): Promise<{
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
}> {
  const summary = await buildFinancialSummary(db, userId)

  return {
    score: summary.financial_health_score,
    grade: scoreGrade(summary.financial_health_score),
    metrics: {
      total_income: summary.total_income,
      total_expenses: summary.total_expenses,
      monthly_loan_payments: summary.monthly_loan_payments,
      remaining_balance: summary.remaining_balance,
      expense_ratio: summary.expense_ratio,
      debt_to_income_ratio: summary.debt_to_income_ratio
    }
  }
}

export async function getChartsData(db: D1Database, userId: string): Promise<{
  charts: {
    expenseByCategory: Array<{ name: string; value: number }>
    monthlyTrend: Array<{ month: string; expenses: number; income: number; loanPayments: number; net: number }>
    cashflowBreakdown: Array<{ name: string; value: number }>
  }
}> {
  const summary = await buildFinancialSummary(db, userId)
  const recentMonths = monthsBack(6)

  const [categoriesResult, monthlyResult, loanPaymentRow] = await Promise.all([
    db.prepare(
      "SELECT category, COALESCE(SUM(amount), 0) AS amount FROM expenses WHERE user_id = ?1 GROUP BY category ORDER BY amount DESC"
    )
      .bind(userId)
      .all<ExpenseByCategoryRow>(),
    db.prepare(
      "SELECT substr(date, 1, 7) AS month, COALESCE(SUM(amount), 0) AS amount FROM expenses WHERE user_id = ?1 AND date >= date('now', 'start of month', '-5 months') GROUP BY substr(date, 1, 7) ORDER BY month ASC"
    )
      .bind(userId)
      .all<MonthlyExpenseRow>(),
    db.prepare(
      "SELECT COALESCE(SUM(minimum_payment), 0) AS monthly_loan_payments FROM loans WHERE user_id = ?1"
    )
      .bind(userId)
      .first<{ monthly_loan_payments: number }>()
  ])

  const expenseByMonth = new Map<string, number>()
  for (const row of monthlyResult.results ?? []) {
    expenseByMonth.set(row.month, Number(row.amount ?? 0))
  }

  const monthlyLoanPayments = Number(loanPaymentRow?.monthly_loan_payments ?? 0)
  const monthlyTrend = recentMonths.map((month) => {
    const expenses = Number((expenseByMonth.get(month) ?? 0).toFixed(2))
    const income = summary.total_income
    const net = Number((income - expenses - monthlyLoanPayments).toFixed(2))
    return {
      month,
      expenses,
      income,
      loanPayments: monthlyLoanPayments,
      net
    }
  })

  const expenseByCategory = (categoriesResult.results ?? []).map((row) => ({
    name: row.category,
    value: Number(row.amount.toFixed(2))
  }))

  const cashflowBreakdown = [
    { name: "Income", value: summary.total_income },
    { name: "Expenses", value: summary.total_expenses },
    { name: "Loan Payments", value: summary.monthly_loan_payments },
    { name: "Remaining", value: summary.remaining_balance }
  ]

  return {
    charts: {
      expenseByCategory,
      monthlyTrend,
      cashflowBreakdown
    }
  }
}

export async function getTimelineData(db: D1Database, userId: string): Promise<{
  timeline: Array<{
    id: string
    type: "loan_payment_due" | "expense_logged"
    date: string
    title: string
    amount: number
    status: "upcoming" | "recorded"
  }>
}> {
  const [loanRows, expenseRows] = await Promise.all([
    db.prepare(
      "SELECT id, loan_name, due_date, minimum_payment FROM loans WHERE user_id = ?1 ORDER BY COALESCE(due_date, '9999-12-31') ASC, created_at DESC LIMIT 12"
    )
      .bind(userId)
      .all<LoanDueRow>(),
    db.prepare(
      "SELECT id, category, date, amount FROM expenses WHERE user_id = ?1 ORDER BY date DESC, created_at DESC LIMIT 12"
    )
      .bind(userId)
      .all<RecentExpenseRow>()
  ])

  const loanEvents = (loanRows.results ?? []).map((row) => ({
    id: `loan-${row.id}`,
    type: "loan_payment_due" as const,
    date: row.due_date ?? nextMonthPlanningDate(),
    title: row.due_date ? `${row.loan_name} payment due` : `Set first payment date for ${row.loan_name}`,
    amount: Number(row.minimum_payment.toFixed(2)),
    status: "upcoming" as const
  }))

  const expenseEvents = (expenseRows.results ?? []).map((row) => ({
    id: `expense-${row.id}`,
    type: "expense_logged" as const,
    date: row.date,
    title: `${row.category} expense logged`,
    amount: Number(row.amount.toFixed(2)),
    status: "recorded" as const
  }))

  const timeline = [...loanEvents, ...expenseEvents]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 20)

  return {
    timeline
  }
}

export type DashboardSummaryForReuse = FinancialSummary
