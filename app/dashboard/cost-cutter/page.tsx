'use client'

import { useEffect, useState } from 'react'

import { CostCutter } from '@/components/dashboard/features/CostCutter/CostCutter'
import FinanceLoader from '@/components/ui/FinanceLoader'
import { useAuth } from '@/contexts/AuthContext'
import { getExpenses, getFinancialProfile } from '@/lib/financial-client'
import { buildProfileSpendingCategories } from '@/lib/profile-spending'

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
        const [profile, expenseData] = await Promise.all([
          getFinancialProfile(),
          getExpenses()
        ])
        const categories = buildProfileSpendingCategories(expenseData.expenses)
        const monthlyExpenses = categories.reduce((sum, item) => sum + item.amount, 0)

        setData({
          monthlyIncome: profile.monthly_income,
          monthlyExpenses,
          country: profile.country || 'United States',
          categories
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
    <div className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
      ) : null}
      <CostCutter userData={data} isGuest={isGuest} />
    </div>
  )
}
