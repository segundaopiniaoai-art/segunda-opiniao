import { Agent } from '@mastra/core/agent'
import { specialistModel } from './shared'
import { resolveSpecialistInstructions } from './resolve-instructions'

export const generalPractice = new Agent({
  id: 'general_practice',
  name: 'general_practice',
  instructions: () => resolveSpecialistInstructions('general_practice'),
  model: specialistModel,
})
