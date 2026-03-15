'use client'

import { useEffect, useState } from 'react'
import { AIAdvisor } from '@/components/dashboard/features/AIAdvisor/AIAdvisor'
import FinanceLoader from '@/components/ui/FinanceLoader'
import { useAuth } from '@/contexts/AuthContext'
import { getFinancialProfile, getFinancialSummary } from '@/lib/financial-client'

type AdvisorData = {
  monthlyIncome: number
  monthlyExpenses: number
  country: string
}

export default function DashboardAdvisorPage() {
  const { user, guestUser, isGuest, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [advisorData, setAdvisorData] = useState<AdvisorData>({
    monthlyIncome: 0,
    monthlyExpenses: 0,
    country: 'United States'
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
        const [profile, summary] = await Promise.all([getFinancialProfile(), getFinancialSummary()])
        setAdvisorData({
          monthlyIncome: summary.total_income,
          monthlyExpenses: summary.total_expenses,
          country: profile.country || 'United States'
        })
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load advisor data')
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

      <div className="h-[calc(100vh-11.5rem)] min-h-[560px]">
        <AIAdvisor
          userData={advisorData}
          layout="fullscreen"
          storageNamespace={user?.id ?? (guestUser?.name ? `guest-${guestUser.name}` : 'guest')}
        />
      </div>
    </div>
  )
}
