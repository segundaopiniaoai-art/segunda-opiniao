import { saveNewVersion, restoreVersion } from '@/app/(protected)/admin/especialistas/actions'

// --- mocks ---

const mockRevalidatePath = jest.fn()
jest.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => mockRevalidatePath(...a) }))

const mockRedirect = jest.fn()
jest.mock('next/navigation', () => ({
  redirect: (url: string) => {
    mockRedirect(url)
    throw new Error(`REDIRECT:${url}`)
  },
}))

const mockRpc = jest.fn()
const mockSingle = jest.fn()
const mockGetUser = jest.fn()
const mockFrom = jest.fn().mockReturnValue({
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: (...a: unknown[]) => mockSingle(...a),
})

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({
    get auth() { return { getUser: () => mockGetUser() } },
    from: (...a: unknown[]) => mockFrom(...a),
    rpc: (...a: unknown[]) => mockRpc(...a),
  }),
}))

const SPECIALIST_ID = 'spec-uuid'
const VERSION_ID = 'ver-uuid'

function setupAdmin() {
  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  mockSingle.mockResolvedValueOnce({ data: { role: 'admin' }, error: null })
}

describe('saveNewVersion', () => {
  beforeEach(() => jest.clearAllMocks())

  it('calls create_specialist_prompt_version RPC and revalidates paths', async () => {
    setupAdmin()
    mockRpc.mockResolvedValue({ error: null })

    await saveNewVersion(SPECIALIST_ID, 'Novo conteúdo')

    expect(mockRpc).toHaveBeenCalledWith('create_specialist_prompt_version', {
      p_specialist_id: SPECIALIST_ID,
      p_content: 'Novo conteúdo',
    })
    expect(mockRevalidatePath).toHaveBeenCalledWith(`/admin/especialistas/${SPECIALIST_ID}`)
    expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/especialistas')
  })

  it('throws when RPC returns an error', async () => {
    setupAdmin()
    mockRpc.mockResolvedValue({ error: { message: 'rpc failed' } })

    await expect(saveNewVersion(SPECIALIST_ID, 'x')).rejects.toThrow('rpc failed')
  })

  it('redirects when user is not admin', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValueOnce({ data: { role: 'user' }, error: null })

    await expect(saveNewVersion(SPECIALIST_ID, 'x')).rejects.toThrow('REDIRECT:/dashboard')
  })
})

describe('restoreVersion', () => {
  beforeEach(() => jest.clearAllMocks())

  it('fetches old version content and calls RPC to create a new version', async () => {
    setupAdmin()
    mockSingle.mockResolvedValueOnce({ data: { content: 'conteúdo original' }, error: null })
    mockRpc.mockResolvedValue({ error: null })

    await restoreVersion(SPECIALIST_ID, VERSION_ID)

    expect(mockRpc).toHaveBeenCalledWith('create_specialist_prompt_version', {
      p_specialist_id: SPECIALIST_ID,
      p_content: 'conteúdo original',
    })
    expect(mockRevalidatePath).toHaveBeenCalledWith(`/admin/especialistas/${SPECIALIST_ID}`)
  })

  it('throws when version fetch fails', async () => {
    setupAdmin()
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } })

    await expect(restoreVersion(SPECIALIST_ID, VERSION_ID)).rejects.toThrow('not found')
  })
})
