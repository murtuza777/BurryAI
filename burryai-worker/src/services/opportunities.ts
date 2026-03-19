import type { AgentWebResult } from "../agent/state"
import { getFullProfile } from "./profile"
import { searchWebByQuery, type SearchProviderEnv } from "../web/search.provider"

type DiscoveryMode = "auto" | "local" | "remote" | "hybrid"
type ResolvedMode = "local" | "remote" | "hybrid"
type OpportunityWorkMode = "local" | "remote" | "hybrid" | "unknown"
type OpportunityType = "internship" | "part-time" | "freelance" | "job" | "gig" | "unknown"

export type OpportunitySearchInput = {
  query?: string
  mode?: DiscoveryMode
  include_internships?: boolean
  include_part_time?: boolean
  include_freelance?: boolean
  remote_regions?: string[]
  radius_km?: number
  max_results?: number
}

export type OpportunityResult = {
  id: string
  title: string
  url: string
  source: AgentWebResult["source"]
  snippet: string
  location: string
  work_mode: OpportunityWorkMode
  opportunity_type: OpportunityType
  score: number
  matched_skills: string[]
  match_reasons: string[]
  near_user_location: boolean
  remote_friendly: boolean
}

type EnrichedOpportunity = OpportunityResult & {
  text: string
  remote_region_allowed: boolean
}

export type OpportunitySearchPayload = {
  opportunities: OpportunityResult[]
  filters_applied: {
    mode: ResolvedMode
    include_internships: boolean
    include_part_time: boolean
    include_freelance: boolean
    remote_regions: string[]
    radius_km: number
  }
  profile_summary: {
    profession: string
    skills: string[]
    location: {
      city: string
      state_region: string
      country: string
      university: string
    }
    preferred_work_mode: "local" | "remote" | "hybrid"
  }
  generated_queries: string[]
}

function compactTokenList(items: string[]): string[] {
  return Array.from(
    new Set(
      items
        .map((item) => item.trim().toLowerCase())
        .filter((item) => item.length > 0)
    )
  )
}

function pickLocationLabel(params: {
  city: string
  state_region: string
  country: string
  university: string
}): string {
  const byPriority = [params.city, params.state_region, params.country, params.university]
  const first = byPriority.find((item) => item.trim().length > 0)
  return first?.trim() ?? "your location"
}

function inferWorkMode(text: string): OpportunityWorkMode {
  if (/\bhybrid\b/.test(text)) return "hybrid"
  if (/\bremote\b|\bwork from home\b|\bwfh\b/.test(text)) return "remote"
  if (/\bon[-\s]?site\b|\bin[-\s]?person\b|\bon campus\b/.test(text)) return "local"
  return "unknown"
}

function inferOpportunityType(text: string): OpportunityType {
  if (/\bintern(ship)?\b/.test(text)) return "internship"
  if (/\bpart[-\s]?time\b/.test(text)) return "part-time"
  if (/\bfreelance\b|\bcontract\b/.test(text)) return "freelance"
  if (/\bgig\b|\bside hustle\b/.test(text)) return "gig"
  if (/\bjob\b|\brole\b|\bopening\b/.test(text)) return "job"
  return "unknown"
}

function locationTokens(params: {
  city: string
  state_region: string
  country: string
  university: string
}): string[] {
  return compactTokenList([
    params.city,
    params.state_region,
    params.country,
    params.university,
    params.university.replace("university", "").trim()
  ])
}

function matchAnyToken(text: string, tokens: string[]): boolean {
  return tokens.some((token) => token.length >= 2 && text.includes(token))
}

function extractMatchedSkills(text: string, skills: string[]): string[] {
  return skills
    .filter((skill) => skill.length >= 2 && text.includes(skill.toLowerCase()))
    .slice(0, 6)
}

