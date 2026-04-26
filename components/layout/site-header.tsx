import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/cn'

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-6 md:px-8">
        <Link
          href="/"
          className="font-heading text-lg font-bold text-foreground"
          aria-label="Segunda Opinião — página inicial"
        >
          Segunda <span className="text-primary">Opinião</span>
        </Link>
        <nav className="flex items-center gap-3 sm:gap-5">
          <Link
            href="/login"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Entrar
          </Link>
          <Link
            href="/register"
            className={cn(buttonVariants({ size: 'sm' }))}
          >
            Comece agora
          </Link>
        </nav>
      </div>
    </header>
  )
}
