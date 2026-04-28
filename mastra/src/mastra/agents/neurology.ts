import { Agent } from '@mastra/core/agent'
import { specialistModel } from './shared'
import { resolveSpecialistInstructions } from './resolve-instructions'

export const neurology = new Agent({
  id: 'neurology',
  name: 'neurology',
  instructions: () => resolveSpecialistInstructions('neurology'),
  model: specialistModel,
})
