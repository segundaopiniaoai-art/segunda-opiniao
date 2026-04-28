import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { listSpecialistsWithCurrentVersion } from '@/lib/admin/specialist-prompts'
import { getSpecialistIcon } from '@/lib/specialist-icons'

export default async function EspecialistasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const specialists = await listSpecialistsWithCurrentVersion(supabase)

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl md:text-3xl font-bold">Especialistas</h1>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Especialista</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Versão atual</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Atualizado em</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {specialists.map((s) => {
              const Icon = getSpecialistIcon(s.icon)
              const updatedAt = new Date(s.currentVersionCreatedAt).toLocaleDateString('pt-BR', {
                day: '2-digit', month: 'short', year: 'numeric',
              })
              return (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-medium">{s.name}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">v{s.currentVersionNumber}</td>
                  <td className="px-4 py-3 text-muted-foreground">{updatedAt}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/especialistas/${s.id}`}
                      className="text-primary hover:underline font-medium"
                    >
                      Editar
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
