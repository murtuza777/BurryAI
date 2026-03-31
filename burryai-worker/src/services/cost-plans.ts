import type { AgentContextData, AgentToolOutput } from "../agent/state"

type SavingsToolOutput = {
  monthlySavingsPotential?: number
  riskLevel?: "low" | "moderate" | "high"
  recommendations?: string[]
}

type PlanRow = {
  id: string
  analysis: string
  model_used: string
  monthly_income: number
  monthly_expenses: number
  remaining_balance: number
  expense_ratio: number
  financial_health_score: number
  target_monthly_savings: number
  created_at: string
  updated_at: string
}

type MilestoneRow = {
  id: string
  plan_id: string
  title: string
  description: string
  due_label: string | null
  target_amount: number
  order_index: number
}

type StepRow = {
  id: string
  milestone_id: string
  title: string
  detail: string | null
  target_amount: number
  order_index: number
  is_completed: number
  completed_at: string | null
}

type DraftStep = {
  title: string
  detail: string
  targetAmount: number
}

type DraftMilestone = {
  title: string
  description: string
  dueLabel: string
  targetAmount: number
  steps: DraftStep[]
}

export type CostPlanStep = {
  id: string
  title: string
  detail: string
  target_amount: number
  order_index: number
  completed: boolean
  completed_at: string | null
}

export type CostPlanMilestone = {
  id: string
  title: string
  description: string
  due_label: string | null
  target_amount: number
  order_index: number
  completed_steps: number
  total_steps: number
  steps: CostPlanStep[]
}

export type CostPlan = {
  id: string
  analysis: string
  model_used: string
  monthly_income: number
  monthly_expenses: number
  remaining_balance: number
  expense_ratio: number
  financial_health_score: number
  target_monthly_savings: number
  created_at: string
  updated_at: string
  progress: {
    completed_steps: number
    total_steps: number
    percentage: number
  }
  milestones: CostPlanMilestone[]
}