function buildQueries(params: {
  query?: string
  profession: string
  skills: string[]
  otherTalents: string[]
  university: string
  city: string
  state_region: string
  country: string
  mode: ResolvedMode
  includeInternships: boolean
  includePartTime: boolean
  includeFreelance: boolean
  radiusKm: number
}): string[] {
  const role = params.profession.trim() || params.skills[0] || "student"
  const skillHint = params.skills.slice(0, 2).join(" ")
  const locationHint = pickLocationLabel({
    city: params.city,
    state_region: params.state_region,
    country: params.country,
    university: params.university
  })

  const queries: string[] = []
  if (params.query?.trim()) {
    queries.push(params.query.trim())
  }

  if (params.includeInternships) {
    queries.push(`${role} internship opportunities ${locationHint} within ${params.radiusKm} km`)
    if (params.university.trim()) {
      queries.push(`student internships near ${params.university.trim()}`)
    }
  }

  if (params.includePartTime) {
    queries.push(`${role} part-time jobs for students ${locationHint} within ${params.radiusKm} km`)
    queries.push(`college student extra earning jobs near ${locationHint} within ${params.radiusKm} km`)
  }

  if (params.includeFreelance) {
    const talentHint = params.otherTalents[0] || skillHint || role
    queries.push(`${talentHint} freelance gigs remote`)
  }

  if (params.mode !== "local") {
    queries.push(`${role} remote jobs ${skillHint}`.trim())
  }

  return compactTokenList(queries).slice(0, 5)
}

function buildOpportunityFromWeb(params: {
  result: AgentWebResult
  profileTokens: string[]
  skills: string[]
  profession: string
  preferredMode: ResolvedMode
  requestedMode: ResolvedMode
  includeInternships: boolean
  includePartTime: boolean
  includeFreelance: boolean
  remoteRegions: string[]
  locationLabel: string
}): EnrichedOpportunity {
  const source = params.result
  const text = `${source.title} ${source.snippet} ${source.url}`.toLowerCase()
  const workMode = inferWorkMode(text)
  const opportunityType = inferOpportunityType(text)
  const matchedSkills = extractMatchedSkills(text, params.skills)
  const nearby = matchAnyToken(text, params.profileTokens)
  const remoteFriendly = workMode === "remote" || workMode === "hybrid"
  const regionMatch =
    params.remoteRegions.length === 0 || matchAnyToken(text, params.remoteRegions.map((item) => item.toLowerCase()))
  const globalRemote = text.includes("worldwide") || text.includes("global") || text.includes("anywhere")

  let score = 30
  if (params.profession && text.includes(params.profession.toLowerCase())) score += 16
  score += matchedSkills.length * 10
  if (opportunityType === "internship") score += 10
  if (opportunityType === "part-time") score += 6
  if (opportunityType === "freelance" || opportunityType === "gig") score += 8
  if (nearby) score += 14
  if (remoteFriendly) score += 10
  if (params.preferredMode === "local" && nearby) score += 6
  if (params.preferredMode === "remote" && remoteFriendly) score += 6
  if (params.preferredMode === "hybrid" && (nearby || remoteFriendly)) score += 4
  if (text.includes("student") || text.includes("college") || text.includes("campus")) score += 8
  if (params.requestedMode === "local" && !nearby) score -= 16
  if (params.requestedMode === "remote" && !remoteFriendly) score -= 18
    if (params.remoteRegions.length > 0 && !regionMatch) score -= 8

  const matchReasons: string[] = []
  if (matchedSkills.length > 0) {
    matchReasons.push(`Skill match: ${matchedSkills.join(", ")}`)
  }
  if (nearby) {
    matchReasons.push(`Location relevance: mentions ${params.locationLabel}`)
  }
  if (remoteFriendly) {
    matchReasons.push("Supports remote/hybrid work")
  }
  if (opportunityType === "internship") {
    matchReasons.push("Internship-oriented listing")
  }
  if (matchReasons.length === 0) {
    matchReasons.push("Keyword relevance match")
  }

  return {
    id: `${source.source}-${source.url}`,
    title: source.title,
    url: source.url,
    source: source.source,
    snippet: source.snippet,
    location: nearby ? params.locationLabel : "Not specified",
    work_mode: workMode,
    opportunity_type: opportunityType,
    score,
    matched_skills: matchedSkills,
    match_reasons: matchReasons,
    near_user_location: nearby,
    remote_friendly: remoteFriendly,
    remote_region_allowed: regionMatch || globalRemote || params.remoteRegions.length === 0,
    text
  }
}

function passesTypeFilter(params: {
  opportunityType: OpportunityType
  includeInternships: boolean
  includePartTime: boolean
  includeFreelance: boolean
}): boolean {
  if (params.opportunityType === "internship") return params.includeInternships
  if (params.opportunityType === "part-time") return params.includePartTime
  if (params.opportunityType === "freelance" || params.opportunityType === "gig") {
    return params.includeFreelance
  }
  return true
}

