import type { AgentIntent } from "../state"

const intentKeywords: Array<{ intent: AgentIntent; keywords: string[] }> = [
  { intent: "debt", keywords: ["loan", "debt", "interest", "repayment", "emi", "payment"] },
  { intent: "savings", keywords: ["save", "savings", "emergency fund", "goal", "invest"] },
  {
    intent: "income",
    keywords: [
      "income",
      "earn",
      "salary",
      "side hustle",
      "extra money",
      "job",
      "internship",
      "part time",
      "freelance",
      "gig"
    ]
  },
  { intent: "budgeting", keywords: ["budget", "spending", "expense", "cut cost", "reduce"] }
]

export function detectIntent(userMessage: string): AgentIntent {
  const normalized = userMessage.toLowerCase()

  for (const rule of intentKeywords) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
      return rule.intent
    }
  }

  return "general"
}
