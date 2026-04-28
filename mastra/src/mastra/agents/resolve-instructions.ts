import { supabaseAdmin } from '../lib/supabase-admin'
import { sharedGuidelines } from './shared'

export async function resolveSpecialistInstructions(agentKey: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('specialists')
    .select('current_prompt_version:specialist_prompt_versions!current_prompt_version_id(content)')
    .eq('agent_key', agentKey)
    .single()

  if (error || !data?.current_prompt_version?.content) {
    throw new Error(
      `Falha ao carregar prompt do especialista ${agentKey}: ${error?.message ?? 'sem versão ativa'}`,
    )
  }

  return `${sharedGuidelines}\n\n${data.current_prompt_version.content}`
}
