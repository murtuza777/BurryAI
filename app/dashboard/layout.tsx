'use client'

import { PlatformShell } from '@/components/dashboard/PlatformShell'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <PlatformShell>{children}</PlatformShell>
}
