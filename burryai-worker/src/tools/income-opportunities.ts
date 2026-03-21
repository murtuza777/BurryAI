import { z } from "zod"
import { discoverOpportunities } from "../services/opportunities"
import { baseToolInputSchema, type ToolDefinition } from "./types"

const outputSchema = z.object({
  count: z.number().int().nonnegative(),
  generatedQueries: z.array(z.string()),
  sourceBreakdown: z.array(
    z.object({
      sourceSite: z.string(),
      count: z.number().int().positive()
    })
  ),
  topMatches: z.array(
    z.object({
      title: z.string(),
      company: z.string(),
      url: z.string(),
      sourceSite: z.string(),
      listingQuality: z.enum(["high", "medium", "community"]),
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

    const sourceBreakdownMap = new Map<string, number>()
    for (const item of data.opportunities) {
      sourceBreakdownMap.set(item.source_site, (sourceBreakdownMap.get(item.source_site) ?? 0) + 1)
    }

    const topMatches = data.opportunities.slice(0, 4).map((item) => ({
      title: item.title,
      company: item.company,
      url: item.url,
      sourceSite: item.source_site,
      listingQuality: item.listing_quality,
      location: item.location,
      workMode: item.work_mode,
      type: item.opportunity_type,
      score: item.score,
      reasons: item.match_reasons
    }))

    return {
      count: data.opportunities.length,
      generatedQueries: data.generated_queries,
      sourceBreakdown: Array.from(sourceBreakdownMap.entries())
        .map(([sourceSite, count]) => ({ sourceSite, count }))
        .sort((a, b) => b.count - a.count),
      topMatches
    }
  },
  summarize(output) {
    if (output.count === 0) {
      return "No strong opportunity matches found from live search. Try broadening filters or updating profile skills."
    }
    const preview = output.topMatches
      .slice(0, 2)
      .map((item) => `${item.title} via ${item.sourceSite}`)
      .join("; ")
    const sourcePreview = output.sourceBreakdown
      .slice(0, 3)
      .map((item) => `${item.sourceSite} (${item.count})`)
      .join(", ")
    return `Found ${output.count} current opportunity matches with hidden sources prioritized ahead of LinkedIn and Indeed. Top picks: ${preview}. Source mix: ${sourcePreview}.`
  }
}
