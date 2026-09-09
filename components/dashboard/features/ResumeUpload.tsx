'use client'

import { useCallback, useRef, useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles,
  Upload,
  X,
  Edit3,
  Zap
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  parseResume,
  applyResumeProfile,
  updateFinancialProfile,
  type ResumeExtraction,
  type FinancialProfile
} from '@/lib/financial-client'
import { cn } from '@/lib/utils'

async function extractTextFromFile(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''

  if (ext === 'txt') {
    return await file.text()
  }

  if (ext === 'pdf') {
    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const pages: string[] = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      pages.push(content.items.map((item: any) => item.str).join(' '))
    }
    return pages.join('\n\n')
  }

  if (ext === 'docx' || ext === 'doc') {
    const mammoth = await import('mammoth')
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.extractRawText({ arrayBuffer })
    return result.value
  }

  throw new Error(`Unsupported file type: .${ext}`)
}

type ResumeUploadProps = {
  onProfileApplied: (profile: FinancialProfile) => Promise<void> | void
  hasExistingResume: boolean
  existingSummary: string
  isGuest: boolean
}

type UploadStage = 'idle' | 'extracting' | 'parsing' | 'review' | 'applying' | 'done'
const ACCEPTED_TYPES = '.pdf,.txt,.doc,.docx'
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024

function validateResumeFile(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const supportedTypes = new Set(['pdf', 'txt', 'doc', 'docx'])

  if (!supportedTypes.has(ext)) {
    throw new Error('Please upload a PDF, TXT, DOC, or DOCX resume.')
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error('Resume files must be 5 MB or smaller.')
  }
}

