export type UserProfileRow = {
  user_id: string
  full_name: string | null
  country: string | null
  student_status: string | null
  university: string | null
  profession: string | null
  skills_json: string | null
  other_talents_json: string | null
  preferred_work_mode: "local" | "remote" | "hybrid" | null
  city: string | null
  state_region: string | null
  remote_regions_json: string | null
  opportunity_radius_km: number | null
  min_hourly_rate: number | null
  onboarding_completed: number
  resume_summary: string | null
  resume_text: string | null
}

export type FinancialProfileRow = {
  user_id: string
  monthly_income: number
  currency: string
  savings_goal: number
  risk_tolerance: "low" | "moderate" | "high"
}

export type FullProfile = {
  full_name: string
  country: string
  student_status: string
  university: string
  profession: string
  skills: string[]
  other_talents: string[]
  preferred_work_mode: "local" | "remote" | "hybrid"
  city: string
  state_region: string
  remote_regions: string[]
  opportunity_radius_km: number
  min_hourly_rate: number
  onboarding_completed: boolean
  monthly_income: number
  currency: string
  savings_goal: number
  risk_tolerance: "low" | "moderate" | "high"
  resume_summary: string
  resume_text: string
}

export type ProfileUpdateInput = Partial<{
  full_name: string
  country: string
  student_status: string
  university: string
  profession: string
  skills: string[]
  other_talents: string[]
  preferred_work_mode: "local" | "remote" | "hybrid"
  city: string
  state_region: string
  remote_regions: string[]
  opportunity_radius_km: number
  min_hourly_rate: number
  onboarding_completed: boolean
  monthly_income: number
  currency: string
  savings_goal: number
  risk_tolerance: "low" | "moderate" | "high"
  resume_summary: string
  resume_text: string
}>

const PROFILE_DEFAULTS: FullProfile = {
  full_name: "",
  country: "",
  student_status: "",
  university: "",
  profession: "",
  skills: [],
  other_talents: [],
  preferred_work_mode: "hybrid",
  city: "",
  state_region: "",
  remote_regions: [],
  opportunity_radius_km: 25,
  min_hourly_rate: 0,
  onboarding_completed: false,
  monthly_income: 0,
  currency: "USD",
  savings_goal: 0,
  risk_tolerance: "moderate",
  resume_summary: "",
  resume_text: ""
}

function parseJsonArray(input: string | null | undefined): string[] {
  if (!input) return []

  try {
    const parsed = JSON.parse(input) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0)
      .slice(0, 50)
  } catch {
    return []
  }
}

export async function getFullProfile(db: D1Database, userId: string): Promise<FullProfile> {
  const [userProfile, financialProfile] = await Promise.all([
    db.prepare(
      "SELECT user_id, full_name, country, student_status, university, profession, skills_json, other_talents_json, preferred_work_mode, city, state_region, remote_regions_json, opportunity_radius_km, min_hourly_rate, onboarding_completed, resume_summary, resume_text FROM user_profiles WHERE user_id = ?1 LIMIT 1"
    )
      .bind(userId)
      .first<UserProfileRow>(),
    db.prepare(
      "SELECT user_id, monthly_income, currency, savings_goal, risk_tolerance FROM financial_profiles WHERE user_id = ?1 LIMIT 1"
    )
      .bind(userId)
      .first<FinancialProfileRow>()
  ])

  return {
    full_name: userProfile?.full_name ?? PROFILE_DEFAULTS.full_name,
    country: userProfile?.country ?? PROFILE_DEFAULTS.country,
    student_status: userProfile?.student_status ?? PROFILE_DEFAULTS.student_status,
    university: userProfile?.university ?? PROFILE_DEFAULTS.university,
    profession: userProfile?.profession ?? PROFILE_DEFAULTS.profession,
    skills: parseJsonArray(userProfile?.skills_json),
    other_talents: parseJsonArray(userProfile?.other_talents_json),
    preferred_work_mode: userProfile?.preferred_work_mode ?? PROFILE_DEFAULTS.preferred_work_mode,
    city: userProfile?.city ?? PROFILE_DEFAULTS.city,
    state_region: userProfile?.state_region ?? PROFILE_DEFAULTS.state_region,
    remote_regions: parseJsonArray(userProfile?.remote_regions_json),
    opportunity_radius_km:
      userProfile?.opportunity_radius_km ?? PROFILE_DEFAULTS.opportunity_radius_km,
    min_hourly_rate: userProfile?.min_hourly_rate ?? PROFILE_DEFAULTS.min_hourly_rate,
    onboarding_completed: Boolean(userProfile?.onboarding_completed ?? 0),
    monthly_income: financialProfile?.monthly_income ?? PROFILE_DEFAULTS.monthly_income,
    currency: financialProfile?.currency ?? PROFILE_DEFAULTS.currency,
    savings_goal: financialProfile?.savings_goal ?? PROFILE_DEFAULTS.savings_goal,
    risk_tolerance: financialProfile?.risk_tolerance ?? PROFILE_DEFAULTS.risk_tolerance,
    resume_summary: userProfile?.resume_summary ?? PROFILE_DEFAULTS.resume_summary,
    resume_text: userProfile?.resume_text ?? PROFILE_DEFAULTS.resume_text
  }
}

export async function updateFullProfile(
  db: D1Database,
  userId: string,
  input: ProfileUpdateInput
): Promise<FullProfile> {
  const existing = await getFullProfile(db, userId)
  const merged: FullProfile = {
    ...existing,
    ...input
  }

  await db.batch([
    db.prepare(
      "INSERT INTO financial_profiles (user_id, monthly_income, currency, savings_goal, risk_tolerance) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(user_id) DO UPDATE SET monthly_income = excluded.monthly_income, currency = excluded.currency, savings_goal = excluded.savings_goal, risk_tolerance = excluded.risk_tolerance"
    )
      .bind(
        userId,
        merged.monthly_income,
        merged.currency,
        merged.savings_goal,
        merged.risk_tolerance
      ),
    db.prepare(
      "INSERT INTO user_profiles (user_id, full_name, country, student_status, university, profession, skills_json, other_talents_json, preferred_work_mode, city, state_region, remote_regions_json, opportunity_radius_km, min_hourly_rate, onboarding_completed, resume_summary, resume_text) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17) ON CONFLICT(user_id) DO UPDATE SET full_name = excluded.full_name, country = excluded.country, student_status = excluded.student_status, university = excluded.university, profession = excluded.profession, skills_json = excluded.skills_json, other_talents_json = excluded.other_talents_json, preferred_work_mode = excluded.preferred_work_mode, city = excluded.city, state_region = excluded.state_region, remote_regions_json = excluded.remote_regions_json, opportunity_radius_km = excluded.opportunity_radius_km, min_hourly_rate = excluded.min_hourly_rate, onboarding_completed = excluded.onboarding_completed, resume_summary = excluded.resume_summary, resume_text = excluded.resume_text"
    )
      .bind(
        userId,
        merged.full_name,
        merged.country,
        merged.student_status,
        merged.university,
        merged.profession,
        JSON.stringify(merged.skills),
        JSON.stringify(merged.other_talents),
        merged.preferred_work_mode,
        merged.city,
        merged.state_region,
        JSON.stringify(merged.remote_regions),
        merged.opportunity_radius_km,
        merged.min_hourly_rate,
        merged.onboarding_completed ? 1 : 0,
        merged.resume_summary || null,
        merged.resume_text || null
      )
  ])

  return await getFullProfile(db, userId)
}
