import { LoginForm } from '@/components/auth/login-form'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; error?: string }>
}) {
  const { reason, error } = await searchParams

  return (
    <div className="max-w-sm mx-auto py-20 px-6">
      <h1 className="text-2xl font-bold mb-8">Entrar</h1>
      {reason === 'session_expired' && (
        <p className="text-amber-700 text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          Sua sessão expirou. Por favor, entre novamente.
        </p>
      )}
      {error === 'auth_failed' && (
        <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
          Falha na autenticação. Por favor, tente novamente.
        </p>
      )}
      <LoginForm />
    </div>
  )
}
