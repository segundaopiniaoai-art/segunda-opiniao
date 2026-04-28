'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import {
  PanelLeftClose,
  PanelLeftOpen,
  ClipboardList,
  Plus,
  LogOut,
  ShieldCheck,
  BarChart3,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { logout } from '@/actions/auth'

const COLLAPSED_KEY = 'sidebar-collapsed'
const ADMIN_OPEN_KEY = 'sidebar-admin-expanded'

type NavItem = { href: string; label: string; icon: LucideIcon }

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Minhas Consultas', icon: ClipboardList },
  { href: '/consultas/nova', label: 'Nova Consulta', icon: Plus },
]

const adminSubItems: NavItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: BarChart3 },
]

export function CollapsibleSidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [labelsVisible, setLabelsVisible] = useState(true)
  const [adminOpen, setAdminOpen] = useState<string>('')

  useEffect(() => {
    const storedCollapsed = localStorage.getItem(COLLAPSED_KEY)
    if (storedCollapsed === 'true') {
      setCollapsed(true)
      setLabelsVisible(false)
    }
    const storedAdminOpen = localStorage.getItem(ADMIN_OPEN_KEY)
    if (storedAdminOpen === 'true') setAdminOpen('admin')
  }, [])

  const toggle = () => {
    const next = !collapsed
    localStorage.setItem(COLLAPSED_KEY, String(next))
    if (next) {
      setLabelsVisible(false)
      setTimeout(() => setCollapsed(true), 150)
    } else {
      setCollapsed(false)
      setTimeout(() => setLabelsVisible(true), 200)
    }
  }

  const handleAdminAccordionChange = (value: string) => {
    setAdminOpen(value)
    localStorage.setItem(ADMIN_OPEN_KEY, value === 'admin' ? 'true' : 'false')
  }

  // When collapsed, clicking Administração expands the sidebar first then opens the accordion.
  const handleCollapsedAdminClick = () => {
    setCollapsed(false)
    setTimeout(() => {
      setLabelsVisible(true)
      setAdminOpen('admin')
      localStorage.setItem(COLLAPSED_KEY, 'false')
      localStorage.setItem(ADMIN_OPEN_KEY, 'true')
    }, 200)
  }

  const isAdminSubActive = adminSubItems.some(
    (i) => pathname === i.href || pathname.startsWith(i.href + '/'),
  )

  return (
    <aside
      className={cn(
        'hidden lg:flex flex-col border-r border-border bg-surface transition-[width] duration-200',
        collapsed ? 'w-16' : 'w-56',
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
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
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
                  : 'text-muted-foreground hover:text-foreground hover:bg-background',
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              <span
                className={cn(
                  'overflow-hidden whitespace-nowrap transition-opacity duration-150',
                  labelsVisible ? 'opacity-100' : 'opacity-0',
                )}
              >
                {item.label}
              </span>
            </Link>
          )
        })}

        {isAdmin && (
          <div className="pt-2">
            {collapsed ? (
              <button
                onClick={handleCollapsedAdminClick}
                aria-label="Administração"
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg w-full text-sm transition-colors',
                  isAdminSubActive
                    ? 'text-primary bg-primary/5'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background',
                )}
              >
                <ShieldCheck className="h-5 w-5 flex-shrink-0" />
              </button>
            ) : (
              <Accordion
                type="single"
                collapsible
                value={adminOpen}
                onValueChange={handleAdminAccordionChange}
              >
                <AccordionItem value="admin" className="border-b-0">
                  <AccordionTrigger
                    className={cn(
                      'py-2 px-3 rounded-lg text-sm font-heading hover:no-underline',
                      isAdminSubActive
                        ? 'text-primary bg-primary/5'
                        : 'text-muted-foreground hover:text-foreground hover:bg-background',
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <ShieldCheck className="h-5 w-5 flex-shrink-0" />
                      <span>Administração</span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pb-1 pt-1">
                    <div className="space-y-1 pl-3 border-l border-border ml-5">
                      {adminSubItems.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            aria-current={isActive ? 'page' : undefined}
                            className={cn(
                              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-heading transition-colors',
                              isActive
                                ? 'text-primary bg-primary/5 font-semibold'
                                : 'text-muted-foreground hover:text-foreground hover:bg-background',
                            )}
                          >
                            <item.icon className="h-4 w-4 flex-shrink-0" />
                            <span>{item.label}</span>
                          </Link>
                        )
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}
          </div>
        )}
      </nav>

      <div className="p-4">
        <form action={logout}>
          <button
            type="submit"
            className={cn(
              'flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground w-full px-1',
              collapsed && 'justify-center',
            )}
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            <span
              className={cn(
                'overflow-hidden whitespace-nowrap transition-opacity duration-150',
                labelsVisible ? 'opacity-100' : 'opacity-0',
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
