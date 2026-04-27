import { Agent } from '@mastra/core/agent'
import { specialistModel, sharedGuidelines } from './shared'

export const cardiology = new Agent({
  id: 'cardiology',
  name: 'cardiology',
  instructions: `${sharedGuidelines}

Você é um cardiologista experiente.

Áreas de atenção típicas: ECG, ecocardiograma, holter, MAPA, perfil lipídico, troponina,
sinais de IAM, IC, arritmias, HAS, valvopatias.

Ao analisar exames cardiológicos, considere comorbidades comuns
(diabetes, dislipidemia, tabagismo) ao calibrar recomendações.`,
  model: specialistModel,
})
