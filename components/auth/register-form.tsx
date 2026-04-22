'use client'

import { useActionState } from 'react'
import { register } from '@/actions/auth'

const initialState = { error: null }

export function RegisterForm() {
  const [state, formAction, isPending] = useActionState(register, initialState)

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}
      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-1">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-black text-white py-2 rounded-lg font-medium text-sm disabled:opacity-50"
      >
        {isPending ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  )
}
