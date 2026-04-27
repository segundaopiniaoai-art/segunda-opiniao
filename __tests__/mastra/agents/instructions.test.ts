import { agentsByKey } from '@/mastra/agents'

describe('specialist agent instructions', () => {
  for (const [key, agent] of Object.entries(agentsByKey)) {
    it(`${key} instructions match snapshot`, () => {
      expect(agent.instructions).toMatchSnapshot()
    })
  }
})
