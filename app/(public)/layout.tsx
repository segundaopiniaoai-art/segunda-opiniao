import Link from 'next/link'

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b px-6 py-4 flex items-center justify-between">
        <a href="/" className="font-semibold text-lg">SaaS App</a>
        <div className="flex gap-4 text-sm">
          <Link href="/login" className="text-gray-600 hover:text-black">Sign in</Link>
          <Link href="/register" className="bg-black text-white px-4 py-1.5 rounded-lg">
            Get started
          </Link>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  )
}
