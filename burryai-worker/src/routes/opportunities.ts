import { Hono } from "hono"
import { z } from "zod"
import { requireAuth } from "../middleware/auth"
import { discoverOpportunities } from "../services/opportunities"
import type { AppEnv } from "../types"

const opportunitySearchSchema = z
  .object({
    query: z.string().trim().max(180).optional(),
    mode: z.enum(["auto", "local", "remote", "hybrid"]).optional(),
    include_internships: z.boolean().optional(),
    include_part_time: z.boolean().optional(),
    include_freelance: z.boolean().optional(),
    remote_regions: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
    radius_km: z.coerce.number().int().min(1).max(500).optional(),
    max_results: z.coerce.number().int().min(6).max(48).optional()
  })
  .strict()

async function readBody(req: Request): Promise<
  | {
      ok: true
      value: z.infer<typeof opportunitySearchSchema>
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

  const parsed = opportunitySearchSchema.safeParse(payload)
  if (!parsed.success) {
    return { ok: false, error: "Invalid request body" }
  }

  return { ok: true, value: parsed.data }
}

const opportunitiesRoutes = new Hono<AppEnv>()
opportunitiesRoutes.use("*", requireAuth)

opportunitiesRoutes.post("/search", async (c) => {
  const body = await readBody(c.req.raw)
  if (!body.ok) {
    return c.json({ error: body.error }, 400)
  }

  try {
    const userId = c.get("userId")
    const payload = await discoverOpportunities({
      db: c.env.DB,
      userId,
      input: body.value,
      searchEnv: {
        provider: c.env.WEB_SEARCH_PROVIDER,
        tavilyApiKey: c.env.TAVILY_API_KEY,
        serperApiKey: c.env.SERPER_API_KEY
      }
    })

    return c.json(payload)
  } catch {
    return c.json({ error: "Failed to search opportunities" }, 500)
  }
})

export default opportunitiesRoutes
