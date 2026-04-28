'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') redirect('/dashboard')
  return supabase
}

export async function saveNewVersion(specialistId: string, content: string) {
  const supabase = await assertAdmin()

  const { error } = await supabase.rpc('create_specialist_prompt_version', {
    p_specialist_id: specialistId,
    p_content: content,
  })

  if (error) throw new Error(error.message)

  revalidatePath(`/admin/especialistas/${specialistId}`)
  revalidatePath('/admin/especialistas')
}

export async function restoreVersion(specialistId: string, versionId: string) {
  const supabase = await assertAdmin()

  const { data: version, error: fetchError } = await supabase
    .from('specialist_prompt_versions')
    .select('content')
    .eq('id', versionId)
    .single()

  if (fetchError || !version?.content) {
    throw new Error(fetchError?.message ?? 'Versão não encontrada')
  }

  const { error } = await supabase.rpc('create_specialist_prompt_version', {
    p_specialist_id: specialistId,
    p_content: version.content,
  })

  if (error) throw new Error(error.message)

  revalidatePath(`/admin/especialistas/${specialistId}`)
  revalidatePath('/admin/especialistas')
}
