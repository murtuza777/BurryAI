import { env } from "cloudflare:test"
import { beforeAll, describe, expect, it } from "vitest"
import { executeTools } from "../src/tools"
import { __private__ as costCutterPrivate } from "../src/tools/cost-cutter"
import { __private__ as financialHealthPrivate } from "../src/tools/financial-health"
import { __private__ as loanOptimizerPrivate } from "../src/tools/loan-optimizer"

describe("tool helpers", () => {
  it("classifies cost-cutter risk from ratios", () => {
    expect(costCutterPrivate.classifyRisk(92, 15)).toBe("high")
    expect(costCutterPrivate.classifyRisk(65, 22)).toBe("moderate")
    expect(costCutterPrivate.classifyRisk(40, 10)).toBe("low")
  })

  it("maps health score to deterministic grades", () => {
    expect(financialHealthPrivate.toGrade(85)).toBe("excellent")
    expect(financialHealthPrivate.toGrade(70)).toBe("good")
    expect(financialHealthPrivate.toGrade(48)).toBe("fair")
    expect(financialHealthPrivate.toGrade(25)).toBe("critical")
  })

  it("chooses avalanche strategy for high-interest debt", () => {
    const strategy = loanOptimizerPrivate.chooseStrategy([
      {
        loan_name: "Card",
        remaining_balance: 2000,
        interest_rate: 19,
        minimum_payment: 120,
        due_date: null
      },
      {
        loan_name: "Student Loan",
        remaining_balance: 12000,
        interest_rate: 5.5,
        minimum_payment: 280,
        due_date: null
      }
    ])

    expect(strategy).toBe("avalanche")
  })
})

describe("tool registry execution", () => {
  beforeAll(async () => {
    await env.DB.exec(
      "CREATE TABLE IF NOT EXISTS financial_profiles (user_id TEXT PRIMARY KEY NOT NULL, monthly_income REAL NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'USD', savings_goal REAL NOT NULL DEFAULT 0, risk_tolerance TEXT NOT NULL DEFAULT 'moderate', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
    )
    await env.DB.exec(
      "CREATE TABLE IF NOT EXISTS expenses (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, amount REAL NOT NULL, category TEXT NOT NULL, description TEXT, date TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
    )
    await env.DB.exec(
      "CREATE TABLE IF NOT EXISTS loans (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, loan_name TEXT NOT NULL, principal_amount REAL NOT NULL, interest_rate REAL NOT NULL, minimum_payment REAL NOT NULL, remaining_balance REAL NOT NULL, due_date TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
    )
  })

  it("executes selected tools with validated outputs", async () => {
    const userId = `tool-user-${Date.now()}`
    await env.DB
      .prepare(
        "INSERT INTO financial_profiles (user_id, monthly_income, currency, savings_goal, risk_tolerance) VALUES (?1, ?2, ?3, ?4, ?5)"
      )
      .bind(userId, 4000, "USD", 800, "moderate")
      .run()

    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO expenses (id, user_id, amount, category, description, date) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
      ).bind(crypto.randomUUID(), userId, 420, "Food", "Food spend", "2026-03-02"),
      env.DB.prepare(
        "INSERT INTO loans (id, user_id, loan_name, principal_amount, interest_rate, minimum_payment, remaining_balance, due_date) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"
      ).bind(crypto.randomUUID(), userId, "Student Loan", 10000, 6.1, 250, 9000, "2026-04-12")
    ])

    const outputs = await executeTools({
      db: env.DB,
      userId,
      context: {
        monthlyIncome: 4000,
        monthlyExpenses: 420,
        monthlyLoanPayments: 250,
        remainingBalance: 3330,
        expenseRatio: 10.5,
        debtToIncomeRatio: 6.25,
        financialHealthScore: 90,
        topExpenseCategories: [{ category: "Food", amount: 420 }],
        totalLoanBalance: 9000
      },
      selectedTools: ["getFinancialProfile", "getExpenses", "financialHealth", "loanOptimizer"],
      userMessage: "Build a plan for my debt and spending."
    })

    expect(outputs).toHaveLength(4)
    expect(outputs.map((item) => item.name)).toEqual([
      "getFinancialProfile",
      "getExpenses",
      "financialHealth",
      "loanOptimizer"
    ])
    expect(outputs.every((item) => item.summary.length > 0)).toBe(true)
  })
})
