import type { SupabaseClient } from '@supabase/supabase-js'

export type SpecialistListItem = {
  id: string
  name: string
  icon: string
  agentKey: string
  currentVersionNumber: number
  currentVersionCreatedAt: string
}

export type PromptVersion = {
  id: string
  versionNumber: number
  createdAt: string
}

export type SpecialistEditorData = {
  id: string
  name: string
  icon: string
  currentVersionId: string
  currentVersionNumber: number
  currentContent: string
  versions: PromptVersion[]
}

export async function listSpecialistsWithCurrentVersion(
  supabase: SupabaseClient,
): Promise<SpecialistListItem[]> {
  const { data, error } = await supabase
    .from('specialists')
    .select(
      'id, name, icon, agent_key, current_version:specialist_prompt_versions!current_prompt_version_id(version_number, created_at)',
    )
    .order('name')

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    icon: row.icon,
    agentKey: row.agent_key,
    currentVersionNumber: row.current_version.version_number,
    currentVersionCreatedAt: row.current_version.created_at,
  }))
}

export async function getSpecialistEditorData(
  supabase: SupabaseClient,
  specialistId: string,
): Promise<SpecialistEditorData> {
  const [specialistRes, versionsRes] = await Promise.all([
    supabase
      .from('specialists')
      .select(
        'id, name, icon, current_prompt_version_id, current_version:specialist_prompt_versions!current_prompt_version_id(version_number, content)',
      )
      .eq('id', specialistId)
      .single(),
    supabase
      .from('specialist_prompt_versions')
      .select('id, version_number, created_at')
      .eq('specialist_id', specialistId)
      .order('version_number', { ascending: false }),
  ])

  if (specialistRes.error) throw specialistRes.error
  if (versionsRes.error) throw versionsRes.error

  const s = specialistRes.data

  return {
    id: s.id,
    name: s.name,
    icon: s.icon,
    currentVersionId: s.current_prompt_version_id,
    currentVersionNumber: s.current_version.version_number,
    currentContent: s.current_version.content,
    versions: (versionsRes.data ?? []).map((v) => ({
      id: v.id,
      versionNumber: v.version_number,
      createdAt: v.created_at,
    })),
  }
}
