import { useCallback, useEffect, useMemo, useState } from 'react'
import { HolographicCard } from '@/components/dashboard/HolographicUI'
import {
  Scissors,
  PiggyBank,
  AlertTriangle,
  DollarSign,
  ShoppingBag,
  Coffee,
  Home,
  Car,
  Loader2,
  Brain,
  Sparkles,
  TrendingDown,
  Zap,
  RefreshCw
} from 'lucide-react'
import { Doughnut, Bar } from 'react-chartjs-2'
import { getCostAnalysis, type CostAnalysisResponse } from '@/lib/financial-client'

interface CostCutterProps {
  userData: {
    monthlyExpenses: number
    monthlyIncome: number
    country: string
    categories: Array<{ category: string; amount: number; percentage: number }>
  }
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
  if (!modelUsed) return ""
  if (modelUsed.startsWith("gemini:")) return modelUsed.replace("gemini:", "")
  if (modelUsed.startsWith("workers-ai:")) {
    const [providerModel, routeInfo] = modelUsed.split("|route:")
    const cleanedModel = providerModel.replace("workers-ai:", "")
    if (!routeInfo) return cleanedModel
    return `${cleanedModel} (${routeInfo.replace("|selected:", ", selected: ")})`
  }
  return modelUsed
}

/* Simple markdown inline formatter */
function formatInline(text: string): JSX.Element[] {
  const parts: JSX.Element[] = []
  let remaining = text
  let key = 0
  while (remaining.length > 0) {
    const bold = remaining.match(/\*\*(.+?)\*\*/)
    if (bold && bold.index !== undefined) {
      if (bold.index > 0) parts.push(<span key={key++}>{remaining.slice(0, bold.index)}</span>)
      parts.push(<strong key={key++} className="text-cyan-200 font-semibold">{bold[1]}</strong>)
      remaining = remaining.slice(bold.index + bold[0].length)
    } else {
      parts.push(<span key={key++}>{remaining}</span>)
      remaining = ""
    }
  }
  return parts
}

function renderAnalysis(text: string): JSX.Element[] {
  const lines = text.split("\n")
  const elements: JSX.Element[] = []
  let listItems: string[] = []
  let listKey = 0

  function flushList() {
    if (listItems.length === 0) return
    elements.push(
      <ul key={`list-${listKey++}`} className="list-disc list-inside space-y-1 my-2 text-slate-300 text-sm">
        {listItems.map((item, i) => (
          <li key={i} className="leading-relaxed">{formatInline(item)}</li>
        ))}
      </ul>
    )
    listItems = []
  }

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (trimmed.startsWith("### ")) {
      flushList()
      elements.push(
        <h4 key={`h4-${i}`} className="text-sm font-bold text-cyan-300 mt-4 mb-1 uppercase tracking-wide flex items-center gap-2">
          <Zap className="w-3 h-3" />
          {formatInline(trimmed.slice(4))}
        </h4>
      )
    } else if (trimmed.startsWith("## ")) {
      flushList()
      elements.push(
        <h3 key={`h3-${i}`} className="text-base font-bold text-cyan-200 mt-4 mb-1">
          {formatInline(trimmed.slice(3))}
        </h3>
      )
    } else if (/^[-*•]\s/.test(trimmed)) {
      listItems.push(trimmed.replace(/^[-*•]\s+/, ""))
    } else if (/^\d+\.\s/.test(trimmed)) {
      listItems.push(trimmed.replace(/^\d+\.\s+/, ""))
    } else if (trimmed === "") {
      flushList()
    } else {
      flushList()
      elements.push(
        <p key={`p-${i}`} className="leading-relaxed text-slate-300 text-sm my-1">
          {formatInline(trimmed)}
        </p>
      )
    }
  }
  flushList()
  return elements
}