function roundCurrency(value: number): number {
  return Number(Math.max(value, 0).toFixed(2))
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function formatCurrency(value: number): string {
  return `$${roundCurrency(value).toLocaleString()}`
}

function categoryCutRate(expenseRatio: number): number {
  if (expenseRatio >= 90) return 0.14
  if (expenseRatio >= 75) return 0.12
  if (expenseRatio >= 60) return 0.1
  return 0.08
}

function getSavingsToolOutput(toolOutputs: AgentToolOutput[]): SavingsToolOutput | null {
  const candidate = toolOutputs.find((tool) => tool.name === "costCutter")?.output
  if (!candidate || typeof candidate !== "object") {
    return null
  }

  return candidate as SavingsToolOutput
}

function buildMilestones(context: AgentContextData, targetMonthlySavings: number): DraftMilestone[] {
  const cutRate = categoryCutRate(context.expenseRatio)
  const topCategory = context.topExpenseCategories[0]
  const secondCategory = context.topExpenseCategories[1]
  const thirdCategory = context.topExpenseCategories[2]

  const quickWinsTarget = roundCurrency(clamp(targetMonthlySavings * 0.2, 15, targetMonthlySavings))
  const topCategoryTarget = roundCurrency(
    topCategory ? clamp(topCategory.amount * cutRate, 20, targetMonthlySavings * 0.45) : targetMonthlySavings * 0.3
  )
  const secondCategoryTarget = roundCurrency(
    secondCategory
      ? clamp(secondCategory.amount * (cutRate - 0.02), 15, targetMonthlySavings * 0.3)
      : targetMonthlySavings * 0.2
  )
  const savingsGuardrailTarget = roundCurrency(
    Math.max(targetMonthlySavings - quickWinsTarget - topCategoryTarget - secondCategoryTarget, 15)
  )
  const weeklyLimit = roundCurrency(targetMonthlySavings / 4)

  return [
    {
      title: "Week 1 - Quick wins",
      description: "Remove easy waste first so the plan starts with small, realistic savings you can keep.",
      dueLabel: "This week",
      targetAmount: quickWinsTarget,
      steps: [
        {
          title: "Cancel one unused recurring charge",
          detail: `Review subscriptions and pause or downgrade at least one charge worth about ${formatCurrency(
            Math.max(quickWinsTarget * 0.5, 8)
          )}.`,
          targetAmount: roundCurrency(Math.max(quickWinsTarget * 0.5, 8))
        },
        {
          title: "Set weekly caps for non-essentials",
          detail: `Put a weekly limit of about ${formatCurrency(
            weeklyLimit
          )} across dining, shopping, and impulse categories before the next payday.`,
          targetAmount: roundCurrency(Math.max(quickWinsTarget * 0.5, 7))
        }
      ]
    },
    {
      title: topCategory ? `Week 2 - Cut ${topCategory.category}` : "Week 2 - Cut your biggest category",
      description: topCategory
        ? `${topCategory.category} is your biggest cost area, so the highest-impact cut should happen here.`
        : "Focus the second week on the spending area that drains the most money.",
      dueLabel: "Next 7 days",
      targetAmount: topCategoryTarget,
      steps: [
        {
          title: topCategory ? `Reduce ${topCategory.category} by one clear rule` : "Reduce the largest spending bucket",
          detail: topCategory
            ? `Bring ${topCategory.category} down by about ${formatCurrency(
                topCategoryTarget
              )} using one rule such as fewer delivery orders, lower transport spend, or one cheaper weekly swap.`
            : `Choose the largest category in your budget and cut at least ${formatCurrency(topCategoryTarget)} from it.`,
          targetAmount: topCategoryTarget
        }
      ]
    },
    {
      title: secondCategory
        ? `Week 3 - Rein in ${secondCategory.category}`
        : "Week 3 - Tighten the second leak",
      description: secondCategory
        ? `After the biggest cut, the next fastest gain comes from tightening ${secondCategory.category}.`
        : "Add a second category cut so the plan does not rely on only one change.",
      dueLabel: "Week 3",
      targetAmount: secondCategoryTarget,
      steps: [
        {
          title: secondCategory ? `Trim ${secondCategory.category}` : "Trim a second discretionary category",
          detail: secondCategory
            ? `Target another ${formatCurrency(
                secondCategoryTarget
              )} by lowering frequency, switching to a cheaper option, or delaying one purchase cycle.`
            : `Find a second category to trim by about ${formatCurrency(secondCategoryTarget)} this month.`,
          targetAmount: secondCategoryTarget
        },
        {
          title: "Use a 24-hour pause rule",
          detail: `Any non-essential purchase should wait 24 hours. This protects at least ${formatCurrency(
            Math.max(secondCategoryTarget * 0.3, 6)
          )} from impulse spending.`,
          targetAmount: roundCurrency(Math.max(secondCategoryTarget * 0.3, 6))
        }
      ]
    },
    {
      title: "Week 4 - Lock the savings in",
      description:
        "Move the money you saved out of spending reach and review which cuts should become your default next month.",
      dueLabel: "End of month",
      targetAmount: savingsGuardrailTarget,
      steps: [
        {
          title: "Auto-move savings on payday",
          detail: `Set an automatic transfer of about ${formatCurrency(
            savingsGuardrailTarget
          )} to savings or debt payoff so the cut becomes real progress.`,
          targetAmount: savingsGuardrailTarget
        },
        {
          title: "Review actual vs planned spend",
          detail: `Compare this month's numbers to the plan and keep the best-performing cuts, especially in ${
            thirdCategory?.category ?? topCategory?.category ?? "your major categories"
          }.`,
          targetAmount: 0
        }
      ]
    }
  ]
}

function toCostPlan(plan: PlanRow, milestones: MilestoneRow[], steps: StepRow[]): CostPlan {
  const milestoneMap = new Map<string, CostPlanMilestone>()
  let completedSteps = 0

  for (const milestone of milestones) {
    milestoneMap.set(milestone.id, {
      id: milestone.id,
      title: milestone.title,
      description: milestone.description,
      due_label: milestone.due_label,
      target_amount: roundCurrency(milestone.target_amount),
      order_index: milestone.order_index,
      completed_steps: 0,
      total_steps: 0,
      steps: []
    })
  }

  for (const step of steps) {
    const milestone = milestoneMap.get(step.milestone_id)
    if (!milestone) continue

    const completed = step.is_completed === 1
    if (completed) {
      completedSteps += 1
      milestone.completed_steps += 1
    }

    milestone.total_steps += 1
    milestone.steps.push({
      id: step.id,
      title: step.title,
      detail: step.detail ?? "",
      target_amount: roundCurrency(step.target_amount),
      order_index: step.order_index,
      completed,
      completed_at: step.completed_at
    })
  }

  const orderedMilestones = [...milestoneMap.values()].sort((a, b) => a.order_index - b.order_index)
  for (const milestone of orderedMilestones) {
    milestone.steps.sort((a, b) => a.order_index - b.order_index)
  }

  const totalSteps = orderedMilestones.reduce((sum, milestone) => sum + milestone.total_steps, 0)

  return {
    id: plan.id,
    analysis: plan.analysis,
    model_used: plan.model_used,
    monthly_income: roundCurrency(plan.monthly_income),
    monthly_expenses: roundCurrency(plan.monthly_expenses),
    remaining_balance: roundCurrency(plan.remaining_balance),
    expense_ratio: Number(plan.expense_ratio.toFixed(2)),
    financial_health_score: plan.financial_health_score,
    target_monthly_savings: roundCurrency(plan.target_monthly_savings),
    created_at: plan.created_at,
    updated_at: plan.updated_at,
    progress: {
      completed_steps: completedSteps,
      total_steps: totalSteps,
      percentage: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0
    },
    milestones: orderedMilestones
  }
}

async function getPlanWithChildren(db: D1Database, planId: string, userId: string): Promise<CostPlan | null> {
  const [planRow, milestonesResult, stepsResult] = await Promise.all([
    db.prepare(
      "SELECT id, analysis, model_used, monthly_income, monthly_expenses, remaining_balance, expense_ratio, financial_health_score, target_monthly_savings, created_at, updated_at " +
        "FROM cost_cutter_plans WHERE id = ?1 AND user_id = ?2"
    )
      .bind(planId, userId)
      .first<PlanRow>(),
    db.prepare(
      "SELECT m.id, m.plan_id, m.title, m.description, m.due_label, m.target_amount, m.order_index " +
        "FROM cost_cutter_plan_milestones m " +
        "INNER JOIN cost_cutter_plans p ON p.id = m.plan_id " +
        "WHERE m.plan_id = ?1 AND p.user_id = ?2 " +
        "ORDER BY m.order_index ASC, m.id ASC"
    )
      .bind(planId, userId)
      .all<MilestoneRow>(),
    db.prepare(
      "SELECT s.id, s.milestone_id, s.title, s.detail, s.target_amount, s.order_index, s.is_completed, s.completed_at " +
        "FROM cost_cutter_plan_steps s " +
        "INNER JOIN cost_cutter_plan_milestones m ON m.id = s.milestone_id " +
        "INNER JOIN cost_cutter_plans p ON p.id = m.plan_id " +
        "WHERE p.id = ?1 AND p.user_id = ?2 " +
        "ORDER BY m.order_index ASC, s.order_index ASC, s.id ASC"
    )
      .bind(planId, userId)
      .all<StepRow>()
  ])

  if (!planRow) {
    return null
  }

  return toCostPlan(planRow, milestonesResult.results ?? [], stepsResult.results ?? [])
}

export async function saveCostCutterPlan(params: {
  db: D1Database
  userId: string
  analysis: string
  modelUsed: string
  context: AgentContextData
  toolOutputs: AgentToolOutput[]
}): Promise<CostPlan> {
  const savingsTool = getSavingsToolOutput(params.toolOutputs)
  const fallbackTarget = Math.max(
    params.context.monthlyExpenses * 0.08,
    (params.context.topExpenseCategories[0]?.amount ?? 250) * 0.08
  )
  const inferredTarget = roundCurrency(
    savingsTool?.monthlySavingsPotential ?? fallbackTarget
  )
  const targetMonthlySavings = clamp(inferredTarget, 15, Math.max(params.context.monthlyExpenses, 15))
  const milestones = buildMilestones(params.context, targetMonthlySavings)
  const planId = crypto.randomUUID()

  const statements: D1PreparedStatement[] = [
    params.db
      .prepare(
        "INSERT INTO cost_cutter_plans (id, user_id, analysis, model_used, monthly_income, monthly_expenses, remaining_balance, expense_ratio, financial_health_score, target_monthly_savings) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)"
      )
      .bind(
        planId,
        params.userId,
        params.analysis,
        params.modelUsed,
        roundCurrency(params.context.monthlyIncome),
        roundCurrency(params.context.monthlyExpenses),
        roundCurrency(params.context.remainingBalance),
        Number(params.context.expenseRatio.toFixed(2)),
        params.context.financialHealthScore,
        roundCurrency(targetMonthlySavings)
      )
  ]

  milestones.forEach((milestone, milestoneIndex) => {
    const milestoneId = crypto.randomUUID()
    statements.push(
      params.db
        .prepare(
          "INSERT INTO cost_cutter_plan_milestones (id, plan_id, title, description, due_label, target_amount, order_index) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"
        )
        .bind(
          milestoneId,
          planId,
          milestone.title,
          milestone.description,
          milestone.dueLabel,
          roundCurrency(milestone.targetAmount),
          milestoneIndex
        )
    )

    milestone.steps.forEach((step, stepIndex) => {
      statements.push(
        params.db
          .prepare(
            "INSERT INTO cost_cutter_plan_steps (id, milestone_id, title, detail, target_amount, order_index) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
          )
          .bind(
            crypto.randomUUID(),
            milestoneId,
            step.title,
            step.detail,
            roundCurrency(step.targetAmount),
            stepIndex
          )
      )
    })
  })

  await params.db.batch(statements)

  const plan = await getPlanWithChildren(params.db, planId, params.userId)
  if (!plan) {
    throw new Error("Failed to save cost cutter plan")
  }

  return plan
}

export async function getLatestCostCutterPlan(
  db: D1Database,
  userId: string
): Promise<CostPlan | null> {
  const latest = await db
    .prepare("SELECT id FROM cost_cutter_plans WHERE user_id = ?1 ORDER BY datetime(created_at) DESC, id DESC LIMIT 1")
    .bind(userId)
    .first<{ id: string }>()

  if (!latest) {
    return null
  }

  return getPlanWithChildren(db, latest.id, userId)
}

export async function setCostPlanStepCompletion(params: {
  db: D1Database
  userId: string
  stepId: string
  completed: boolean
}): Promise<CostPlan | null> {
  const owner = await params.db
    .prepare(
      "SELECT p.id AS plan_id " +
        "FROM cost_cutter_plan_steps s " +
        "INNER JOIN cost_cutter_plan_milestones m ON m.id = s.milestone_id " +
        "INNER JOIN cost_cutter_plans p ON p.id = m.plan_id " +
        "WHERE s.id = ?1 AND p.user_id = ?2"
    )
    .bind(params.stepId, params.userId)
    .first<{ plan_id: string }>()

  if (!owner) {
    return null
  }

  await params.db
    .prepare(
      "UPDATE cost_cutter_plan_steps SET is_completed = ?1, completed_at = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?3"
    )
    .bind(params.completed ? 1 : 0, params.completed ? new Date().toISOString() : null, params.stepId)
    .run()

  await params.db
    .prepare("UPDATE cost_cutter_plans SET updated_at = CURRENT_TIMESTAMP WHERE id = ?1 AND user_id = ?2")
    .bind(owner.plan_id, params.userId)
    .run()

  return getPlanWithChildren(params.db, owner.plan_id, params.userId)
}
