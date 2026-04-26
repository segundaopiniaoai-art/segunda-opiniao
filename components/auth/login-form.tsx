'use client'

import { loginWithGoogle } from '@/actions/auth'

export function LoginForm() {
  return (
    <form action={loginWithGoogle}>
      <button
        type="submit"
        className="w-full bg-black text-white py-2 rounded-lg font-medium text-sm hover:bg-gray-800 transition-colors"
      >
        Entrar com Google
      </button>
    </form>
  )
}
