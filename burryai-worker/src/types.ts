export type Bindings = {
  AI?: {
    run: (model: string, input: unknown) => Promise<unknown>
  }
  AI_FALLBACK_MODEL?: string
  AI_PRIMARY_MODEL?: string
  AI_REASONING_MODEL?: string
  DB: D1Database
  ENABLE_VECTORIZE_RAG?: string
  EMBEDDING_MODEL?: string
  FINANCE_KB_INDEX?: Vectorize
  JWT_SECRET: string
  WEB_SEARCH_PROVIDER?: string
  TAVILY_API_KEY?: string
  SERPER_API_KEY?: string
}

export type Variables = {
  userId: string
  requestId: string
}

export type AppEnv = {
  Bindings: Bindings
  Variables: Variables
}
