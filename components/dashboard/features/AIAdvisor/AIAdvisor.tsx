import type React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Info,
  Loader2,
  MessageSquarePlus,
  Search,
  Sparkles,
  Trash2
} from "lucide-react"

import {
  createAdvisorChat,
  deleteAdvisorChat,
  getAgentAdvice,
  listAdvisorChats,
  sendAdvisorChatMessage,
  type AdvisorChatThread as RemoteAdvisorChatThread,
  type AgentAdviceResponse
} from "@/lib/financial-client"
import { ChatInput, ChatInputSubmit, ChatInputTextArea } from "@/components/ui/chat-input"

function AdvisorBrandMark() {
  return (
    <div
      className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/15 via-slate-900/45 to-cyan-500/15 shadow-[inset_0_1px_0_rgba(52,211,153,0.12)]"
      aria-hidden
    >
      <CircleDollarSign className="h-[18px] w-[18px] text-emerald-200" strokeWidth={1.85} />
      <Sparkles className="absolute -right-0.5 -top-0.5 h-3 w-3 text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.35)]" strokeWidth={2.25} />
    </div>
  )
}

type MessageMeta = {
  intent: AgentAdviceResponse["intent"]
  usedTools: AgentAdviceResponse["used_tools"]
  toolSummaries: AgentAdviceResponse["tool_summaries"]
  knowledgeSources: AgentAdviceResponse["knowledge_sources"]
  webSources: AgentAdviceResponse["web_sources"]
  rag: AgentAdviceResponse["rag"]
}

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  modelUsed?: string
  meta?: MessageMeta
}

type ChatThread = {
  id: string
  title: string
  createdAt: Date
  updatedAt: Date
  messages: Message[]
}

interface AIAdvisorProps {
  userData: {
    monthlyIncome: number
    monthlyExpenses: number
    country: string
  }
  accountId?: string | null
  layout?: "embedded" | "fullscreen"
  storageNamespace?: string
}

type InlineToken =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "link"; text: string; href: string }

type PersistedThread = Omit<ChatThread, "createdAt" | "updatedAt" | "messages"> & {
  createdAt: string
  updatedAt: string
  messages: Array<Omit<Message, "timestamp"> & { timestamp: string }>
}

const CHAT_THREADS_STORAGE_PREFIX = "burryai:advisor:threads:v1"
const ACTIVE_THREAD_STORAGE_PREFIX = "burryai:advisor:active-thread:v1"
const LEGACY_CHAT_STORAGE_KEY = "burryai:advisor:chat:v3"

const QUICK_PROMPTS = [
  "Analyze my spending breakdown",
  "How can I save more monthly?",
  "Build me a debt payoff plan",
  "Compare income vs expenses",
  "Find nearby and remote extra earning opportunities"
]

const AGENT_STEPS = [
  "Understanding request",
  "Searching financial context",
  "Reasoning on your data",
  "Drafting response"
]

function createWelcomeMessage(): Message {
  return {
    id: `welcome-${Date.now()}`,
    role: "assistant",
    content:
      "Welcome to BurryAI Advisor. I can help analyze your income vs expenses, build debt and savings plans, and suggest practical ways to boost earnings. Tell me your top money goal for this month and I will create a focused plan.",
    timestamp: new Date(),
    modelUsed: "system"
  }
}

function createThread(title = "New Chat"): ChatThread {
  const now = new Date()
  return {
    id: `thread-${crypto.randomUUID()}`,
    title,
    createdAt: now,
    updatedAt: now,
    messages: [createWelcomeMessage()]
  }
}

function makeThreadTitle(content: string): string {
  const cleaned = content.trim().replace(/\s+/g, " ")
  if (!cleaned) return "New Chat"
  if (cleaned.length <= 36) return cleaned
  return `${cleaned.slice(0, 36)}...`
}

function normalizeModelName(modelUsed?: string): string {
  if (!modelUsed) return "-"
  if (modelUsed.startsWith("gemini:")) return modelUsed.slice("gemini:".length)
  if (modelUsed.startsWith("workers-ai:")) {
    const [providerModel, routeInfo] = modelUsed.split("|route:")
    const cleanedModel = providerModel.replace("workers-ai:", "")
    if (!routeInfo) return cleanedModel
    return `${cleanedModel} (${routeInfo.replace("|selected:", ", selected: ")})`
  }
  return modelUsed
}

