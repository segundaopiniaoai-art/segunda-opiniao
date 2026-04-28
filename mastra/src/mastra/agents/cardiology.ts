import { Agent } from '@mastra/core/agent'
import { specialistModel } from './shared'
import { resolveSpecialistInstructions } from './resolve-instructions'

export const cardiology = new Agent({
  id: 'cardiology',
  name: 'cardiology',
  instructions: () => resolveSpecialistInstructions('cardiology'),
  model: specialistModel,
})
