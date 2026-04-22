import Link from 'next/link'
import { RegisterForm } from '@/components/auth/register-form'

export default function RegisterPage() {
  return (
    <div className="max-w-sm mx-auto py-20 px-6">
      <h1 className="text-2xl font-bold mb-8">Create account</h1>
      <RegisterForm />
      <p className="mt-6 text-sm text-center text-gray-600">
        Already have an account?{' '}
        <Link href="/login" className="underline text-black">
          Sign in
        </Link>
      </p>
    </div>
  )
}
