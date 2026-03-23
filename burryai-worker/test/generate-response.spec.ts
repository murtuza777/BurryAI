import { describe, expect, it } from "vitest"
import { extractWorkersAiText } from "../src/agent/nodes/generate-response"

describe("extractWorkersAiText", () => {
  it("reads classic workers ai response payloads", () => {
    expect(extractWorkersAiText({ response: "hello" })).toBe("hello")
  })

  it("reads glm chat completion payloads", () => {
    expect(
      extractWorkersAiText({
        choices: [
          {
            message: {
              content: "budget answer"
            }
          }
        ]
      })
    ).toBe("budget answer")
  })

  it("reads glm structured content arrays", () => {
    expect(
      extractWorkersAiText({
        choices: [
          {
            message: {
              content: [
                { type: "output_text", text: "Line one" },
                { type: "output_text", text: "Line two" }
              ]
            }
          }
        ]
      })
    ).toBe("Line one\nLine two")
  })
})
