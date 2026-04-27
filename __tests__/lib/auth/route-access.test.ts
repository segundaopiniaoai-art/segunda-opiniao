import { determineAccess } from '@/lib/auth/route-access'

const user = { id: 'user-123' }

describe('determineAccess', () => {
  describe('public paths', () => {
    it('allows unauthenticated access to landing page', () => {
      expect(determineAccess('/', null, null)).toEqual({ action: 'allow' })
    })

    it('allows authenticated user to access landing page', () => {
      expect(determineAccess('/', user, 'user')).toEqual({ action: 'allow' })
    })

    it('allows unauthenticated access to /login', () => {
      expect(determineAccess('/login', null, null)).toEqual({ action: 'allow' })
    })

    it('redirects authenticated user away from /login to /dashboard', () => {
      expect(determineAccess('/login', user, 'user')).toEqual({
        action: 'redirect',
        destination: '/dashboard',
      })
    })

  })

  describe('protected paths', () => {
    it('redirects unauthenticated user from /dashboard to /login', () => {
      expect(determineAccess('/dashboard', null, null)).toEqual({
        action: 'redirect',
        destination: '/login',
      })
    })

    it('allows authenticated user with role=user to access /dashboard', () => {
      expect(determineAccess('/dashboard', user, 'user')).toEqual({ action: 'allow' })
    })

    it('allows authenticated user with role=admin to access /dashboard', () => {
      expect(determineAccess('/dashboard', user, 'admin')).toEqual({ action: 'allow' })
    })

    it('redirects unauthenticated user from /consultas/nova to /login', () => {
      expect(determineAccess('/consultas/nova', null, null)).toEqual({
        action: 'redirect',
        destination: '/login',
      })
    })

    it('allows authenticated user to access /consultas/nova', () => {
      expect(determineAccess('/consultas/nova', user, 'user')).toEqual({ action: 'allow' })
    })

    it('redirects unauthenticated user from /consultas/some-id to /login', () => {
      expect(determineAccess('/consultas/some-id', null, null)).toEqual({
        action: 'redirect',
        destination: '/login',
      })
    })
  })

  describe('admin paths', () => {
    it('redirects unauthenticated user from /admin/users to /login', () => {
      expect(determineAccess('/admin/users', null, null)).toEqual({
        action: 'redirect',
        destination: '/login',
      })
    })

    it('redirects user with role=user from /admin/users to /dashboard', () => {
      expect(determineAccess('/admin/users', user, 'user')).toEqual({
        action: 'redirect',
        destination: '/dashboard',
      })
    })

    it('allows user with role=admin to access /admin/users', () => {
      expect(determineAccess('/admin/users', user, 'admin')).toEqual({ action: 'allow' })
    })

    it('allows admin to access /admin/costs', () => {
      expect(determineAccess('/admin/costs', user, 'admin')).toEqual({ action: 'allow' })
    })

    it('redirects user with role=user from /admin/costs to /dashboard', () => {
      expect(determineAccess('/admin/costs', user, 'user')).toEqual({
        action: 'redirect',
        destination: '/dashboard',
      })
    })

    it('redirects authenticated user with unresolved role (null) from /admin/users to /dashboard', () => {
      expect(determineAccess('/admin/users', user, null)).toEqual({
        action: 'redirect',
        destination: '/dashboard',
      })
    })
  })
})
