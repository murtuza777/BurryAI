import { Hono } from "hono"
import { z } from "zod"
import { requireAuth } from "../middleware/auth"
import { parseResumeWithAI } from "../services/resume-parser"
import { getFullProfile, updateFullProfile } from "../services/profile"
import type { AppEnv } from "../types"

const parseResumeSchema = z
  .object({
    text: z.string().trim().min(30, "Resume text too short").max(50000, "Resume text too long")
  })
  .strict()

const applyResumeSchema = z
  .object({
    full_name: z.string().trim().max(120).optional(),
    profession: z.string().trim().max(120).optional(),
    skills: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
    other_talents: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
    city: z.string().trim().max(80).optional(),
    state_region: z.string().trim().max(80).optional(),
    country: z.string().trim().max(80).optional(),
    university: z.string().trim().max(120).optional(),
    student_status: z.string().trim().max(50).optional(),
    preferred_work_mode: z.enum(["local", "remote", "hybrid"]).optional(),
    resume_summary: z.string().trim().max(2000).optional(),
    resume_text: z.string().trim().max(50000).optional()
  })
  .strict()

async function readBody<TSchema extends z.ZodTypeAny>(
  req: Request,
  schema: TSchema
): Promise<
  | {
      ok: true
      value: z.infer<TSchema>
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

  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return { ok: false, error: firstIssue?.message ?? "Invalid request body" }
  }

  return { ok: true, value: parsed.data }
}

const resumeRoutes = new Hono<AppEnv>()
resumeRoutes.use("*", requireAuth)

resumeRoutes.post("/parse", async (c) => {
  const body = await readBody(c.req.raw, parseResumeSchema)
  if (!body.ok) {
    return c.json({ error: body.error }, 400)
  }

  if (!c.env.AI) {
    return c.json({ error: "AI service not available" }, 503)
  }

  try {
    const result = await parseResumeWithAI({
      resumeText: body.value.text,
      aiBinding: c.env.AI,
      model: c.env.AI_PRIMARY_MODEL,
      fallbackModel: c.env.AI_FALLBACK_MODEL
    })

    return c.json({
      extraction: result.extraction,
      profile_update: result.profileUpdate
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to parse resume"
    return c.json({ error: message }, 500)
  }
})

resumeRoutes.post("/apply", async (c) => {
  const body = await readBody(c.req.raw, applyResumeSchema)
  if (!body.ok) {
    return c.json({ error: body.error }, 400)
  }

  try {
    const userId = c.get("userId")
    const profile = await updateFullProfile(c.env.DB, userId, body.value)
    return c.json({ profile })
  } catch {
    return c.json({ error: "Failed to apply resume data to profile" }, 500)
  }
})

export default resumeRoutes
