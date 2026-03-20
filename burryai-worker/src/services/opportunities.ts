import type { AgentWebResult } from "../agent/state"
import { getFullProfile } from "./profile"
import { searchWebByQuery, type SearchProviderEnv } from "../web/search.provider"

type DiscoveryMode = "auto" | "local" | "remote" | "hybrid"
type ResolvedMode = "local" | "remote" | "hybrid"
type OpportunityWorkMode = "local" | "remote" | "hybrid" | "unknown"
type OpportunityType = "internship" | "part-time" | "freelance" | "job" | "gig" | "unknown"
type ListingQuality = "high" | "medium" | "community"

type SourceClassification = {
  sourceSite: string
  listingQuality: ListingQuality | null
}

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
  company: string
  url: string
  source: AgentWebResult["source"]
  source_site: string
  listing_quality: ListingQuality
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

const BLOCKED_HOSTS = [
  "youtube.com",
  "youtu.be",
  "instagram.com",
  "facebook.com",
  "tiktok.com",
  "medium.com",
  "udemy.com",
  "coursera.org"
]

const COMMUNITY_PATHS = [
  "/r/forhire/",
  "/r/slavelabour/",
  "/r/jobs/",
  "/r/hiring/",
  "/r/internships/"
]

const ARTICLE_TERMS = /\b(best|top|guide|tips|how to|course|video|blog|review)\b/i
const LISTING_TERMS =
  /\b(job|jobs|career|careers|hiring|opening|openings|role|position|positions|internship|internships|part[-\s]?time|full[-\s]?time|freelance|contract|gig)\b/i

function compactTokenList(items: string[]): string[] {
  return Array.from(
    new Set(
      items
        .map((item) => item.trim().toLowerCase())
        .filter((item) => item.length > 0)
    )
  )
}

function uniqueStrings(items: string[]): string[] {
  const seen = new Set<string>()
  const output: string[] = []

  for (const item of items.map((value) => value.trim()).filter((value) => value.length > 0)) {
    const key = item.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    output.push(item)
  }

  return output
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
  if (/\bremote\b|\bwork from home\b|\bwfh\b|\banywhere\b/.test(text)) return "remote"
  if (/\bon[-\s]?site\b|\bin[-\s]?person\b|\bon campus\b/.test(text)) return "local"
  return "unknown"
}

function inferOpportunityType(text: string): OpportunityType {
  if (/\bintern(ship)?\b/.test(text)) return "internship"
  if (/\bpart[-\s]?time\b/.test(text)) return "part-time"
  if (/\bfreelance\b|\bcontract\b/.test(text)) return "freelance"
  if (/\bgig\b|\bside hustle\b/.test(text)) return "gig"
  if (/\bjob\b|\brole\b|\bopening\b|\bposition\b/.test(text)) return "job"
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

function hostnameFromUrl(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.toLowerCase()
  } catch {
    return ""
  }
}

function pathnameFromUrl(rawUrl: string): string {
  try {
    return new URL(rawUrl).pathname.toLowerCase()
  } catch {
    return ""
  }
}

function prettifySourceSite(hostname: string): string {
  if (hostname.includes("linkedin.com")) return "LinkedIn"
  if (hostname.includes("indeed.com")) return "Indeed"
  if (hostname.includes("greenhouse.io")) return "Greenhouse"
  if (hostname.includes("lever.co")) return "Lever"
  if (hostname.includes("myworkdayjobs.com")) return "Workday"
  if (hostname.includes("smartrecruiters.com")) return "SmartRecruiters"
  if (hostname.includes("ashbyhq.com")) return "Ashby"
  if (hostname.includes("wellfound.com")) return "Wellfound"
  if (hostname.includes("upwork.com")) return "Upwork"
  if (hostname.includes("reddit.com")) return "Reddit"
  if (hostname.includes("x.com") || hostname.includes("twitter.com")) return "X"
  if (hostname.includes("internshala.com")) return "Internshala"
  if (hostname.includes("ycombinator.com")) return "Y Combinator"
  if (hostname.endsWith(".edu")) return "Campus"

  return hostname.replace(/^www\./, "").split(".")[0] || "Website"
}

