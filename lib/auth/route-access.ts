const PUBLIC_ONLY_PATHS = ['/login', '/register']
const PROTECTED_PREFIXES = ['/dashboard']
const ADMIN_PREFIXES = ['/admin']

export type AccessDecision =
  | { action: 'allow' }
  | { action: 'redirect'; destination: string }

export function determineAccess(
  pathname: string,
  user: { id: string } | null,
  role: string | null
): AccessDecision {
  const isPublicOnly = PUBLIC_ONLY_PATHS.includes(pathname)
  const needsAuth = [...PROTECTED_PREFIXES, ...ADMIN_PREFIXES].some((prefix) =>
    pathname.startsWith(prefix)
  )
  const isAdminPath = ADMIN_PREFIXES.some((prefix) => pathname.startsWith(prefix))

  if (user && isPublicOnly) {
    return { action: 'redirect', destination: '/dashboard' }
  }

  if (!user && needsAuth) {
    return { action: 'redirect', destination: '/login' }
  }

  if (user && isAdminPath && role !== 'admin') {
    return { action: 'redirect', destination: '/dashboard' }
  }

  return { action: 'allow' }
}
