'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CreditCard, PieChart, TrendingUp, Trash2, Wallet } from 'lucide-react'
import { Doughnut, Line } from 'react-chartjs-2'
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip
} from 'chart.js'

import { HolographicCard } from '@/components/dashboard/HolographicUI'
import FinanceLoader from '@/components/ui/FinanceLoader'
import { useAuth } from '@/contexts/AuthContext'
import {
  deleteExpense,
  deleteLoan,
  getDashboardCharts,
  getDashboardFinancialScore,
  getExpenses,
  getFinancialSummary,
  getLoans,
  type ExpenseItem,
  type FinancialSummary,
  type LoanItem
} from '@/lib/financial-client'

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
)

const DEFAULT_SUMMARY: FinancialSummary = {
  total_income: 0,
  total_expenses: 0,
  monthly_loan_payments: 0,
  remaining_balance: 0,
  expense_ratio: 0,
  debt_to_income_ratio: 0,
  total_loan_balance: 0,
  loans_count: 0,
  expenses_count: 0,
  financial_health_score: 0
}

export default function DashboardOverviewPage() {
  const { user, guestUser, isGuest, loading: authLoading } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState<FinancialSummary>(DEFAULT_SUMMARY)
  const [dashboardScore, setDashboardScore] = useState<{ score: number; grade: string }>({
    score: 0,
    grade: 'F'
  })
  const [dashboardCharts, setDashboardCharts] = useState<{
    expenseByCategory: Array<{ name: string; value: number }>
    monthlyTrend: Array<{ month: string; expenses: number; income: number; loanPayments: number; net: number }>
    cashflowBreakdown: Array<{ name: string; value: number }>
  }>({
    expenseByCategory: [],
    monthlyTrend: [],
    cashflowBreakdown: []
  })
  const [expenses, setExpenses] = useState<ExpenseItem[]>([])
  const [loans, setLoans] = useState<LoanItem[]>([])

  const loadData = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      if (!user && isGuest) {
        setSummary(DEFAULT_SUMMARY)
        setExpenses([])
        setLoans([])
        setDashboardScore({ score: 0, grade: 'F' })
        setDashboardCharts({ expenseByCategory: [], monthlyTrend: [], cashflowBreakdown: [] })
        return
      }

      const [summaryData, expenseData, loanData, scoreData, chartsData] = await Promise.all([
        getFinancialSummary(),
        getExpenses(),
        getLoans(),
        getDashboardFinancialScore(),
        getDashboardCharts()
      ])

      setSummary(summaryData)
      setExpenses(expenseData.expenses)
      setLoans(loanData.loans)
      setDashboardScore({
        score: scoreData.score,
        grade: scoreData.grade
      })
      setDashboardCharts(chartsData.charts)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }, [isGuest, user])

  useEffect(() => {
    if (authLoading) return
    void loadData()
  }, [authLoading, loadData])

  async function handleDeleteExpense(id: string) {
    try {
      await deleteExpense(id)
      await loadData()
    } catch (delError) {
      setError(delError instanceof Error ? delError.message : 'Failed to delete expense')
    }
  }

  async function handleDeleteLoan(id: string) {
    try {
      await deleteLoan(id)
      await loadData()
    } catch (delError) {
      setError(delError instanceof Error ? delError.message : 'Failed to delete loan')
    }
  }

  const cashFlowChartData = useMemo(() => {
    if (dashboardCharts.cashflowBreakdown.length > 0) {
      const breakdownMap = new Map(dashboardCharts.cashflowBreakdown.map((item) => [item.name, item.value]))
      const expensesValue = Number(breakdownMap.get('Expenses') ?? 0)
      const loanPaymentsValue = Number(breakdownMap.get('Loan Payments') ?? 0)
      const remainingValue = Number(breakdownMap.get('Remaining') ?? 0)
      return {
        labels: ['Expenses', 'Loan Payments', 'Remaining'],
        datasets: [
          {
            data: [expensesValue, loanPaymentsValue, Math.max(remainingValue, 0)],
            backgroundColor: ['rgba(239, 68, 68, 0.75)', 'rgba(245, 158, 11, 0.75)', 'rgba(16, 185, 129, 0.8)'],
            borderColor: ['rgba(239, 68, 68, 1)', 'rgba(245, 158, 11, 1)', 'rgba(16, 185, 129, 1)'],
            borderWidth: 1
          }
        ]
      }
    }

    const remaining = Math.max(summary.remaining_balance, 0)
    return {
      labels: ['Expenses', 'Loan Payments', 'Remaining'],
      datasets: [
        {
          data: [summary.total_expenses, summary.monthly_loan_payments, remaining],
          backgroundColor: ['rgba(239, 68, 68, 0.75)', 'rgba(245, 158, 11, 0.75)', 'rgba(16, 185, 129, 0.8)'],
          borderColor: ['rgba(239, 68, 68, 1)', 'rgba(245, 158, 11, 1)', 'rgba(16, 185, 129, 1)'],
          borderWidth: 1
        }
      ]
    }
  }, [dashboardCharts.cashflowBreakdown, summary.monthly_loan_payments, summary.remaining_balance, summary.total_expenses])

  const projectionChartData = useMemo(() => {
    if (dashboardCharts.monthlyTrend.length > 0) {
      return {
        labels: dashboardCharts.monthlyTrend.map((item) => item.month),
        datasets: [
          {
            label: 'Projected Net Balance',
            data: dashboardCharts.monthlyTrend.map((item) => item.net),
            borderColor: 'rgba(34, 211, 238, 1)',
            backgroundColor: 'rgba(34, 211, 238, 0.2)',
            fill: true,
            tension: 0.35
          }
        ]
      }
    }

    const monthlyNet = summary.remaining_balance
    const points = Array.from({ length: 6 }, (_, index) => Math.round(monthlyNet * (index + 1)))

    return {
      labels: ['Month 1', 'Month 2', 'Month 3', 'Month 4', 'Month 5', 'Month 6'],
      datasets: [
        {
          label: 'Projected Net Balance',
          data: points,
          borderColor: 'rgba(34, 211, 238, 1)',
          backgroundColor: 'rgba(34, 211, 238, 0.2)',
          fill: true,
          tension: 0.35
        }
      ]
    }
  }, [dashboardCharts.monthlyTrend, summary.remaining_balance])

  const displayName = useMemo(() => {
    if (guestUser?.name) return guestUser.name
    if (user?.email) return user.email.split('@')[0]
    return 'Student'
  }, [guestUser?.name, user?.email])

  if (authLoading || loading) {
    return <FinanceLoader />
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800/80 bg-slate-950/50 px-4 py-4 sm:px-5 sm:py-5">
        <p className="text-xs uppercase tracking-[0.28em] text-cyan-300/80">Dashboard</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">Welcome, {displayName}</h1>
      </section>

      {error ? (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-rose-200">{error}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <HolographicCard>
          <p className="flex items-center gap-2 text-sm text-slate-300">
            <Wallet className="h-4 w-4 text-cyan-300" />
            Total Income
          </p>
          <p className="mt-2 break-words text-3xl font-semibold sm:text-4xl">${summary.total_income.toLocaleString()}</p>
        </HolographicCard>

        <HolographicCard>
          <p className="flex items-center gap-2 text-sm text-slate-300">
            <PieChart className="h-4 w-4 text-rose-300" />
            Total Expenses
          </p>
          <p className="mt-2 break-words text-3xl font-semibold sm:text-4xl">${summary.total_expenses.toLocaleString()}</p>
        </HolographicCard>

        <HolographicCard>
          <p className="flex items-center gap-2 text-sm text-slate-300">
            <CreditCard className="h-4 w-4 text-amber-300" />
            Loan Payments
          </p>
          <p className="mt-2 break-words text-3xl font-semibold sm:text-4xl">${summary.monthly_loan_payments.toLocaleString()}</p>
        </HolographicCard>

        <HolographicCard>
          <p className="flex items-center gap-2 text-sm text-slate-300">
            <TrendingUp className="h-4 w-4 text-emerald-300" />
            Health Score
          </p>
          <p className="mt-2 break-words text-3xl font-semibold sm:text-4xl">{dashboardScore.score}/100</p>
          <p className="mt-1 text-xs text-slate-300">Grade {dashboardScore.grade}</p>
        </HolographicCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <HolographicCard>
          <h3 className="mb-4 text-xl font-semibold">Monthly Cash Flow Mix</h3>
          <div className="h-64 sm:h-72">
            <Doughnut
              data={cashFlowChartData}
              options={{
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    labels: { color: '#e2e8f0' }
                  }
                }
              }}
            />
          </div>
        </HolographicCard>

        <HolographicCard>
          <h3 className="mb-4 text-xl font-semibold">6-Month Projection</h3>
          <div className="h-64 sm:h-72">
            <Line
              data={projectionChartData}
              options={{
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    labels: { color: '#e2e8f0' }
                  }
                },
                scales: {
                  x: {
                    ticks: { color: '#e2e8f0' },
                    grid: { color: 'rgba(148, 163, 184, 0.18)' }
                  },
                  y: {
                    ticks: {
                      color: '#e2e8f0',
                      callback: (value) => `$${value.toLocaleString()}`
                    },
                    grid: { color: 'rgba(148, 163, 184, 0.18)' }
                  }
                }
              }}
            />
          </div>
        </HolographicCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <HolographicCard>
          <h3 className="mb-3 text-lg font-semibold">Recent Expenses</h3>
          <div className="max-h-80 space-y-3 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
            {expenses.length === 0 ? (
              <p className="text-sm text-slate-400">No expenses logged yet.</p>
            ) : (
              expenses.slice(0, 10).map((expense) => (
                <div
                  key={expense.id}
                  className="group flex items-start justify-between gap-2 rounded-lg border border-slate-700/60 bg-slate-900/60 p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{expense.category}</p>
                    <p className="text-sm text-slate-300">${expense.amount.toLocaleString()}</p>
                    {expense.description ? <p className="break-words text-xs text-slate-500">{expense.description}</p> : null}
                    <p className="text-xs text-slate-400">{expense.date}</p>
                  </div>
                  <button
                    onClick={() => void handleDeleteExpense(expense.id)}
                    className="shrink-0 rounded-md p-1.5 text-slate-500 opacity-100 transition-colors hover:bg-rose-500/10 hover:text-rose-400 sm:opacity-0 sm:group-hover:opacity-100"
                    title="Delete expense"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </HolographicCard>

        <HolographicCard>
          <h3 className="mb-3 text-lg font-semibold">Loan Snapshot</h3>
          <div className="max-h-80 space-y-3 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
            {loans.length === 0 ? (
              <p className="text-sm text-slate-400">No loans recorded yet.</p>
            ) : (
              loans.slice(0, 10).map((loan) => (
                <div
                  key={loan.id}
                  className="group flex items-start justify-between gap-2 rounded-lg border border-slate-700/60 bg-slate-900/60 p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{loan.loan_name}</p>
                    <p className="text-sm text-slate-300">Balance: ${loan.remaining_balance.toLocaleString()}</p>
                    <p className="text-xs text-slate-400">Min payment: ${loan.minimum_payment.toLocaleString()}</p>
                  </div>
                  <button
                    onClick={() => void handleDeleteLoan(loan.id)}
                    className="shrink-0 rounded-md p-1.5 text-slate-500 opacity-100 transition-colors hover:bg-rose-500/10 hover:text-rose-400 sm:opacity-0 sm:group-hover:opacity-100"
                    title="Delete loan"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </HolographicCard>
      </div>
    </div>
  )
}
