import { z } from "zod"
import { baseToolInputSchema, type ToolDefinition } from "./types"

const outputSchema = z.object({
  monthlyIncome: z.number(),
  savingsGoal: z.number(),
  currency: z.string(),
  riskTolerance: z.string(),
  remainingBalance: z.number(),
  expenseRatio: z.number(),
  debtToIncomeRatio: z.number()
})

type FinancialProfileRow = {
  monthly_income: number | null
  savings_goal: number | null
  currency: string | null
  risk_tolerance: string | null
}

export const getFinancialProfileTool: ToolDefinition<typeof baseToolInputSchema, typeof outputSchema> =
  {
    name: "getFinancialProfile",
    description: "Fetch user financial profile and baseline metrics.",
    inputSchema: baseToolInputSchema,
    outputSchema,
    async run(input, ctx) {
      const profile = await ctx.db
        .prepare(
          "SELECT monthly_income, savings_goal, currency, risk_tolerance FROM financial_profiles WHERE user_id = ?1 LIMIT 1"
        )
        .bind(input.userId)
        .first<FinancialProfileRow>()

      return {
        monthlyIncome: Number(input.context.monthlyIncome.toFixed(2)),
        savingsGoal: Number((profile?.savings_goal ?? 0).toFixed(2)),
        currency: profile?.currency ?? "USD",
        riskTolerance: profile?.risk_tolerance ?? "moderate",
        remainingBalance: input.context.remainingBalance,
        expenseRatio: input.context.expenseRatio,
        debtToIncomeRatio: input.context.debtToIncomeRatio
      }
    },
    summarize(output) {
      return `Profile income $${output.monthlyIncome.toLocaleString()}, balance $${output.remainingBalance.toLocaleString()}, expense ratio ${output.expenseRatio.toFixed(1)}%.`
    }
  }
