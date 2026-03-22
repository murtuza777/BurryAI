export const DEFAULT_CHAT_MODEL = "@cf/zai-org/glm-4.7-flash"
export const DEFAULT_REASONING_MODEL = "@cf/qwen/qwq-32b"
export const DEFAULT_FALLBACK_MODEL = "@cf/meta/llama-3-8b-instruct"

type ModelCatalog = {
  chatModel: string
  reasoningModel: string
  fallbackModel: string
}

export type ModelRoute = {
  taskType: "chat" | "reasoning"
  primaryModel: string
  fallbackModel: string
  modelsToTry: string[]
}

const REASONING_PATTERNS = [
  /\b(calc|calculate|calculation|math|formula|equation|estimate|project|forecast)\b/i,
  /\b(plan|planning|strategy|roadmap|scenario|simulate|simulation|what if)\b/i,
  /\b(compare|comparison|optimi[sz]e|rebalance|allocate|split|prioriti[sz]e)\b/i,
  /\b(debt|loan|emi|interest|apr|payoff|repay|repayment)\b/i,
  /\b(budget|budgeting|savings rate|expense ratio|debt[-\s]?to[-\s]?income|dti)\b/i,
  /\b(monthly|weekly|yearly|annual|timeline|schedule|goal)\b/i,
  /\b(best option|best approach|should i|which is better)\b/i,
  /[$€£₹]/,
  /\b\d+(?:\.\d+)?%/,
  /\b\d+(?:,\d{3})*(?:\.\d+)?\b/
]

function countReasoningSignals(userInput: string): number {
  return REASONING_PATTERNS.reduce(
    (count, pattern) => count + (pattern.test(userInput) ? 1 : 0),
    0
  )
}

function shouldUseReasoningModel(userInput: string): boolean {
  const normalized = userInput.trim().toLowerCase()
  if (normalized.length === 0) {
    return false
  }

  return countReasoningSignals(normalized) >= 2
}

export function selectModel(userInput: string): string {
  return shouldUseReasoningModel(userInput)
    ? DEFAULT_REASONING_MODEL
    : DEFAULT_CHAT_MODEL
}

export function resolveModelRoute(
  userInput: string,
  catalog?: Partial<ModelCatalog>
): ModelRoute {
  const chatModel = catalog?.chatModel?.trim() || DEFAULT_CHAT_MODEL
  const reasoningModel = catalog?.reasoningModel?.trim() || DEFAULT_REASONING_MODEL
  const fallbackModel = catalog?.fallbackModel?.trim() || DEFAULT_FALLBACK_MODEL
  const taskType = shouldUseReasoningModel(userInput) ? "reasoning" : "chat"
  const primaryModel = taskType === "reasoning" ? reasoningModel : chatModel
  const modelsToTry = Array.from(new Set([primaryModel, fallbackModel].filter(Boolean)))

  return {
    taskType,
    primaryModel,
    fallbackModel,
    modelsToTry
  }
}
