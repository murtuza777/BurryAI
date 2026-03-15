import type { AgentWebResult } from "../agent/state"

type ProviderName = "tavily" | "serper"

type SearchProviderEnv = {
  provider?: string
  tavilyApiKey?: string
  serperApiKey?: string
}

const WEB_CACHE_TTL_MS = 1000 * 60 * 20
const webResultCache = new Map<string, { expiresAt: number; results: AgentWebResult[] }>()

type TavilyResponse = {
  results?: Array<{
    title?: string
    url?: string
    content?: string
  }>
}

type SerperResponse = {
  organic?: Array<{
    title?: string
    link?: string
    snippet?: string
  }>
}

function cacheKey(provider: string, query: string): string {
  return `${provider}:${query.toLowerCase().trim()}`
}

function readCache(key: string): AgentWebResult[] | null {
  const hit = webResultCache.get(key)
  if (!hit) return null
  if (hit.expiresAt < Date.now()) {
    webResultCache.delete(key)
    return null
  }
  return hit.results
}

function writeCache(key: string, results: AgentWebResult[]): void {
  webResultCache.set(key, {
    expiresAt: Date.now() + WEB_CACHE_TTL_MS,
    results
  })
}

function sanitizeResults(results: AgentWebResult[], topK: number): AgentWebResult[] {
  return results
    .filter((item) => item.title.trim().length > 0 && item.url.trim().length > 0)
    .slice(0, topK)
}

async function searchWithTavily(query: string, apiKey: string, topK: number): Promise<AgentWebResult[]> {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      query,
      max_results: topK,
      include_answer: false
    })
  })
  if (!response.ok) return []

  const payload = (await response.json()) as TavilyResponse
  return sanitizeResults(
    (payload.results ?? []).map((item) => ({
      title: item.title ?? "Untitled result",
      url: item.url ?? "",
      snippet: item.content ?? "",
      source: "tavily" as const
    })),
    topK
  )
}

async function searchWithSerper(query: string, apiKey: string, topK: number): Promise<AgentWebResult[]> {
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey
    },
    body: JSON.stringify({
      q: query,
      num: topK
    })
  })
  if (!response.ok) return []

  const payload = (await response.json()) as SerperResponse
  return sanitizeResults(
    (payload.organic ?? []).map((item) => ({
      title: item.title ?? "Untitled result",
      url: item.link ?? "",
      snippet: item.snippet ?? "",
      source: "serper" as const
    })),
    topK
  )
}

function shouldSearchWeb(intent: string, message: string): boolean {
  const normalized = message.toLowerCase()
  if (intent === "income") return true
  return ["side hustle", "freelance", "gig", "remote job", "extra income", "earn more"].some((keyword) =>
    normalized.includes(keyword)
  )
}

export async function searchWebForIncomeIdeas(params: {
  intent: string
  message: string
  env: SearchProviderEnv
  topK?: number
  forceSearch?: boolean
}): Promise<AgentWebResult[]> {
  if (!params.forceSearch && !shouldSearchWeb(params.intent, params.message)) {
    return []
  }

  const topK = Math.max(1, Math.min(params.topK ?? 3, 5))
  const provider = (params.env.provider?.toLowerCase() ?? "tavily") as ProviderName
  const query =
    params.intent === "income"
      ? `student side hustle opportunities ${params.message}`
      : `student personal finance advice ${params.message}`
  const key = cacheKey(provider, query)
  const cached = readCache(key)
  if (cached) return cached

  let results: AgentWebResult[] = []
  if (provider === "serper" && params.env.serperApiKey) {
    results = await searchWithSerper(query, params.env.serperApiKey, topK)
  } else if (params.env.tavilyApiKey) {
    results = await searchWithTavily(query, params.env.tavilyApiKey, topK)
  } else if (params.env.serperApiKey) {
    results = await searchWithSerper(query, params.env.serperApiKey, topK)
  }

  writeCache(key, results)
  return results
}
