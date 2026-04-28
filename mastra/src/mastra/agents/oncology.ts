import { Agent } from '@mastra/core/agent'
import { specialistModel } from './shared'
import { resolveSpecialistInstructions } from './resolve-instructions'

export const oncology = new Agent({
  id: 'oncology',
  name: 'oncology',
  instructions: () => resolveSpecialistInstructions('oncology'),
  model: specialistModel,
})
