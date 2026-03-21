import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test"
import { beforeAll, describe, expect, it } from "vitest"
import worker from "../src/index"
import { __private__ as opportunitiesPrivate } from "../src/services/opportunities"

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
  const email = `phase-opps-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`
  const password = "Password1234!"
  const response = await runFetch(
    new IncomingRequest("http://example.com/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    }),
    testEnv
  )

  expect(response.status).toBe(201)
  const body = (await response.json()) as { user: { id: string } }
  return {
    userId: body.user.id,
    cookie: extractSessionCookie(response.headers.get("set-cookie"))
  }
}

describe("Opportunities route", () => {
  it("classifies direct job boards and blocks non-listing media", () => {
    expect(
      opportunitiesPrivate.classifySource({
        url: "https://www.linkedin.com/jobs/view/123456789",
        text: "frontend engineer remote hiring",
        university: ""
      })
    ).toEqual({
      sourceSite: "LinkedIn",
      listingQuality: "high"
    })

    expect(
      opportunitiesPrivate.classifySource({
        url: "https://www.youtube.com/watch?v=abc123",
        text: "best remote jobs video",
        university: ""
      }).listingQuality
    ).toBeNull()
  })

  it("prioritizes niche and direct sources above mainstream boards", () => {
    expect(opportunitiesPrivate.sourcePriorityAdjustment("Greenhouse", "high")).toBeGreaterThan(
      opportunitiesPrivate.sourcePriorityAdjustment("LinkedIn", "high")
    )

    expect(opportunitiesPrivate.sourcePriorityAdjustment("Reddit", "community")).toBeGreaterThan(
      opportunitiesPrivate.sourcePriorityAdjustment("Indeed", "high")
    )
  })

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
  })

  it("returns structured payload even when providers are unavailable", async () => {
    const testEnv: TestEnv = {
      ...env,
      JWT_SECRET: "phase-opportunities-secret"
    }
    const { cookie } = await signupUser(testEnv)

    const profileUpdate = await runFetch(
      new IncomingRequest("http://example.com/profile", {
        method: "PUT",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          profession: "UI Designer",
          skills: ["figma", "ux"],
          preferred_work_mode: "remote",
          city: "Boston",
          country: "United States",
          remote_regions: ["United States", "Canada"]
        })
      }),
      testEnv
    )
    expect(profileUpdate.status).toBe(200)

    const response = await runFetch(
      new IncomingRequest("http://example.com/opportunities/search", {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query: "remote ui design internship",
          mode: "remote",
          max_results: 10
        })
      }),
      testEnv
    )

    expect(response.status).toBe(200)
    const payload = (await response.json()) as {
      opportunities: unknown[]
      generated_queries: string[]
      filters_applied: { mode: string }
      profile_summary: { profession: string }
    }

    expect(Array.isArray(payload.opportunities)).toBe(true)
    expect(Array.isArray(payload.generated_queries)).toBe(true)
    expect(payload.filters_applied.mode).toBe("remote")
    expect(payload.profile_summary.profession).toBe("UI Designer")
  })
})
