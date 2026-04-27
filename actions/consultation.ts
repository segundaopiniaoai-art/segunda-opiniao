'use server'

import { createClient } from '@/lib/supabase/server'
import { startConsultationWorkflow } from '@/lib/mastra/client'

const MAX_FILES = 5
const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_CONTEXT = 2000

type FileMetadata = { name: string; size: number }

type CreateInput = {
  specialistId: string
  patientContext?: string
  files: FileMetadata[]
}

type CreateResult =
  | { error: string }
  | { consultationId: string; uploadUrls: { fileName: string; url: string }[] }

export async function createConsultation(input: CreateInput): Promise<CreateResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Usuário não autenticado' }

  if (!input.files.length) return { error: 'Envie pelo menos 1 arquivo PDF' }
  if (input.files.length > MAX_FILES) return { error: 'Máximo de 5 arquivos permitidos' }
  if (input.files.some(f => f.size > MAX_FILE_SIZE)) return { error: 'Cada arquivo deve ter no máximo 10MB' }
  if (input.patientContext && input.patientContext.length > MAX_CONTEXT) {
    return { error: `Contexto deve ter no máximo ${MAX_CONTEXT} caracteres` }
  }

  const { data: specialist } = await supabase
    .from('specialists')
    .select('id')
    .eq('id', input.specialistId)
    .eq('active', true)
    .single()
  if (!specialist) return { error: 'Especialista não encontrado' }

  const { data: consultation, error: cErr } = await supabase
    .from('consultations')
    .insert({
      user_id: user.id,
      specialist_id: input.specialistId,
      patient_context: input.patientContext ?? null,
      status: 'pending',
    })
    .select('id')
    .single()
  if (cErr || !consultation) return { error: 'Erro ao criar consulta. Tente novamente.' }

  const uploadUrls: { fileName: string; url: string }[] = []
  for (const file of input.files) {
    const storagePath = `${user.id}/${consultation.id}/${file.name}`
    const { error: fErr } = await supabase.from('consultation_files').insert({
      consultation_id: consultation.id,
      file_name: file.name,
      file_size: file.size,
      storage_path: storagePath,
    })
    if (fErr) return { error: 'Erro ao registrar arquivo. Tente novamente.' }

    const { data: signed, error: uErr } = await supabase.storage
      .from('consultation-files')
      .createSignedUploadUrl(storagePath, { upsert: false })
    if (uErr || !signed) return { error: 'Erro ao gerar URL de upload. Tente novamente.' }

    uploadUrls.push({ fileName: file.name, url: signed.signedUrl })
  }

  return { consultationId: consultation.id, uploadUrls }
}

type ConfirmResult = { error: string } | { success: true }

export async function confirmConsultationUpload(consultationId: string): Promise<ConfirmResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Usuário não autenticado' }

  const { data: consultation } = await supabase
    .from('consultations')
    .select('id, status')
    .eq('id', consultationId)
    .eq('user_id', user.id)
    .single()
  if (!consultation) return { error: 'Consulta não encontrada' }
  if (consultation.status !== 'pending') return { error: 'Esta consulta já foi confirmada' }

  const { data: files } = await supabase
    .from('consultation_files')
    .select('storage_path, file_name')
    .eq('consultation_id', consultationId)
  if (!files?.length) return { error: 'Nenhum arquivo registrado' }

  const missing: string[] = []
  for (const file of files) {
    const dir = file.storage_path.substring(0, file.storage_path.lastIndexOf('/'))
    const fileName = file.storage_path.substring(file.storage_path.lastIndexOf('/') + 1)
    const { data: listed } = await supabase.storage.from('consultation-files').list(dir)
    if (!listed?.some(i => i.name === fileName)) missing.push(file.file_name)
  }
  if (missing.length) return { error: `Arquivos não enviados: ${missing.join(', ')}` }

  const { error: upErr } = await supabase
    .from('consultations')
    .update({ status: 'processing' })
    .eq('id', consultationId)
  if (upErr) return { error: 'Erro ao atualizar status' }

  try {
    await startConsultationWorkflow(consultationId)
  } catch {
    await supabase
      .from('consultations')
      .update({ status: 'failed', failure_reason: 'Não foi possível iniciar a análise. Tente novamente.' })
      .eq('id', consultationId)
    return { error: 'Não foi possível iniciar a análise. Tente novamente em instantes.' }
  }

  return { success: true }
}

export async function retryConsultation(consultationId: string): Promise<ConfirmResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Usuário não autenticado' }

  const { data: consultation } = await supabase
    .from('consultations')
    .select('id, status')
    .eq('id', consultationId)
    .eq('user_id', user.id)
    .single()
  if (!consultation) return { error: 'Consulta não encontrada' }
  if (consultation.status !== 'failed') return { error: 'Só é possível reenviar consultas com falha' }

  const { error: upErr } = await supabase
    .from('consultations')
    .update({ status: 'processing', failure_reason: null, result: null })
    .eq('id', consultationId)
  if (upErr) return { error: 'Erro ao atualizar status' }

  try {
    await startConsultationWorkflow(consultationId)
  } catch {
    await supabase
      .from('consultations')
      .update({ status: 'failed', failure_reason: 'Não foi possível iniciar a análise. Tente novamente.' })
      .eq('id', consultationId)
    return { error: 'Não foi possível iniciar a análise. Tente novamente em instantes.' }
  }

  return { success: true }
}