function passesModeFilter(item: EnrichedOpportunity, mode: ResolvedMode): boolean {
  if (mode === "local") return item.near_user_location && item.work_mode !== "remote"
  if (mode === "remote") return item.remote_friendly || item.work_mode === "unknown"
  return true
}

function uniqueByUrl(items: EnrichedOpportunity[]): EnrichedOpportunity[] {
  const seen = new Set<string>()
  const output: EnrichedOpportunity[] = []
  for (const item of items) {
    if (seen.has(item.url)) continue
    seen.add(item.url)
    output.push(item)
  }
  return output
}

export async function discoverOpportunities(params: {
  db: D1Database
  userId: string
  input: OpportunitySearchInput
  searchEnv: SearchProviderEnv
}): Promise<OpportunitySearchPayload> {
  const profile = await getFullProfile(params.db, params.userId)
  const includeInternships = params.input.include_internships ?? true
  const includePartTime = params.input.include_part_time ?? true
  const includeFreelance = params.input.include_freelance ?? true
  const remoteRegions = compactTokenList(params.input.remote_regions ?? profile.remote_regions)
  const radiusKm = Math.max(1, Math.min(params.input.radius_km ?? profile.opportunity_radius_km, 500))
  const maxResults = Math.max(3, Math.min(params.input.max_results ?? 15, 30))
  const requestedMode: ResolvedMode =
    params.input.mode === "auto" || !params.input.mode
      ? profile.preferred_work_mode
      : params.input.mode

  const skills = compactTokenList([...profile.skills, ...profile.other_talents]).slice(0, 12)
  const profileTokens = locationTokens({
    city: profile.city,
    state_region: profile.state_region,
    country: profile.country,
    university: profile.university
  })
  const resolvedMode: ResolvedMode =
    requestedMode === "local" && profileTokens.length === 0 ? "hybrid" : requestedMode
  const locationLabel = pickLocationLabel({
    city: profile.city,
    state_region: profile.state_region,
    country: profile.country,
    university: profile.university
  })

  const queries = buildQueries({
    query: params.input.query,
    profession: profile.profession,
    skills,
    otherTalents: profile.other_talents,
    university: profile.university,
    city: profile.city,
    state_region: profile.state_region,
    country: profile.country,
    mode: resolvedMode,
    includeInternships,
    includePartTime,
    includeFreelance,
    radiusKm
  })
  const perQueryTopK = Math.max(3, Math.min(7, Math.ceil(maxResults / Math.max(1, queries.length)) + 2))

  const batches = await Promise.all(
    queries.map((query) =>
      searchWebByQuery({
        query,
        env: params.searchEnv,
        topK: perQueryTopK,
        cacheScope: "opportunities"
      })
    )
  )

  const normalized = uniqueByUrl(
    batches
      .flat()
      .map((result) =>
        buildOpportunityFromWeb({
          result,
          profileTokens,
          skills,
          profession: profile.profession,
          preferredMode: profile.preferred_work_mode,
          requestedMode: resolvedMode,
          includeInternships,
          includePartTime,
          includeFreelance,
          remoteRegions,
          locationLabel
        })
      )
      .filter((item) =>
        passesTypeFilter({
          opportunityType: item.opportunity_type,
          includeInternships,
          includePartTime,
          includeFreelance
        })
      )
      .filter((item) => passesModeFilter(item, resolvedMode))
      .filter((item) =>
        remoteRegions.length > 0 && resolvedMode !== "local" ? item.remote_region_allowed : true
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
  )

  return {
    opportunities: normalized.map(({ text: _, remote_region_allowed: __, ...item }) => item),
    filters_applied: {
      mode: resolvedMode,
      include_internships: includeInternships,
      include_part_time: includePartTime,
      include_freelance: includeFreelance,
      remote_regions: remoteRegions,
      radius_km: radiusKm
    },
    profile_summary: {
      profession: profile.profession,
      skills: profile.skills,
      location: {
        city: profile.city,
        state_region: profile.state_region,
        country: profile.country,
        university: profile.university
      },
      preferred_work_mode: profile.preferred_work_mode
    },
    generated_queries: queries
  }
}
