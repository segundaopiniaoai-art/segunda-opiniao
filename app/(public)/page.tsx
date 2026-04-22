import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="max-w-4xl mx-auto py-24 px-6 text-center">
      <h1 className="text-5xl font-bold mb-6">AI Agent Platform</h1>
      <p className="text-xl text-gray-600 mb-10">
        Automate your workflows with intelligent AI agents powered by Claude.
      </p>
      <div className="flex gap-4 justify-center">
        <Link
          href="/register"
          className="bg-black text-white px-6 py-3 rounded-lg font-medium"
        >
          Get started free
        </Link>
        <Link href="/login" className="border px-6 py-3 rounded-lg font-medium">
          Sign in
        </Link>
      </div>
    </div>
  )
}
