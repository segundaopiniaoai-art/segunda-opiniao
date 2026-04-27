import { z } from 'zod'

export const consultationResultSchema = z.object({
  summary: z.string(),
  findings: z.array(z.object({
    title: z.string(),
    detail: z.string(),
    severity: z.enum(['info', 'attention', 'urgent']),
  })),
  assessment: z.string(),
  recommendations: z.array(z.string()),
  questionsForDoctor: z.array(z.string()),
  redFlags: z.array(z.string()),
  confidence: z.enum(['low', 'medium', 'high']),
  disclaimer: z.string(),
})

export type ConsultationResult = z.infer<typeof consultationResultSchema>
