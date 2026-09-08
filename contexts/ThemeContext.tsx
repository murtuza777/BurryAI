'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const STORAGE_KEY = 'burryai-theme'

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

export function ThemeProvider({
  children,
  defaultTheme = 'dark',
  storageKey = STORAGE_KEY
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('dark')
  const [mounted, setMounted] = useState(false)

  // Initialize theme from localStorage or default
  useEffect(() => {
    let savedTheme: Theme = defaultTheme
    try {
      const stored = localStorage.getItem(storageKey) as Theme | null
      if (stored && (stored === 'light' || stored === 'dark' || stored === 'system')) {
        savedTheme = stored
      }
    } catch {
      // Ignore localStorage read errors
    }

    setThemeState(savedTheme)
    const initialResolved = savedTheme === 'system' ? getSystemTheme() : savedTheme
    setResolvedTheme(initialResolved)

    const root = document.documentElement
    if (initialResolved === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }

    setMounted(true)
  }, [defaultTheme, storageKey])

  // React to theme changes and system preference changes
  useEffect(() => {
    if (!mounted) return

    const applyTheme = (currentTheme: Theme) => {
      const computedResolved = currentTheme === 'system' ? getSystemTheme() : currentTheme
      setResolvedTheme(computedResolved)

      const root = document.documentElement
      if (computedResolved === 'dark') {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }

    applyTheme(theme)

    // Listen for OS system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleSystemChange = () => {
      if (theme === 'system') {
        applyTheme('system')
      }
    }

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleSystemChange)
      return () => mediaQuery.removeEventListener('change', handleSystemChange)
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleSystemChange)
      return () => mediaQuery.removeListener(handleSystemChange)
    }
  }, [theme, mounted])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    try {
      localStorage.setItem(storageKey, newTheme)
    } catch {
      // Ignore localStorage write errors
    }
  }

  const toggleTheme = () => {
    if (resolvedTheme === 'dark') {
      setTheme('light')
    } else {
      setTheme('dark')
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
