import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { HolographicCard } from '@/components/dashboard/HolographicUI'
import {
  AlertTriangle,
  ArrowRight,
  Brain,
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
  Scissors
} from 'lucide-react'
import { Doughnut } from 'react-chartjs-2'
import { getCostAnalysis, type CostAnalysisResponse } from '@/lib/financial-client'
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

export function CostCutter({ userData, isGuest = false }: CostCutterProps) {
  const router = useRouter()
  const [aiAnalysis, setAiAnalysis] = useState<CostAnalysisResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const hasIncome = userData.monthlyIncome > 0
  const hasCategories = userData.categories.length > 0
  const canAnalyze = hasIncome && hasCategories && !isGuest

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load AI cost analysis')
    } finally {
      setLoading(false)
    }
  }, [hasCategories, hasIncome, isGuest, userData.categories, userData.monthlyIncome])

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
      <section className="overflow-hidden rounded-[28px] border border-slate-800 bg-[linear-gradient(135deg,rgba(249,115,22,0.12),transparent_40%),linear-gradient(180deg,rgba(10,15,28,0.98),rgba(8,12,22,0.96))] p-6 shadow-[0_24px_60px_rgba(3,7,18,0.45)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-300/80">Cost Cutter</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Cut spending only from the categories you actually saved</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
              This page uses your saved Profile spending setup only. No extra essential bucket, no fake comparison budget, just your income versus the categories you entered.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/dashboard/profile')}
              className="border-slate-700 bg-slate-950/70 hover:bg-slate-900"
            >
              <PencilLine className="mr-2 h-4 w-4" />
              Edit profile spending
            </Button>
            <Button
              type="button"
              onClick={() => void loadAnalysis()}
              disabled={!canAnalyze || loading}
              className="bg-orange-300 text-slate-950 hover:bg-orange-200 disabled:bg-slate-700 disabled:text-slate-300"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
              Analyze with AI
            </Button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Monthly income</p>
            <p className="mt-3 text-2xl font-semibold text-white">{hasIncome ? formatCurrency(monthlyIncome) : 'Missing'}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Saved categories</p>
            <p className="mt-3 text-2xl font-semibold text-white">{categories.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Total planned spend</p>
            <p className="mt-3 text-2xl font-semibold text-white">{formatCurrency(totalExpenses)}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Left from income</p>
            <p className="mt-3 text-2xl font-semibold text-emerald-300">{formatCurrency(unassignedIncome)}</p>
          </div>
        </div>
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
          <div className="border-b border-slate-800/70 px-5 py-4">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-orange-300" />
              <h3 className="text-lg font-semibold text-white">Budget snapshot</h3>
            </div>
            <p className="mt-1 text-sm text-slate-400">A simple view of the money you assigned in Profile.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-3">
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
          <div className="p-5 h-[340px]">
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
            {aiAnalysis?.model_used ? (
              <div className="inline-flex items-center rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1 text-xs text-slate-300">
                <Sparkles className="mr-2 h-3.5 w-3.5 text-orange-300" />
                {formatModelUsed(aiAnalysis.model_used)}
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
    </div>
  )
}
