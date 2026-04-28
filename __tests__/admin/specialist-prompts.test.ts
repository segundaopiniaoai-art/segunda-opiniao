import {
  listSpecialistsWithCurrentVersion,
  getSpecialistEditorData,
} from '@/lib/admin/specialist-prompts'

function buildSupabase(overrides: Record<string, () => Promise<unknown>> = {}) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
  }
  const from = jest.fn().mockReturnValue(chain)
  return { supabase: { from } as unknown as Parameters<typeof listSpecialistsWithCurrentVersion>[0], chain, from }
}

const SPECIALIST_ROW = {
  id: 'spec-1',
  name: 'Cardiologia',
  icon: '❤️',
  agent_key: 'cardiology',
  current_version: { version_number: 2, created_at: '2026-04-28T00:00:00Z' },
}

const VERSION_ROWS = [
  { id: 'v2', version_number: 2, created_at: '2026-04-28T00:00:00Z' },
  { id: 'v1', version_number: 1, created_at: '2026-01-01T00:00:00Z' },
]

describe('listSpecialistsWithCurrentVersion', () => {
  it('maps DB rows to SpecialistListItem shape', async () => {
    const { supabase, chain } = buildSupabase()
    chain.order.mockResolvedValue({ data: [SPECIALIST_ROW], error: null })

    const result = await listSpecialistsWithCurrentVersion(supabase)

    expect(result).toEqual([
      {
        id: 'spec-1',
        name: 'Cardiologia',
        icon: '❤️',
        agentKey: 'cardiology',
        currentVersionNumber: 2,
        currentVersionCreatedAt: '2026-04-28T00:00:00Z',
      },
    ])
  })

  it('throws when supabase returns an error', async () => {
    const { supabase, chain } = buildSupabase()
    chain.order.mockResolvedValue({ data: null, error: new Error('db error') })

    await expect(listSpecialistsWithCurrentVersion(supabase)).rejects.toThrow('db error')
  })
})

describe('getSpecialistEditorData', () => {
  it('returns specialist with current content and full version list', async () => {
    const chain = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    }
    const from = jest.fn().mockReturnValue(chain)
    const supabase = { from } as unknown as Parameters<typeof getSpecialistEditorData>[0]

    chain.single.mockResolvedValue({
      data: {
        id: 'spec-1',
        name: 'Cardiologia',
        icon: '❤️',
        current_prompt_version_id: 'v2',
        current_version: { version_number: 2, content: 'Você é um cardiologista.' },
      },
      error: null,
    })
    chain.order.mockResolvedValue({ data: VERSION_ROWS, error: null })

    const result = await getSpecialistEditorData(supabase, 'spec-1')

    expect(result).toEqual({
      id: 'spec-1',
      name: 'Cardiologia',
      icon: '❤️',
      currentVersionId: 'v2',
      currentVersionNumber: 2,
      currentContent: 'Você é um cardiologista.',
      versions: [
        { id: 'v2', versionNumber: 2, createdAt: '2026-04-28T00:00:00Z' },
        { id: 'v1', versionNumber: 1, createdAt: '2026-01-01T00:00:00Z' },
      ],
    })
  })

  it('throws when specialist fetch fails', async () => {
    const chain = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: new Error('not found') }),
    }
    const from = jest.fn().mockReturnValue(chain)
    const supabase = { from } as unknown as Parameters<typeof getSpecialistEditorData>[0]
    chain.order.mockResolvedValue({ data: [], error: null })

    await expect(getSpecialistEditorData(supabase, 'bad-id')).rejects.toThrow('not found')
  })
})