export function CostCutter({ userData }: CostCutterProps) {
  const [aiAnalysis, setAiAnalysis] = useState<CostAnalysisResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const loadAnalysis = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const result = await getCostAnalysis()
      setAiAnalysis(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load AI cost analysis")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAnalysis()
  }, [loadAnalysis])

  const categories = aiAnalysis?.context.topExpenseCategories ?? userData.categories
  const totalExpenses = aiAnalysis?.context.monthlyExpenses ?? userData.monthlyExpenses
  const monthlyIncome = aiAnalysis?.context.monthlyIncome ?? userData.monthlyIncome

  const expenseCategories = useMemo(() => {
    return (categories as Array<{ category: string; amount: number }>).slice(0, 6).map((item) => {
      const Icon = getIcon(item.category)
      return { ...item, icon: Icon, potential: item.amount * 0.9 }
    })
  }, [categories])

  const totalSavingsPotential = expenseCategories.reduce((acc, cat) => acc + (cat.amount - cat.potential), 0)

  const chartColors = [
    'rgba(34, 211, 238, 0.8)',
    'rgba(56, 189, 248, 0.7)',
    'rgba(14, 165, 233, 0.65)',
    'rgba(2, 132, 199, 0.6)',
    'rgba(6, 182, 212, 0.55)',
    'rgba(103, 232, 249, 0.5)'
  ]

  const chartData = {
    labels: expenseCategories.map((cat) => cat.category),
    datasets: [{
      data: expenseCategories.map((cat) => cat.amount),
      backgroundColor: chartColors.slice(0, expenseCategories.length),
      borderColor: 'rgba(6, 182, 212, 0.3)',
      borderWidth: 1
    }]
  }

  const savingsChartData = {
    labels: ['Current Spend', 'After AI Cuts'],
    datasets: [{
      label: 'Monthly Expenses',
      data: [totalExpenses, Math.max(totalExpenses - totalSavingsPotential, 0)],
      backgroundColor: ['rgba(244, 63, 94, 0.7)', 'rgba(16, 185, 129, 0.7)'],
      borderColor: ['rgba(244, 63, 94, 1)', 'rgba(16, 185, 129, 1)'],
      borderWidth: 1,
      borderRadius: 8
    }]
  }

  return (
    <div className="space-y-6 w-full">
      {/* AI Analysis Status Banner */}
      {loading ? (
        <HolographicCard className="!p-0 overflow-hidden">
          <div className="relative flex items-center gap-4 px-6 py-5">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-sky-500/5 to-transparent" />
            <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400/20 to-sky-500/20 border border-cyan-500/20">
              <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
            </div>
            <div className="relative">
              <p className="font-semibold text-white">AI is analyzing your expenses…</p>
              <p className="text-sm text-slate-400 mt-0.5">Running cost-cutter tools and generating personalized recommendations</p>
            </div>
          </div>
        </HolographicCard>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-rose-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
          <button
            onClick={() => void loadAnalysis()}
            className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-500/20 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        </div>
      ) : null}

      {/* Charts Row */}
      <div className="flex flex-col lg:flex-row gap-6 w-full">
        <HolographicCard className="flex-1 !p-0 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-800/40 px-5 py-4 bg-slate-950/40">
            <Scissors className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-semibold">Expense Breakdown</h3>
          </div>
          <div className="p-5 h-72">
            {expenseCategories.length > 0 ? (
              <Doughnut
                data={chartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  cutout: '60%',
                  plugins: {
                    legend: {
                      position: 'right',
                      labels: { color: '#cbd5e1', padding: 10, usePointStyle: true, pointStyleWidth: 8 }
                    }
                  }
                }}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                Add expenses to see breakdown
              </div>
            )}
          </div>
        </HolographicCard>

        <HolographicCard className="flex-1 !p-0 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-800/40 px-5 py-4 bg-slate-950/40">
            <PiggyBank className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-semibold">Savings Potential</h3>
            {totalSavingsPotential > 0 ? (
              <span className="ml-auto text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-0.5">
                Save ${totalSavingsPotential.toFixed(0)}/mo
              </span>
            ) : null}
          </div>
          <div className="p-5 h-72">
            <Bar
              data={savingsChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(148, 163, 184, 0.1)' },
                    ticks: { color: '#94a3b8', callback: (v) => `$${v}` }
                  },
                  x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                }
              }}
            />
          </div>
        </HolographicCard>
      </div>

      {/* Category Cards */}
      <HolographicCard className="!p-0 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-800/40 px-5 py-4 bg-slate-950/40">
          <TrendingDown className="w-5 h-5 text-cyan-400" />
          <h3 className="text-lg font-semibold">Category Analysis</h3>
        </div>
        <div className="p-5">
          {expenseCategories.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Add expense categories to unlock analysis.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {expenseCategories.map((category, index) => {
                const Icon = category.icon
                const ratio =
                  monthlyIncome > 0
                    ? ((category.amount / monthlyIncome) * 100).toFixed(1)
                    : "0"
                return (
                  <div
                    key={index}
                    className="rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-900/80 to-slate-950/60 p-4 hover:border-cyan-500/20 transition-all duration-300"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/15">
                          <Icon className="w-4 h-4 text-cyan-400" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm">{category.category}</h4>
                          <p className="text-xs text-slate-500">{ratio}% of income</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-base">${category.amount.toFixed(0)}</p>
                        <p className="text-xs text-emerald-400 font-medium">
                          Save ${(category.amount - category.potential).toFixed(0)}
                        </p>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-sky-500 transition-all duration-500"
                        style={{ width: `${category.amount > 0 ? (category.potential / category.amount) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </HolographicCard>

      {/* AI Recommendations */}
      {aiAnalysis && !loading ? (
        <HolographicCard className="!p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800/40 px-5 py-4 bg-slate-950/40">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400/20 to-sky-500/20 border border-cyan-500/20">
                <Brain className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">AI Cost-Cutting Recommendations</h3>
                <p className="text-xs text-slate-500">Personalized by BurryAI</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {aiAnalysis.model_used ? (
                <span className="text-xs text-cyan-400/70 bg-cyan-500/5 border border-cyan-500/15 rounded-full px-2.5 py-0.5 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  {formatModelUsed(aiAnalysis.model_used)}
                </span>
              ) : null}
              <button
                onClick={() => void loadAnalysis()}
                disabled={loading}
                className="flex items-center gap-1 rounded-lg border border-slate-700/50 bg-slate-900/60 px-2.5 py-1.5 text-xs text-slate-400 hover:text-cyan-300 hover:border-cyan-500/20 transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
          <div className="px-6 py-5 max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
            {renderAnalysis(aiAnalysis.analysis)}
          </div>
        </HolographicCard>
      ) : null}

      {/* Cost of Living Analysis */}
      <HolographicCard className="!p-0 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-800/40 px-5 py-4 bg-slate-950/40">
          <DollarSign className="w-5 h-5 text-cyan-400" />
          <h3 className="text-lg font-semibold">Cost of Living — {userData.country}</h3>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-700/40 bg-slate-900/50 p-4 text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Your Expenses</p>
              <p className="text-2xl font-bold text-white">${totalExpenses.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/5 p-4 text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Avg Student</p>
              <p className="text-2xl font-bold text-cyan-400">${(totalExpenses * 0.9).toFixed(0)}</p>
            </div>
            <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-4 text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">AI Target</p>
              <p className="text-2xl font-bold text-emerald-400">${(totalExpenses * 0.8).toFixed(0)}</p>
            </div>
          </div>
        </div>
      </HolographicCard>
    </div>
  )
}