function trimUrl(url: string): { href: string; text: string } {
  const match = url.match(/^(.*?)([.,!?;:])?$/)
  const href = match?.[1] ?? url
  return { href, text: url }
}

function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = []
  const pattern = /\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)]+)/g
  let lastIndex = 0

  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > lastIndex) {
      tokens.push({ type: "text", text: text.slice(lastIndex, index) })
    }

    if (match[1]) {
      tokens.push({ type: "bold", text: match[1] })
    } else if (match[2] && match[3]) {
      tokens.push({ type: "link", text: match[2], href: match[3] })
    } else if (match[4]) {
      const normalized = trimUrl(match[4])
      tokens.push({ type: "link", text: normalized.text, href: normalized.href })
    }

    lastIndex = index + match[0].length
  }

  if (lastIndex < text.length) {
    tokens.push({ type: "text", text: text.slice(lastIndex) })
  }

  return tokens
}

function renderInline(text: string, keyPrefix: string): JSX.Element[] {
  return parseInline(text).map((token, index) => {
    if (token.type === "bold") {
      return (
        <strong key={`${keyPrefix}-b-${index}`} className="font-semibold text-slate-100">
          {token.text}
        </strong>
      )
    }

    if (token.type === "link") {
      return (
        <a
          key={`${keyPrefix}-l-${index}`}
          href={token.href}
          target="_blank"
          rel="noreferrer"
          className="break-all text-cyan-300 underline decoration-cyan-500/50 underline-offset-2"
        >
          {token.text}
        </a>
      )
    }

    return <span key={`${keyPrefix}-t-${index}`}>{token.text}</span>
  })
}

function renderAssistantContent(text: string): JSX.Element[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n")
  const nodes: JSX.Element[] = []
  const bulletItems: string[] = []
  const numberedItems: string[] = []

  function flushBullets(key: number) {
    if (bulletItems.length === 0) return
    nodes.push(
      <ul key={`ul-${key}`} className="my-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
        {bulletItems.map((item, index) => (
          <li key={`bul-${index}`}>{renderInline(item, `bul-${key}-${index}`)}</li>
        ))}
      </ul>
    )
    bulletItems.length = 0
  }

  function flushNumbers(key: number) {
    if (numberedItems.length === 0) return
    nodes.push(
      <ol key={`ol-${key}`} className="my-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed">
        {numberedItems.map((item, index) => (
          <li key={`num-${index}`}>{renderInline(item, `num-${key}-${index}`)}</li>
        ))}
      </ol>
    )
    numberedItems.length = 0
  }

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim()
    if (!line) {
      flushBullets(index)
      flushNumbers(index)
      return
    }

    const headingMatch = line.match(/^#{1,6}\s+(.+)$/)
    if (headingMatch) {
      flushBullets(index)
      flushNumbers(index)
      nodes.push(
        <h4 key={`h-${index}`} className="mt-3 text-sm font-semibold text-cyan-200">
          {renderInline(headingMatch[1], `h-${index}`)}
        </h4>
      )
      return
    }

    if (/^[-*]\s+/.test(line)) {
      flushNumbers(index)
      bulletItems.push(line.replace(/^[-*]\s+/, ""))
      return
    }

    if (/^\d+\.\s+/.test(line)) {
      flushBullets(index)
      numberedItems.push(line.replace(/^\d+\.\s+/, ""))
      return
    }

    if (line.endsWith(":") && line.length < 80) {
      flushBullets(index)
      flushNumbers(index)
      nodes.push(
        <h4 key={`s-${index}`} className="mt-3 text-sm font-semibold text-cyan-200">
          {renderInline(line, `s-${index}`)}
        </h4>
      )
      return
    }

    flushBullets(index)
    flushNumbers(index)
    nodes.push(
      <p key={`p-${index}`} className="text-sm leading-relaxed">
        {renderInline(line, `p-${index}`)}
      </p>
    )
  })

  flushBullets(lines.length + 1)
  flushNumbers(lines.length + 2)

  return nodes
}

