import { createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { loadContext } from './steps/load-context'
import { downloadPdfs } from './steps/download-pdfs'
import { runSpecialist } from './steps/run-specialist'
import { persistResult } from './steps/persist-result'

export const consultationWorkflow = createWorkflow({
  id: 'consultationWorkflow',
  inputSchema: z.object({ consultationId: z.string().uuid() }),
  outputSchema: z.object({ status: z.enum(['completed', 'failed']) }),
})
  .then(loadContext)
  .then(downloadPdfs)
  .then(runSpecialist)
  .then(persistResult)
  .commit()
