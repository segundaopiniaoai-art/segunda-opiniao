import type { Metadata } from 'next'
import { Figtree, Noto_Sans } from 'next/font/google'
import './globals.css'

const figtree = Figtree({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-figtree',
})

const notoSans = Noto_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-noto-sans',
  preload: false,
})

export const metadata: Metadata = {
  title: 'Segunda Opinião',
  description: 'Uma segunda opinião médica baseada em ciência.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="pt-BR"
      className={`${figtree.variable} ${notoSans.variable}`}
    >
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
