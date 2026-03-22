import { describe, expect, it } from "vitest"
import {
  DEFAULT_CHAT_MODEL,
  DEFAULT_FALLBACK_MODEL,
  DEFAULT_REASONING_MODEL,
  resolveModelRoute,
  selectModel
} from "../src/agent/model-router"

describe("model router", () => {
  it("routes simple chat prompts to GLM", () => {
    expect(selectModel("Explain budgeting like I am a beginner.")).toBe(DEFAULT_CHAT_MODEL)
  })

  it("routes finance logic prompts to QWQ", () => {
    expect(
      selectModel("My income is $3500, expenses are $2200, and loan payment is $300. Build a payoff plan.")
    ).toBe(DEFAULT_REASONING_MODEL)
  })

  it("builds a fallback chain with Llama 3", () => {
    const route = resolveModelRoute(
      "Compare two repayment strategies and calculate interest savings over 12 months."
    )

    expect(route.primaryModel).toBe(DEFAULT_REASONING_MODEL)
    expect(route.fallbackModel).toBe(DEFAULT_FALLBACK_MODEL)
    expect(route.modelsToTry).toEqual([DEFAULT_REASONING_MODEL, DEFAULT_FALLBACK_MODEL])
  })
})
