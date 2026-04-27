import {
  createConsultation,
  confirmConsultationUpload,
  retryConsultation,
} from '@/actions/consultation'

const mockGetUser = jest.fn()
const mockFrom = jest.fn()
const mockStorageFrom = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    storage: { from: mockStorageFrom },
  })),
}))

const mockStartWorkflow = jest.fn()
jest.mock('@/lib/mastra/client', () => ({
  startConsultationWorkflow: (...args: unknown[]) => mockStartWorkflow(...args),
}))

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}))

beforeEach(() => {
  jest.clearAllMocks()
})

// Builder helpers for fluent Supabase chains
function makeSelectChain(returnValue: unknown) {
  const single = jest.fn().mockResolvedValue(returnValue)
  const secondEq = jest.fn().mockReturnValue({ single })
  const firstEq = jest.fn().mockReturnValue({ eq: secondEq, single })
  const select = jest.fn().mockReturnValue({ eq: firstEq })
  return { select }
}

function makeInsertChain(insertResult: unknown, selectResult?: unknown) {
  const single = jest.fn().mockResolvedValue(selectResult ?? insertResult)
  const selectFn = jest.fn().mockReturnValue({ single })
  const insert = jest.fn().mockReturnValue({ error: null, select: selectFn, ...(selectResult === undefined ? insertResult as object : {}) })
  return { insert }
}

function makeUpdateChain(returnValue: unknown) {
  const eq = jest.fn().mockResolvedValue(returnValue)
  const update = jest.fn().mockReturnValue({ eq })
  return { update }
}

function makeFileSelectChain(returnValue: unknown) {
  const eq = jest.fn().mockResolvedValue(returnValue)
  const select = jest.fn().mockReturnValue({ eq })
  return { select }
}

// ─── createConsultation ───────────────────────────────────────────────────────

describe('createConsultation', () => {
  const baseInput = {
    specialistId: 'spec-1',
    files: [{ name: 'exam.pdf', size: 1024 }],
  }

  it('returns error when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const result = await createConsultation(baseInput)

    expect(result).toEqual({ error: 'Usuário não autenticado' })
  })

  it('returns error when no files provided', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const result = await createConsultation({ ...baseInput, files: [] })

    expect(result).toEqual({ error: 'Envie pelo menos 1 arquivo PDF' })
  })

  it('returns error when more than 5 files provided', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    const files = Array.from({ length: 6 }, (_, i) => ({ name: `file${i}.pdf`, size: 1024 }))

    const result = await createConsultation({ ...baseInput, files })

    expect(result).toEqual({ error: 'Máximo de 5 arquivos permitidos' })
  })

  it('returns error when a file exceeds 10MB', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    const files = [{ name: 'big.pdf', size: 11 * 1024 * 1024 }]

    const result = await createConsultation({ ...baseInput, files })

    expect(result).toEqual({ error: 'Cada arquivo deve ter no máximo 10MB' })
  })

  it('returns error when patientContext exceeds 2000 characters', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    const patientContext = 'a'.repeat(2001)

    const result = await createConsultation({ ...baseInput, patientContext })

    expect(result).toEqual({ error: 'Contexto deve ter no máximo 2000 caracteres' })
  })

  it('returns error when specialist is not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockFrom.mockReturnValue(makeSelectChain({ data: null, error: null }).select.call(null))

    // specialist query: select → eq(id) → eq(active) → single returns null
    const specialistSingle = jest.fn().mockResolvedValue({ data: null, error: null })
    const specialistSecondEq = jest.fn().mockReturnValue({ single: specialistSingle })
    const specialistFirstEq = jest.fn().mockReturnValue({ eq: specialistSecondEq })
    const specialistSelect = jest.fn().mockReturnValue({ eq: specialistFirstEq })
    mockFrom.mockReturnValueOnce({ select: specialistSelect })

    const result = await createConsultation(baseInput)

    expect(result).toEqual({ error: 'Especialista não encontrado' })
  })

  it('returns consultationId and uploadUrls on happy path', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    // specialist query
    const specialistSingle = jest.fn().mockResolvedValue({ data: { id: 'spec-1' }, error: null })
    const specialistSecondEq = jest.fn().mockReturnValue({ single: specialistSingle })
    const specialistFirstEq = jest.fn().mockReturnValue({ eq: specialistSecondEq })
    const specialistSelect = jest.fn().mockReturnValue({ eq: specialistFirstEq })

    // consultation insert query
    const consultationSingle = jest.fn().mockResolvedValue({ data: { id: 'cons-1' }, error: null })
    const consultationSelectFn = jest.fn().mockReturnValue({ single: consultationSingle })
    const consultationInsert = jest.fn().mockReturnValue({ select: consultationSelectFn })

    // consultation_files insert query (no further chain needed — we check error)
    const filesInsert = jest.fn().mockResolvedValue({ error: null })

    mockFrom
      .mockReturnValueOnce({ select: specialistSelect })        // specialists
      .mockReturnValueOnce({ insert: consultationInsert })       // consultations
      .mockReturnValueOnce({ insert: filesInsert })              // consultation_files

    // storage createSignedUploadUrl
    const mockCreateSignedUploadUrl = jest.fn().mockResolvedValue({
      data: { signedUrl: 'https://storage.example.com/signed-url' },
      error: null,
    })
    mockStorageFrom.mockReturnValue({ createSignedUploadUrl: mockCreateSignedUploadUrl })

    const result = await createConsultation(baseInput)

    expect(result).toEqual({
      consultationId: 'cons-1',
      uploadUrls: [{ fileName: 'exam.pdf', url: 'https://storage.example.com/signed-url' }],
    })
  })
})

