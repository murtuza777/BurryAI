import dynamic from 'next/dynamic'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ComponentType } from 'react'

import FinanceLoader from '../components/ui/FinanceLoader'

const LandingPage = dynamic<{}>(
  () => import('../components/LandingPage').then((mod) => mod.default as ComponentType<{}>),
  { 
    ssr: false,
    loading: () => <FinanceLoader />
  }
)

export default function Home() {
  const hasSessionCookie = Boolean(cookies().get('session')?.value)

  if (hasSessionCookie) {
    redirect('/dashboard')
  }

  return <LandingPage />
} 
