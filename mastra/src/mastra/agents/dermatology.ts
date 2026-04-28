import { Agent } from '@mastra/core/agent'
import { specialistModel } from './shared'
import { resolveSpecialistInstructions } from './resolve-instructions'

export const dermatology = new Agent({
  id: 'dermatology',
  name: 'dermatology',
  instructions: () => resolveSpecialistInstructions('dermatology'),
  model: specialistModel,
})
