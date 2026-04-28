import { agentsByKey } from '@/mastra/agents'

jest.mock('@/mastra/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { current_prompt_version: { content: 'stub content' } },
        error: null,
      }),
    }),
  },
}))

describe('specialist agents', () => {
  it('all expected keys are present', () => {
    expect(Object.keys(agentsByKey).sort()).toEqual(
      ['cardiology', 'dermatology', 'general_practice', 'neurology', 'oncology', 'orthopedics'],
    )
  })

  for (const [key, agent] of Object.entries(agentsByKey)) {
    it(`${key} instructions resolve to a string containing shared guidelines`, async () => {
      const instructions = await agent.getInstructions()
      expect(typeof instructions).toBe('string')
      expect(instructions).toContain('SEGUNDA OPINIÃO')
    })
  }
})
