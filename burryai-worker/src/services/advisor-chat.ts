export const ADVISOR_WELCOME_MESSAGE =
  "Welcome to BurryAI Advisor. I can help analyze your income vs expenses, build debt and savings plans, and suggest practical ways to boost earnings. Tell me your top money goal for this month and I will create a focused plan."

export type AdvisorMessageMeta = {
  intent: "budgeting" | "debt" | "savings" | "income" | "general"
  used_tools: string[]
  tool_summaries: Array<{ name: string; summary: string }>
  knowledge_sources: Array<{ title: string; source: string }>
  web_sources: Array<{ title: string; url: string; source: "tavily" | "serper" | "none" }>
  rag: {
    vectorize_enabled: boolean
    knowledge_count: number
    web_count: number
    web_search_triggered: boolean
  }
}

export type AdvisorChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string
  model_used?: string
  meta?: AdvisorMessageMeta
}

export type AdvisorChatThread = {
  id: string
  title: string
  created_at: string
  updated_at: string
  messages: AdvisorChatMessage[]
}

type ThreadRow = {
  id: string
  title: string
  created_at: string
  updated_at: string
}

type MessageRow = {
  id: string
  thread_id: string
  role: "user" | "assistant"
  content: string
  model_used: string | null
  meta_json: string | null
  created_at: string
}

function parseMeta(metaJson: string | null): AdvisorMessageMeta | undefined {
  if (!metaJson) {
    return undefined
  }

  try {
    return JSON.parse(metaJson) as AdvisorMessageMeta
  } catch {
    return undefined
  }
}

function serializeMessage(row: MessageRow): AdvisorChatMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    timestamp: row.created_at,
    model_used: row.model_used ?? undefined,
    meta: parseMeta(row.meta_json)
  }
}

function buildThreadMap(threads: ThreadRow[], messages: MessageRow[]): AdvisorChatThread[] {
  const grouped = new Map<string, AdvisorChatMessage[]>()

  for (const row of messages) {
    const existing = grouped.get(row.thread_id) ?? []
    existing.push(serializeMessage(row))
    grouped.set(row.thread_id, existing)
  }

  return threads.map((thread) => ({
    id: thread.id,
    title: thread.title,
    created_at: thread.created_at,
    updated_at: thread.updated_at,
    messages: grouped.get(thread.id) ?? []
  }))
}

export function makeAdvisorThreadTitle(content: string): string {
  const cleaned = content.trim().replace(/\s+/g, " ")
  if (!cleaned) return "New Chat"
  if (cleaned.length <= 36) return cleaned
  return `${cleaned.slice(0, 36)}...`
}

export async function listAdvisorThreads(
  db: D1Database,
  userId: string
): Promise<AdvisorChatThread[]> {
  const [threadsResult, messagesResult] = await Promise.all([
    db.prepare(
      "SELECT id, title, created_at, updated_at FROM advisor_threads WHERE user_id = ?1 ORDER BY datetime(updated_at) DESC, id DESC"
    )
      .bind(userId)
      .all<ThreadRow>(),
    db.prepare(
      "SELECT m.id, m.thread_id, m.role, m.content, m.model_used, m.meta_json, m.created_at " +
        "FROM advisor_messages m " +
        "INNER JOIN advisor_threads t ON t.id = m.thread_id " +
        "WHERE t.user_id = ?1 " +
        "ORDER BY datetime(m.created_at) ASC, m.id ASC"
    )
      .bind(userId)
      .all<MessageRow>()
  ])

  return buildThreadMap(threadsResult.results ?? [], messagesResult.results ?? [])
}

export async function getAdvisorThread(
  db: D1Database,
  userId: string,
  threadId: string
): Promise<AdvisorChatThread | null> {
  const [threadRow, messagesResult] = await Promise.all([
    db.prepare(
      "SELECT id, title, created_at, updated_at FROM advisor_threads WHERE id = ?1 AND user_id = ?2"
    )
      .bind(threadId, userId)
      .first<ThreadRow>(),
    db.prepare(
      "SELECT m.id, m.thread_id, m.role, m.content, m.model_used, m.meta_json, m.created_at " +
        "FROM advisor_messages m " +
        "INNER JOIN advisor_threads t ON t.id = m.thread_id " +
        "WHERE t.id = ?1 AND t.user_id = ?2 " +
        "ORDER BY datetime(m.created_at) ASC, m.id ASC"
    )
      .bind(threadId, userId)
      .all<MessageRow>()
  ])

  if (!threadRow) {
    return null
  }

  return buildThreadMap([threadRow], messagesResult.results ?? [])[0] ?? null
}

export async function createAdvisorThread(
  db: D1Database,
  userId: string,
  title = "New Chat"
): Promise<AdvisorChatThread> {
  const threadId = crypto.randomUUID()
  const welcomeMessageId = crypto.randomUUID()

  await db.batch([
    db.prepare("INSERT INTO advisor_threads (id, user_id, title) VALUES (?1, ?2, ?3)").bind(
      threadId,
      userId,
      title.trim() || "New Chat"
    ),
    db.prepare(
      "INSERT INTO advisor_messages (id, thread_id, user_id, role, content, model_used) VALUES (?1, ?2, ?3, 'assistant', ?4, 'system')"
    ).bind(welcomeMessageId, threadId, userId, ADVISOR_WELCOME_MESSAGE)
  ])

  const created = await getAdvisorThread(db, userId, threadId)
  if (!created) {
    throw new Error("Failed to create advisor thread")
  }

  return created
}

export async function insertAdvisorMessage(params: {
  db: D1Database
  userId: string
  threadId: string
  role: "user" | "assistant"
  content: string
  modelUsed?: string
  meta?: AdvisorMessageMeta
}): Promise<void> {
  await params.db
    .prepare(
      "INSERT INTO advisor_messages (id, thread_id, user_id, role, content, model_used, meta_json) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"
    )
    .bind(
      crypto.randomUUID(),
      params.threadId,
      params.userId,
      params.role,
      params.content,
      params.modelUsed ?? null,
      params.meta ? JSON.stringify(params.meta) : null
    )
    .run()
}

export async function deleteAdvisorThread(
  db: D1Database,
  userId: string,
  threadId: string
): Promise<boolean> {
  const result = await db
    .prepare("DELETE FROM advisor_threads WHERE id = ?1 AND user_id = ?2")
    .bind(threadId, userId)
    .run()

  return (result.meta.changes ?? 0) > 0
}

export async function renameAdvisorThreadIfDefault(
  db: D1Database,
  userId: string,
  threadId: string,
  message: string
): Promise<void> {
  await db
    .prepare(
      "UPDATE advisor_threads SET title = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2 AND user_id = ?3 AND title = 'New Chat'"
    )
    .bind(makeAdvisorThreadTitle(message), threadId, userId)
    .run()
}

export async function getAdvisorConversationHistory(
  db: D1Database,
  userId: string,
  threadId: string,
  limit = 10
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  const result = await db
    .prepare(
      "SELECT role, content FROM advisor_messages " +
        "WHERE thread_id = ?1 AND user_id = ?2 AND (model_used IS NULL OR model_used != 'system') " +
        "ORDER BY datetime(created_at) DESC, id DESC LIMIT ?3"
    )
    .bind(threadId, userId, limit)
    .all<{ role: "user" | "assistant"; content: string }>()

  return (result.results ?? []).reverse()
}