function formatThreadTime(date: Date): string {
  return date.toLocaleDateString([], { month: "short", day: "numeric" })
}

function fromRemoteThread(thread: RemoteAdvisorChatThread): ChatThread {
  return {
    id: thread.id,
    title: thread.title,
    createdAt: new Date(thread.created_at),
    updatedAt: new Date(thread.updated_at),
    messages: (thread.messages ?? []).map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      timestamp: new Date(message.timestamp),
      modelUsed: message.model_used,
      meta: message.meta
        ? {
            intent: message.meta.intent,
            usedTools: message.meta.used_tools,
            toolSummaries: message.meta.tool_summaries,
            knowledgeSources: message.meta.knowledge_sources,
            webSources: message.meta.web_sources,
            rag: message.meta.rag
          }
        : undefined
    }))
  }
}

function toPersistedThreads(threads: ChatThread[]): PersistedThread[] {
  return threads.map((thread) => ({
    ...thread,
    createdAt: thread.createdAt.toISOString(),
    updatedAt: thread.updatedAt.toISOString(),
    messages: thread.messages.map((message) => ({
      ...message,
      timestamp: message.timestamp.toISOString()
    }))
  }))
}

function fromPersistedThreads(raw: string): ChatThread[] {
  const parsed = JSON.parse(raw) as PersistedThread[]
  if (!Array.isArray(parsed)) return []

  return parsed.map((thread) => ({
    ...thread,
    createdAt: new Date(thread.createdAt),
    updatedAt: new Date(thread.updatedAt),
    messages: (thread.messages ?? []).map((message) => ({
      ...message,
      timestamp: new Date(message.timestamp)
    }))
  }))
}

