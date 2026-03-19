'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserRound } from 'lucide-react'

import { HolographicCard } from '@/components/dashboard/HolographicUI'
import { Button } from '@/components/ui/button'
import FinanceLoader from '@/components/ui/FinanceLoader'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import {
  createExpense,
  createLoan,
  getFinancialProfile,
  updateFinancialProfile,
  type RiskTolerance,
  type WorkMode
} from '@/lib/financial-client'

type ProfileForm = {
  full_name: string
  country: string
  student_status: string
  university: string
  profession: string
  skills_csv: string
  other_talents_csv: string
  preferred_work_mode: WorkMode
  city: string
  state_region: string
  remote_regions_csv: string
  opportunity_radius_km: number
  min_hourly_rate: number
  monthly_income: number
  savings_goal: number
  risk_tolerance: RiskTolerance
}

function toCsv(items: string[]): string {
  return items.join(', ')
}

function fromCsv(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    )
  )
}

export default function DashboardProfilePage() {
  const router = useRouter()
  const { user, isGuest, loading: authLoading } = useAuth()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    full_name: '',
    country: '',
    student_status: '',
    university: '',
    profession: '',
    skills_csv: '',
    other_talents_csv: '',
    preferred_work_mode: 'hybrid',
    city: '',
    state_region: '',
    remote_regions_csv: '',
    opportunity_radius_km: 25,
    min_hourly_rate: 0,
    monthly_income: 0,
    savings_goal: 0,
    risk_tolerance: 'moderate'
  })
  const [newExpense, setNewExpense] = useState({
    amount: 0,
    category: '',
    description: '',
    date: new Date().toISOString().slice(0, 10)
  })
  const [newLoan, setNewLoan] = useState({
    loan_name: '',
    loan_amount: 0,
    interest_rate: 0,
    monthly_payment: 0,
    next_payment_date: ''
  })

  const loadData = useCallback(async () => {
    if (!user || isGuest) {
      setLoading(false)
      return
    }

    setError('')
    setLoading(true)
    try {
      const profileData = await getFinancialProfile()
      setProfileForm({
        full_name: profileData.full_name,
        country: profileData.country,
        student_status: profileData.student_status,
        university: profileData.university,
        profession: profileData.profession || '',
        skills_csv: toCsv(profileData.skills || []),
        other_talents_csv: toCsv(profileData.other_talents || []),
        preferred_work_mode: profileData.preferred_work_mode || 'hybrid',
        city: profileData.city || '',
        state_region: profileData.state_region || '',
        remote_regions_csv: toCsv(profileData.remote_regions || []),
        opportunity_radius_km: profileData.opportunity_radius_km || 25,
        min_hourly_rate: profileData.min_hourly_rate || 0,
        monthly_income: profileData.monthly_income,
        savings_goal: profileData.savings_goal,
        risk_tolerance: profileData.risk_tolerance
      })
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }, [isGuest, user])

  useEffect(() => {
    if (authLoading) return
    void loadData()
  }, [authLoading, loadData])

  async function handleSaveProfile() {
    if (!user || isGuest) return
    setSaving(true)
    setError('')
    try {
      const updated = await updateFinancialProfile({
        full_name: profileForm.full_name,
        country: profileForm.country,
        student_status: profileForm.student_status,
        university: profileForm.university,
        profession: profileForm.profession,
        skills: fromCsv(profileForm.skills_csv),
        other_talents: fromCsv(profileForm.other_talents_csv),
        preferred_work_mode: profileForm.preferred_work_mode,
        city: profileForm.city,
        state_region: profileForm.state_region,
        remote_regions: fromCsv(profileForm.remote_regions_csv),
        opportunity_radius_km: Number(profileForm.opportunity_radius_km || 25),
        min_hourly_rate: Number(profileForm.min_hourly_rate || 0),
        monthly_income: Number(profileForm.monthly_income || 0),
        savings_goal: Number(profileForm.savings_goal || 0),
        risk_tolerance: profileForm.risk_tolerance
      })
      setProfileForm({
        full_name: updated.full_name,
        country: updated.country,
        student_status: updated.student_status,
        university: updated.university,
        profession: updated.profession || '',
        skills_csv: toCsv(updated.skills || []),
        other_talents_csv: toCsv(updated.other_talents || []),
        preferred_work_mode: updated.preferred_work_mode || 'hybrid',
        city: updated.city || '',
        state_region: updated.state_region || '',
        remote_regions_csv: toCsv(updated.remote_regions || []),
        opportunity_radius_km: updated.opportunity_radius_km || 25,
        min_hourly_rate: updated.min_hourly_rate || 0,
        monthly_income: updated.monthly_income,
        savings_goal: updated.savings_goal,
        risk_tolerance: updated.risk_tolerance
      })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateExpense() {
    if (isGuest || !newExpense.category || newExpense.amount <= 0) return
    setError('')
    try {
      await createExpense({
        category: newExpense.category,
        amount: Number(newExpense.amount),
        description: newExpense.description || undefined,
        date: newExpense.date || undefined
      })
      setNewExpense({ amount: 0, category: '', description: '', date: new Date().toISOString().slice(0, 10) })
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to add expense')
    }
  }

  async function handleCreateLoan() {
    if (isGuest || newLoan.loan_amount <= 0 || newLoan.monthly_payment <= 0) return
    setError('')
    try {
      await createLoan({
        loan_name: newLoan.loan_name || undefined,
        loan_amount: Number(newLoan.loan_amount),
        interest_rate: Number(newLoan.interest_rate),
        monthly_payment: Number(newLoan.monthly_payment),
        next_payment_date: newLoan.next_payment_date || undefined
      })
      setNewLoan({
        loan_name: '',
        loan_amount: 0,
        interest_rate: 0,
        monthly_payment: 0,
        next_payment_date: ''
      })
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to add loan')
    }
  }

  if (authLoading || loading) {
    return <FinanceLoader />
  }

  return (
    <div className="min-h-[calc(100vh-10rem)]">
      <HolographicCard className="border-cyan-500/25">
      <div className="rounded-xl border border-cyan-500/20 bg-black/20 p-6">
        {isGuest ? (
          <div className="mb-4 rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Guest mode cannot persist profile updates. Sign up to save profile data.
          </div>
        ) : null}

        {error ? (
          <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
        ) : null}

        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-2xl font-semibold">
              <UserRound className="h-6 w-6 text-cyan-300" />
              Profile Settings
            </h3>
            <p className="mt-1 text-sm text-slate-300">
              Keep your financial profile accurate for better recommendations and projections.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push('/onboarding')}
            className="border-slate-700 bg-slate-900/80 hover:bg-slate-800"
          >
            Re-run onboarding
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-4 rounded-xl border border-slate-700/60 bg-slate-950/50 p-5">
            <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200/90">Personal & Academic</h4>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full name</Label>
                <Input
                  id="full_name"
                  value={profileForm.full_name}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, full_name: event.target.value }))}
                  className="border-cyan-500/30 bg-slate-950/70"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={profileForm.country}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, country: event.target.value }))}
                  className="border-cyan-500/30 bg-slate-950/70"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="student_status">Student status</Label>
                <Input
                  id="student_status"
                  value={profileForm.student_status}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, student_status: event.target.value }))}
                  className="border-cyan-500/30 bg-slate-950/70"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="university">University</Label>
                <Input
                  id="university"
                  value={profileForm.university}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, university: event.target.value }))}
                  className="border-cyan-500/30 bg-slate-950/70"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-slate-700/60 bg-slate-950/50 p-5">
            <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200/90">Financial Preferences</h4>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="monthly_income">Monthly income</Label>
                <Input
                  id="monthly_income"
                  type="number"
                  min={0}
                  value={profileForm.monthly_income}
                  onChange={(event) =>
                    setProfileForm((prev) => ({ ...prev, monthly_income: Number(event.target.value || 0) }))
                  }
                  className="border-cyan-500/30 bg-slate-950/70"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="savings_goal">Savings goal</Label>
                <Input
                  id="savings_goal"
                  type="number"
                  min={0}
                  value={profileForm.savings_goal}
                  onChange={(event) =>
                    setProfileForm((prev) => ({ ...prev, savings_goal: Number(event.target.value || 0) }))
                  }
                  className="border-cyan-500/30 bg-slate-950/70"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="risk_tolerance">Risk tolerance</Label>
                <select
                  id="risk_tolerance"
                  value={profileForm.risk_tolerance}
                  onChange={(event) =>
                    setProfileForm((prev) => ({ ...prev, risk_tolerance: event.target.value as RiskTolerance }))
                  }
                  className="h-10 w-full rounded-md border border-cyan-500/30 bg-slate-950/70 px-3 text-sm outline-none focus:border-cyan-300"
                >
                  <option value="low">Low</option>
                  <option value="moderate">Moderate</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-slate-700/60 bg-slate-950/50 p-5 lg:col-span-2">
            <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200/90">Income Opportunities Profile</h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="profession">Profession / target role</Label>
                <Input
                  id="profession"
                  value={profileForm.profession}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, profession: event.target.value }))}
                  className="border-cyan-500/30 bg-slate-950/70"
                  placeholder="Frontend Developer"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preferred_work_mode">Preferred mode</Label>
                <select
                  id="preferred_work_mode"
                  value={profileForm.preferred_work_mode}
                  onChange={(event) =>
                    setProfileForm((prev) => ({ ...prev, preferred_work_mode: event.target.value as WorkMode }))
                  }
                  className="h-10 w-full rounded-md border border-cyan-500/30 bg-slate-950/70 px-3 text-sm outline-none focus:border-cyan-300"
                >
                  <option value="local">Local</option>
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="skills_csv">Skills (comma separated)</Label>
                <Input
                  id="skills_csv"
                  value={profileForm.skills_csv}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, skills_csv: event.target.value }))}
                  className="border-cyan-500/30 bg-slate-950/70"
                  placeholder="React, JavaScript, UI Design"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="other_talents_csv">Other talents (comma separated)</Label>
                <Input
                  id="other_talents_csv"
                  value={profileForm.other_talents_csv}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, other_talents_csv: event.target.value }))}
                  className="border-cyan-500/30 bg-slate-950/70"
                  placeholder="Tutoring, Content writing, Video editing"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={profileForm.city}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, city: event.target.value }))}
                  className="border-cyan-500/30 bg-slate-950/70"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state_region">State / region</Label>
                <Input
                  id="state_region"
                  value={profileForm.state_region}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, state_region: event.target.value }))}
                  className="border-cyan-500/30 bg-slate-950/70"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="remote_regions_csv">Remote regions (comma separated)</Label>
                <Input
                  id="remote_regions_csv"
                  value={profileForm.remote_regions_csv}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, remote_regions_csv: event.target.value }))}
                  className="border-cyan-500/30 bg-slate-950/70"
                  placeholder="United States, Canada, Europe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="opportunity_radius_km">Nearby radius (km)</Label>
                <Input
                  id="opportunity_radius_km"
                  type="number"
                  min={1}
                  max={500}
                  value={profileForm.opportunity_radius_km}
                  onChange={(event) =>
                    setProfileForm((prev) => ({ ...prev, opportunity_radius_km: Number(event.target.value || 25) }))
                  }
                  className="border-cyan-500/30 bg-slate-950/70"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="min_hourly_rate">Minimum hourly rate</Label>
                <Input
                  id="min_hourly_rate"
                  type="number"
                  min={0}
                  value={profileForm.min_hourly_rate}
                  onChange={(event) =>
                    setProfileForm((prev) => ({ ...prev, min_hourly_rate: Number(event.target.value || 0) }))
                  }
                  className="border-cyan-500/30 bg-slate-950/70"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-slate-700/60 bg-slate-950/50 p-5">
            <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200/90">Quick Add Expense</h4>
            <Input
              placeholder="Category"
              value={newExpense.category}
              onChange={(event) => setNewExpense((prev) => ({ ...prev, category: event.target.value }))}
              className="border-cyan-500/30 bg-slate-950/70"
            />
            <Input
              type="number"
              min={0}
              placeholder="Amount"
              value={newExpense.amount}
              onChange={(event) => setNewExpense((prev) => ({ ...prev, amount: Number(event.target.value || 0) }))}
              className="border-cyan-500/30 bg-slate-950/70"
            />
            <Input
              placeholder="Description (optional)"
              value={newExpense.description}
              onChange={(event) => setNewExpense((prev) => ({ ...prev, description: event.target.value }))}
              className="border-cyan-500/30 bg-slate-950/70"
            />
            <Input
              type="date"
              value={newExpense.date}
              onChange={(event) => setNewExpense((prev) => ({ ...prev, date: event.target.value }))}
              className="border-cyan-500/30 bg-slate-950/70"
            />
            <Button
              type="button"
              onClick={() => void handleCreateExpense()}
              disabled={isGuest}
              className="rounded-xl border border-cyan-300/60 bg-cyan-400 px-4 py-2.5 font-semibold text-slate-950 shadow-[0_10px_30px_rgba(34,211,238,0.35)] hover:bg-cyan-300"
            >
              Add expense
            </Button>
          </div>

          <div className="space-y-3 rounded-xl border border-slate-700/60 bg-slate-950/50 p-5">
            <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200/90">Quick Add Loan</h4>
            <Input
              placeholder="Loan name (e.g. Student Loan)"
              value={newLoan.loan_name}
              onChange={(event) => setNewLoan((prev) => ({ ...prev, loan_name: event.target.value }))}
              className="border-cyan-500/30 bg-slate-950/70"
            />
            <Input
              type="number"
              min={0}
              placeholder="Loan amount"
              value={newLoan.loan_amount}
              onChange={(event) => setNewLoan((prev) => ({ ...prev, loan_amount: Number(event.target.value || 0) }))}
              className="border-cyan-500/30 bg-slate-950/70"
            />
            <Input
              type="number"
              min={0}
              placeholder="Interest rate (%)"
              value={newLoan.interest_rate}
              onChange={(event) => setNewLoan((prev) => ({ ...prev, interest_rate: Number(event.target.value || 0) }))}
              className="border-cyan-500/30 bg-slate-950/70"
            />
            <Input
              type="number"
              min={0}
              placeholder="Monthly payment"
              value={newLoan.monthly_payment}
              onChange={(event) =>
                setNewLoan((prev) => ({ ...prev, monthly_payment: Number(event.target.value || 0) }))
              }
              className="border-cyan-500/30 bg-slate-950/70"
            />
            <Input
              type="date"
              value={newLoan.next_payment_date}
              onChange={(event) => setNewLoan((prev) => ({ ...prev, next_payment_date: event.target.value }))}
              className="border-cyan-500/30 bg-slate-950/70"
            />
            <Button
              type="button"
              onClick={() => void handleCreateLoan()}
              disabled={isGuest}
              className="rounded-xl border border-cyan-300/60 bg-cyan-400 px-4 py-2.5 font-semibold text-slate-950 shadow-[0_10px_30px_rgba(34,211,238,0.35)] hover:bg-cyan-300"
            >
              Add loan
            </Button>
          </div>
        </div>

        <div className="mt-7 flex justify-end">
          <Button
            onClick={() => void handleSaveProfile()}
            disabled={saving || isGuest}
            className="rounded-xl border border-cyan-300/60 bg-cyan-400 px-4 py-2.5 font-semibold text-slate-950 shadow-[0_10px_30px_rgba(34,211,238,0.35)] hover:bg-cyan-300"
          >
            {saving ? 'Saving...' : 'Save profile'}
          </Button>
        </div>
      </div>
      </HolographicCard>
    </div>
  )
}