// ─── confirmConsultationUpload ────────────────────────────────────────────────

describe('confirmConsultationUpload', () => {
  it('returns error when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const result = await confirmConsultationUpload('cons-1')

    expect(result).toEqual({ error: 'Usuário não autenticado' })
  })

  it('returns error when consultation status is not pending', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const single = jest.fn().mockResolvedValue({ data: { id: 'cons-1', status: 'processing' }, error: null })
    const secondEq = jest.fn().mockReturnValue({ single })
    const firstEq = jest.fn().mockReturnValue({ eq: secondEq })
    const select = jest.fn().mockReturnValue({ eq: firstEq })
    mockFrom.mockReturnValueOnce({ select })

    const result = await confirmConsultationUpload('cons-1')

    expect(result).toEqual({ error: 'Esta consulta já foi confirmada' })
  })

  it('returns error when a file is missing from storage', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    // consultation select chain
    const consultationSingle = jest.fn().mockResolvedValue({ data: { id: 'cons-1', status: 'pending' }, error: null })
    const consultationSecondEq = jest.fn().mockReturnValue({ single: consultationSingle })
    const consultationFirstEq = jest.fn().mockReturnValue({ eq: consultationSecondEq })
    const consultationSelect = jest.fn().mockReturnValue({ eq: consultationFirstEq })

    // files select chain — returns a file record
    const filesEq = jest.fn().mockResolvedValue({
      data: [{ storage_path: 'user-1/cons-1/exam.pdf', file_name: 'exam.pdf' }],
      error: null,
    })
    const filesSelect = jest.fn().mockReturnValue({ eq: filesEq })

    mockFrom
      .mockReturnValueOnce({ select: consultationSelect })
      .mockReturnValueOnce({ select: filesSelect })

    // storage list returns empty — file not found
    const mockList = jest.fn().mockResolvedValue({ data: [], error: null })
    mockStorageFrom.mockReturnValue({ list: mockList })

    const result = await confirmConsultationUpload('cons-1')

    expect(result).toEqual({ error: 'Arquivos não enviados: exam.pdf' })
  })

  it('happy path: updates status to processing, triggers workflow, returns success', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockStartWorkflow.mockResolvedValue({ runId: 'run-1' })

    // consultation select
    const consultationSingle = jest.fn().mockResolvedValue({ data: { id: 'cons-1', status: 'pending' }, error: null })
    const consultationSecondEq = jest.fn().mockReturnValue({ single: consultationSingle })
    const consultationFirstEq = jest.fn().mockReturnValue({ eq: consultationSecondEq })
    const consultationSelect = jest.fn().mockReturnValue({ eq: consultationFirstEq })

    // files select
    const filesEq = jest.fn().mockResolvedValue({
      data: [{ storage_path: 'user-1/cons-1/exam.pdf', file_name: 'exam.pdf' }],
      error: null,
    })
    const filesSelect = jest.fn().mockReturnValue({ eq: filesEq })

    // update chain
    const updateEq = jest.fn().mockResolvedValue({ error: null })
    const update = jest.fn().mockReturnValue({ eq: updateEq })

    mockFrom
      .mockReturnValueOnce({ select: consultationSelect })
      .mockReturnValueOnce({ select: filesSelect })
      .mockReturnValueOnce({ update })

    // storage list — file present
    const mockList = jest.fn().mockResolvedValue({ data: [{ name: 'exam.pdf' }], error: null })
    mockStorageFrom.mockReturnValue({ list: mockList })

    const result = await confirmConsultationUpload('cons-1')

    expect(update).toHaveBeenCalledWith({ status: 'processing' })
    expect(mockStartWorkflow).toHaveBeenCalledWith('cons-1')
    expect(result).toEqual({ success: true })
  })

  it('reverts to failed and returns error when startConsultationWorkflow throws', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockStartWorkflow.mockRejectedValue(new Error('Mastra unreachable'))

    // consultation select
    const consultationSingle = jest.fn().mockResolvedValue({ data: { id: 'cons-1', status: 'pending' }, error: null })
    const consultationSecondEq = jest.fn().mockReturnValue({ single: consultationSingle })
    const consultationFirstEq = jest.fn().mockReturnValue({ eq: consultationSecondEq })
    const consultationSelect = jest.fn().mockReturnValue({ eq: consultationFirstEq })

    // files select
    const filesEq = jest.fn().mockResolvedValue({
      data: [{ storage_path: 'user-1/cons-1/exam.pdf', file_name: 'exam.pdf' }],
      error: null,
    })
    const filesSelect = jest.fn().mockReturnValue({ eq: filesEq })

    // first update (processing) chain
    const processingUpdateEq = jest.fn().mockResolvedValue({ error: null })
    const processingUpdate = jest.fn().mockReturnValue({ eq: processingUpdateEq })

    // second update (failed) chain
    const failedUpdateEq = jest.fn().mockResolvedValue({ error: null })
    const failedUpdate = jest.fn().mockReturnValue({ eq: failedUpdateEq })

    mockFrom
      .mockReturnValueOnce({ select: consultationSelect })
      .mockReturnValueOnce({ select: filesSelect })
      .mockReturnValueOnce({ update: processingUpdate })
      .mockReturnValueOnce({ update: failedUpdate })

    // storage list — file present
    const mockList = jest.fn().mockResolvedValue({ data: [{ name: 'exam.pdf' }], error: null })
    mockStorageFrom.mockReturnValue({ list: mockList })

    const result = await confirmConsultationUpload('cons-1')

    expect(failedUpdate).toHaveBeenCalledWith({
      status: 'failed',
      failure_reason: 'Não foi possível iniciar a análise. Tente novamente.',
    })
    expect(result).toEqual({ error: 'Não foi possível iniciar a análise. Tente novamente em instantes.' })
  })
})

