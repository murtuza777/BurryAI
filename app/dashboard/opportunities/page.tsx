'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Building2,
  ExternalLink,
  Filter,
  GraduationCap,
  MapPin,
  PencilLine,
  Search,
  Sparkles,
  Wifi
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import FinanceLoader from '@/components/ui/FinanceLoader'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/contexts/AuthContext'
import {
  getFinancialProfile,
  searchOpportunities,
  type OpportunitySearchInput,
  type OpportunitySearchResponse,
  type WorkMode
} from '@/lib/financial-client'
import { cn } from '@/lib/utils'

type ModeFilter = 'auto' | WorkMode
type SourceBucket = OpportunitySearchResponse['opportunities'][number]['source_bucket']

const MODE_OPTIONS: Array<{ value: ModeFilter; label: string; icon: typeof MapPin }> = [
  { value: 'auto', label: 'Smart Match', icon: Sparkles },
  { value: 'local', label: 'Nearby', icon: MapPin },
  { value: 'remote', label: 'Remote', icon: Wifi },
  { value: 'hybrid', label: 'Hybrid', icon: Briefcase }
]

const RADIUS_OPTIONS = [10, 25, 50, 100]
const RESULT_OPTIONS = [18, 30, 42]
const SOURCE_BUCKET_ORDER: SourceBucket[] = ['hidden', 'direct', 'standard', 'popular']
const SOURCE_BUCKET_LABELS: Record<SourceBucket, { title: string; description: string }> = {
  hidden: {
    title: 'Hidden and niche matches',
    description: 'Less-seen opportunities from communities, startup boards, niche boards, and social hiring posts.'
  },
  direct: {
    title: 'Direct career pages',
    description: 'Listings pulled from company career pages and ATS systems before broad job boards.'
  },
  standard: {
    title: 'Additional web matches',
    description: 'Relevant web listings that still fit, but are not as niche as the top sections.'
  },
  popular: {
    title: 'Popular boards',
    description: 'LinkedIn and Indeed fallback listings kept lower so hidden matches show first.'
  }
}

function toCsv(items: string[]): string {
  return items.join(', ')
}

function fromCsv(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    )
  )
}

function isOpportunityProfileConfigured(params: {
  profession: string
  skillsCsv: string
  talentsCsv: string
}): boolean {
  return Boolean(
    params.profession.trim().length > 0 &&
      (params.skillsCsv.trim().length > 0 || params.talentsCsv.trim().length > 0)
  )
}

function ToggleButton(props: {
  active: boolean
  label: string
  onClick: () => void
  icon?: typeof MapPin
}) {
  const Icon = props.icon

  return (
    <button
      type="button"
      onClick={props.onClick}
      className={cn(
        'inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition',
        props.active
          ? 'border-cyan-300/80 bg-cyan-300 text-slate-950 shadow-[0_10px_24px_rgba(34,211,238,0.16)]'
          : 'border-slate-700 bg-slate-950/70 text-slate-300 hover:border-cyan-400/60 hover:text-slate-100'
      )}
    >
      {Icon ? <Icon className="h-4 w-4" /> : null}
      {props.label}
    </button>
  )
}

