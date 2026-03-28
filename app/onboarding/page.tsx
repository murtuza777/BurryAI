'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import FinanceLoader from '@/components/ui/FinanceLoader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BrandIdentity } from '@/components/BrandIdentity'
import { useAuth } from '@/contexts/AuthContext'
import {
  createExpense,
  createLoan,
  getExpenses,
  getFinancialProfile,
  getLoans,
  updateFinancialProfile,
  type RiskTolerance
} from '@/lib/financial-client'

type FormState = {
  fullName: string
  country: string
  studentStatus: string
  university: string
  monthlyIncome: number
  savingsGoal: number
  riskTolerance: RiskTolerance
  monthlyExpenses: number
  loanAmount: number
  interestRate: number
  monthlyPayment: number
  nextPaymentDate: string
}

const DEFAULT_FORM: FormState = {
  fullName: '',
  country: '',
  studentStatus: 'undergraduate',
  university: '',
  monthlyIncome: 0,
  savingsGoal: 0,
  riskTolerance: 'moderate',
  monthlyExpenses: 0,
  loanAmount: 0,
  interestRate: 5.5,
  monthlyPayment: 0,
  nextPaymentDate: ''
}

export default function OnboardingPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const bootstrap = async () => {
      if (authLoading) return
      if (!user) {
        router.replace('/login')
        return
      }

      try {
        const profile = await getFinancialProfile()
        if (profile.onboarding_completed) {
          router.replace('/dashboard')
          return
        }

        setForm((prev) => ({
          ...prev,
          fullName: profile.full_name || '',
          country: profile.country || '',
          studentStatus: profile.student_status || 'undergraduate',
          university: profile.university || '',
          monthlyIncome: profile.monthly_income || 0,
          savingsGoal: profile.savings_goal || 0,
          riskTolerance: profile.risk_tolerance || 'moderate'
        }))
      } catch {
        // Keep defaults if profile is unavailable.
      } finally {
        setLoading(false)
      }
    }

    void bootstrap()
  }, [authLoading, router, user])

  const estimatedRemaining = useMemo(() => {
    return form.monthlyIncome - form.monthlyExpenses - form.monthlyPayment
  }, [form.monthlyExpenses, form.monthlyIncome, form.monthlyPayment])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSaving(true)

    try {
      await updateFinancialProfile({
        full_name: form.fullName.trim(),
        country: form.country.trim(),
        student_status: form.studentStatus.trim(),
        university: form.university.trim(),
        monthly_income: Number(form.monthlyIncome || 0),
        savings_goal: Number(form.savingsGoal || 0),
        risk_tolerance: form.riskTolerance,
        onboarding_completed: true
      })

      const [expenseData, loanData] = await Promise.all([getExpenses(), getLoans()])

      if (Number(form.monthlyExpenses) > 0 && expenseData.expenses.length === 0) {
        await createExpense({
          amount: Number(form.monthlyExpenses),
          category: 'Essential',
          description: 'Initial monthly expense estimate'
        })
      }

      if (Number(form.loanAmount) > 0 && loanData.loans.length === 0) {
        await createLoan({
          loan_name: 'Student Loan',
          loan_amount: Number(form.loanAmount),
          interest_rate: Number(form.interestRate || 0),
          monthly_payment: Number(form.monthlyPayment || 0),
          next_payment_date: form.nextPaymentDate || undefined
        })
      }

      router.replace('/dashboard')
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Failed to save onboarding'
      if (message.toLowerCase().includes('failed to fetch')) {
        setError('Connection issue while saving onboarding. Please retry in a few seconds.')
      } else {
        setError(message)
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading || authLoading) {
    return <FinanceLoader />
  }

  return (
    <div className="min-h-[100svh] bg-[radial-gradient(circle_at_20%_20%,#0f766e26,transparent_45%),radial-gradient(circle_at_80%_0%,#1d4ed826,transparent_35%),linear-gradient(#020617,#020617)] px-4 py-6 text-slate-100 sm:py-10">
      <div className="mx-auto w-full max-w-4xl rounded-2xl border border-cyan-500/25 bg-slate-900/70 backdrop-blur p-6 md:p-8 shadow-[0_22px_80px_rgba(6,182,212,0.2)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-3">
              <BrandIdentity size={28} textClassName="text-xl font-semibold text-cyan-200" />
            </div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Set up your financial profile</h1>
            <p className="text-slate-300 mt-2">
              This onboarding replaces dashboard mock data with your real baseline metrics.
            </p>
          </div>
          <div className="rounded-full border border-cyan-500/30 bg-slate-950/70 px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-cyan-200">
            Step 1 of 1
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              value={form.fullName}
              onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
              placeholder="Alex Carter"
              className="bg-slate-950/60 border-cyan-500/30"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              value={form.country}
              onChange={(event) => setForm((prev) => ({ ...prev, country: event.target.value }))}
              placeholder="United States"
              className="bg-slate-950/60 border-cyan-500/30"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="studentStatus">Student status</Label>
            <Input
              id="studentStatus"
              value={form.studentStatus}
              onChange={(event) => setForm((prev) => ({ ...prev, studentStatus: event.target.value }))}
              placeholder="undergraduate"
              className="bg-slate-950/60 border-cyan-500/30"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="university">University</Label>
            <Input
              id="university"
              value={form.university}
              onChange={(event) => setForm((prev) => ({ ...prev, university: event.target.value }))}
              placeholder="State University"
              className="bg-slate-950/60 border-cyan-500/30"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="monthlyIncome">Monthly income (USD)</Label>
            <Input
              id="monthlyIncome"
              type="number"
              min={0}
              value={form.monthlyIncome}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, monthlyIncome: Number(event.target.value || 0) }))
              }
              className="bg-slate-950/60 border-cyan-500/30"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="monthlyExpenses">Monthly expenses (USD)</Label>
            <Input
              id="monthlyExpenses"
              type="number"
              min={0}
              value={form.monthlyExpenses}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, monthlyExpenses: Number(event.target.value || 0) }))
              }
              className="bg-slate-950/60 border-cyan-500/30"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="savingsGoal">Savings goal (USD)</Label>
            <Input
              id="savingsGoal"
              type="number"
              min={0}
              value={form.savingsGoal}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, savingsGoal: Number(event.target.value || 0) }))
              }
              className="bg-slate-950/60 border-cyan-500/30"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="riskTolerance">Risk tolerance</Label>
            <select
              id="riskTolerance"
              value={form.riskTolerance}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  riskTolerance: event.target.value as RiskTolerance
                }))
              }
              className="w-full h-10 rounded-md border border-cyan-500/30 bg-slate-950/60 px-3 text-sm outline-none focus:border-cyan-400"
            >
              <option value="low">Low</option>
              <option value="moderate">Moderate</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="loanAmount">Loan amount (optional)</Label>
            <Input
              id="loanAmount"
              type="number"
              min={0}
              value={form.loanAmount}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, loanAmount: Number(event.target.value || 0) }))
              }
              className="bg-slate-950/60 border-cyan-500/30"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="interestRate">Interest rate (%)</Label>
            <Input
              id="interestRate"
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={form.interestRate}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, interestRate: Number(event.target.value || 0) }))
              }
              className="bg-slate-950/60 border-cyan-500/30"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="monthlyPayment">Monthly loan payment</Label>
            <Input
              id="monthlyPayment"
              type="number"
              min={0}
              value={form.monthlyPayment}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, monthlyPayment: Number(event.target.value || 0) }))
              }
              className="bg-slate-950/60 border-cyan-500/30"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nextPaymentDate">Next payment date</Label>
            <Input
              id="nextPaymentDate"
              type="date"
              value={form.nextPaymentDate}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, nextPaymentDate: event.target.value }))
              }
              className="bg-slate-950/60 border-cyan-500/30"
            />
          </div>

          <div className="md:col-span-2 rounded-xl border border-cyan-500/30 bg-slate-950/60 p-4">
            <p className="text-sm text-slate-300">Estimated monthly remaining balance</p>
            <p
              className={`mt-1 text-2xl font-semibold ${
                estimatedRemaining >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              ${estimatedRemaining.toLocaleString()}
            </p>
          </div>

          {error ? (
            <p className="md:col-span-2 text-sm text-rose-400">{error}</p>
          ) : null}

          <div className="flex flex-col-reverse gap-3 pt-2 md:col-span-2 md:flex-row md:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/dashboard')}
              className="w-full border-slate-700 bg-slate-900/85 hover:bg-slate-800 md:w-auto"
            >
              Skip for now
            </Button>
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-cyan-300 via-cyan-400 to-teal-300 font-semibold text-slate-950 hover:brightness-105 md:w-auto"
              disabled={saving}
            >
              {saving ? 'Saving profile...' : 'Complete onboarding'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