// ─── retryConsultation ────────────────────────────────────────────────────────

describe('retryConsultation', () => {
  it('returns error when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const result = await retryConsultation('cons-1')

    expect(result).toEqual({ error: 'Usuário não autenticado' })
  })

  it('returns error when consultation status is not failed', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const single = jest.fn().mockResolvedValue({ data: { id: 'cons-1', status: 'processing' }, error: null })
    const secondEq = jest.fn().mockReturnValue({ single })
    const firstEq = jest.fn().mockReturnValue({ eq: secondEq })
    const select = jest.fn().mockReturnValue({ eq: firstEq })
    mockFrom.mockReturnValueOnce({ select })

    const result = await retryConsultation('cons-1')

    expect(result).toEqual({ error: 'Só é possível reenviar consultas com falha' })
  })

  it('happy path: clears failure fields, triggers workflow, returns success', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockStartWorkflow.mockResolvedValue({ runId: 'run-2' })

    // consultation select
    const single = jest.fn().mockResolvedValue({ data: { id: 'cons-1', status: 'failed' }, error: null })
    const secondEq = jest.fn().mockReturnValue({ single })
    const firstEq = jest.fn().mockReturnValue({ eq: secondEq })
    const select = jest.fn().mockReturnValue({ eq: firstEq })

    // update chain
    const updateEq = jest.fn().mockResolvedValue({ error: null })
    const update = jest.fn().mockReturnValue({ eq: updateEq })

    mockFrom
      .mockReturnValueOnce({ select })
      .mockReturnValueOnce({ update })

    const result = await retryConsultation('cons-1')

    expect(update).toHaveBeenCalledWith({ status: 'processing', failure_reason: null, result: null })
    expect(mockStartWorkflow).toHaveBeenCalledWith('cons-1')
    expect(result).toEqual({ success: true })
  })

  it('reverts to failed and returns error when startConsultationWorkflow throws', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockStartWorkflow.mockRejectedValue(new Error('Mastra unreachable'))

    // consultation select
    const single = jest.fn().mockResolvedValue({ data: { id: 'cons-1', status: 'failed' }, error: null })
    const secondEq = jest.fn().mockReturnValue({ single })
    const firstEq = jest.fn().mockReturnValue({ eq: secondEq })
    const select = jest.fn().mockReturnValue({ eq: firstEq })

    // first update (processing)
    const processingUpdateEq = jest.fn().mockResolvedValue({ error: null })
    const processingUpdate = jest.fn().mockReturnValue({ eq: processingUpdateEq })

    // second update (failed)
    const failedUpdateEq = jest.fn().mockResolvedValue({ error: null })
    const failedUpdate = jest.fn().mockReturnValue({ eq: failedUpdateEq })

    mockFrom
      .mockReturnValueOnce({ select })
      .mockReturnValueOnce({ update: processingUpdate })
      .mockReturnValueOnce({ update: failedUpdate })

    const result = await retryConsultation('cons-1')

    expect(failedUpdate).toHaveBeenCalledWith({
      status: 'failed',
      failure_reason: 'Não foi possível iniciar a análise. Tente novamente.',
    })
    expect(result).toEqual({ error: 'Não foi possível iniciar a análise. Tente novamente em instantes.' })
  })
})
