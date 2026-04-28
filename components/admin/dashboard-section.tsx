import type { ReactNode } from 'react'

type Props = {
  title: string
  comingSoon?: boolean
  children: ReactNode
}

export function DashboardSection({ title, comingSoon, children }: Props) {
  return (
    <section>
      <header className="flex items-center gap-2 mb-4">
        <h2 className="font-heading text-lg font-semibold">{title}</h2>
        {comingSoon && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
            Em breve
          </span>
        )}
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {children}
      </div>
    </section>
  )
}
