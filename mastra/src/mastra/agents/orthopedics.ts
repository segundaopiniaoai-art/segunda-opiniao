import { Agent } from '@mastra/core/agent'
import { specialistModel } from './shared'
import { resolveSpecialistInstructions } from './resolve-instructions'

export const orthopedics = new Agent({
  id: 'orthopedics',
  name: 'orthopedics',
  instructions: () => resolveSpecialistInstructions('orthopedics'),
  model: specialistModel,
})
