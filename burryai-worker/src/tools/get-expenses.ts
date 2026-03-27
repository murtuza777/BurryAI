import { z } from "zod"
import { baseToolInputSchema, type ToolDefinition } from "./types"

type ExpenseCategoryRow = {
  category: string
  amount: number
}

type RecentExpenseRow = {
  amount: number
  category: string
  date: string
}

const outputSchema = z.object({
  totalMonthlyExpenses: z.number(),
  topCategories: z.array(
    z.object({
      category: z.string(),
      amount: z.number()
    })
  ),
  recentExpenses: z.array(
    z.object({
      amount: z.number(),
      category: z.string(),
      date: z.string()
    })
  )
})

export const getExpensesTool: ToolDefinition<typeof baseToolInputSchema, typeof outputSchema> = {
  name: "getExpenses",
  description: "Return monthly expense breakdown and recent transactions.",
  inputSchema: baseToolInputSchema,
  outputSchema,
  async run(input, ctx) {
    if (ctx.expenseCategoriesOverride && ctx.expenseCategoriesOverride.length > 0) {
      return {
        totalMonthlyExpenses: input.context.monthlyExpenses,
        topCategories: ctx.expenseCategoriesOverride,
        recentExpenses: []
      }
    }

    const [categoryRows, recentRows] = await Promise.all([
      ctx.db
        .prepare(
          "SELECT category, COALESCE(SUM(amount), 0) AS amount FROM expenses WHERE user_id = ?1 GROUP BY category ORDER BY amount DESC LIMIT 5"
        )
        .bind(input.userId)
        .all<ExpenseCategoryRow>(),
      ctx.db
        .prepare(
          "SELECT amount, category, date FROM expenses WHERE user_id = ?1 ORDER BY date DESC, created_at DESC LIMIT 5"
        )
        .bind(input.userId)
        .all<RecentExpenseRow>()
    ])

    return {
      totalMonthlyExpenses: input.context.monthlyExpenses,
      topCategories: (categoryRows.results ?? []).map((row) => ({
        category: row.category,
        amount: Number(row.amount.toFixed(2))
      })),
      recentExpenses: (recentRows.results ?? []).map((row) => ({
        amount: Number(row.amount.toFixed(2)),
        category: row.category,
        date: row.date
      }))
    }
  },
  summarize(output) {
    const topCategory = output.topCategories[0]
    if (!topCategory) {
      return "No expenses recorded yet."
    }

    return `Total expenses $${output.totalMonthlyExpenses.toLocaleString()}; top category ${topCategory.category} at $${topCategory.amount.toLocaleString()}.`
  }
}
