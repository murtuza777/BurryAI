'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Bell,
  Bot,
  Briefcase,
  CalendarRange,
  ChevronDown,
  Home,
  LogOut,
  Scissors,
  Search,
  User
} from 'lucide-react'

import { BrandIdentity } from '@/components/BrandIdentity'
import { Button } from '@/components/ui/button'
import FinanceLoader from '@/components/ui/FinanceLoader'
import { useAuth } from '@/contexts/AuthContext'
import { getFinancialProfile } from '@/lib/financial-client'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', shortLabel: 'Home', icon: Home },
  { href: '/dashboard/advisor', label: 'AI Advisor', shortLabel: 'Advisor', icon: Bot },
  { href: '/dashboard/opportunities', label: 'Opportunities', shortLabel: 'Jobs', icon: Briefcase },
  { href: '/dashboard/cost-cutter', label: 'Cost Cutter', shortLabel: 'Cuts', icon: Scissors },
  { href: '/dashboard/timeline', label: 'Timeline', shortLabel: 'Plan', icon: CalendarRange }
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

  const activeNavItem = useMemo(
    () => NAV_ITEMS.find((item) => isActiveNav(pathname, item.href)) ?? NAV_ITEMS[0],
    [pathname]
  )
  const isAdvisorRoute = pathname.startsWith('/dashboard/advisor')

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
    <div
      className={`bg-[radial-gradient(circle_at_7%_0%,rgba(6,182,212,0.18),transparent_35%),radial-gradient(circle_at_92%_4%,rgba(59,130,246,0.14),transparent_30%),linear-gradient(180deg,#010817_0%,#020617_100%)] text-white ${
        isAdvisorRoute ? 'h-[100svh] overflow-hidden' : 'min-h-[100svh]'
      }`}
    >
      <div
        className={`mx-auto w-full max-w-[1800px] px-3 pt-4 sm:px-4 md:px-6 md:pt-6 lg:px-8 ${
          isAdvisorRoute ? 'flex h-full min-h-0 flex-col pb-3 md:pb-4' : 'pb-28 sm:pb-32 md:pb-6'
        }`}
      >
        <header className="sticky top-3 z-40 rounded-[1.75rem] border border-slate-800/90 bg-slate-950/75 px-3 py-3 shadow-[0_12px_42px_rgba(2,6,23,0.55)] backdrop-blur-xl sm:px-4 md:top-4 md:rounded-[2rem]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 shrink">
              <BrandIdentity
                size={28}
                textClassName="text-lg font-semibold text-cyan-200 sm:text-xl"
                className="min-w-0"
              />
              <div className="mt-2 md:hidden">
                <p className="text-[10px] uppercase tracking-[0.28em] text-cyan-300/75">Current feature</p>
                <p className="mt-1 truncate text-sm font-medium text-slate-100">{activeNavItem.label}</p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                className="hidden h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-900/70 text-slate-300 transition hover:text-cyan-200 sm:inline-flex"
                title="Search"
              >
                <Search className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-900/70 text-slate-300 transition hover:text-cyan-200"
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
                    className={`hidden h-4 w-4 text-slate-300 transition-transform sm:block ${isProfileMenuOpen ? 'rotate-180' : ''}`}
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

          <nav className="mt-3 hidden rounded-full border border-slate-800 bg-slate-900/60 p-1.5 md:block">
              <div className="grid grid-cols-2 gap-1.5 md:grid-cols-5">
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
        </header>

        <main className={isAdvisorRoute ? 'mt-4 flex min-h-0 flex-1 flex-col overflow-hidden pb-0 md:mt-5' : 'mt-4 min-h-[calc(100svh-8rem)] pb-2 md:mt-5 md:pb-0'}>
          {isGuest ? (
            <div className="mb-4 rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-amber-100">
              Guest mode is active. Sign up to save real financial data and analytics.
            </div>
          ) : null}
          {children}
        </main>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:hidden">
        <nav className="mx-auto flex max-w-xl items-end justify-between gap-1 rounded-[1.75rem] border border-slate-700/80 bg-slate-950/90 px-2 py-2 shadow-[0_18px_45px_rgba(2,6,23,0.72)] backdrop-blur-xl">
          {NAV_ITEMS.map((item) => {
            const active = isActiveNav(pathname, item.href)
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-[1.2rem] px-2 py-2 text-[11px] font-medium transition ${
                  active
                    ? 'bg-gradient-to-b from-cyan-400/25 to-sky-500/20 text-white shadow-[0_10px_28px_rgba(34,211,238,0.22)]'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? 'text-cyan-200' : 'text-slate-500'}`} />
                <span className="truncate">{item.shortLabel}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
