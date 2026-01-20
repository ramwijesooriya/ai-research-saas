import { ClerkProvider } from '@clerk/nextjs'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AI ResearchPro - Generate Market Research Reports with AI',
  description: 'Generate comprehensive, professional market research reports in seconds using AI. Perfect for investors, entrepreneurs, and analysts.',
  keywords: 'AI research, market research, business intelligence, AI reports',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className}>{children}</body>
      </html>
    </ClerkProvider>
  )
}