import Link from 'next/link'
import { LogOut } from 'lucide-react'
import { logout } from '@/actions/auth'

export function MobileHeader() {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-surface px-4 lg:hidden">
      <Link
        href="/dashboard"
        className="font-heading text-lg font-bold text-foreground"
      >
        Segunda <span className="text-primary">Opiniao</span>
      </Link>
      <form action={logout}>
        <button
          type="submit"
          className="text-muted-foreground hover:text-foreground p-2"
          aria-label="Sair"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </form>
    </header>
  )
}
