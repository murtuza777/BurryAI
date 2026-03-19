import { Hono } from "hono"
import { z } from "zod"
import { requireAuth } from "../middleware/auth"
import { getFullProfile, updateFullProfile } from "../services/profile"
import type { AppEnv } from "../types"

const riskToleranceSchema = z.enum(["low", "moderate", "high"])
const workModeSchema = z.enum(["local", "remote", "hybrid"])
const listFieldSchema = z
  .array(z.string().trim().min(1).max(60))
  .max(50)
  .optional()

const profileUpdateSchema = z
  .object({
    full_name: z.string().trim().max(120).optional(),
    country: z.string().trim().max(80).optional(),
    student_status: z.string().trim().max(50).optional(),
    university: z.string().trim().max(120).optional(),
    profession: z.string().trim().max(120).optional(),
    skills: listFieldSchema,
    other_talents: listFieldSchema,
    preferred_work_mode: workModeSchema.optional(),
    city: z.string().trim().max(80).optional(),
    state_region: z.string().trim().max(80).optional(),
    remote_regions: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
    opportunity_radius_km: z.coerce.number().int().min(1).max(500).optional(),
    min_hourly_rate: z.coerce.number().nonnegative().optional(),
    onboarding_completed: z.boolean().optional(),
    monthly_income: z.coerce.number().nonnegative().optional(),
    currency: z
      .string()
      .trim()
      .length(3)
      .optional()
      .transform((value) => value?.toUpperCase()),
    savings_goal: z.coerce.number().nonnegative().optional(),
    risk_tolerance: riskToleranceSchema.optional()
  })
  .strict()

async function readBody(req: Request): Promise<
  | {
      ok: true
      value: z.infer<typeof profileUpdateSchema>
    }
  | {
      ok: false
      error: string
    }
> {
  let payload: unknown

  try {
    payload = await req.json()
  } catch {
    return { ok: false, error: "Invalid JSON body" }
  }

  const parsed = profileUpdateSchema.safeParse(payload)
  if (!parsed.success) {
    return { ok: false, error: "Invalid request body" }
  }

  return { ok: true, value: parsed.data }
}

const profileRoutes = new Hono<AppEnv>()
profileRoutes.use("*", requireAuth)

profileRoutes.get("/", async (c) => {
  try {
    const userId = c.get("userId")
    const profile = await getFullProfile(c.env.DB, userId)
    return c.json({ profile })
  } catch {
    return c.json({ error: "Failed to fetch profile" }, 500)
  }
})

profileRoutes.put("/", async (c) => {
  const body = await readBody(c.req.raw)
  if (!body.ok) {
    return c.json({ error: body.error }, 400)
  }

  try {
    const userId = c.get("userId")
    const profile = await updateFullProfile(c.env.DB, userId, body.value)
    return c.json({ profile })
  } catch {
    return c.json({ error: "Failed to update profile" }, 500)
  }
})

export default profileRoutes