export default function DashboardOpportunitiesPage() {
  const router = useRouter()
  const { isGuest, loading: authLoading } = useAuth()

  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [error, setError] = useState('')
  const [searchResult, setSearchResult] = useState<OpportunitySearchResponse | null>(null)

  const [profileDraft, setProfileDraft] = useState({
    profession: '',
    skillsCsv: '',
    talentsCsv: '',
    preferredMode: 'hybrid' as WorkMode,
    city: '',
    stateRegion: '',
    country: '',
    remoteRegionsCsv: '',
    radiusKm: 25,
    minHourlyRate: 0
  })

  const [filters, setFilters] = useState({
    query: '',
    mode: 'auto' as ModeFilter,
    includeInternships: true,
    includePartTime: true,
    includeFreelance: false,
    radiusKm: 25,
    maxResults: 30
  })

  useEffect(() => {
    if (authLoading) return
    if (isGuest) {
      setLoading(false)
      return
    }

    const run = async () => {
      setLoading(true)
      setError('')
      try {
        const profile = await getFinancialProfile()
        const nextDraft = {
          profession: profile.profession || '',
          skillsCsv: toCsv(profile.skills || []),
          talentsCsv: toCsv(profile.other_talents || []),
          preferredMode: profile.preferred_work_mode || 'hybrid',
          city: profile.city || '',
          stateRegion: profile.state_region || '',
          country: profile.country || '',
          remoteRegionsCsv: toCsv(profile.remote_regions || []),
          radiusKm: profile.opportunity_radius_km || 25,
          minHourlyRate: profile.min_hourly_rate || 0
        }

        setProfileDraft(nextDraft)
        setFilters((prev) => ({
          ...prev,
          radiusKm: profile.opportunity_radius_km || 25
        }))

        if (
          isOpportunityProfileConfigured({
            profession: nextDraft.profession,
            skillsCsv: nextDraft.skillsCsv,
            talentsCsv: nextDraft.talentsCsv
          })
        ) {
          setSearching(true)
          const payload = await searchOpportunities({
            mode: 'auto',
            include_internships: true,
            include_part_time: true,
            include_freelance: false,
            remote_regions: fromCsv(nextDraft.remoteRegionsCsv),
            radius_km: Number(nextDraft.radiusKm || 25),
            max_results: 30
          })
          setSearchResult(payload)
        } else {
          setSearchResult(null)
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load profile defaults')
      } finally {
        setSearching(false)
        setLoading(false)
      }
    }

    void run()
  }, [authLoading, isGuest])

  const remoteRegions = useMemo(() => fromCsv(profileDraft.remoteRegionsCsv), [profileDraft.remoteRegionsCsv])
  const groupedResults = useMemo(() => {
    if (!searchResult) return []

    return SOURCE_BUCKET_ORDER.map((bucket) => ({
      bucket,
      items: searchResult.opportunities.filter((item) => item.source_bucket === bucket)
    })).filter((group) => group.items.length > 0)
  }, [searchResult])
  const hasSavedOpportunityProfile = useMemo(
    () =>
      isOpportunityProfileConfigured({
        profession: profileDraft.profession,
        skillsCsv: profileDraft.skillsCsv,
        talentsCsv: profileDraft.talentsCsv
      }),
    [profileDraft.profession, profileDraft.skillsCsv, profileDraft.talentsCsv]
  )

  async function runSearch(overrides?: Partial<OpportunitySearchInput>) {
    if (isGuest || !hasSavedOpportunityProfile) return

    setSearching(true)
    setError('')
    try {
      const payload = await searchOpportunities({
        query: filters.query.trim() || undefined,
        mode: filters.mode,
        include_internships: filters.includeInternships,
        include_part_time: filters.includePartTime,
        include_freelance: filters.includeFreelance,
        remote_regions: remoteRegions,
        radius_km: Number(filters.radiusKm || 25),
        max_results: Number(filters.maxResults || 30),
        ...overrides
      })
      setSearchResult(payload)
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Failed to search opportunities')
    } finally {
      setSearching(false)
    }
  }

  if (authLoading || loading) {
    return <FinanceLoader />
  }

  return (
    <div className="min-h-[calc(100vh-10rem)] space-y-5">
      {isGuest ? (
        <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Guest mode cannot fetch live opportunities. Sign up to unlock saved filters and job matches.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-[2rem] border border-cyan-500/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.14),transparent_30%),linear-gradient(180deg,rgba(2,6,23,0.92),rgba(2,6,23,0.76))] p-6 shadow-[0_24px_80px_rgba(2,6,23,0.45)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-cyan-200">
              <Sparkles className="h-3.5 w-3.5" />
              Opportunity Engine
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-50 md:text-4xl">
              Find real listings, not random search clutter
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
              BurryAI now searches deeper across company career pages, startup boards, campus pages, Reddit, X, GitHub, Hacker News, and niche remote boards before it falls back to LinkedIn or Indeed.
            </p>
          </div>

          {hasSavedOpportunityProfile ? (
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              Opportunity profile is saved in Profile details.
            </div>
          ) : null}
        </div>

        {hasSavedOpportunityProfile ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-3xl border border-slate-800/80 bg-slate-950/55 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Saved Opportunity Profile</p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-100">{profileDraft.profession}</h2>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/dashboard/profile')}
                  className="border-slate-700 bg-slate-900/70 text-slate-100 hover:bg-slate-800"
                >
                  <PencilLine className="mr-2 h-4 w-4" />
                  Profile details
                </Button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {fromCsv(profileDraft.skillsCsv).slice(0, 6).map((skill) => (
                  <Badge key={skill} className="border-cyan-400/30 bg-cyan-400/10 text-cyan-100">
                    {skill}
                  </Badge>
                ))}
                {fromCsv(profileDraft.talentsCsv).slice(0, 3).map((talent) => (
                  <Badge key={talent} className="border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-100">
                    {talent}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-3xl border border-slate-800/80 bg-slate-950/55 p-4">
                <div className="flex items-center gap-2 text-slate-200">
                  <MapPin className="h-4 w-4 text-cyan-300" />
                  <span className="text-sm font-medium">Location</span>
                </div>
                <p className="mt-2 text-sm text-slate-300">
                  {[profileDraft.city, profileDraft.stateRegion, profileDraft.country].filter(Boolean).join(', ') || 'Remote-first'}
                </p>
              </div>
              <div className="rounded-3xl border border-slate-800/80 bg-slate-950/55 p-4">
                <div className="flex items-center gap-2 text-slate-200">
                  <Briefcase className="h-4 w-4 text-cyan-300" />
                  <span className="text-sm font-medium">Work Style</span>
                </div>
                <p className="mt-2 text-sm capitalize text-slate-300">{profileDraft.preferredMode}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-[2rem] border border-slate-800/80 bg-slate-950/55 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-100">Add opportunity details in Profile</h2>
                <p className="mt-1 text-sm text-slate-300">
                  This page now stays focused on discovery. Add your role, skills, location, work mode, and other talents in Profile details.
                </p>
              </div>
              <Badge className="border-cyan-400/30 bg-cyan-400/10 text-cyan-100">Profile required for quality matches</Badge>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                onClick={() => router.push('/dashboard/profile')}
                disabled={isGuest}
                className="rounded-full border border-cyan-300/60 bg-cyan-300 px-5 py-2.5 font-semibold text-slate-950 hover:bg-cyan-200"
              >
                Open profile details
              </Button>
              <p className="text-xs text-slate-400">
                Opportunity research will use those saved details for personalized matches.
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-[2rem] border border-cyan-500/20 bg-slate-950/60 p-6 shadow-[0_24px_70px_rgba(2,6,23,0.4)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Search Filters</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-100">Search hidden opportunities faster</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hasSavedOpportunityProfile ? (
              <div className="flex flex-wrap gap-2">
                {remoteRegions.slice(0, 3).map((region) => (
                  <Badge key={region} className="border-slate-700 bg-slate-900 text-slate-200">
                    {region}
                  </Badge>
                ))}
              </div>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowFilters((prev) => !prev)}
              className="h-9 rounded-full border-slate-700 bg-slate-900/70 px-4 text-slate-100 hover:bg-slate-800"
            >
              <Filter className="mr-2 h-4 w-4" />
              Filters
              {showFilters ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="mt-5 rounded-3xl border border-slate-800/80 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(2,6,23,0.92))] p-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                id="query"
                value={filters.query}
                onChange={(event) => setFilters((prev) => ({ ...prev, query: event.target.value }))}
                className="h-10 rounded-full border-slate-700 bg-slate-950/80 pl-11 pr-4 text-sm text-slate-100"
                placeholder="Search role, skill, internship, company, or hiring phrase"
              />
            </div>
            <Button
              type="button"
              onClick={() => void runSearch()}
              disabled={searching || isGuest || !hasSavedOpportunityProfile}
              className="h-10 rounded-full border border-cyan-300/60 bg-cyan-300 px-5 text-sm font-semibold text-slate-950 hover:bg-cyan-200"
            >
              {searching ? 'Searching...' : 'Search listings'}
            </Button>
          </div>
          {!hasSavedOpportunityProfile ? (
            <p className="mt-3 text-xs text-slate-400">
              Add your opportunity details in Profile before searching so results stay personalized.
            </p>
          ) : null}
        </div>

        {showFilters ? (
          <div className="mt-5 grid gap-4 rounded-3xl border border-slate-800/80 bg-slate-950/50 p-4 xl:grid-cols-[1.4fr_1fr]">
            <div className="space-y-4">
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm text-slate-300">
                  <Filter className="h-4 w-4 text-cyan-300" />
                  Search mode
                </div>
                <div className="flex flex-wrap gap-2">
                  {MODE_OPTIONS.map((option) => (
                    <ToggleButton
                      key={option.value}
                      active={filters.mode === option.value}
                      label={option.label}
                      icon={option.icon}
                      onClick={() => setFilters((prev) => ({ ...prev, mode: option.value }))}
                    />
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2 text-sm text-slate-300">
                  <GraduationCap className="h-4 w-4 text-cyan-300" />
                  Opportunity type
                </div>
                <div className="flex flex-wrap gap-2">
                  <ToggleButton
                    active={filters.includeInternships}
                    label="Internships"
                    onClick={() =>
                      setFilters((prev) => ({ ...prev, includeInternships: !prev.includeInternships }))
                    }
                  />
                  <ToggleButton
                    active={filters.includePartTime}
                    label="Part-time"
                    onClick={() =>
                      setFilters((prev) => ({ ...prev, includePartTime: !prev.includePartTime }))
                    }
                  />
                  <ToggleButton
                    active={filters.includeFreelance}
                    label="Freelance"
                    onClick={() =>
                      setFilters((prev) => ({ ...prev, includeFreelance: !prev.includeFreelance }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-3xl border border-slate-800/80 bg-slate-950/55 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Search radius</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {RADIUS_OPTIONS.map((radius) => (
                    <ToggleButton
                      key={radius}
                      active={filters.radiusKm === radius}
                      label={`${radius} km`}
                      onClick={() => setFilters((prev) => ({ ...prev, radiusKm: radius }))}
                    />
                  ))}
                </div>
              </div>
              <div className="rounded-3xl border border-slate-800/80 bg-slate-950/55 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Result volume</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {RESULT_OPTIONS.map((count) => (
                    <ToggleButton
                      key={count}
                      active={filters.maxResults === count}
                      label={`${count} listings`}
                      onClick={() => setFilters((prev) => ({ ...prev, maxResults: count }))}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-[2rem] border border-cyan-500/20 bg-slate-950/60 p-6 shadow-[0_20px_60px_rgba(2,6,23,0.38)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Results</p>
            <h3 className="mt-1 text-2xl font-semibold text-slate-100">
              {searchResult ? `${searchResult.opportunities.length} matched listings` : 'No search run yet'}
            </h3>
          </div>
          {searchResult ? (
            <div className="text-sm text-slate-400">
              Mode: <span className="capitalize text-slate-200">{searchResult.filters_applied.mode}</span>
            </div>
          ) : null}
        </div>

        {!searchResult ? (
          <div className="mt-6 rounded-3xl border border-dashed border-slate-700 bg-slate-950/40 p-10 text-center">
            <p className="text-base font-medium text-slate-200">
              {hasSavedOpportunityProfile
                ? 'Search across direct listings and community hiring posts'
                : 'Finish your opportunity profile to unlock personalized discovery'}
            </p>
            <p className="mt-2 text-sm text-slate-400">
              {hasSavedOpportunityProfile
                ? 'We prioritize company career pages, niche platforms, social hiring posts, and community leads, then keep popular boards lower in the list.'
                : 'Use Profile details once, then this page stays focused on hidden and useful opportunities.'}
            </p>
          </div>
        ) : searchResult.opportunities.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-slate-700 bg-slate-950/40 p-10 text-center">
            <p className="text-base font-medium text-slate-200">No strong listings matched these filters</p>
            <p className="mt-2 text-sm text-slate-400">
              Try switching mode, broadening skills, or using a shorter search phrase.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {groupedResults.map((group) => (
              <div key={group.bucket} className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3 rounded-3xl border border-slate-800/70 bg-slate-950/40 px-4 py-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{group.items.length} listings</p>
                    <h4 className="mt-1 text-lg font-semibold text-slate-100">{SOURCE_BUCKET_LABELS[group.bucket].title}</h4>
                  </div>
                  <p className="max-w-2xl text-sm text-slate-400">{SOURCE_BUCKET_LABELS[group.bucket].description}</p>
                </div>

                <div className="grid gap-4">
                  {group.items.map((item) => (
                    <article
                      key={item.id}
                      className="group relative overflow-hidden rounded-[1.75rem] border border-slate-800/90 bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(2,6,23,0.92))] p-5 transition hover:border-cyan-400/40 hover:shadow-[0_22px_60px_rgba(14,165,233,0.12)]"
                    >
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.07),transparent_30%)] opacity-0 transition group-hover:opacity-100" />
                      <div className="relative">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="max-w-3xl">
                            <div className="flex flex-wrap gap-2">
                              <Badge className="border-cyan-400/30 bg-cyan-400/10 text-cyan-100">
                                {item.source_site}
                              </Badge>
                              <Badge className="border-slate-700 bg-slate-900 text-slate-200 capitalize">
                                {item.listing_quality}
                              </Badge>
                              {item.near_user_location ? (
                                <Badge className="border-emerald-400/30 bg-emerald-400/10 text-emerald-100">
                                  Nearby match
                                </Badge>
                              ) : null}
                              {item.remote_friendly ? (
                                <Badge className="border-sky-400/30 bg-sky-400/10 text-sky-100">
                                  Remote-friendly
                                </Badge>
                              ) : null}
                            </div>

                            <a
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-3 inline-flex items-start gap-2 text-xl font-semibold text-slate-50 transition hover:text-cyan-200"
                            >
                              <span>{item.title}</span>
                              <ExternalLink className="mt-1 h-4 w-4 shrink-0" />
                            </a>

                            <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-300">
                              {item.company ? (
                                <span className="inline-flex items-center gap-2">
                                  <Building2 className="h-4 w-4 text-cyan-300" />
                                  {item.company}
                                </span>
                              ) : null}
                              <span className="inline-flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-cyan-300" />
                                {item.location}
                              </span>
                              <span className="inline-flex items-center gap-2">
                                <Briefcase className="h-4 w-4 text-cyan-300" />
                                {item.work_mode} / {item.opportunity_type}
                              </span>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Match Score</div>
                            <div className="mt-1 text-2xl font-semibold text-cyan-200">{item.score}</div>
                          </div>
                        </div>

                        <p className="mt-4 text-sm leading-6 text-slate-300">
                          {item.snippet || 'Open the listing for full details.'}
                        </p>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {item.matched_skills.map((skill) => (
                            <Badge key={skill} className="border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-100">
                              {skill}
                            </Badge>
                          ))}
                        </div>

                        <p className="mt-4 text-sm text-slate-400">{item.match_reasons.join(' | ')}</p>

                        <div className="mt-5">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 text-sm font-medium text-cyan-200 transition hover:text-cyan-100"
                          >
                            Open listing
                            <ArrowRight className="h-4 w-4" />
                          </a>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
