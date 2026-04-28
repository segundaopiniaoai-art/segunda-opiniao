'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ClipboardList, Plus } from 'lucide-react'
import { cn } from '@/lib/cn'

const items = [
  { href: '/dashboard', label: 'Consultas', icon: ClipboardList },
  { href: '/consultas/nova', label: 'Nova Consulta', icon: Plus },
]

export function BottomNav() {
  const pathname = usePathname()

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
