import { createStep } from '@mastra/core/workflows'
import { z } from 'zod'
import { supabaseAdmin } from '../../lib/supabase-admin'
import { markConsultationFailed } from '../../lib/mark-failed'

const fileWithBytes = z.object({
  id: z.string(),
  file_name: z.string(),
  storage_path: z.string(),
  file_size: z.number(),
  pdfBytes: z.instanceof(Uint8Array),
})

export const downloadPdfs = createStep({
  id: 'downloadPdfs',
  inputSchema: z.object({
    consultationId: z.string(),
    userId: z.string(),
    agentKey: z.string(),
    patientContext: z.string().nullable(),
    files: z.array(z.object({
      id: z.string(),
      file_name: z.string(),
      storage_path: z.string(),
      file_size: z.number(),
    })),
  }),
  outputSchema: z.object({
    consultationId: z.string(),
    agentKey: z.string(),
    patientContext: z.string().nullable(),
    files: z.array(fileWithBytes),
  }),
  execute: async ({ inputData }) => {
    try {
      const filesWithBytes = await Promise.all(
        inputData.files.map(async (f) => {
          const { data, error } = await supabaseAdmin.storage
            .from('consultation-files')
            .download(f.storage_path)
          if (error || !data) throw new Error(`Arquivo ausente: ${f.file_name}`)
          const buffer = await data.arrayBuffer()
          return { ...f, pdfBytes: new Uint8Array(buffer) }
        })
      )
      return {
        consultationId: inputData.consultationId,
        agentKey: inputData.agentKey,
        patientContext: inputData.patientContext,
        files: filesWithBytes,
      }
    } catch (err) {
      await markConsultationFailed(inputData.consultationId, 'Não conseguimos ler seus arquivos. Tente novamente.')
      throw err
    }
  },
})
