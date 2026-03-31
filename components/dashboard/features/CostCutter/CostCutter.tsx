import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { HolographicCard } from '@/components/dashboard/HolographicUI'
import {
  ArrowRight,
  Brain,
  ChevronDown,
  ChevronUp,
  Coffee,
  Home,
  Loader2,
  PencilLine,
  PiggyBank,
  ShoppingBag,
  Sparkles,
  Car,
  Wallet,
  TrendingDown,
  Target,
  CheckCircle2,
  Scissors,
  ListChecks
} from 'lucide-react'
import { Doughnut } from 'react-chartjs-2'
import '@/lib/chartjs-register'
import {
  getCostAnalysis,
  getLatestCostPlan,
  updateCostPlanStep,
  type CostAnalysisResponse,
  type CostPlan
} from '@/lib/financial-client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { renderAssistantContent } from '@/components/dashboard/shared/render-assistant-content'

interface CostCutterProps {
  userData: {
    monthlyExpenses: number
    monthlyIncome: number
    country: string
    categories: Array<{ category: string; amount: number; percentage: number }>
  }
  isGuest?: boolean
}

const ICON_MAP: Record<string, typeof Home> = {
  housing: Home,
  rent: Home,
  hostel: Home,
  food: Coffee,
  grocery: Coffee,
  groceries: Coffee,
  transportation: Car,
  transport: Car,
  travel: Car,
  shopping: ShoppingBag,
  subscriptions: ShoppingBag,
  education: ShoppingBag,
  entertainment: ShoppingBag,
  miscellaneous: ShoppingBag
}

function getIcon(category: string) {
  return ICON_MAP[category.toLowerCase()] ?? ShoppingBag
}

