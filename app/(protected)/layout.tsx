import Link from 'next/link'
import { logout } from '@/actions/auth'

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex">
      <aside className="w-56 border-r bg-gray-50 flex flex-col p-6">
        <Link href="/dashboard" className="font-semibold text-lg mb-8 block">
          Segunda Opinião
        </Link>
        <nav className="space-y-1 flex-1">
          <Link
            href="/dashboard"
            className="block text-sm px-3 py-2 rounded-lg hover:bg-gray-100"
          >
            Minhas Consultas
          </Link>
          <Link
            href="/consultas/nova"
            className="block text-sm px-3 py-2 rounded-lg hover:bg-gray-100"
          >
            Nova Consulta
          </Link>
        </nav>
        <form action={logout}>
          <button
            type="submit"
            className="text-sm text-gray-500 hover:text-black w-full text-left"
          >
            Sair
          </button>
        </form>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  )
}
