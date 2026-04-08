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

export default function ResumeUpload({
  onProfileApplied,
  hasExistingResume,
  existingSummary,
  isGuest
}: ResumeUploadProps) {
  const [expanded, setExpanded] = useState(() => !hasExistingResume)
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
      const result = await parseResume(text)
      setEditableExtraction({ ...result.extraction })
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
      const result = await parseResume(pasteText.trim())
      setEditableExtraction({ ...result.extraction })
      setRawText(pasteText.trim())
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
      const updated = await applyResumeProfile(profileData)
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
    ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
    : 'border-amber-400/30 bg-amber-400/10 text-amber-100'

  return (
    <section className="overflow-hidden rounded-[1.25rem] border border-cyan-500/20 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.10),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(34,211,238,0.10),transparent_30%),linear-gradient(180deg,rgba(2,6,23,0.92),rgba(2,6,23,0.76))] shadow-[0_14px_44px_rgba(2,6,23,0.38)]">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 transition hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/30 to-cyan-500/30 shadow-inner">
            <Sparkles className="h-4.5 w-4.5 text-violet-200" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-slate-100">AI Resume Matching</p>
            <p className="text-xs text-slate-400">Upload your resume for personalized job discovery</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={cn('text-[10px]', statusColor)}>{statusLabel}</Badge>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-800/60 px-4 py-4 space-y-4">
          {isGuest && (
            <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-100">
              Sign up to use AI resume matching.
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-200 flex items-start gap-2">
              <X className="h-4 w-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {hasExistingResume && existingSummary && stage === 'idle' && (
            <div className="rounded-xl border border-slate-800/70 bg-slate-950/50 p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-2">Current Resume Summary</p>
              <p className="text-sm text-slate-300 leading-relaxed">{existingSummary}</p>
            </div>
          )}

          {stage === 'done' && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-center space-y-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-300 mx-auto" />
              <p className="text-sm font-medium text-emerald-100">
                Resume applied! Your profile was updated and a fresh job search is running.
              </p>
              <Button
                variant="outline"
                onClick={resetAll}
                className="mt-2 h-8 rounded-full border-slate-700 bg-slate-900/70 px-3 text-xs text-slate-200 hover:bg-slate-800"
              >
                Upload a different resume
              </Button>
            </div>
          )}

          {(stage === 'extracting' || stage === 'parsing' || stage === 'applying') && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="h-8 w-8 text-cyan-300 animate-spin" />
              <p className="text-sm text-slate-300">
                {stage === 'extracting' && `Reading ${fileName}...`}
                {stage === 'parsing' && 'AI is analyzing your resume...'}
                {stage === 'applying' && 'Updating your profile...'}
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
                    'relative cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all',
                    dragOver
                      ? 'border-cyan-300/70 bg-cyan-500/10 scale-[1.01]'
                      : 'border-slate-700 bg-slate-950/40 hover:border-cyan-400/40 hover:bg-slate-950/60'
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_TYPES}
                    onChange={handleFileInput}
                    className="hidden"
                  />
                  <Upload className={cn('h-10 w-10 mx-auto mb-3 transition', dragOver ? 'text-cyan-300' : 'text-slate-500')} />
                  <p className="text-sm font-medium text-slate-200">
                    Drop your resume here or <span className="text-cyan-300">browse files</span>
                  </p>
                  <p className="mt-1.5 text-xs text-slate-400">PDF, TXT, or DOCX — up to 5 MB</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder="Paste your full resume text here..."
                    className="min-h-[160px] w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-400/50 resize-y"
                  />
                  <Button
                    onClick={() => void handlePasteAnalyze()}
                    disabled={pasteText.trim().length < 30}
                    className="h-9 rounded-full border border-cyan-300/60 bg-cyan-300 px-4 text-xs font-semibold text-slate-950 hover:bg-cyan-200"
                  >
                    <Zap className="mr-1.5 h-3.5 w-3.5" />
                    Analyze with AI
                  </Button>
                </div>
              )}
              <button
                type="button"
                onClick={() => { setPasteMode((p) => !p); setError('') }}
                className="text-xs text-slate-400 hover:text-cyan-300 transition underline underline-offset-2"
              >
                {pasteMode ? 'Upload a file instead' : 'Or paste resume text manually'}
              </button>
            </>
          )}

          {stage === 'review' && editableExtraction && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-violet-300" />
                <p className="text-sm font-semibold text-slate-100">Review AI Extraction</p>
                <p className="text-xs text-slate-400">— Edit anything before applying</p>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <FieldRow label="Full Name" value={editableExtraction.full_name} onChange={(v) => updateField('full_name', v)} />
                <FieldRow label="Profession" value={editableExtraction.profession} onChange={(v) => updateField('profession', v)} />
                <FieldRow label="City" value={editableExtraction.city} onChange={(v) => updateField('city', v)} />
                <FieldRow label="State/Region" value={editableExtraction.state_region} onChange={(v) => updateField('state_region', v)} />
                <FieldRow label="Country" value={editableExtraction.country} onChange={(v) => updateField('country', v)} />
                <FieldRow label="University" value={editableExtraction.university} onChange={(v) => updateField('university', v)} />
                <FieldRow label="Student Status" value={editableExtraction.student_status} onChange={(v) => updateField('student_status', v)} />
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Work Mode</label>
                  <select
                    value={editableExtraction.preferred_work_mode}
                    onChange={(e) => updateField('preferred_work_mode', e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none focus:border-cyan-400/50"
                  >
                    <option value="remote">Remote</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="local">Local</option>
                  </select>
                </div>
              </div>

              <FieldRow
                label="Skills (comma separated)"
                value={editableExtraction.skills.join(', ')}
                onChange={(v) => updateField('skills', v.split(',').map((s) => s.trim()).filter(Boolean))}
              />
              <FieldRow
                label="Other Talents (comma separated)"
                value={editableExtraction.other_talents.join(', ')}
                onChange={(v) => updateField('other_talents', v.split(',').map((s) => s.trim()).filter(Boolean))}
              />

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-[0.18em] text-slate-500">AI Summary</label>
                <textarea
                  value={editableExtraction.resume_summary}
                  onChange={(e) => updateField('resume_summary', e.target.value)}
                  className="min-h-[80px] w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-200 outline-none focus:border-cyan-400/50 resize-y"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  onClick={() => void handleApply()}
                  className="h-10 rounded-full border border-cyan-300/60 bg-cyan-300 px-5 text-sm font-semibold text-slate-950 hover:bg-cyan-200 shadow-[0_10px_30px_rgba(34,211,238,0.25)]"
                >
                  <Zap className="mr-2 h-4 w-4" />
                  Apply to Profile & Search Jobs
                </Button>
                <Button
                  variant="outline"
                  onClick={resetAll}
                  className="h-10 rounded-full border-slate-700 bg-slate-900/70 px-4 text-sm text-slate-200 hover:bg-slate-800"
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
      <label className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 border-slate-700 bg-slate-950/70 text-sm text-slate-100 focus:border-cyan-400/50"
      />
    </div>
  )
}
