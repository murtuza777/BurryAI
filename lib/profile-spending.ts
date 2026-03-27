import type { ExpenseItem } from '@/lib/financial-client'

export const PROFILE_SPENDING_DESCRIPTION = 'Profile spending setup'

export function isCurrentMonth(date: string): boolean {
  return date.slice(0, 7) === new Date().toISOString().slice(0, 7)
}

export function getProfileSpendingExpenses(expenses: ExpenseItem[]): ExpenseItem[] {
  return expenses.filter(
    (expense) =>
      expense.description === PROFILE_SPENDING_DESCRIPTION &&
      isCurrentMonth(expense.date)
  )
}

export function buildProfileSpendingCategories(
  expenses: ExpenseItem[]
): Array<{ category: string; amount: number; percentage: number }> {
  const grouped = new Map<string, number>()

  for (const expense of getProfileSpendingExpenses(expenses)) {
    grouped.set(
      expense.category,
      Number(((grouped.get(expense.category) ?? 0) + expense.amount).toFixed(2))
    )
  }

  const total = Array.from(grouped.values()).reduce((sum, amount) => sum + amount, 0)

  return Array.from(grouped.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: total > 0 ? Number(((amount / total) * 100).toFixed(2)) : 0
    }))
    .sort((a, b) => b.amount - a.amount)
}
