'use client'

import { useEffect, useState } from 'react'

import { CostCutter } from '@/components/dashboard/features/CostCutter/CostCutter'
import FinanceLoader from '@/components/ui/FinanceLoader'
import { useAuth } from '@/contexts/AuthContext'
import { getDashboardExpenseSummary, getFinancialProfile, getFinancialSummary } from '@/lib/financial-client'

type CostData = {
  monthlyIncome: number
  monthlyExpenses: number
  country: string
  categories: Array<{ category: string; amount: number; percentage: number }>
}

export default function DashboardCostCutterPage() {
  const { isGuest, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState<CostData>({
    monthlyIncome: 0,
    monthlyExpenses: 0,
    country: 'United States',
    categories: []
  })

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
        const [summary, profile, expenseSummary] = await Promise.all([
          getFinancialSummary(),
          getFinancialProfile(),
          getDashboardExpenseSummary()
        ])

        setData({
          monthlyIncome: summary.total_income,
          monthlyExpenses: summary.total_expenses,
          country: profile.country || 'United States',
          categories: expenseSummary.summary.by_category
        })
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load cost cutter')
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
    <div className="space-y-4 min-h-[calc(100vh-10rem)]">
      {error ? (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
      ) : null}
      <CostCutter userData={data} />
    </div>
  )
}
