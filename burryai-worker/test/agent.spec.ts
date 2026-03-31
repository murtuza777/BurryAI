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

async function signupUser(testEnv: TestEnv): Promise<{
  userId: string
  cookie: string
  email: string
  password: string
}> {
  const email = `phase6-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`
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
  const body = (await signupResponse.json()) as { user: { id: string } }
  return {
    userId: body.user.id,
    cookie: extractSessionCookie(signupResponse.headers.get("set-cookie")),
    email,
    password
  }
}

describe("Agent routes", () => {
  beforeAll(async () => {
    await env.DB.exec(
      "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
    )
    await env.DB.exec(
      "CREATE TABLE IF NOT EXISTS financial_profiles (user_id TEXT PRIMARY KEY NOT NULL, monthly_income REAL NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'USD', savings_goal REAL NOT NULL DEFAULT 0, risk_tolerance TEXT NOT NULL DEFAULT 'moderate', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE)"
    )
    await env.DB.exec(
      "CREATE TABLE IF NOT EXISTS expenses (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, amount REAL NOT NULL, category TEXT NOT NULL, description TEXT, date TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE)"
    )
    await env.DB.exec(
      "CREATE TABLE IF NOT EXISTS loans (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, loan_name TEXT NOT NULL, principal_amount REAL NOT NULL, interest_rate REAL NOT NULL, minimum_payment REAL NOT NULL, remaining_balance REAL NOT NULL, due_date TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE)"
    )
    await env.DB.exec(
      "CREATE TABLE IF NOT EXISTS ai_logs (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, query TEXT NOT NULL, response TEXT NOT NULL, model_used TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE)"
    )
    await env.DB.exec(
      "CREATE TABLE IF NOT EXISTS advisor_threads (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, title TEXT NOT NULL DEFAULT 'New Chat', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE)"
    )
    await env.DB.exec(
      "CREATE TABLE IF NOT EXISTS advisor_messages (id TEXT PRIMARY KEY NOT NULL, thread_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, model_used TEXT, meta_json TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (thread_id) REFERENCES advisor_threads(id) ON DELETE CASCADE ON UPDATE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE)"
    )
    await env.DB.exec(
      "CREATE TABLE IF NOT EXISTS cost_cutter_plans (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, analysis TEXT NOT NULL, model_used TEXT NOT NULL, monthly_income REAL NOT NULL DEFAULT 0, monthly_expenses REAL NOT NULL DEFAULT 0, remaining_balance REAL NOT NULL DEFAULT 0, expense_ratio REAL NOT NULL DEFAULT 0, financial_health_score INTEGER NOT NULL DEFAULT 0, target_monthly_savings REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE)"
    )
    await env.DB.exec(
      "CREATE TABLE IF NOT EXISTS cost_cutter_plan_milestones (id TEXT PRIMARY KEY NOT NULL, plan_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, due_label TEXT, target_amount REAL NOT NULL DEFAULT 0, order_index INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (plan_id) REFERENCES cost_cutter_plans(id) ON DELETE CASCADE ON UPDATE CASCADE)"
    )
    await env.DB.exec(
      "CREATE TABLE IF NOT EXISTS cost_cutter_plan_steps (id TEXT PRIMARY KEY NOT NULL, milestone_id TEXT NOT NULL, title TEXT NOT NULL, detail TEXT, target_amount REAL NOT NULL DEFAULT 0, order_index INTEGER NOT NULL DEFAULT 0, is_completed INTEGER NOT NULL DEFAULT 0, completed_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (milestone_id) REFERENCES cost_cutter_plan_milestones(id) ON DELETE CASCADE ON UPDATE CASCADE)"
    )
  })

  it("rejects unauthorized advice requests", async () => {
    const testEnv: TestEnv = {
      ...env,
      JWT_SECRET: "phase6-agent-secret"
    }

    const response = await runFetch(
      new IncomingRequest("http://example.com/agent/advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "How can I budget better?" })
      }),
      testEnv
    )

    expect(response.status).toBe(401)
  })

  it("returns advice and writes ai_logs row", async () => {
    const testEnv: TestEnv = {
      ...env,
      JWT_SECRET: "phase6-agent-secret"
    }

    const user = await signupUser(testEnv)

    await env.DB.prepare("UPDATE financial_profiles SET monthly_income = ?1 WHERE user_id = ?2")
      .bind(3500, user.userId)
      .run()

    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO expenses (id, user_id, amount, category, description, date) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
      )
        .bind(crypto.randomUUID(), user.userId, 700, "Rent", "Rent", "2026-03-01"),
      env.DB.prepare(
        "INSERT INTO loans (id, user_id, loan_name, principal_amount, interest_rate, minimum_payment, remaining_balance, due_date) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"
      )
        .bind(crypto.randomUUID(), user.userId, "Student Loan", 18000, 5.9, 300, 16200, "2026-04-20")
    ])

    const prompt = "Give me a debt repayment plan for this month."
    const response = await runFetch(
      new IncomingRequest("http://example.com/agent/advice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: user.cookie
        },
        body: JSON.stringify({ message: prompt })
      }),
      testEnv
    )

    expect(response.status).toBe(200)
    const payload = (await response.json()) as {
      response: string
      model_used: string
      intent: string
      used_tools: string[]
      knowledge_sources: Array<{ title: string; source: string }>
      web_sources: Array<{ title: string; url: string; source: string }>
    }
    expect(payload.response.length).toBeGreaterThan(0)
    expect(payload.model_used.length).toBeGreaterThan(0)
    expect(payload.intent).toBe("debt")
    expect(payload.used_tools.length).toBeGreaterThan(0)
    expect(payload.used_tools).toContain("loanOptimizer")
    expect(payload.knowledge_sources.length).toBeGreaterThan(0)
    expect(Array.isArray(payload.web_sources)).toBe(true)
    if (payload.model_used.startsWith("fallback:")) {
      // Rule-based fallback returns structured advice; assert intent-related content
      expect(payload.response.toLowerCase()).toContain("debt")
    }

    const logRow = await env.DB.prepare(
      "SELECT user_id, query, response, model_used FROM ai_logs WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 1"
    )
      .bind(user.userId)
      .first<{
        user_id: string
        query: string
        response: string
        model_used: string
      }>()

    expect(logRow).not.toBeNull()
    expect(logRow?.user_id).toBe(user.userId)
    expect(logRow?.query).toBe(prompt)
    expect(logRow?.response.length ?? 0).toBeGreaterThan(0)
    expect(logRow?.model_used.length ?? 0).toBeGreaterThan(0)
  })

  it("persists advisor chat threads and messages for the signed-in account", async () => {
    const testEnv: TestEnv = {
      ...env,
      JWT_SECRET: "phase6-agent-secret"
    }

    const user = await signupUser(testEnv)

    await env.DB.prepare("UPDATE financial_profiles SET monthly_income = ?1 WHERE user_id = ?2")
      .bind(3200, user.userId)
      .run()

    const createResponse = await runFetch(
      new IncomingRequest("http://example.com/agent/chats", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: user.cookie
        },
        body: JSON.stringify({})
      }),
      testEnv
    )

    expect(createResponse.status).toBe(201)
    const createPayload = (await createResponse.json()) as {
      thread: {
        id: string
        messages: Array<{ role: string; content: string }>
      }
    }
    expect(createPayload.thread.messages.length).toBe(1)

    const messageText = "Help me cut spending on food and subscriptions this month."
    const sendResponse = await runFetch(
      new IncomingRequest(`http://example.com/agent/chats/${createPayload.thread.id}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: user.cookie
        },
        body: JSON.stringify({ message: messageText })
      }),
      testEnv
    )

    expect(sendResponse.status).toBe(200)
    const sendPayload = (await sendResponse.json()) as {
      thread: {
        title: string
        messages: Array<{ role: string; content: string }>
      }
    }
    expect(sendPayload.thread.title.toLowerCase()).toContain("help me cut")
    expect(sendPayload.thread.messages.some((message) => message.role === "user" && message.content === messageText)).toBe(true)
    expect(sendPayload.thread.messages.some((message) => message.role === "assistant")).toBe(true)

    const listResponse = await runFetch(
      new IncomingRequest("http://example.com/agent/chats", {
        method: "GET",
        headers: {
          Cookie: user.cookie
        }
      }),
      testEnv
    )

    expect(listResponse.status).toBe(200)
    const listPayload = (await listResponse.json()) as {
      threads: Array<{
        id: string
        messages: Array<{ role: string; content: string }>
      }>
    }
    expect(listPayload.threads.some((thread) => thread.id === createPayload.thread.id)).toBe(true)
    const persistedThread = listPayload.threads.find((thread) => thread.id === createPayload.thread.id)
    expect(persistedThread?.messages.some((message) => message.content === messageText)).toBe(true)
  })

  it("stores a cost cutter plan with milestones and persists step completion", async () => {
    const testEnv: TestEnv = {
      ...env,
      JWT_SECRET: "phase6-agent-secret"
    }

    const user = await signupUser(testEnv)

    const analysisResponse = await runFetch(
      new IncomingRequest("http://example.com/agent/cost-analysis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: user.cookie
        },
        body: JSON.stringify({
          monthlyIncome: 3000,
          categories: [
            { category: "Food", amount: 650 },
            { category: "Subscriptions", amount: 120 },
            { category: "Transport", amount: 240 }
          ]
        })
      }),
      testEnv
    )

    expect(analysisResponse.status).toBe(200)
    const analysisPayload = (await analysisResponse.json()) as {
      plan: {
        id: string
        milestones: Array<{
          id: string
          steps: Array<{ id: string; completed: boolean }>
        }>
      }
    }
    expect(analysisPayload.plan.milestones.length).toBeGreaterThan(0)
    expect(analysisPayload.plan.milestones[0]?.steps.length ?? 0).toBeGreaterThan(0)

    const latestPlanResponse = await runFetch(
      new IncomingRequest("http://example.com/agent/cost-plan", {
        method: "GET",
        headers: {
          Cookie: user.cookie
        }
      }),
      testEnv
    )

    expect(latestPlanResponse.status).toBe(200)
    const latestPlanPayload = (await latestPlanResponse.json()) as {
      plan: {
        id: string
        progress: { completed_steps: number }
        milestones: Array<{
          steps: Array<{ id: string; completed: boolean }>
        }>
      } | null
    }
    expect(latestPlanPayload.plan?.id).toBe(analysisPayload.plan.id)

    const firstStepId = latestPlanPayload.plan?.milestones[0]?.steps[0]?.id
    expect(firstStepId).toBeTruthy()

    const patchResponse = await runFetch(
      new IncomingRequest(`http://example.com/agent/cost-plan/steps/${firstStepId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: user.cookie
        },
        body: JSON.stringify({ completed: true })
      }),
      testEnv
    )

    expect(patchResponse.status).toBe(200)
    const patchPayload = (await patchResponse.json()) as {
      plan: {
        progress: { completed_steps: number }
        milestones: Array<{
          steps: Array<{ id: string; completed: boolean }>
        }>
      }
    }
    expect(patchPayload.plan.progress.completed_steps).toBeGreaterThanOrEqual(1)
    expect(
      patchPayload.plan.milestones.some((milestone) =>
        milestone.steps.some((step) => step.id === firstStepId && step.completed)
      )
    ).toBe(true)
  })
})
