'use client'

import { useEffect, useState } from 'react'

import { HolographicCard } from '@/components/dashboard/HolographicUI'
import { FinancialTimeline } from '@/components/dashboard/features/Timeline/FinancialTimeline'
import FinanceLoader from '@/components/ui/FinanceLoader'
import { useAuth } from '@/contexts/AuthContext'
import { getDashboardTimeline, getFinancialSummary, getLoans, type LoanItem } from '@/lib/financial-client'

type TimelineData = {
  loanAmount: number
  monthlyIncome: number
  monthlyExpenses: number
  loans: LoanItem[]
}

export default function DashboardTimelinePage() {
  const { isGuest, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState<TimelineData>({
    loanAmount: 0,
    monthlyIncome: 0,
    monthlyExpenses: 0,
    loans: []
  })
  const [events, setEvents] = useState<
    Array<{
      id: string
      type: 'loan_payment_due' | 'expense_logged'
      date: string
      title: string
      amount: number
      status: 'upcoming' | 'recorded'
    }>
  >([])

  useEffect(() => {
    if (authLoading) return

    if (isGuest) {
      setLoading(false)
      return
    }

    const run = async () => {
      setLoading(true)
      setError('')
      try {
        const [summary, loanData, timelineData] = await Promise.all([
          getFinancialSummary(),
          getLoans(),
          getDashboardTimeline()
        ])

        setData({
          loanAmount: summary.total_loan_balance,
          monthlyIncome: summary.total_income,
          monthlyExpenses: summary.total_expenses,
          loans: loanData.loans
        })
        setEvents(timelineData.timeline)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load timeline')
      } finally {
        setLoading(false)
      }
    }

    void run()
  }, [authLoading, isGuest])

  if (authLoading || loading) {
    return <FinanceLoader />
  }

  return (
    <div className="space-y-6 min-h-[calc(100vh-10rem)]">
      {error ? (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
      ) : null}

      <FinancialTimeline userData={data} />

      <HolographicCard>
        <h3 className="mb-3 text-lg font-semibold">Backend Timeline Events</h3>
        <div className="space-y-3">
          {events.length === 0 ? (
            <p className="text-sm text-slate-400">No timeline events available yet.</p>
          ) : (
            events.slice(0, 10).map((event) => (
              <div key={event.id} className="rounded-lg border border-slate-700/60 bg-slate-900/60 p-3">
                <p className="font-medium">{event.title}</p>
                <p className="text-sm text-slate-300">${event.amount.toLocaleString()}</p>
                <p className="text-xs text-slate-400">
                  {event.date} | {event.status}
                </p>
              </div>
            ))
          )}
        </div>
      </HolographicCard>
    </div>
  )
}
