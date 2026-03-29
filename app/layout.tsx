import { AuthProvider } from '@/contexts/AuthContext'
import './globals.css'
import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'BurryAI',
  description: 'AI-Powered Student Finance Management',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-512.png', sizes: '512x512', type: 'image/png' }
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: '/favicon.ico'
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="overflow-x-hidden bg-slate-950 antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
} 
