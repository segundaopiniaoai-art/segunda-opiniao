import { NextRequest } from 'next/server'

const mockExchangeCodeForSession = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      auth: {
        exchangeCodeForSession: mockExchangeCodeForSession,
      },
    })
  ),
}))

import { GET } from '@/app/auth/callback/route'

function makeRequest(url: string) {
  return new NextRequest(new URL(url, 'http://localhost:3000'))
}

describe('GET /auth/callback', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('redirects to /dashboard on valid code', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null })
    const response = await GET(makeRequest('/auth/callback?code=valid-code'))
    expect(response.status).toBe(307)
    expect(new URL(response.headers.get('location')!).pathname).toBe('/dashboard')
  })

  it('redirects to /login with error when code is missing', async () => {
    const response = await GET(makeRequest('/auth/callback'))
    expect(response.status).toBe(307)
    const location = new URL(response.headers.get('location')!)
    expect(location.pathname).toBe('/login')
    expect(location.searchParams.get('error')).toBe('auth_failed')
  })

  it('redirects to /login with error when exchange fails', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      error: new Error('invalid code'),
    })
    const response = await GET(makeRequest('/auth/callback?code=bad-code'))
    expect(response.status).toBe(307)
    const location = new URL(response.headers.get('location')!)
    expect(location.pathname).toBe('/login')
    expect(location.searchParams.get('error')).toBe('auth_failed')
  })
})
