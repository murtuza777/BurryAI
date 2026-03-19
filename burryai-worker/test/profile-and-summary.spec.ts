import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test"
import { beforeAll, describe, expect, it } from "vitest"
import worker from "../src/index"

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>

type TestEnv = typeof env & {
  JWT_SECRET: string
}

function extractSessionCookie(setCookieHeader: string | null): string {
  if (!setCookieHeader) {
    throw new Error("Missing set-cookie header")
  }

  const sessionCookie = setCookieHeader.split(";")[0]
  if (!sessionCookie.startsWith("session=")) {
    throw new Error("Session cookie not found")
  }

  return sessionCookie
}

async function runFetch(request: Request, testEnv: TestEnv): Promise<Response> {
  const ctx = createExecutionContext()
  const response = await worker.fetch(request, testEnv, ctx)
  await waitOnExecutionContext(ctx)
  return response
}

async function signupUser(testEnv: TestEnv): Promise<{ userId: string; cookie: string }> {
  const email = `phase4-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`
  const password = "Password1234!"
  const signupResponse = await runFetch(
    new IncomingRequest("http://example.com/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    }),
    testEnv
  )

  expect(signupResponse.status).toBe(201)
  const cookie = extractSessionCookie(signupResponse.headers.get("set-cookie"))
  const body = (await signupResponse.json()) as { user: { id: string } }

  return {
    userId: body.user.id,
    cookie
  }
}

describe("Profile and financial summary routes", () => {
  beforeAll(async () => {
    await env.DB.exec(
      "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
    )
    await env.DB.exec(
      "CREATE TABLE IF NOT EXISTS financial_profiles (user_id TEXT PRIMARY KEY NOT NULL, monthly_income REAL NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'USD', savings_goal REAL NOT NULL DEFAULT 0, risk_tolerance TEXT NOT NULL DEFAULT 'moderate', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE)"
    )
    await env.DB.exec(
      "CREATE TABLE IF NOT EXISTS user_profiles (user_id TEXT PRIMARY KEY NOT NULL, full_name TEXT, country TEXT, student_status TEXT, university TEXT, profession TEXT, skills_json TEXT, other_talents_json TEXT, preferred_work_mode TEXT, city TEXT, state_region TEXT, remote_regions_json TEXT, opportunity_radius_km INTEGER NOT NULL DEFAULT 25, min_hourly_rate REAL NOT NULL DEFAULT 0, onboarding_completed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE)"
    )
    await env.DB.exec(
      "CREATE TABLE IF NOT EXISTS expenses (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, amount REAL NOT NULL, category TEXT NOT NULL, description TEXT, date TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE)"
    )
    await env.DB.exec(
      "CREATE TABLE IF NOT EXISTS loans (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, loan_name TEXT NOT NULL, principal_amount REAL NOT NULL, interest_rate REAL NOT NULL, minimum_payment REAL NOT NULL, remaining_balance REAL NOT NULL, due_date TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE)"
    )
  })

  it("reads and updates financial profile", async () => {
    const testEnv: TestEnv = {
      ...env,
      JWT_SECRET: "phase4-profile-summary-secret"
    }
    const { cookie } = await signupUser(testEnv)

    const getBeforeUpdate = await runFetch(
      new IncomingRequest("http://example.com/profile", {
        method: "GET",
        headers: { Cookie: cookie }
      }),
      testEnv
    )
    expect(getBeforeUpdate.status).toBe(200)

    const updateResponse = await runFetch(
      new IncomingRequest("http://example.com/profile", {
        method: "PUT",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          full_name: "Test Student",
          country: "USA",
          student_status: "undergraduate",
          university: "Example University",
          monthly_income: 3200,
          savings_goal: 800,
          risk_tolerance: "low",
          onboarding_completed: true
        })
      }),
      testEnv
    )

    expect(updateResponse.status).toBe(200)
    const payload = (await updateResponse.json()) as {
      profile: {
        full_name: string
        monthly_income: number
        onboarding_completed: boolean
      }
    }
    expect(payload.profile.full_name).toBe("Test Student")
    expect(payload.profile.monthly_income).toBe(3200)
    expect(payload.profile.onboarding_completed).toBe(true)
  })

  it("returns deterministic financial summary values", async () => {
    const testEnv: TestEnv = {
      ...env,
      JWT_SECRET: "phase4-profile-summary-secret"
    }
    const { userId, cookie } = await signupUser(testEnv)
    const today = new Date().toISOString().slice(0, 10)

    await env.DB.prepare(
      "UPDATE financial_profiles SET monthly_income = ?1 WHERE user_id = ?2"
    )
      .bind(4000, userId)
      .run()
    await env.DB.prepare(
      "INSERT INTO expenses (id, user_id, amount, category, description, date) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
    )
      .bind(crypto.randomUUID(), userId, 1200, "Rent", "Monthly rent", today)
      .run()
    await env.DB.prepare(
      "INSERT INTO loans (id, user_id, loan_name, principal_amount, interest_rate, minimum_payment, remaining_balance, due_date) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"
    )
      .bind(crypto.randomUUID(), userId, "Student Loan", 10000, 5.5, 300, 9000, null)
      .run()

    const summaryResponse = await runFetch(
      new IncomingRequest("http://example.com/financial-summary", {
        method: "GET",
        headers: { Cookie: cookie }
      }),
      testEnv
    )

    expect(summaryResponse.status).toBe(200)
    const payload = (await summaryResponse.json()) as {
      summary: {
        total_income: number
        total_expenses: number
        monthly_loan_payments: number
        remaining_balance: number
        financial_health_score: number
      }
    }
    expect(payload.summary.total_income).toBe(4000)
    expect(payload.summary.total_expenses).toBe(1200)
    expect(payload.summary.monthly_loan_payments).toBe(300)
    expect(payload.summary.remaining_balance).toBe(2500)
    expect(payload.summary.financial_health_score).toBeGreaterThan(0)
    expect(payload.summary.financial_health_score).toBeLessThanOrEqual(100)
  })
})
