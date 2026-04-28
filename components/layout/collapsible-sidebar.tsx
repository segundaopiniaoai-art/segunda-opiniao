'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  PanelLeftClose,
  PanelLeftOpen,
  ClipboardList,
  Plus,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { logout } from '@/actions/auth'

const STORAGE_KEY = 'sidebar-collapsed'

const navItems = [
  { href: '/dashboard', label: 'Minhas Consultas', icon: ClipboardList },
  { href: '/consultas/nova', label: 'Nova Consulta', icon: Plus },
]

export function CollapsibleSidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [labelsVisible, setLabelsVisible] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'true') {
      setCollapsed(true)
      setLabelsVisible(false)
    }
  }, [])

  const toggle = () => {
    const next = !collapsed
    localStorage.setItem(STORAGE_KEY, String(next))

    if (next) {
      setLabelsVisible(false)
      setTimeout(() => setCollapsed(true), 150)
    } else {
      setCollapsed(false)
      setTimeout(() => setLabelsVisible(true), 200)
    }
  }

  return (
    <aside
      className={cn(
        'hidden lg:flex flex-col border-r border-border bg-surface transition-[width] duration-200',
        collapsed ? 'w-16' : 'w-56'
      )}
      role="navigation"
      aria-label="Menu principal"
    >
      <div className="p-4 flex items-center justify-between">
        <Link
          href="/dashboard"
          className="font-heading text-lg font-bold text-foreground overflow-hidden whitespace-nowrap"
        >
          {collapsed ? (
            <span className="text-primary">SO</span>
          ) : (
            <>
              Segunda <span className="text-primary">Opiniao</span>
            </>
          )}
        </Link>
        <button
          onClick={toggle}
          aria-expanded={!collapsed}
          className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-background"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      <nav className="flex-1 px-2 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-heading transition-colors',
                isActive
                  ? 'text-primary bg-primary/5 font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background'
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              <span
                className={cn(
                  'overflow-hidden whitespace-nowrap transition-opacity duration-150',
                  labelsVisible ? 'opacity-100' : 'opacity-0'
                )}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>

      <div className="p-4">
        <form action={logout}>
          <button
            type="submit"
            className={cn(
              'flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground w-full px-1',
              collapsed && 'justify-center'
            )}
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            <span
              className={cn(
                'overflow-hidden whitespace-nowrap transition-opacity duration-150',
                labelsVisible ? 'opacity-100' : 'opacity-0'
              )}
            >
              Sair
            </span>
          </button>
        </form>
      </div>
    </aside>
  )
}
