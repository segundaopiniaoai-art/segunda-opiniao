import { CollapsibleSidebar } from '@/components/layout/collapsible-sidebar'
import { MobileHeader } from '@/components/layout/mobile-header'
import { BottomNav } from '@/components/layout/bottom-nav'

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <CollapsibleSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <MobileHeader />

        <main className="flex-1 px-6 py-8 pb-20 lg:pb-8 md:px-8">
          <div className="mx-auto max-w-4xl">{children}</div>
        </main>

        <BottomNav />
      </div>
    </div>
  )
}
