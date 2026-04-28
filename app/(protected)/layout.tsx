import { CollapsibleSidebar } from '@/components/layout/collapsible-sidebar'
import { MobileHeader } from '@/components/layout/mobile-header'
import { BottomNav } from '@/components/layout/bottom-nav'
import { createClient } from '@/lib/supabase/server'

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // Middleware already redirects unauthenticated users — fail-closed if profile fetch errors.
  let isAdmin = false
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    isAdmin = profile?.role === 'admin'
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <CollapsibleSidebar isAdmin={isAdmin} />

      <div className="flex-1 flex flex-col min-w-0">
        <MobileHeader />

        <main className="flex-1 px-6 py-8 pb-20 lg:pb-8 md:px-8">
          <div className="mx-auto max-w-4xl">{children}</div>
        </main>

        <BottomNav isAdmin={isAdmin} />
      </div>
    </div>
  )
}
