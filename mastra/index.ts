import { Mastra } from '@mastra/core'
import { agentsByKey } from './agents'

export const mastra = new Mastra({
  agents: agentsByKey,
  workflows: {},
  server: {
    middleware: [
      {
        handler: async (c, next) => {
          const auth = c.req.header('authorization')
          if (auth !== `Bearer ${process.env.MASTRA_API_KEY}`) {
            return new Response('Unauthorized', { status: 401 })
          }
          return next()
        },
        path: '/api/workflows/*',
      },
    ],
  },
})
