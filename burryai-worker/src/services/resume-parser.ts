import type { FullProfile, ProfileUpdateInput } from "./profile"

type ResumeExtraction = {
  full_name: string
  profession: string
  skills: string[]
  other_talents: string[]
  city: string
  state_region: string
  country: string
  university: string
  student_status: string
  preferred_work_mode: "local" | "remote" | "hybrid"
  resume_summary: string
}

const EXTRACTION_PROMPT = `You are a resume parser. Extract structured data from the resume text below.

Return ONLY a valid JSON object with these fields (no markdown, no explanation):
{
  "full_name": "string or empty",
  "profession": "string — the candidate's primary job title/role, e.g. 'Full Stack Developer', 'Data Scientist'",
  "skills": ["array of technical skills and tools, max 20"],
  "other_talents": ["array of soft skills, certifications, languages, side skills, max 10"],
  "city": "string or empty",
  "state_region": "string or empty",
  "country": "string or empty",
  "university": "string — most recent educational institution or empty",
  "student_status": "one of: 'current_student', 'recent_graduate', 'professional', or empty",
  "preferred_work_mode": "one of: 'remote', 'hybrid', 'local' — infer from resume content, default 'hybrid'",
  "resume_summary": "A 50-100 word professional summary of the candidate highlighting their strongest skills, experience level, and career focus. Write in third person."
}

Rules:
- Extract ALL technical skills mentioned (programming languages, frameworks, tools, platforms)
- For profession, pick the most senior/relevant title mentioned
- Infer location from addresses, phone area codes, or stated locations
- If the person is currently in school or recently graduated, set student_status accordingly
- The resume_summary should be useful for job matching — focus on skills, experience, and job preferences
- Return ONLY the JSON object, nothing else

Resume text:
`

export async function parseResumeWithAI(params: {
  resumeText: string
  aiBinding: {
    run: (model: string, input: unknown) => Promise<unknown>
  }
  model?: string
  fallbackModel?: string
}): Promise<{ extraction: ResumeExtraction; profileUpdate: ProfileUpdateInput }> {
  const trimmedText = params.resumeText.trim().slice(0, 12000)
  if (trimmedText.length < 30) {
    throw new Error("Resume text is too short to parse")
  }

  const prompt = EXTRACTION_PROMPT + trimmedText

  const primaryModel = params.model || "@cf/meta/llama-3-8b-instruct"
  const fallback = params.fallbackModel || "@cf/meta/llama-3-8b-instruct"

  let rawResponse: string | null = null

  for (const model of [primaryModel, fallback]) {
    try {
      const result = (await params.aiBinding.run(model, {
        messages: [
          {
            role: "system",
            content:
              "You are a precise resume parser. You ONLY output valid JSON objects. No markdown fences, no explanation text."
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 1200,
        temperature: 0.1
      })) as { response?: string }

      if (result?.response) {
        rawResponse = result.response
        break
      }
    } catch {
      continue
    }
  }

  if (!rawResponse) {
    throw new Error("AI failed to parse resume")
  }

  const extraction = extractJsonFromResponse(rawResponse)

  const profileUpdate: ProfileUpdateInput = {}

  if (extraction.full_name) profileUpdate.full_name = extraction.full_name
  if (extraction.profession) profileUpdate.profession = extraction.profession
  if (extraction.skills.length > 0) profileUpdate.skills = extraction.skills
  if (extraction.other_talents.length > 0) profileUpdate.other_talents = extraction.other_talents
  if (extraction.city) profileUpdate.city = extraction.city
  if (extraction.state_region) profileUpdate.state_region = extraction.state_region
  if (extraction.country) profileUpdate.country = extraction.country
  if (extraction.university) profileUpdate.university = extraction.university
  if (extraction.student_status) profileUpdate.student_status = extraction.student_status
  if (extraction.preferred_work_mode) profileUpdate.preferred_work_mode = extraction.preferred_work_mode
  if (extraction.resume_summary) profileUpdate.resume_summary = extraction.resume_summary

  return { extraction, profileUpdate }
}

function extractJsonFromResponse(raw: string): ResumeExtraction {
  let cleaned = raw.trim()

  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch?.[1]) {
    cleaned = fenceMatch[1].trim()
  }

  const braceStart = cleaned.indexOf("{")
  const braceEnd = cleaned.lastIndexOf("}")
  if (braceStart >= 0 && braceEnd > braceStart) {
    cleaned = cleaned.slice(braceStart, braceEnd + 1)
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(cleaned) as Record<string, unknown>
  } catch {
    throw new Error("AI returned invalid JSON for resume parsing")
  }

  return {
    full_name: safeString(parsed.full_name),
    profession: safeString(parsed.profession),
    skills: safeStringArray(parsed.skills, 20),
    other_talents: safeStringArray(parsed.other_talents, 10),
    city: safeString(parsed.city),
    state_region: safeString(parsed.state_region),
    country: safeString(parsed.country),
    university: safeString(parsed.university),
    student_status: safeString(parsed.student_status),
    preferred_work_mode: safeWorkMode(parsed.preferred_work_mode),
    resume_summary: safeString(parsed.resume_summary)
  }
}

function safeString(value: unknown): string {
  if (typeof value === "string") return value.trim()
  return ""
}

function safeStringArray(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, max)
}

function safeWorkMode(value: unknown): "local" | "remote" | "hybrid" {
  if (value === "remote" || value === "local" || value === "hybrid") return value
  return "hybrid"
}
