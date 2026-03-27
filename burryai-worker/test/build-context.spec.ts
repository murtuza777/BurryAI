import { describe, expect, it } from "vitest"
import { applyContextOverrides } from "../src/agent/nodes/build-context"

describe("applyContextOverrides", () => {
  it("recomputes totals and ratios from manual expense categories", () => {
    const result = applyContextOverrides(
      {
        monthlyIncome: 3000,
        monthlyExpenses: 1200,
        monthlyLoanPayments: 300,
        remainingBalance: 1500,
        expenseRatio: 40,
        debtToIncomeRatio: 10,
        financialHealthScore: 80,
        topExpenseCategories: [
          { category: "Food", amount: 400 },
          { category: "Rent", amount: 800 }
        ],
        totalLoanBalance: 5000
      },
      {
        monthlyIncome: 4000,
        topExpenseCategories: [
          { category: "Travel", amount: 250 },
          { category: "Housing", amount: 1500 },
          { category: "Food", amount: 500 }
        ]
      }
    )

    expect(result.monthlyIncome).toBe(4000)
    expect(result.monthlyExpenses).toBe(2250)
    expect(result.remainingBalance).toBe(1450)
    expect(result.expenseRatio).toBe(56.25)
    expect(result.debtToIncomeRatio).toBe(7.5)
    expect(result.topExpenseCategories).toEqual([
      { category: "Housing", amount: 1500 },
      { category: "Food", amount: 500 },
      { category: "Travel", amount: 250 }
    ])
  })
})
