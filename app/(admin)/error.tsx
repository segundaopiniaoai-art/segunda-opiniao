'use client'

export default function AdminError({
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="text-center py-20">
      <h2 className="text-xl font-semibold mb-4">Something went wrong</h2>
      <button
        onClick={reset}
        className="bg-white text-gray-900 px-4 py-2 rounded-lg text-sm"
      >
        Try again
      </button>
    </div>
  )
}
