import Link from 'next/link'
import { logout } from '@/actions/auth'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex">
      <aside className="w-56 border-r bg-gray-900 text-white flex flex-col p-6">
        <Link href="/dashboard" className="font-semibold text-lg mb-8 block">
          Admin
        </Link>
        <nav className="space-y-1 flex-1">
          <Link
            href="/admin/users"
            className="block text-sm px-3 py-2 rounded-lg hover:bg-gray-800"
          >
            Users
          </Link>
          <Link
            href="/admin/costs"
            className="block text-sm px-3 py-2 rounded-lg hover:bg-gray-800"
          >
            Costs
          </Link>
        </nav>
        <form action={logout}>
          <button
            type="submit"
            className="text-sm text-gray-400 hover:text-white w-full text-left"
          >
            Sign out
          </button>
        </form>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  )
}
