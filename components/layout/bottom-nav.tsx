'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ClipboardList, Plus, ShieldCheck, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

type NavItem = { href: string; label: string; icon: LucideIcon }

const baseItems: NavItem[] = [
  { href: '/dashboard', label: 'Consultas', icon: ClipboardList },
  { href: '/consultas/nova', label: 'Nova Consulta', icon: Plus },
]
const adminItem: NavItem = { href: '/admin/dashboard', label: 'Admin', icon: ShieldCheck }

export function BottomNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname()
  const items = isAdmin ? [...baseItems, adminItem] : baseItems

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 flex h-16 items-center justify-around border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
      role="navigation"
      aria-label="Navegacao principal"
    >
      {items.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex flex-col items-center gap-0.5 px-4 py-1',
              isActive ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <item.icon className="h-5 w-5" />
            <span className="text-xs">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
