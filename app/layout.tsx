import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import './globals.css'
import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'BurryAI',
  description: 'AI-Powered Student Finance Management',
  icons: {
    icon: [{ url: '/icon.png?v=4', sizes: '512x512', type: 'image/png' }],
    apple: [{ url: '/apple-icon.png?v=4', sizes: '180x180', type: 'image/png' }],
    shortcut: '/icon.png?v=4'
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('burryai-theme');
                  var theme = stored || 'dark';
                  var isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                  if (isDark) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="overflow-x-hidden bg-background text-foreground antialiased selection:bg-cyan-500/20 selection:text-cyan-900 dark:selection:text-cyan-200 transition-colors duration-200">
        <ThemeProvider defaultTheme="dark" storageKey="burryai-theme">
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
} 
