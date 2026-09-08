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
  Monitor,
  Moon,
  Scissors,
  Search,
  Sun,
  User
} from 'lucide-react'

import { BrandIdentity } from '@/components/BrandIdentity'
import { Button } from '@/components/ui/button'
import FinanceLoader from '@/components/ui/FinanceLoader'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
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
  const { theme, setTheme } = useTheme()
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
      className={`transition-colors duration-200 bg-[radial-gradient(circle_at_7%_0%,rgba(6,182,212,0.08),transparent_35%),radial-gradient(circle_at_92%_4%,rgba(59,130,246,0.06),transparent_30%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] text-slate-900 dark:bg-[radial-gradient(circle_at_7%_0%,rgba(6,182,212,0.18),transparent_35%),radial-gradient(circle_at_92%_4%,rgba(59,130,246,0.14),transparent_30%),linear-gradient(180deg,#010817_0%,#020617_100%)] dark:text-white ${
        isAdvisorRoute ? 'h-[100svh] overflow-hidden' : 'min-h-[100svh]'
      }`}
    >
      <div
        className={`mx-auto w-full max-w-[1800px] px-3 pt-4 sm:px-4 md:px-6 md:pt-6 lg:px-8 ${
          isAdvisorRoute
            ? 'flex h-full min-h-0 flex-col pb-[calc(env(safe-area-inset-bottom)+8rem)] pt-0 md:pb-4 md:pt-6'
            : 'pb-28 sm:pb-32 md:pb-6'
        }`}
      >
        <header
          className={`sticky top-3 z-40 rounded-[1.75rem] border border-slate-200/90 bg-white/80 px-3 py-3 shadow-[0_12px_42px_rgba(15,23,42,0.06)] backdrop-blur-xl dark:border-slate-800/90 dark:bg-slate-950/75 dark:shadow-[0_12px_42px_rgba(2,6,23,0.55)] sm:px-4 md:top-4 md:rounded-[2rem] ${
            isAdvisorRoute ? 'hidden md:block' : ''
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 shrink">
              <BrandIdentity
                size={28}
                textClassName="text-lg font-semibold text-cyan-700 dark:text-cyan-200 sm:text-xl"
                className="min-w-0"
              />
              <div className="mt-2 md:hidden">
                <p className="text-[10px] uppercase tracking-[0.28em] text-cyan-600/80 dark:text-cyan-300/75">Current feature</p>
                <p className="mt-1 truncate text-sm font-medium text-slate-900 dark:text-slate-100">{activeNavItem.label}</p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                className="hidden h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-700 transition hover:text-cyan-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:text-cyan-200 sm:inline-flex"
                title="Search"
              >
                <Search className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-700 transition hover:text-cyan-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:text-cyan-200"
                title="Notifications"
              >
                <Bell className="h-4 w-4" />
              </button>
              <div ref={profileMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white pl-1 pr-2 text-slate-800 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100 dark:hover:bg-slate-800"
                  aria-expanded={isProfileMenuOpen}
                  aria-haspopup="menu"
                  title="Profile menu"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/80 to-sky-500/80 text-xs font-semibold text-white">
                    {profileInitial}
                  </span>
                  <ChevronDown
                    className={`hidden h-4 w-4 text-slate-400 transition-transform dark:text-slate-300 sm:block ${isProfileMenuOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {isProfileMenuOpen ? (
                  <div className="absolute right-0 top-11 z-30 w-64 rounded-2xl border border-slate-200/90 bg-white/95 p-2.5 shadow-[0_16px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-slate-800/90 dark:bg-slate-950/95 dark:shadow-[0_16px_40px_rgba(2,6,23,0.65)]">
                    <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-800">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{identity}</p>
                      <span className="inline-block mt-0.5 text-[11px] font-medium text-cyan-600 dark:text-cyan-400">
                        {isGuest ? 'Guest Session' : 'Active Account'}
                      </span>
                    </div>

                    <div className="mt-1.5 space-y-1">
                      <Link
                        href="/dashboard/profile"
                        onClick={() => setIsProfileMenuOpen(false)}
                        className="flex items-center rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/80"
                      >
                        <User className="mr-2 h-4 w-4 text-slate-500 dark:text-slate-400" />
                        Profile & Settings
                      </Link>

                      {/* Theme Selector in Profile Dropdown */}
                      <div className="px-3 py-2">
                        <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          <span>Appearance</span>
                          <span className="capitalize font-semibold text-cyan-600 dark:text-cyan-400">{theme}</span>
                        </div>
                        <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-xl bg-slate-100/90 p-1 dark:bg-slate-900/90">
                          <button
                            type="button"
                            onClick={() => setTheme('light')}
                            className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-medium transition ${
                              theme === 'light'
                                ? 'bg-white text-cyan-700 shadow-xs border border-slate-200/80 dark:bg-slate-800 dark:text-cyan-300 dark:border-slate-700'
                                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                            }`}
                            title="Light Theme"
                          >
                            <Sun className="h-3.5 w-3.5" />
                            <span>Light</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setTheme('dark')}
                            className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-medium transition ${
                              theme === 'dark'
                                ? 'bg-white text-cyan-700 shadow-xs border border-slate-200/80 dark:bg-slate-800 dark:text-cyan-300 dark:border-slate-700'
                                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                            }`}
                            title="Dark Theme"
                          >
                            <Moon className="h-3.5 w-3.5" />
                            <span>Dark</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setTheme('system')}
                            className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-medium transition ${
                              theme === 'system'
                                ? 'bg-white text-cyan-700 shadow-xs border border-slate-200/80 dark:bg-slate-800 dark:text-cyan-300 dark:border-slate-700'
                                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                            }`}
                            title="System Preference"
                          >
                            <Monitor className="h-3.5 w-3.5" />
                            <span>Auto</span>
                          </button>
                        </div>
                      </div>

                      <div className="border-t border-slate-100 pt-1 dark:border-slate-800">
                        <Button
                          variant="ghost"
                          onClick={() => void handleLogout()}
                          className="w-full justify-start rounded-xl px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/30 dark:hover:text-rose-300"
                        >
                          <LogOut className="mr-2 h-4 w-4" />
                          Logout
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <nav className="mt-3 hidden rounded-full border border-slate-200/90 bg-slate-100/70 p-1.5 dark:border-slate-800 dark:bg-slate-900/60 md:block">
              <div className="grid grid-cols-2 gap-1.5 md:grid-cols-5">
                {NAV_ITEMS.map((item) => {
                  const active = isActiveNav(pathname, item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`rounded-full px-3 py-2 text-center text-sm font-medium transition ${
                        active
                          ? 'bg-gradient-to-r from-cyan-500/20 to-sky-500/15 text-cyan-900 border border-cyan-500/30 shadow-xs dark:bg-gradient-to-r dark:from-cyan-500/30 dark:to-sky-500/25 dark:text-white dark:border-transparent dark:shadow-[0_6px_24px_rgba(34,211,238,0.35)]'
                          : 'text-slate-600 hover:bg-white/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-slate-100'
                      }`}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </div>
          </nav>
        </header>

        <main
          className={
            isAdvisorRoute
              ? 'flex min-h-0 flex-1 flex-col overflow-hidden pb-0 md:mt-5'
              : 'mt-4 min-h-[calc(100svh-8rem)] pb-2 md:mt-5 md:pb-0'
          }
        >
          {isGuest ? (
            <div className="mb-4 rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-amber-800 dark:text-amber-100">
              Guest mode is active. Sign up to save real financial data and analytics.
            </div>
          ) : null}
          {children}
        </main>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:hidden">
        <nav className="mx-auto flex max-w-xl items-end justify-between gap-1 rounded-[1.75rem] border border-slate-200/90 bg-white/90 px-2 py-2 shadow-[0_18px_45px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-950/90 dark:shadow-[0_18px_45px_rgba(2,6,23,0.72)]">
          {NAV_ITEMS.map((item) => {
            const active = isActiveNav(pathname, item.href)
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-[1.2rem] px-2 py-2 text-[11px] font-medium transition ${
                  active
                    ? 'bg-gradient-to-b from-cyan-400/20 to-sky-500/15 text-cyan-900 dark:bg-gradient-to-b dark:from-cyan-400/25 dark:to-sky-500/20 dark:text-white dark:shadow-[0_10px_28px_rgba(34,211,238,0.22)]'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? 'text-cyan-600 dark:text-cyan-200' : 'text-slate-400 dark:text-slate-500'}`} />
                <span className="truncate">{item.shortLabel}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