function fallbackExtractResume(text: string): ResumeExtraction {
  const clean = text.replace(/\r\n/g, '\n')

  const commonSkills = [
    'React', 'Next.js', 'Vue', 'Angular', 'TypeScript', 'JavaScript', 'Node.js', 'Python',
    'Java', 'C++', 'C#', 'Go', 'Rust', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'SQL', 'PostgreSQL',
    'MongoDB', 'MySQL', 'Redis', 'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure', 'Git',
    'GraphQL', 'Tailwind', 'HTML', 'CSS', 'Figma', 'Linux', 'REST API', 'CI/CD',
    'Machine Learning', 'Data Analysis', 'Agile', 'Scrum'
  ]
  const extractedSkills = commonSkills
    .filter((s) => new RegExp(`\\b${s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i').test(clean))
    .slice(0, 15)

  const roles = [
    'Full Stack Engineer', 'Full Stack Developer', 'Frontend Developer', 'Backend Developer',
    'Software Engineer', 'Web Developer', 'Mobile Developer', 'Data Scientist', 'Data Analyst',
    'Machine Learning Engineer', 'DevOps Engineer', 'UI/UX Designer', 'Product Designer',
    'Product Manager', 'Project Manager', 'QA Engineer', 'Security Engineer', 'Cloud Architect'
  ]
  const matchedRole = roles.find((r) => new RegExp(`\\b${r}\\b`, 'i').test(clean)) || 'Software Engineer'

  const isStudent = /\b(student|bachelor|master|undergraduate|university|college|expected graduation|gpa)\b/i.test(clean)
  const studentStatus = isStudent ? 'current_student' : 'professional'

  let preferredMode: 'local' | 'remote' | 'hybrid' = 'hybrid'
  if (/\bremote\b|\bwork from home\b|\bwfh\b/i.test(clean)) preferredMode = 'remote'
  else if (/\bon-?site\b|\bin-?person\b/i.test(clean)) preferredMode = 'local'

  const lines = clean.split('\n').map((l) => l.trim()).filter(Boolean)
  const possibleName = lines[0] && lines[0].length < 40 && !/@|http|resume/i.test(lines[0]) ? lines[0] : ''

  let city = ''
  const locationMatch = clean.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?),\s*([A-Z]{2}|[A-Z][a-z]+)\b/)
  if (locationMatch) {
    city = locationMatch[1]
  }

  const skillsList = extractedSkills.length > 0 ? extractedSkills : ['JavaScript', 'React', 'Problem Solving']

  return {
    full_name: possibleName,
    profession: matchedRole,
    skills: skillsList,
    other_talents: ['Communication', 'Teamwork', 'Project Management'],
    city: city || '',
    state_region: '',
    country: '',
    university: isStudent ? (clean.match(/\b([A-Z][a-zA-Z\s]+(?:University|College|Institute))\b/)?.[1] || '') : '',
    student_status: studentStatus,
    preferred_work_mode: preferredMode,
    resume_summary: `${matchedRole} with active background across ${skillsList.slice(0, 4).join(', ')}. Analyzed for personalized opportunity matching.`
  }
}

export default function ResumeUpload({
  onProfileApplied,
  hasExistingResume,
  existingSummary,
  isGuest
}: ResumeUploadProps) {
  const [expanded, setExpanded] = useState(false)
  const [stage, setStage] = useState<UploadStage>('idle')
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const [rawText, setRawText] = useState('')
  const [pasteMode, setPasteMode] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [editableExtraction, setEditableExtraction] = useState<ResumeExtraction | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    setError('')
    try {
      validateResumeFile(file)
      setFileName(file.name)
      setStage('extracting')
      const text = await extractTextFromFile(file)
      if (text.trim().length < 30) {
        setError('Could not extract enough text from this file. Try pasting your resume text instead.')
        setStage('idle')
        return
      }
      setRawText(text)
      setStage('parsing')

      let extraction: ResumeExtraction
      try {
        const result = await parseResume(text)
        extraction = result.extraction
      } catch {
        extraction = fallbackExtractResume(text)
      }

      setEditableExtraction({ ...extraction })
      setStage('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process resume')
      setStage('idle')
    }
  }, [])

  const handlePasteAnalyze = useCallback(async () => {
    if (pasteText.trim().length < 30) {
      setError('Please paste at least 30 characters of resume text.')
      return
    }
    setError('')
    setStage('parsing')
    try {
      const trimmed = pasteText.trim()
      setRawText(trimmed)

      let extraction: ResumeExtraction
      try {
        const result = await parseResume(trimmed)
        extraction = result.extraction
      } catch {
        extraction = fallbackExtractResume(trimmed)
      }

      setEditableExtraction({ ...extraction })
      setStage('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse resume')
      setStage('idle')
    }
  }, [pasteText])

  const handleApply = useCallback(async () => {
    if (!editableExtraction) return
    setStage('applying')
    setError('')
    try {
      const profileData: Partial<FinancialProfile> & { resume_text?: string } = {
        profession: editableExtraction.profession,
        skills: editableExtraction.skills,
        other_talents: editableExtraction.other_talents,
        city: editableExtraction.city,
        state_region: editableExtraction.state_region,
        country: editableExtraction.country,
        university: editableExtraction.university,
        student_status: editableExtraction.student_status,
        preferred_work_mode: editableExtraction.preferred_work_mode,
        resume_summary: editableExtraction.resume_summary,
        resume_text: rawText.slice(0, 50000)
      }
      if (editableExtraction.full_name) {
        profileData.full_name = editableExtraction.full_name
      }

      let updated: FinancialProfile
      try {
        updated = await applyResumeProfile(profileData)
      } catch {
        updated = await updateFinancialProfile(profileData)
      }

      await onProfileApplied(updated)
      setStage('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply resume data')
      setStage('review')
    }
  }, [editableExtraction, rawText, onProfileApplied])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files?.[0]
      if (file) void handleFile(file)
    },
    [handleFile]
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (file) void handleFile(file)
    },
    [handleFile]
  )

  const resetAll = () => {
    setStage('idle')
    setError('')
    setFileName('')
    setRawText('')
    setPasteText('')
    setEditableExtraction(null)
    setPasteMode(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const updateField = (key: keyof ResumeExtraction, value: string | string[]) => {
    if (!editableExtraction) return
    setEditableExtraction({ ...editableExtraction, [key]: value })
  }

  const statusLabel = hasExistingResume
    ? 'Resume on file'
    : 'No resume uploaded'

  const statusColor = hasExistingResume
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-100'
    : 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-100'

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white/90 shadow-xs dark:border-cyan-500/20 dark:bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.08),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(34,211,238,0.08),transparent_30%),linear-gradient(180deg,rgba(2,6,23,0.92),rgba(2,6,23,0.76))]">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 transition hover:bg-slate-50 dark:hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/30 to-cyan-500/30 shadow-inner">
            <Sparkles className="h-3.5 w-3.5 text-violet-600 dark:text-violet-200" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">AI Resume Matching</span>
              <Badge className={cn('text-[10px] py-0 px-2 h-4 font-normal', statusColor)}>{statusLabel}</Badge>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {hasExistingResume ? 'Resume active for smart job relevance' : 'Upload or paste resume to personalize job discovery'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <span>{expanded ? 'Close' : 'Manage'}</span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-800/60 p-3 space-y-3">
          {isGuest && (
            <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-100">
              Sign up to unlock automated resume parsing and saved profile matching.
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-200 flex items-start gap-2">
              <X className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {hasExistingResume && existingSummary && stage === 'idle' && (
            <div className="rounded-lg border border-slate-200/90 bg-slate-50/70 p-2.5 dark:border-slate-800/70 dark:bg-slate-950/50">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Current Resume Summary</p>
                <Badge variant="outline" className="text-[9px] py-0 px-1.5 h-3.5 border-slate-300 dark:border-slate-700 text-slate-500">Active</Badge>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed line-clamp-3">{existingSummary}</p>
            </div>
          )}

          {stage === 'done' && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-center space-y-1.5">
              <div className="flex items-center justify-center gap-1.5 text-emerald-800 dark:text-emerald-200">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs font-semibold">Resume successfully applied to profile!</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">Your opportunity matches are refreshed based on your skills.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={resetAll}
                className="mt-1 h-7 rounded-full border-slate-300 dark:border-slate-700 text-[11px]"
              >
                Upload different file
              </Button>
            </div>
          )}

          {(stage === 'extracting' || stage === 'parsing' || stage === 'applying') && (
            <div className="flex items-center justify-center py-4 gap-2.5">
              <Loader2 className="h-4 w-4 text-cyan-500 dark:text-cyan-300 animate-spin" />
              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                {stage === 'extracting' && `Reading ${fileName}...`}
                {stage === 'parsing' && 'Analyzing skills and experience with AI...'}
                {stage === 'applying' && 'Updating profile and matching jobs...'}
              </p>
            </div>
          )}

          {stage === 'idle' && !isGuest && (
            <>
              {!pasteMode ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'relative cursor-pointer rounded-lg border border-dashed py-3 px-3.5 text-center transition-all flex flex-col sm:flex-row items-center justify-between gap-2.5',
                    dragOver
                      ? 'border-cyan-400 bg-cyan-500/10 scale-[1.005]'
                      : 'border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950/40 hover:border-cyan-400/60 hover:bg-slate-50 dark:hover:bg-slate-950/60'
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_TYPES}
                    onChange={handleFileInput}
                    className="hidden"
                  />
                  <div className="flex items-center gap-2.5 text-left">
                    <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition', dragOver ? 'bg-cyan-500/20 text-cyan-500' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300')}>
                      <Upload className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-900 dark:text-slate-100">
                        Drop resume or <span className="font-semibold text-cyan-600 dark:text-cyan-400 underline underline-offset-2">browse</span>
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">PDF, DOCX, TXT (up to 5MB)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setPasteMode(true); setError('') }}
                      className="text-[11px] font-medium text-slate-600 hover:text-cyan-600 dark:text-slate-400 dark:hover:text-cyan-300 transition underline underline-offset-2"
                    >
                      Paste text instead
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder="Paste your resume text or qualifications here..."
                    className="min-h-[85px] w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950/70 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-cyan-400/50 resize-y"
                  />
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => { setPasteMode(false); setError('') }}
                      className="text-[11px] text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-300 transition underline underline-offset-2"
                    >
                      ← Upload a file
                    </button>
                    <Button
                      size="sm"
                      onClick={() => void handlePasteAnalyze()}
                      disabled={pasteText.trim().length < 30}
                      className="h-7 rounded-full border border-cyan-400/60 bg-cyan-400 px-3 text-xs font-semibold text-slate-950 hover:bg-cyan-300"
                    >
                      <Zap className="mr-1 h-3 w-3" />
                      Extract & match
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {stage === 'review' && editableExtraction && (
            <div className="space-y-3 rounded-lg border border-slate-200/90 bg-slate-50/60 p-3 dark:border-slate-800/80 dark:bg-slate-950/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Edit3 className="h-3.5 w-3.5 text-violet-500 dark:text-violet-300" />
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">Review Extracted Profile</span>
                </div>
                <span className="text-[10px] text-slate-500">Edit fields before applying</span>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <FieldRow label="Role / Profession" value={editableExtraction.profession} onChange={(v) => updateField('profession', v)} />
                <FieldRow label="Location (City)" value={editableExtraction.city} onChange={(v) => updateField('city', v)} />
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Work Mode</label>
                  <select
                    value={editableExtraction.preferred_work_mode}
                    onChange={(e) => updateField('preferred_work_mode', e.target.value)}
                    className="h-8 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-cyan-400/50"
                  >
                    <option value="remote">Remote</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="local">Local</option>
                  </select>
                </div>
              </div>

              <FieldRow
                label="Skills (comma-separated)"
                value={editableExtraction.skills.join(', ')}
                onChange={(v) => updateField('skills', v.split(',').map((s) => s.trim()).filter(Boolean))}
              />

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Resume Summary</label>
                <textarea
                  value={editableExtraction.resume_summary}
                  onChange={(e) => updateField('resume_summary', e.target.value)}
                  className="min-h-[60px] w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-cyan-400/50 resize-y"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={() => void handleApply()}
                  className="h-8 rounded-full border border-cyan-400/60 bg-cyan-400 px-4 text-xs font-semibold text-slate-950 hover:bg-cyan-300"
                >
                  <Zap className="mr-1.5 h-3.5 w-3.5" />
                  Apply & Search Jobs
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetAll}
                  className="h-8 rounded-full border-slate-300 dark:border-slate-700 px-3 text-xs"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function FieldRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{label}</label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-md border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 focus:border-cyan-400/50"
      />
    </div>
  )
}