function formatModelUsed(modelUsed?: string): string {
  if (!modelUsed) return ''
  if (modelUsed.startsWith('gemini:')) return modelUsed.replace('gemini:', '')
  if (modelUsed.startsWith('workers-ai:')) {
    const [providerModel, routeInfo] = modelUsed.split('|route:')
    const cleanedModel = providerModel.replace('workers-ai:', '')
    if (!routeInfo) return cleanedModel
    return `${cleanedModel} (${routeInfo.replace('|selected:', ', selected: ')})`
  }
  return modelUsed
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString()}`
}

function progressLabel(plan: CostPlan): string {
  return `${plan.progress.completed_steps}/${plan.progress.total_steps} steps done`
}

export function CostCutter({ userData, isGuest = false }: CostCutterProps) {
  const router = useRouter()
  const [showIntro, setShowIntro] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState<CostAnalysisResponse | null>(null)
  const [savedPlan, setSavedPlan] = useState<CostPlan | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingPlan, setLoadingPlan] = useState(false)
  const [updatingStepId, setUpdatingStepId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const hasIncome = userData.monthlyIncome > 0
  const hasCategories = userData.categories.length > 0
  const canAnalyze = hasIncome && hasCategories && !isGuest

  useEffect(() => {
    if (isGuest) {
      setSavedPlan(null)
      return
    }

    let cancelled = false

    const loadSavedPlan = async () => {
      setLoadingPlan(true)
      try {
        const plan = await getLatestCostPlan()
        if (!cancelled) {
          setSavedPlan(plan)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load saved cost plan')
        }
      } finally {
        if (!cancelled) {
          setLoadingPlan(false)
        }
      }
    }

    void loadSavedPlan()

    return () => {
      cancelled = true
    }
  }, [isGuest])

  const loadAnalysis = useCallback(async () => {
    if (isGuest) {
      setError('Sign in to run AI cost analysis.')
      return
    }

    if (!hasIncome || !hasCategories) {
      setError('Add your monthly income and saved spending categories in Profile before starting Cost Cutter.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const result = await getCostAnalysis({
        monthlyIncome: userData.monthlyIncome,
        categories: userData.categories.map((item) => ({
          category: item.category,
          amount: item.amount
        }))
      })
      setAiAnalysis(result)
      setSavedPlan(result.plan)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load AI cost analysis')
    } finally {
      setLoading(false)
    }
  }, [hasCategories, hasIncome, isGuest, userData.categories, userData.monthlyIncome])

  const togglePlanStep = useCallback(async (stepId: string, completed: boolean) => {
    setUpdatingStepId(stepId)
    setError('')
    try {
      const nextPlan = await updateCostPlanStep(stepId, completed)
      setSavedPlan(nextPlan)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update plan step')
    } finally {
      setUpdatingStepId(null)
    }
  }, [])

  const categories = userData.categories
  const totalExpenses = categories.reduce((sum, item) => sum + item.amount, 0)
  const monthlyIncome = userData.monthlyIncome
  const unassignedIncome = Math.max(monthlyIncome - totalExpenses, 0)
  const savingsRate = monthlyIncome > 0 ? Math.max(((monthlyIncome - totalExpenses) / monthlyIncome) * 100, 0) : 0
  const estimatedCut = categories.reduce((sum, item) => sum + item.amount * 0.1, 0)
  const topCategory = categories[0]

  const expenseCategories = useMemo(() => {
    return categories.slice(0, 6).map((item) => {
      const Icon = getIcon(item.category)
      const suggestedCut = Number((item.amount * 0.1).toFixed(2))
      return { ...item, icon: Icon, suggestedCut }
    })
  }, [categories])

  const chartData = {
    labels: expenseCategories.map((cat) => cat.category),
    datasets: [
      {
        data: expenseCategories.map((cat) => cat.amount),
        backgroundColor: ['#f4a261', '#e76f51', '#2a9d8f', '#264653', '#8ab17d', '#e9c46a'],
        borderColor: '#07111f',
        borderWidth: 3
      }
    ]
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[1.25rem] border border-cyan-500/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.14),transparent_30%),linear-gradient(180deg,rgba(2,6,23,0.92),rgba(2,6,23,0.76))] px-4 py-3 shadow-[0_14px_44px_rgba(2,6,23,0.38)]">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {isGuest ? (
              <p className="text-sm text-slate-300">Sign in to run AI analysis on your saved spending.</p>
            ) : canAnalyze ? (
              <>
                <Badge className="border-slate-700 bg-slate-900/70 text-slate-200">{formatCurrency(monthlyIncome)} income</Badge>
                <Badge className="border-slate-700 bg-slate-900/70 text-slate-200">
                  {categories.length} {categories.length === 1 ? 'category' : 'categories'}
                </Badge>
                <Badge className="border-slate-700 bg-slate-900/70 text-slate-200">{formatCurrency(totalExpenses)} spend</Badge>
                <Badge className="border-emerald-400/30 bg-emerald-500/10 text-emerald-100">{formatCurrency(unassignedIncome)} left</Badge>
              </>
            ) : (
              <p className="text-sm text-slate-300">
                Add income and categories in <span className="text-slate-100">Profile</span> to analyze.
              </p>
            )}
          </div>

          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowIntro((prev) => !prev)}
              className="h-8 rounded-full border-slate-700 bg-slate-900/70 px-3 text-xs text-slate-100 hover:bg-slate-800"
            >
              {showIntro ? 'Hide' : 'How it works'}
              {showIntro ? <ChevronUp className="ml-1.5 h-3.5 w-3.5" /> : <ChevronDown className="ml-1.5 h-3.5 w-3.5" />}
            </Button>
            <Button
              type="button"
              onClick={() => router.push('/dashboard/profile')}
              className="h-8 rounded-full border border-cyan-300/60 bg-cyan-300 px-3 text-xs font-semibold text-slate-950 hover:bg-cyan-200"
            >
              <PencilLine className="mr-1.5 h-3.5 w-3.5" />
              Profile details
            </Button>
          </div>
        </div>

        {showIntro ? (
          <div className="mt-3 rounded-2xl border border-slate-800/80 bg-slate-950/55 px-4 py-3 text-sm text-slate-300">
            <p className="text-sm font-medium text-slate-100">How it works</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6">
              <li>Uses the income and category amounts you saved in Profile.</li>
              <li>Suggests where to trim based on those numbers—nothing extra is invented.</li>
              <li>
                Status:{' '}
                <span className={canAnalyze ? 'text-emerald-200' : 'text-amber-200'}>
                  {canAnalyze ? 'Ready to analyze' : 'Complete Profile first'}
                </span>
              </li>
            </ul>
          </div>
        ) : null}
      </section>

      {isGuest ? (
        <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Guest mode can view Cost Cutter, but AI analysis needs a saved account and Profile spending data.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <HolographicCard className="!p-0 overflow-hidden border border-slate-800/80">
          <div className="flex flex-col gap-3 border-b border-slate-800/70 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 shrink-0 text-orange-300" />
                <h3 className="text-lg font-semibold text-white">Budget snapshot</h3>
              </div>
              <p className="mt-1 text-sm text-slate-400">A simple view of the money you assigned in Profile.</p>
            </div>
            <Button
              type="button"
              onClick={() => void loadAnalysis()}
              disabled={!canAnalyze || loading}
              className="h-9 shrink-0 self-start rounded-full border border-orange-300/70 bg-orange-300 px-4 text-xs font-semibold text-slate-950 hover:bg-orange-200 disabled:bg-slate-700 disabled:text-slate-500 sm:self-center"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
              Analyze
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
                <Target className="h-4 w-4 text-orange-300" />
                Spending load
              </div>
              <p className="mt-3 text-3xl font-semibold text-white">
                {monthlyIncome > 0 ? `${((totalExpenses / monthlyIncome) * 100).toFixed(1)}%` : '0%'}
              </p>
              <p className="mt-2 text-sm text-slate-400">Of your income is already assigned to saved categories.</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
                <PiggyBank className="h-4 w-4 text-emerald-300" />
                Current savings room
              </div>
              <p className="mt-3 text-3xl font-semibold text-white">{savingsRate.toFixed(1)}%</p>
              <p className="mt-2 text-sm text-slate-400">Income left after the categories you saved.</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
                <Scissors className="h-4 w-4 text-cyan-300" />
                Quick cut estimate
              </div>
              <p className="mt-3 text-3xl font-semibold text-white">{formatCurrency(estimatedCut)}</p>
              <p className="mt-2 text-sm text-slate-400">A flat 10% trim across saved categories before AI advice.</p>
            </div>
          </div>
        </HolographicCard>

        <HolographicCard className="!p-0 overflow-hidden border border-slate-800/80">
          <div className="border-b border-slate-800/70 px-5 py-4">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-orange-300" />
              <h3 className="text-lg font-semibold text-white">Biggest pressure point</h3>
            </div>
            <p className="mt-1 text-sm text-slate-400">Start here if you want the fastest improvement.</p>
          </div>
          <div className="p-5">
            {topCategory ? (
              <div className="rounded-[24px] border border-orange-400/20 bg-orange-500/8 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-orange-300/80">Largest category</p>
                <p className="mt-3 text-2xl font-semibold text-white">{topCategory.category}</p>
                <p className="mt-2 text-lg text-slate-200">{formatCurrency(topCategory.amount)}</p>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  This category alone takes{' '}
                  <span className="font-semibold text-white">
                    {monthlyIncome > 0 ? `${((topCategory.amount / monthlyIncome) * 100).toFixed(1)}%` : '0%'}
                  </span>{' '}
                  of your monthly income.
                </p>
                <div className="mt-4 inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
                  A 10% trim here saves {formatCurrency(topCategory.amount * 0.1)}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Add spending categories in Profile to surface your largest cost area.</p>
            )}
          </div>
        </HolographicCard>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <HolographicCard className="!p-0 overflow-hidden border border-slate-800/80">
          <div className="border-b border-slate-800/70 px-5 py-4">
            <h3 className="text-lg font-semibold text-white">Where your money goes</h3>
            <p className="mt-1 text-sm text-slate-400">Only the categories saved in Profile are shown here.</p>
          </div>
          <div className="h-[280px] p-5 sm:h-[340px]">
            {expenseCategories.length > 0 ? (
              <Doughnut
                data={chartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  cutout: '58%',
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: {
                        color: '#cbd5e1',
                        padding: 18,
                        usePointStyle: true,
                        pointStyleWidth: 10
                      }
                    }
                  }
                }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                No saved spending categories yet.
              </div>
            )}
          </div>
        </HolographicCard>

        <HolographicCard className="!p-0 overflow-hidden border border-slate-800/80">
          <div className="border-b border-slate-800/70 px-5 py-4">
            <h3 className="text-lg font-semibold text-white">Saved category list</h3>
            <p className="mt-1 text-sm text-slate-400">Use this to see what is worth cutting before you run AI.</p>
          </div>
          <div className="divide-y divide-slate-800/70">
            {expenseCategories.length > 0 ? (
              expenseCategories.map((category) => {
                const Icon = category.icon
                const shareOfIncome = monthlyIncome > 0 ? (category.amount / monthlyIncome) * 100 : 0

                return (
                  <div key={category.category} className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950/80">
                        <Icon className="h-4 w-4 text-orange-300" />
                      </div>
                      <div>
                        <p className="text-base font-medium text-white">{category.category}</p>
                        <p className="mt-1 text-sm text-slate-400">
                          {shareOfIncome.toFixed(1)}% of income
                          {' '}| Suggested first-pass cut {formatCurrency(category.suggestedCut)}
                        </p>
                      </div>
                    </div>
                    <div className="text-left md:text-right">
                      <p className="text-lg font-semibold text-white">{formatCurrency(category.amount)}</p>
                      <p className="mt-1 text-sm text-slate-400">{category.percentage.toFixed(1)}% of saved spending</p>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="px-5 py-8 text-sm text-slate-400">
                Add categories like food, travel, housing, subscriptions, or shopping in Profile to start using Cost Cutter.
              </div>
            )}
          </div>
        </HolographicCard>
      </div>

      <HolographicCard className="!p-0 overflow-hidden border border-slate-800/80">
        <div className="border-b border-slate-800/70 px-5 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">AI cost-cutting plan</h3>
              <p className="mt-1 text-sm text-slate-400">
                Personalized savings ideas based only on your saved income and category totals.
              </p>
            </div>
            {(aiAnalysis?.model_used ?? savedPlan?.model_used) ? (
              <div className="inline-flex items-center rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1 text-xs text-slate-300">
                <Sparkles className="mr-2 h-3.5 w-3.5 text-orange-300" />
                {formatModelUsed(aiAnalysis?.model_used ?? savedPlan?.model_used)}
              </div>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 px-5 py-6 text-sm text-slate-300">
            <Loader2 className="h-5 w-5 animate-spin text-orange-300" />
            Building a savings plan from your saved categories...
          </div>
        ) : aiAnalysis ? (
          <div className="space-y-4 px-5 py-5">
            {renderAssistantContent(aiAnalysis.analysis)}
          </div>
        ) : (
          <div className="px-5 py-8">
            <div className="rounded-[24px] border border-dashed border-slate-700 bg-slate-950/50 p-6">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-300" />
                <div>
                  <p className="text-base font-medium text-white">Ready for analysis</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Press <span className="font-medium text-slate-200">Analyze with AI</span> to get targeted suggestions on where to reduce spending and how much you may be able to save.
                  </p>
                  <button
                    type="button"
                    onClick={() => void loadAnalysis()}
                    disabled={!canAnalyze}
                    className="mt-4 inline-flex items-center text-sm font-medium text-orange-300 transition hover:text-orange-200 disabled:text-slate-600"
                  >
                    Start AI analysis
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </HolographicCard>

      <HolographicCard className="!p-0 overflow-hidden border border-slate-800/80">
        <div className="border-b border-slate-800/70 px-5 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-cyan-300" />
                <h3 className="text-lg font-semibold text-white">Saved milestone plan</h3>
              </div>
              <p className="mt-1 text-sm text-slate-400">
                Each new AI analysis now stores a followable cost-cutting plan with persistent steps.
              </p>
            </div>
            {savedPlan ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-cyan-500/30 bg-cyan-500/10 text-cyan-100">
                  {formatCurrency(savedPlan.target_monthly_savings)} monthly target
                </Badge>
                <Badge className="border-slate-700 bg-slate-900/70 text-slate-200">
                  {progressLabel(savedPlan)}
                </Badge>
              </div>
            ) : null}
          </div>
        </div>

        {loadingPlan && !savedPlan ? (
          <div className="flex items-center gap-3 px-5 py-6 text-sm text-slate-300">
            <Loader2 className="h-5 w-5 animate-spin text-cyan-300" />
            Loading your saved cost-cutting milestones...
          </div>
        ) : savedPlan ? (
          <div className="space-y-4 px-5 py-5">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-medium text-white">Plan progress</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {savedPlan.progress.percentage}% complete with {savedPlan.progress.completed_steps} of{' '}
                    {savedPlan.progress.total_steps} steps finished.
                  </p>
                </div>
                <div className="text-sm text-slate-300">
                  Latest target: <span className="font-semibold text-white">{formatCurrency(savedPlan.target_monthly_savings)}</span>
                </div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400"
                  style={{ width: `${savedPlan.progress.percentage}%` }}
                />
              </div>
            </div>

            <div className="space-y-4">
              {savedPlan.milestones.map((milestone) => (
                <div key={milestone.id} className="rounded-[24px] border border-slate-800 bg-slate-950/65 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-base font-semibold text-white">{milestone.title}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-400">{milestone.description}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {milestone.due_label ? (
                        <Badge className="border-slate-700 bg-slate-900/70 text-slate-200">{milestone.due_label}</Badge>
                      ) : null}
                      <Badge className="border-emerald-400/30 bg-emerald-500/10 text-emerald-100">
                        {formatCurrency(milestone.target_amount)}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    {milestone.steps.map((step) => (
                      <button
                        key={step.id}
                        type="button"
                        onClick={() => void togglePlanStep(step.id, !step.completed)}
                        disabled={updatingStepId === step.id}
                        className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                          step.completed
                            ? 'border-emerald-400/30 bg-emerald-500/10'
                            : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'
                        }`}
                      >
                        <div
                          className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border ${
                            step.completed ? 'border-emerald-300 bg-emerald-300 text-slate-950' : 'border-slate-600 text-slate-500'
                          }`}
                        >
                          {updatingStepId === step.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                            <p className={`text-sm font-medium ${step.completed ? 'text-emerald-100' : 'text-white'}`}>{step.title}</p>
                            <span className="text-xs text-slate-400">{formatCurrency(step.target_amount)}</span>
                          </div>
                          <p className="mt-1 text-sm leading-6 text-slate-400">{step.detail}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="px-5 py-8">
            <div className="rounded-[24px] border border-dashed border-slate-700 bg-slate-950/50 p-6">
              <p className="text-base font-medium text-white">No saved milestone plan yet</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Run AI analysis once and BurryAI will save a month plan with milestones and step-by-step actions you can track here.
              </p>
            </div>
          </div>
        )}
      </HolographicCard>
    </div>
  )
}