function classifySource(params: {
  url: string
  text: string
  university: string
}): SourceClassification {
  const hostname = hostnameFromUrl(params.url)
  const pathname = pathnameFromUrl(params.url)
  const sourceSite = prettifySourceSite(hostname)

  if (!hostname) {
    return { sourceSite: "Unknown", listingQuality: null }
  }

  if (BLOCKED_HOSTS.some((host) => hostname.includes(host))) {
    return { sourceSite, listingQuality: null }
  }

  if (hostname.includes("linkedin.com") && pathname.includes("/jobs/view")) {
    return { sourceSite, listingQuality: "high" }
  }
  if (hostname.includes("indeed.com") && (pathname.includes("/viewjob") || pathname.includes("/rc/clk"))) {
    return { sourceSite, listingQuality: "high" }
  }
  if (hostname.includes("jobs.lever.co")) {
    return { sourceSite, listingQuality: "high" }
  }
  if (
    (hostname.includes("greenhouse.io") || hostname.includes("greenhouse-job-boards")) &&
    !pathname.includes("/blog")
  ) {
    return { sourceSite, listingQuality: "high" }
  }
  if (hostname.includes("myworkdayjobs.com") && pathname.includes("/job/")) {
    return { sourceSite, listingQuality: "high" }
  }
  if (hostname.includes("smartrecruiters.com") && pathname.includes("/job/")) {
    return { sourceSite, listingQuality: "high" }
  }
  if (hostname.includes("ashbyhq.com") && pathname.includes("/jobs/")) {
    return { sourceSite, listingQuality: "high" }
  }
  if (hostname.includes("wellfound.com") && pathname.includes("/jobs/")) {
    return { sourceSite, listingQuality: "high" }
  }
  if (
    hostname.includes("internshala.com") &&
    (pathname.includes("/internships/") || pathname.includes("/jobs/"))
  ) {
    return { sourceSite, listingQuality: "high" }
  }
  if (hostname.includes("upwork.com") && pathname.includes("/freelance-jobs/")) {
    return { sourceSite, listingQuality: "high" }
  }
  if (hostname.includes("ycombinator.com") && pathname.includes("/jobs/")) {
    return { sourceSite, listingQuality: "high" }
  }
  if (
    hostname.includes("reddit.com") &&
    COMMUNITY_PATHS.some((communityPath) => pathname.includes(communityPath))
  ) {
    return { sourceSite, listingQuality: "community" }
  }
  if (
    (hostname.includes("x.com") || hostname.includes("twitter.com")) &&
    pathname.includes("/status/") &&
    LISTING_TERMS.test(params.text)
  ) {
    return { sourceSite, listingQuality: "community" }
  }

  const careerPath = /\/(careers?|jobs?|openings?|positions?|internships?|join-us|vacancies)/.test(pathname)
  if (careerPath && LISTING_TERMS.test(params.text) && !ARTICLE_TERMS.test(params.text)) {
    return { sourceSite, listingQuality: "medium" }
  }

  const campusSignal =
    hostname.endsWith(".edu") ||
    (params.university.trim().length > 0 && params.text.includes(params.university.toLowerCase()))
  if (campusSignal && LISTING_TERMS.test(params.text)) {
    return { sourceSite, listingQuality: "medium" }
  }

  return { sourceSite, listingQuality: null }
}

function cleanListingTitle(title: string, sourceSite: string): string {
  return title
    .replace(new RegExp(`\\s+[|\\-]\\s+${sourceSite}.*$`, "i"), "")
    .replace(/\s+[|\-]\s+(Jobs|Careers|Hiring).*$/i, "")
    .replace(/\s+\b(Apply now|Apply today|Learn more|Join us)\b.*$/i, "")
    .trim()
}

function extractCompany(title: string, sourceSite: string): string {
  const cleanedTitle = cleanListingTitle(title, sourceSite)
  const parts = cleanedTitle
    .split(/\s+[|\-@•]\s+/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length >= 2) {
    return parts[1]
  }

  return ""
}

function extractLocationLabel(params: {
  snippet: string
  text: string
  nearby: boolean
  locationLabel: string
}): string {
  if (params.nearby) return params.locationLabel

  const locationMatch = params.snippet.match(
    /\b(?:location|based in|located in|city)\s*[:\-]?\s*([A-Za-z0-9\s,.-]{3,60})/i
  )
  if (locationMatch?.[1]) {
    return locationMatch[1].trim()
  }

  if (params.text.includes("remote")) return "Remote"
  if (params.text.includes("hybrid")) return "Hybrid"

  return "Not specified"
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
  const skillHint = params.skills.slice(0, 3).join(" ")
  const communityTalent = params.otherTalents[0] || params.skills[0] || role
  const localHint = [params.city, params.state_region, params.country].filter(Boolean).join(" ").trim()
  const locationHint = localHint || params.university.trim() || "student campus"

  const typeHints = [
    params.includeInternships ? "internship" : "",
    params.includePartTime ? "part-time" : "",
    params.includeFreelance ? "freelance" : ""
  ]
    .filter(Boolean)
    .join(" ")

  const queries: string[] = []
  if (params.query?.trim()) {
    queries.push(`${params.query.trim()} site:linkedin.com/jobs/view`)
    queries.push(`${params.query.trim()} site:indeed.com/viewjob`)
  }

  if (params.mode !== "remote") {
    queries.push(`${role} ${skillHint} ${typeHints} ${locationHint} site:linkedin.com/jobs/view`)
    queries.push(`${role} ${typeHints} ${locationHint} site:indeed.com/viewjob`)
    queries.push(`${role} ${locationHint} jobs site:jobs.lever.co OR site:boards.greenhouse.io`)
    if (params.includeInternships) {
      queries.push(`${role} internship ${locationHint} site:linkedin.com/jobs/view`)
    }
    if (params.university.trim()) {
      queries.push(`"${params.university.trim()}" student jobs internship careers`)
    }
  }

  if (params.mode !== "local") {
    queries.push(`${role} remote ${skillHint} site:linkedin.com/jobs/view`)
    queries.push(`${role} remote ${skillHint} site:jobs.lever.co OR site:boards.greenhouse.io`)
    queries.push(`${role} remote ${skillHint} site:myworkdayjobs.com OR site:smartrecruiters.com`)
    if (params.includeFreelance) {
      queries.push(`${communityTalent} remote freelance site:upwork.com/freelance-jobs`)
    }
    queries.push(`${role} hiring remote site:reddit.com/r/forhire OR site:reddit.com/r/jobs`)
    queries.push(`${role} hiring remote site:x.com OR site:twitter.com`)
  }

  return uniqueStrings(queries).slice(0, 10)
}

