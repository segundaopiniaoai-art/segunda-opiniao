import Link from 'next/link'
import { LoginForm } from '@/components/auth/login-form'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>
}) {
  const { reason } = await searchParams

  return (
    <div className="max-w-sm mx-auto py-20 px-6">
      <h1 className="text-2xl font-bold mb-8">Sign in</h1>
      {reason === 'session_expired' && (
        <p className="text-amber-700 text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          Your session expired. Please sign in again.
        </p>
      )}
      <LoginForm />
      <p className="mt-6 text-sm text-center text-gray-600">
        No account?{' '}
        <Link href="/register" className="underline text-black">
          Create one
        </Link>
      </p>
    </div>
  )
}
