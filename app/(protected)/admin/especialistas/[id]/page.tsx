import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getSpecialistEditorData } from '@/lib/admin/specialist-prompts'
import { getSpecialistIcon } from '@/lib/specialist-icons'
import { PromptEditor } from './prompt-editor'

type Props = {
  params: Promise<{ id: string }>
}

export default async function EspecialistaEditorPage({ params }: Props) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  let data
  try {
    data = await getSpecialistEditorData(supabase, id)
  } catch {
    notFound()
  }

  const Icon = getSpecialistIcon(data.icon)

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/especialistas" className="text-muted-foreground hover:text-foreground text-sm">
          ← Especialistas
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <Icon className="h-6 w-6 text-primary shrink-0" />
        <h1 className="font-heading text-2xl font-bold">{data.name}</h1>
      </div>

      <PromptEditor
        specialistId={data.id}
        currentVersionId={data.currentVersionId}
        currentVersionNumber={data.currentVersionNumber}
        initialContent={data.currentContent}
        versions={data.versions}
      />
    </div>
  )
}
