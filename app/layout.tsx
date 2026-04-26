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
  metadataBase: new URL('https://segundaopiniao.com.br'),
  title: {
    default: 'Segunda Opinião — Uma segunda opinião médica baseada em ciência',
    template: '%s · Segunda Opinião',
  },
  description:
    'Envie seus exames e receba uma segunda opinião médica em minutos, com análise probabilística feita por uma IA especializada e fundamentada em evidências científicas.',
  applicationName: 'Segunda Opinião',
  authors: [{ name: 'Segunda Opinião' }],
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: 'Segunda Opinião',
    title: 'Segunda Opinião — Uma segunda opinião médica baseada em ciência',
    description:
      'Envie seus exames e receba uma análise probabilística feita por uma IA especializada, fundamentada em milhares de artigos científicos.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Segunda Opinião',
    description:
      'Uma segunda opinião médica em minutos, baseada em evidências científicas.',
  },
  robots: { index: true, follow: true },
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