function ThreadCard(props: {
  active: boolean
  thread: ChatThread
  onOpen: () => void
  onDelete: () => void
}) {
  const { active, thread, onOpen, onDelete } = props

  return (
    <div
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onOpen()
        }
      }}
      role="button"
      tabIndex={0}
      className={`w-full rounded-[1.1rem] border px-2.5 py-2.5 text-left transition ${
        active
          ? "border-cyan-400/35 bg-cyan-500/10 shadow-[0_18px_40px_rgba(8,145,178,0.18)]"
          : "border-slate-800/80 bg-slate-950/75 hover:border-slate-700 hover:bg-slate-900/90"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-[11px] font-medium text-slate-100">{thread.title}</p>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onDelete()
          }}
          className="rounded p-0.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-300"
          title="Delete chat"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      <p className="mt-1.5 text-[10px] text-slate-500">
        {thread.messages.length} messages | {formatThreadTime(thread.updatedAt)}
      </p>
    </div>
  )
}

interface AdvisorSidebarProps {
  activeThreadId: string | null
  onClose?: () => void
  onCreateThread: () => void
  onDeleteThread: (threadId: string) => void
  onOpenThread: (threadId: string) => void
  sortedThreads: ChatThread[]
  variant?: "desktop" | "mobile"
}

function AdvisorSidebar({
  activeThreadId,
  onClose,
  onCreateThread,
  onDeleteThread,
  onOpenThread,
  sortedThreads,
  variant = "desktop"
}: AdvisorSidebarProps) {
  const isMobile = variant === "mobile"

  return (
    <aside
      className={
        isMobile
          ? "flex h-full w-full max-w-[320px] flex-col border-r border-slate-800/80 bg-[linear-gradient(180deg,rgba(2,6,23,0.98),rgba(8,15,30,0.98))] shadow-[0_24px_80px_rgba(2,6,23,0.55)]"
          : "hidden h-full min-h-0 flex-col rounded-[2rem] border border-slate-800/80 bg-[linear-gradient(180deg,rgba(2,6,23,0.98),rgba(8,15,30,0.97))] shadow-[0_20px_60px_rgba(2,6,23,0.55)] lg:flex"
      }
    >
      <div className={`border-b border-slate-800/80 ${isMobile ? "px-3 py-3" : "px-3 py-3"}`}>
        {onClose ? (
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700/80 bg-slate-900/85 text-slate-200 shadow-[0_10px_24px_rgba(2,6,23,0.28)]"
              title="Close chats"
              aria-label="Close chats"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onCreateThread}
          className="mt-1 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-2 text-xs font-medium text-cyan-100 transition hover:bg-cyan-500/15"
        >
          <MessageSquarePlus className="h-3.5 w-3.5" />
          New Chat
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-2.5 pb-2.5 pt-2.5">
        <div className="hide-scrollbar h-full space-y-2 overflow-y-auto pr-1">
          {sortedThreads.map((thread) => (
            <ThreadCard
              key={thread.id}
              active={activeThreadId === thread.id}
              thread={thread}
              onOpen={() => onOpenThread(thread.id)}
              onDelete={() => onDeleteThread(thread.id)}
            />
          ))}
        </div>
      </div>
    </aside>
  )
}

interface AdvisorConversationPanelProps {
  activeMessages: Message[]
  agentStep: number
  chatEndRef: React.RefObject<HTMLDivElement>
  hydrated: boolean
  inputMessage: string
  inputRef: React.RefObject<HTMLTextAreaElement>
  isFullscreen: boolean
  isLoading: boolean
  onInputChange: (value: string) => void
  onSendMessage: (text?: string) => void | Promise<void>
  onToggleSidebar: () => void
  openTraceId: string | null
  sidebarOpen: boolean
  setOpenTraceId: React.Dispatch<React.SetStateAction<string | null>>
  showSidebarToggle: boolean
  userData: AIAdvisorProps["userData"]
}

function AdvisorConversationPanel({
  activeMessages,
  agentStep,
  chatEndRef,
  hydrated,
  inputMessage,
  inputRef,
  isFullscreen,
  isLoading,
  onInputChange,
  onSendMessage,
  onToggleSidebar,
  openTraceId,
  sidebarOpen,
  setOpenTraceId,
  showSidebarToggle,
  userData
}: AdvisorConversationPanelProps) {
  return (
    <section
      className={`flex min-h-0 flex-col overflow-hidden rounded-[2rem] border border-slate-800/80 bg-[linear-gradient(180deg,rgba(2,6,23,0.98),rgba(8,15,30,0.97))] shadow-[0_20px_60px_rgba(2,6,23,0.55)] ${
        isFullscreen ? "h-full" : "min-h-[32rem] sm:min-h-[38rem] lg:h-[calc(100svh-11rem)]"
      }`}
    >
      <div className="shrink-0 border-b border-slate-800/80 bg-[linear-gradient(180deg,rgba(15,23,42,0.82),rgba(15,23,42,0.58))] px-3 py-3 sm:px-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <AdvisorBrandMark />
            <h3 className="truncate text-sm font-semibold text-slate-100 sm:text-base">BurryAI Advisor</h3>
          </div>

          {showSidebarToggle ? (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-700/80 bg-slate-900/85 text-slate-200 shadow-[0_10px_24px_rgba(2,6,23,0.28)]"
              title={sidebarOpen ? "Hide chats" : "Show chats"}
              aria-label={sidebarOpen ? "Hide chats" : "Show chats"}
            >
              {sidebarOpen ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <div className="shrink-0 flex items-center gap-2 border-b border-slate-800 bg-slate-950/60 px-4 py-2 text-xs text-cyan-200 sm:px-5">
          <Search className="h-3.5 w-3.5 animate-pulse" />
          {AGENT_STEPS[agentStep]}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="hide-scrollbar h-full overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(6,182,212,0.08),transparent_30%),radial-gradient(circle_at_bottom,rgba(16,185,129,0.08),transparent_24%),linear-gradient(180deg,rgba(15,23,42,0.32),rgba(2,6,23,0.22))] p-4 sm:p-5">
          <div className="space-y-4">
            {activeMessages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "assistant" ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[90%] px-4 py-3 shadow-[0_12px_30px_rgba(15,23,42,0.18)] sm:max-w-[84%] ${
                    message.role === "assistant"
                      ? "rounded-[1.6rem] rounded-bl-md border border-slate-800/60 bg-slate-900/92 text-slate-100"
                      : "rounded-[1.6rem] rounded-br-md bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-500 text-white"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <div className="relative">
                      {message.meta ? (
                        <button
                          type="button"
                          onClick={() => setOpenTraceId((prev) => (prev === message.id ? null : message.id))}
                          className="absolute right-0 top-0 inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-cyan-200"
                          title="Show agent details"
                          aria-label="Show agent details"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      ) : null}

                      <div className={message.meta ? "space-y-1 pr-8" : "space-y-1"}>
                        {renderAssistantContent(message.content)}
                      </div>

                      {openTraceId === message.id && message.meta ? (
                        <div className="mt-3 space-y-2 rounded-xl border border-cyan-500/20 bg-slate-950/70 p-3 text-xs text-slate-300">
                          <p>
                            <span className="text-slate-400">Intent:</span> {message.meta.intent}
                          </p>
                          <p>
                            <span className="text-slate-400">Model:</span> {normalizeModelName(message.modelUsed)}
                          </p>
                          <p>
                            <span className="text-slate-400">RAG:</span> {message.meta.rag.knowledge_count} knowledge chunks, {message.meta.rag.web_count} web results, search triggered: {message.meta.rag.web_search_triggered ? "yes" : "no"}
                          </p>
                          <p>
                            <span className="text-slate-400">Tools:</span>{" "}
                            {message.meta.usedTools.join(", ") || "none"}
                          </p>

                          {message.meta.toolSummaries.length > 0 ? (
                            <div className="space-y-1">
                              <p className="text-slate-400">Tool outputs:</p>
                              {message.meta.toolSummaries.map((tool) => (
                                <p key={`${message.id}-${tool.name}`}>
                                  {tool.name}: {tool.summary}
                                </p>
                              ))}
                            </div>
                          ) : null}

                          {message.meta.knowledgeSources.length > 0 ? (
                            <div className="space-y-1">
                              <p className="text-slate-400">Knowledge sources:</p>
                              {message.meta.knowledgeSources.map((source, index) => (
                                <p key={`${message.id}-k-${index}`}>
                                  {source.title} ({source.source})
                                </p>
                              ))}
                            </div>
                          ) : null}

                          {message.meta.webSources.length > 0 ? (
                            <div className="space-y-1">
                              <p className="text-slate-400">Web sources:</p>
                              {message.meta.webSources.map((source, index) => (
                                <p key={`${message.id}-w-${index}`}>
                                  <a
                                    href={source.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="break-all text-cyan-300 underline decoration-cyan-500/50 underline-offset-2"
                                  >
                                    {source.title || source.url}
                                  </a>{" "}
                                  ({source.source})
                                </p>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                  )}

                  <p className="mt-2 text-[11px] opacity-70">
                    {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}

            {isLoading ? (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl border border-cyan-500/20 bg-slate-900 px-4 py-3 text-xs text-slate-300">
                  <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                  Agent is working...
                </div>
              </div>
            ) : null}

            <div ref={chatEndRef} />
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-800/70 bg-[linear-gradient(180deg,rgba(2,6,23,0.72),rgba(2,6,23,0.96))] p-3 sm:p-4">
        {activeMessages.length <= 2 ? (
          <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-visible sm:pb-3">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => void onSendMessage(prompt)}
                disabled={isLoading}
                className="shrink-0 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100 transition hover:bg-cyan-500/15 disabled:opacity-40"
              >
                {prompt}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex items-end gap-2">
          <ChatInput
            value={inputMessage}
            onChange={(event) => onInputChange(event.target.value)}
            onSubmit={() => void onSendMessage()}
            loading={isLoading}
            className="border-slate-700/70 bg-slate-900/90 shadow-[0_14px_30px_rgba(2,6,23,0.28)] focus-within:border-cyan-400/40 focus-within:ring-cyan-400/15"
          >
            <ChatInputTextArea
              ref={inputRef}
              placeholder="Message BurryAI..."
              disabled={!hydrated}
              className="bg-transparent px-2 py-2 text-[15px] text-slate-100 placeholder:text-slate-500"
            />
            <ChatInputSubmit
              disabled={!hydrated || !inputMessage.trim()}
              className="border-cyan-400/20 bg-gradient-to-r from-cyan-500 to-sky-500 text-white hover:from-cyan-400 hover:to-sky-400"
            />
          </ChatInput>
        </div>
      </div>
    </section>
  )
}

export function AIAdvisor({
  userData,
  accountId = null,
  layout = "embedded",
  storageNamespace = "default"
}: AIAdvisorProps) {
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [activeThreadId, setActiveThreadId] = useState("")
  const [inputMessage, setInputMessage] = useState("")
  const [loadingThreadId, setLoadingThreadId] = useState<string | null>(null)
  const [agentStep, setAgentStep] = useState(0)
  const [openTraceId, setOpenTraceId] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [syncError, setSyncError] = useState("")

  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const remotePersistence = Boolean(accountId)
  const threadStorageKey = `${CHAT_THREADS_STORAGE_PREFIX}:${storageNamespace}`
  const activeThreadStorageKey = `${ACTIVE_THREAD_STORAGE_PREFIX}:${storageNamespace}`

  const sortedThreads = useMemo(
    () => [...threads].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
    [threads]
  )

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? sortedThreads[0] ?? null,
    [activeThreadId, sortedThreads, threads]
  )

  const activeMessages = activeThread?.messages ?? []
  const isLoading = loadingThreadId === activeThread?.id
  const isFullscreen = layout === "fullscreen"

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [activeMessages, isLoading, openTraceId, activeThread?.id])

  useEffect(() => {
    let cancelled = false

    async function hydrateRemoteThreads() {
      try {
        const storedActiveThread = localStorage.getItem(activeThreadStorageKey)
        const remoteThreads = await listAdvisorChats()
        let nextThreads = remoteThreads.map(fromRemoteThread)

        if (nextThreads.length === 0) {
          const created = await createAdvisorChat()
          nextThreads = [fromRemoteThread(created)]
        }

        if (cancelled) return

        setThreads(nextThreads)
        setActiveThreadId(
          storedActiveThread && nextThreads.some((thread) => thread.id === storedActiveThread)
            ? storedActiveThread
            : nextThreads[0]?.id ?? ""
        )
        setSyncError("")
      } catch (error) {
        if (cancelled) return

        const initial = createThread()
        setThreads([initial])
        setActiveThreadId(initial.id)
        setSyncError(error instanceof Error ? error.message : "Unable to sync advisor chats right now.")
      } finally {
        if (!cancelled) {
          setHydrated(true)
        }
      }
    }

    function hydrateLocalThreads() {
      try {
        const storedThreads = localStorage.getItem(threadStorageKey)
        const storedActiveThread = localStorage.getItem(activeThreadStorageKey)

        if (storedThreads) {
          const parsedThreads = fromPersistedThreads(storedThreads)
          if (parsedThreads.length > 0) {
            setThreads(parsedThreads)
            setActiveThreadId(
              storedActiveThread && parsedThreads.some((thread) => thread.id === storedActiveThread)
                ? storedActiveThread
                : parsedThreads[0].id
            )
            setHydrated(true)
            return
          }
        }

        const legacyRaw = localStorage.getItem(LEGACY_CHAT_STORAGE_KEY)
        if (legacyRaw) {
          const legacyMessages = JSON.parse(legacyRaw) as Array<
            Omit<Message, "timestamp"> & { timestamp: string }
          >
          if (Array.isArray(legacyMessages) && legacyMessages.length > 0) {
            const migrated = createThread("Previous Chat")
            migrated.messages = legacyMessages.map((message) => ({
              ...message,
              timestamp: new Date(message.timestamp)
            }))
            migrated.updatedAt = new Date()
            setThreads([migrated])
            setActiveThreadId(migrated.id)
            setHydrated(true)
            return
          }
        }
      } catch {
        // Ignore malformed cache and regenerate below.
      }

      const initial = createThread()
      setThreads([initial])
      setActiveThreadId(initial.id)
      setHydrated(true)
    }

    setHydrated(false)
    if (remotePersistence) {
      void hydrateRemoteThreads()
    } else {
      hydrateLocalThreads()
    }

    return () => {
      cancelled = true
    }
  }, [activeThreadStorageKey, remotePersistence, threadStorageKey])

  useEffect(() => {
    if (!hydrated) return
    localStorage.setItem(activeThreadStorageKey, activeThreadId)
    if (!remotePersistence) {
      localStorage.setItem(threadStorageKey, JSON.stringify(toPersistedThreads(threads)))
    }
  }, [activeThreadId, activeThreadStorageKey, hydrated, remotePersistence, threadStorageKey, threads])

  useEffect(() => {
    if (!isLoading) {
      setAgentStep(0)
      return
    }

    const id = window.setInterval(() => {
      setAgentStep((step) => (step + 1) % AGENT_STEPS.length)
    }, 1200)

    return () => window.clearInterval(id)
  }, [isLoading])

  useEffect(() => {
    if (!activeThread && sortedThreads.length > 0) {
      setActiveThreadId(sortedThreads[0].id)
    }
  }, [activeThread, sortedThreads])

  useEffect(() => {
    if (!isFullscreen) return

    const mediaQuery = window.matchMedia("(min-width: 1024px)")
    const syncSidebar = () => setSidebarOpen(mediaQuery.matches)

    syncSidebar()
    mediaQuery.addEventListener("change", syncSidebar)
    return () => mediaQuery.removeEventListener("change", syncSidebar)
  }, [isFullscreen])

  function upsertThread(thread: ChatThread) {
    setThreads((prev) => {
      const remaining = prev.filter((item) => item.id !== thread.id)
      return [thread, ...remaining]
    })
  }

  function updateThreadMessages(
    threadId: string,
    updater: (messages: Message[], existingTitle: string) => { messages: Message[]; title: string }
  ) {
    setThreads((prev) =>
      prev.map((thread) => {
        if (thread.id !== threadId) return thread
        const next = updater(thread.messages, thread.title)
        return {
          ...thread,
          title: next.title,
          messages: next.messages,
          updatedAt: new Date()
        }
      })
    )
  }

  function createNewThread() {
    void (async () => {
      if (remotePersistence) {
        try {
          const thread = fromRemoteThread(await createAdvisorChat())
          upsertThread(thread)
          setActiveThreadId(thread.id)
          setInputMessage("")
          setOpenTraceId(null)
          setSyncError("")
        } catch (error) {
          setSyncError(error instanceof Error ? error.message : "Unable to create a new chat.")
          return
        }
      } else {
        const thread = createThread()
        setThreads((prev) => [thread, ...prev])
        setActiveThreadId(thread.id)
        setInputMessage("")
        setOpenTraceId(null)
      }

      if (typeof window !== "undefined" && window.innerWidth < 1024) {
        setSidebarOpen(false)
      }
    })()
  }

  function deleteThread(threadId: string) {
    void (async () => {
      if (remotePersistence) {
        try {
          await deleteAdvisorChat(threadId)
          const remaining = threads.filter((thread) => thread.id !== threadId)
          if (remaining.length === 0) {
            const replacement = fromRemoteThread(await createAdvisorChat())
            setThreads([replacement])
            setActiveThreadId(replacement.id)
          } else {
            setThreads(remaining)
            if (threadId === activeThreadId) {
              setActiveThreadId(remaining[0].id)
            }
          }
          setSyncError("")
          return
        } catch (error) {
          setSyncError(error instanceof Error ? error.message : "Unable to delete this chat.")
          return
        }
      }

      setThreads((prev) => {
        if (prev.length === 1) {
          const fresh = createThread()
          setActiveThreadId(fresh.id)
          return [fresh]
        }

        const next = prev.filter((thread) => thread.id !== threadId)
        if (threadId === activeThreadId && next.length > 0) {
          setActiveThreadId(next[0].id)
        }
        return next
      })
    })()
  }

  function openThread(threadId: string) {
    setActiveThreadId(threadId)
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setSidebarOpen(false)
    }
  }

  async function sendMessage(textOverride?: string) {
    const text = (textOverride ?? inputMessage).trim()
    if (!text || isLoading) return

    let currentThreadId = activeThread?.id
    if (!currentThreadId) {
      if (remotePersistence) {
        try {
          const created = fromRemoteThread(await createAdvisorChat())
          upsertThread(created)
          setActiveThreadId(created.id)
          currentThreadId = created.id
        } catch (error) {
          setSyncError(error instanceof Error ? error.message : "Unable to create a chat.")
          return
        }
      } else {
        const thread = createThread()
        setThreads((prev) => [thread, ...prev])
        setActiveThreadId(thread.id)
        currentThreadId = thread.id
      }
    }

    const userMessage: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date()
    }

    updateThreadMessages(currentThreadId, (messages, existingTitle) => ({
      messages: [...messages, userMessage],
      title: existingTitle === "New Chat" ? makeThreadTitle(text) : existingTitle
    }))
    setInputMessage("")
    setLoadingThreadId(currentThreadId)

    try {
      if (remotePersistence) {
        const remoteThread = await sendAdvisorChatMessage(currentThreadId, text)
        upsertThread(fromRemoteThread(remoteThread))
        setSyncError("")
      } else {
        const agent = await getAgentAdvice(text)
        const assistantMessage: Message = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: agent.response,
          timestamp: new Date(),
          modelUsed: agent.model_used,
          meta: {
            intent: agent.intent,
            usedTools: agent.used_tools,
            toolSummaries: agent.tool_summaries,
            knowledgeSources: agent.knowledge_sources,
            webSources: agent.web_sources,
            rag: agent.rag
          }
        }

        updateThreadMessages(currentThreadId, (messages, existingTitle) => ({
          messages: [...messages, assistantMessage],
          title: existingTitle
        }))
      }
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Unable to generate advice now."

      updateThreadMessages(currentThreadId, (messages, existingTitle) => ({
        messages: [
          ...messages,
          {
            id: `e-${Date.now()}`,
            role: "assistant",
            content: messageText,
            timestamp: new Date(),
            modelUsed: "error"
          }
        ],
        title: existingTitle
      }))
      if (remotePersistence) {
        setSyncError(messageText)
      }
    } finally {
      setLoadingThreadId(null)
      inputRef.current?.focus()
    }
  }

  return (
    <div
      className={
        isFullscreen
          ? `grid h-full min-h-0 grid-cols-1 gap-4 pb-[calc(env(safe-area-inset-bottom)+5.75rem)] md:pb-0 ${
              sidebarOpen ? "lg:grid-cols-[320px,minmax(0,1fr)]" : "lg:grid-cols-[minmax(0,1fr)]"
            }`
          : "w-full space-y-3"
      }
    >
      {syncError ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {syncError}
        </div>
      ) : null}

      {isFullscreen && sidebarOpen ? (
        <>
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)}>
            <div className="h-full w-full max-w-[320px]" onClick={(event) => event.stopPropagation()}>
              <AdvisorSidebar
                activeThreadId={activeThread?.id ?? null}
                onClose={() => setSidebarOpen(false)}
                onCreateThread={createNewThread}
                onDeleteThread={deleteThread}
                onOpenThread={openThread}
                sortedThreads={sortedThreads}
                variant="mobile"
              />
            </div>
          </div>

          <AdvisorSidebar
            activeThreadId={activeThread?.id ?? null}
            onCreateThread={createNewThread}
            onDeleteThread={deleteThread}
            onOpenThread={openThread}
            sortedThreads={sortedThreads}
          />
        </>
      ) : !isFullscreen ? (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={createNewThread}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-200 hover:bg-cyan-500/20 sm:w-auto"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            New Chat
          </button>

          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <label htmlFor="chat-thread-select" className="text-xs text-slate-400">
              Chats
            </label>
            <select
              id="chat-thread-select"
              value={activeThread?.id ?? ""}
              onChange={(event) => setActiveThreadId(event.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-slate-200 sm:flex-none"
            >
              {sortedThreads.map((thread) => (
                <option key={thread.id} value={thread.id}>
                  {thread.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      <div className="min-h-0 min-w-0">
        <AdvisorConversationPanel
          activeMessages={activeMessages}
          agentStep={agentStep}
          chatEndRef={chatEndRef}
          hydrated={hydrated}
          inputMessage={inputMessage}
          inputRef={inputRef}
          isFullscreen={isFullscreen}
          isLoading={isLoading}
          onInputChange={setInputMessage}
          onSendMessage={sendMessage}
          onToggleSidebar={() => setSidebarOpen((open) => !open)}
          openTraceId={openTraceId}
          sidebarOpen={sidebarOpen}
          setOpenTraceId={setOpenTraceId}
          showSidebarToggle={isFullscreen}
          userData={userData}
        />
      </div>
    </div>
  )
}
