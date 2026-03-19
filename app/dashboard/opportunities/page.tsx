'use client'

import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import FinanceLoader from '@/components/ui/FinanceLoader'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import {
  getFinancialProfile,
  searchOpportunities,
  updateFinancialProfile,
  type OpportunitySearchResponse,
  type WorkMode
} from '@/lib/financial-client'

type ModeFilter = 'auto' | WorkMode

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

export default function DashboardOpportunitiesPage() {
  const { isGuest, loading: authLoading } = useAuth()

  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [searching, setSearching] = useState(false)
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
    includeFreelance: true,
    radiusKm: 25,
    maxResults: 15
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
        setProfileDraft({
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
        })
        setFilters((prev) => ({
          ...prev,
          mode: 'auto',
          radiusKm: profile.opportunity_radius_km || 25
        }))
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load profile defaults')
      } finally {
        setLoading(false)
      }
    }

    void run()
  }, [authLoading, isGuest])

  const remoteRegions = useMemo(() => fromCsv(profileDraft.remoteRegionsCsv), [profileDraft.remoteRegionsCsv])

  async function handleSaveProfileDefaults() {
    if (isGuest) return
    setSavingProfile(true)
    setError('')
    try {
      await updateFinancialProfile({
        profession: profileDraft.profession.trim(),
        skills: fromCsv(profileDraft.skillsCsv),
        other_talents: fromCsv(profileDraft.talentsCsv),
        preferred_work_mode: profileDraft.preferredMode,
        city: profileDraft.city.trim(),
        state_region: profileDraft.stateRegion.trim(),
        country: profileDraft.country.trim(),
        remote_regions: remoteRegions,
        opportunity_radius_km: Number(profileDraft.radiusKm || 25),
        min_hourly_rate: Number(profileDraft.minHourlyRate || 0)
      })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save opportunity profile')
    } finally {
      setSavingProfile(false)
    }
  }

  async function runSearch() {
    if (isGuest) return
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
        max_results: Number(filters.maxResults || 15)
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
    <div className="space-y-4 min-h-[calc(100vh-10rem)]">
      {isGuest ? (
        <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Guest mode cannot fetch or save opportunities. Sign up to personalize nearby and remote matches.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
      ) : null}

      <section className="rounded-xl border border-cyan-500/20 bg-black/20 p-5">
        <h2 className="text-xl font-semibold text-cyan-100">Opportunity Profile</h2>
        <p className="mt-1 text-sm text-slate-300">
          Set your profession, skills, and location so BurryAI can find relevant local and remote income options.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="profession">Profession / Target Role</Label>
            <Input
              id="profession"
              value={profileDraft.profession}
              onChange={(event) => setProfileDraft((prev) => ({ ...prev, profession: event.target.value }))}
              className="border-cyan-500/30 bg-slate-950/70"
              placeholder="Frontend Developer"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="preferredMode">Preferred Work Mode</Label>
            <select
              id="preferredMode"
              value={profileDraft.preferredMode}
              onChange={(event) =>
                setProfileDraft((prev) => ({ ...prev, preferredMode: event.target.value as WorkMode }))
              }
              className="h-10 w-full rounded-md border border-cyan-500/30 bg-slate-950/70 px-3 text-sm outline-none focus:border-cyan-300"
            >
              <option value="local">Local</option>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="skillsCsv">Skills (comma separated)</Label>
            <Input
              id="skillsCsv"
              value={profileDraft.skillsCsv}
              onChange={(event) => setProfileDraft((prev) => ({ ...prev, skillsCsv: event.target.value }))}
              className="border-cyan-500/30 bg-slate-950/70"
              placeholder="React, JavaScript, UI Design"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="talentsCsv">Other Talents (comma separated)</Label>
            <Input
              id="talentsCsv"
              value={profileDraft.talentsCsv}
              onChange={(event) => setProfileDraft((prev) => ({ ...prev, talentsCsv: event.target.value }))}
              className="border-cyan-500/30 bg-slate-950/70"
              placeholder="Content writing, Video editing, Tutoring"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={profileDraft.city}
              onChange={(event) => setProfileDraft((prev) => ({ ...prev, city: event.target.value }))}
              className="border-cyan-500/30 bg-slate-950/70"
              placeholder="Boston"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="stateRegion">State / Region</Label>
            <Input
              id="stateRegion"
              value={profileDraft.stateRegion}
              onChange={(event) => setProfileDraft((prev) => ({ ...prev, stateRegion: event.target.value }))}
              className="border-cyan-500/30 bg-slate-950/70"
              placeholder="Massachusetts"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              value={profileDraft.country}
              onChange={(event) => setProfileDraft((prev) => ({ ...prev, country: event.target.value }))}
              className="border-cyan-500/30 bg-slate-950/70"
              placeholder="United States"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="radiusKm">Nearby Radius (km)</Label>
            <Input
              id="radiusKm"
              type="number"
              min={1}
              max={500}
              value={profileDraft.radiusKm}
              onChange={(event) =>
                setProfileDraft((prev) => ({ ...prev, radiusKm: Number(event.target.value || 25) }))
              }
              className="border-cyan-500/30 bg-slate-950/70"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="remoteRegions">Remote Regions (comma separated)</Label>
            <Input
              id="remoteRegions"
              value={profileDraft.remoteRegionsCsv}
              onChange={(event) =>
                setProfileDraft((prev) => ({ ...prev, remoteRegionsCsv: event.target.value }))
              }
              className="border-cyan-500/30 bg-slate-950/70"
              placeholder="United States, Canada, Europe"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="minHourlyRate">Minimum Hourly Rate (optional)</Label>
            <Input
              id="minHourlyRate"
              type="number"
              min={0}
              value={profileDraft.minHourlyRate}
              onChange={(event) =>
                setProfileDraft((prev) => ({ ...prev, minHourlyRate: Number(event.target.value || 0) }))
              }
              className="border-cyan-500/30 bg-slate-950/70"
            />
          </div>
        </div>

        <div className="mt-4">
          <Button
            type="button"
            onClick={() => void handleSaveProfileDefaults()}
            disabled={savingProfile || isGuest}
            className="rounded-xl border border-cyan-300/60 bg-cyan-400 px-4 py-2.5 font-semibold text-slate-950 shadow-[0_10px_30px_rgba(34,211,238,0.35)] hover:bg-cyan-300"
          >
            {savingProfile ? 'Saving profile...' : 'Save Opportunity Profile'}
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-cyan-500/20 bg-black/20 p-5">
        <h2 className="text-xl font-semibold text-cyan-100">Search Opportunities</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="query">Search intent (optional)</Label>
            <Input
              id="query"
              value={filters.query}
              onChange={(event) => setFilters((prev) => ({ ...prev, query: event.target.value }))}
              className="border-cyan-500/30 bg-slate-950/70"
              placeholder="React internship near campus or remote"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mode">Mode</Label>
            <select
              id="mode"
              value={filters.mode}
              onChange={(event) => setFilters((prev) => ({ ...prev, mode: event.target.value as ModeFilter }))}
              className="h-10 w-full rounded-md border border-cyan-500/30 bg-slate-950/70 px-3 text-sm outline-none focus:border-cyan-300"
            >
              <option value="auto">Auto (profile default)</option>
              <option value="local">Local nearby</option>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxResults">Max results</Label>
            <Input
              id="maxResults"
              type="number"
              min={3}
              max={30}
              value={filters.maxResults}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, maxResults: Number(event.target.value || 15) }))
              }
              className="border-cyan-500/30 bg-slate-950/70"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="searchRadius">Search radius (km)</Label>
            <Input
              id="searchRadius"
              type="number"
              min={1}
              max={500}
              value={filters.radiusKm}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, radiusKm: Number(event.target.value || 25) }))
              }
              className="border-cyan-500/30 bg-slate-950/70"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-200">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={filters.includeInternships}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, includeInternships: event.target.checked }))
              }
            />
            Internships
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={filters.includePartTime}
              onChange={(event) => setFilters((prev) => ({ ...prev, includePartTime: event.target.checked }))}
            />
            Part-time
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={filters.includeFreelance}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, includeFreelance: event.target.checked }))
              }
            />
            Freelance / gigs
          </label>
        </div>

        <div className="mt-4">
          <Button
            type="button"
            onClick={() => void runSearch()}
            disabled={searching || isGuest}
            className="rounded-xl border border-cyan-300/60 bg-cyan-400 px-4 py-2.5 font-semibold text-slate-950 shadow-[0_10px_30px_rgba(34,211,238,0.35)] hover:bg-cyan-300"
          >
            {searching ? 'Searching...' : 'Find Opportunities'}
          </Button>
        </div>
      </section>

      {searchResult ? (
        <section className="rounded-xl border border-cyan-500/20 bg-black/20 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-semibold text-cyan-100">
              Matches ({searchResult.opportunities.length})
            </h3>
            <p className="text-xs text-slate-300">
              Mode applied: <span className="font-semibold text-slate-100">{searchResult.filters_applied.mode}</span>
            </p>
          </div>

          {searchResult.generated_queries.length > 0 ? (
            <div className="mt-3 rounded-lg border border-slate-700/60 bg-slate-950/60 p-3 text-xs text-slate-300">
              <p className="mb-1 font-semibold text-slate-200">Generated search queries</p>
              <p>{searchResult.generated_queries.join(' | ')}</p>
            </div>
          ) : null}

          <div className="mt-4 space-y-3">
            {searchResult.opportunities.map((item) => (
              <article
                key={item.id}
                className="rounded-lg border border-slate-700/60 bg-slate-950/60 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-base font-semibold text-cyan-200 hover:text-cyan-100"
                    >
                      {item.title}
                    </a>
                    <p className="mt-1 text-xs text-slate-400">
                      {item.location} | {item.work_mode} | {item.opportunity_type} | score {item.score}
                    </p>
                  </div>
                  <span className="rounded-full border border-cyan-500/40 px-2 py-1 text-xs uppercase tracking-wide text-cyan-200">
                    {item.source}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-200">{item.snippet || 'Open listing for details.'}</p>
                <p className="mt-2 text-xs text-slate-400">
                  {item.match_reasons.join(' | ')}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
