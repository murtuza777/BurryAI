import { z } from "zod"
import { discoverOpportunities } from "../services/opportunities"
import { baseToolInputSchema, type ToolDefinition } from "./types"

const outputSchema = z.object({
  count: z.number().int().nonnegative(),
  topMatches: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      location: z.string(),
      workMode: z.enum(["local", "remote", "hybrid", "unknown"]),
      type: z.enum(["internship", "part-time", "freelance", "job", "gig", "unknown"]),
      score: z.number(),
      reasons: z.array(z.string())
    })
  )
})

export const incomeOpportunitiesTool: ToolDefinition<
  typeof baseToolInputSchema,
  typeof outputSchema
> = {
  name: "incomeOpportunities",
  description:
    "Find location-aware and remote opportunities for extra income, part-time work, and internships.",
  inputSchema: baseToolInputSchema,
  outputSchema,
  async run(input, ctx) {
    const data = await discoverOpportunities({
      db: ctx.db,
      userId: input.userId,
      input: {
        query: input.userMessage,
        mode: "auto",
        include_internships: true,
        include_part_time: true,
        include_freelance: true,
        max_results: 6
      },
      searchEnv: ctx.searchEnv ?? {}
    })

    const topMatches = data.opportunities.slice(0, 4).map((item) => ({
      title: item.title,
      url: item.url,
      location: item.location,
      workMode: item.work_mode,
      type: item.opportunity_type,
      score: item.score,
      reasons: item.match_reasons
    }))

    return {
      count: data.opportunities.length,
      topMatches
    }
  },
  summarize(output) {
    if (output.count === 0) {
      return "No strong opportunity matches found from live search. Try broadening filters or updating profile skills."
    }
    const preview = output.topMatches
      .slice(0, 2)
      .map((item) => item.title)
      .join("; ")
    return `Found ${output.count} opportunity matches. Top picks: ${preview}.`
  }
}
