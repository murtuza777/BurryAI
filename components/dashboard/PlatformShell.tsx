'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Bell, ChevronDown, LogOut, Search, User } from 'lucide-react'

import { BrandIdentity } from '@/components/BrandIdentity'
import { Button } from '@/components/ui/button'
import FinanceLoader from '@/components/ui/FinanceLoader'
import { useAuth } from '@/contexts/AuthContext'
import { getFinancialProfile } from '@/lib/financial-client'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/advisor', label: 'AI Advisor' },
  { href: '/dashboard/cost-cutter', label: 'Cost Cutter' },
  { href: '/dashboard/timeline', label: 'Timeline' }
]

function isActiveNav(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname.startsWith(href)
}

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, guestUser, isGuest, loading: authLoading, logout } = useAuth()
  const [checkingProfile, setCheckingProfile] = useState(true)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user && !isGuest) {
      router.replace('/login')
      return
    }

    if (isGuest) {
      setCheckingProfile(false)
      return
    }

    const run = async () => {
      setCheckingProfile(true)
      try {
        const profile = await getFinancialProfile()
        if (!profile.onboarding_completed) {
          router.replace('/onboarding')
          return
        }
      } catch {
        // Ignore and fallback to email below.
      } finally {
        setCheckingProfile(false)
      }
    }

    void run()
  }, [authLoading, guestUser?.name, isGuest, router, user])

  const identity = useMemo(() => {
    if (user?.email) return user.email
    if (guestUser?.name) return `${guestUser.name} (Guest)`
    return 'Guest'
  }, [guestUser?.name, user?.email])

  const identityLabel = useMemo(() => {
    if (guestUser?.name) return guestUser.name
    if (user?.email) return user.email
    return 'Guest'
  }, [guestUser?.name, user?.email])

  const profileInitial = useMemo(() => {
    const trimmed = identityLabel.trim()
    return trimmed.length ? trimmed[0].toUpperCase() : 'G'
  }, [identityLabel])

  useEffect(() => {
    if (!isProfileMenuOpen) return

    const handleOutsideClick = (event: MouseEvent) => {
      if (!profileMenuRef.current) return
      if (!profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [isProfileMenuOpen])

  async function handleLogout() {
    setIsProfileMenuOpen(false)
    await logout()
    router.replace('/login')
  }

  if (authLoading || checkingProfile) {
    return <FinanceLoader />
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_7%_0%,rgba(6,182,212,0.18),transparent_35%),radial-gradient(circle_at_92%_4%,rgba(59,130,246,0.14),transparent_30%),linear-gradient(180deg,#010817_0%,#020617_100%)] text-white">
      <div className="mx-auto w-full max-w-[1800px] px-3 py-5 sm:px-4 md:px-6 md:py-6 lg:px-8">
        <header className="rounded-[2rem] border border-slate-800/90 bg-slate-950/70 px-4 py-3 shadow-[0_12px_42px_rgba(2,6,23,0.55)]">
          <div className="flex flex-wrap items-center justify-between gap-3 md:flex-nowrap">
            <div className="shrink-0">
              <BrandIdentity size={30} textClassName="text-xl font-semibold text-cyan-200" />
            </div>

            <nav className="order-3 w-full rounded-full border border-slate-800 bg-slate-900/60 p-1.5 md:order-2 md:w-auto md:min-w-[500px]">
              <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
                {NAV_ITEMS.map((item) => {
                  const active = isActiveNav(pathname, item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`rounded-full px-3 py-2 text-center text-sm font-medium transition ${
                        active
                          ? 'bg-gradient-to-r from-cyan-500/30 to-sky-500/25 text-white shadow-[0_6px_24px_rgba(34,211,238,0.35)]'
                          : 'text-slate-300 hover:bg-slate-800/80 hover:text-slate-100'
                      }`}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </nav>

            <div className="order-2 flex items-center gap-2 md:order-3">
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-900/70 text-slate-300 hover:text-cyan-200"
                title="Search"
              >
                <Search className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-900/70 text-slate-300 hover:text-cyan-200"
                title="Notifications"
              >
                <Bell className="h-4 w-4" />
              </button>
              <div ref={profileMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 pl-1 pr-2 text-slate-100 transition hover:bg-slate-800"
                  aria-expanded={isProfileMenuOpen}
                  aria-haspopup="menu"
                  title="Profile menu"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/80 to-sky-500/80 text-xs font-semibold text-white">
                    {profileInitial}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-slate-300 transition-transform ${isProfileMenuOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {isProfileMenuOpen ? (
                  <div className="absolute right-0 top-11 z-30 w-60 rounded-2xl border border-slate-800/90 bg-slate-950/95 p-2 shadow-[0_16px_40px_rgba(2,6,23,0.65)] backdrop-blur">
                    <div className="border-b border-slate-800 px-3 py-2">
                      <p className="text-sm font-medium text-slate-100">{identity}</p>
                    </div>

                    <div className="mt-1 space-y-1">
                      <Link
                        href="/dashboard/profile"
                        onClick={() => setIsProfileMenuOpen(false)}
                        className="flex items-center rounded-xl px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-800/80"
                      >
                        <User className="mr-2 h-4 w-4" />
                        Profile
                      </Link>

                      <Button
                        variant="ghost"
                        onClick={() => void handleLogout()}
                        className="w-full justify-start rounded-xl px-3 py-2 text-sm text-slate-200 hover:bg-slate-800/80 hover:text-slate-100"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Logout
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <main className="mt-5 min-h-[calc(100vh-8.5rem)]">
          {isGuest ? (
            <div className="mb-4 rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-amber-100">
              Guest mode is active. Sign up to save real financial data and analytics.
            </div>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  )
}