function buildOpportunityFromWeb(params: {
  result: AgentWebResult
  profileTokens: string[]
  skills: string[]
  profession: string
  preferredMode: ResolvedMode
  requestedMode: ResolvedMode
  remoteRegions: string[]
  locationLabel: string
  university: string
}): EnrichedOpportunity | null {
  const source = params.result
  const text = `${source.title} ${source.snippet} ${source.url}`.toLowerCase()
  const sourceMeta = classifySource({
    url: source.url,
    text,
    university: params.university
  })

  if (!sourceMeta.listingQuality) {
    return null
  }

  const workMode = inferWorkMode(text)
  const opportunityType = inferOpportunityType(text)
  const matchedSkills = extractMatchedSkills(text, params.skills)
  const nearby = matchAnyToken(text, params.profileTokens)
  const remoteFriendly = workMode === "remote" || workMode === "hybrid"
  const regionMatch =
    params.remoteRegions.length === 0 ||
    matchAnyToken(text, params.remoteRegions.map((item) => item.toLowerCase()))
  const globalRemote = text.includes("worldwide") || text.includes("global") || text.includes("anywhere")

  let score = 45
  if (params.profession && text.includes(params.profession.toLowerCase())) score += 18
  score += matchedSkills.length * 9
  if (opportunityType === "internship") score += 10
  if (opportunityType === "part-time") score += 8
  if (opportunityType === "freelance" || opportunityType === "gig") score += 8
  if (nearby) score += 16
  if (remoteFriendly) score += 10
  if (sourceMeta.listingQuality === "high") score += 18
  if (sourceMeta.listingQuality === "medium") score += 8
  if (sourceMeta.listingQuality === "community") score += 6
  if (params.preferredMode === "local" && nearby) score += 6
  if (params.preferredMode === "remote" && remoteFriendly) score += 6
  if (params.preferredMode === "hybrid" && (nearby || remoteFriendly)) score += 4
  if (text.includes("student") || text.includes("college") || text.includes("campus")) score += 8
  if (params.requestedMode === "local" && !nearby) score -= 18
  if (params.requestedMode === "remote" && !remoteFriendly) score -= 16
  if (params.remoteRegions.length > 0 && !regionMatch) score -= 8

  const cleanedTitle = cleanListingTitle(source.title, sourceMeta.sourceSite)
  const company = extractCompany(cleanedTitle, sourceMeta.sourceSite)
  const matchReasons: string[] = []

  if (matchedSkills.length > 0) {
    matchReasons.push(`Matches ${matchedSkills.join(", ")}`)
  }
  if (sourceMeta.listingQuality === "high") {
    matchReasons.push(`Direct listing from ${sourceMeta.sourceSite}`)
  } else if (sourceMeta.listingQuality === "community") {
    matchReasons.push(`Community lead from ${sourceMeta.sourceSite}`)
  } else {
    matchReasons.push(`Career page signal from ${sourceMeta.sourceSite}`)
  }
  if (nearby) {
    matchReasons.push(`Near ${params.locationLabel}`)
  }
  if (remoteFriendly) {
    matchReasons.push("Remote-friendly")
  }

  return {
    id: `${source.source}-${source.url}`,
    title: cleanedTitle || source.title,
    company,
    url: source.url,
    source: source.source,
    source_site: sourceMeta.sourceSite,
    listing_quality: sourceMeta.listingQuality,
    snippet: source.snippet,
    location: extractLocationLabel({
      snippet: source.snippet,
      text,
      nearby,
      locationLabel: params.locationLabel
    }),
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
  const maxResults = Math.max(6, Math.min(params.input.max_results ?? 18, 30))
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
  const perQueryTopK = Math.max(4, Math.min(6, Math.ceil(maxResults / Math.max(1, queries.length)) + 2))

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
          remoteRegions,
          locationLabel,
          university: profile.university
        })
      )
      .filter((item): item is EnrichedOpportunity => item !== null)
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

export const __private__ = {
  classifySource,
  cleanListingTitle,
  extractCompany
}
