import { readFileSync } from 'fs'
import { resolve } from 'path'

function loadEnvFile(envPath: string) {
  try {
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      // Strip surrounding single or double quotes if any tool emitted them.
      const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
      if (!process.env[key]) {
        process.env[key] = value
      }
    }
  } catch {
    // file not found — skip
  }
}

export default function globalSetup() {
  const cwd = process.cwd()
  // .env.test.local takes priority (local Supabase for integration tests),
  // falling back to .env.local (remote/production credentials).
  loadEnvFile(resolve(cwd, '.env.test.local'))
  loadEnvFile(resolve(cwd, '.env.local'))
}
