import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx)$/.test(name) ? [path] : []
  })
}

describe('frontend secrets', () => {
  it('does not embed a service-role key or credential', () => {
    const files = sourceFiles('src')
    expect(files.length).toBeGreaterThan(10)
    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      expect(text, file).not.toMatch(/service_role/i)
      expect(text, file).not.toMatch(/SUPABASE_SERVICE/i)
      expect(text, file).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/)
    }
  })

  it('keeps the example environment free of a real key', () => {
    const example = readFileSync('.env.example', 'utf8')
    expect(example).toContain('VITE_SUPABASE_ANON_KEY=')
    expect(example).not.toMatch(/eyJ/)
    expect(example).toContain('https://ptjtiexrgwjomvaefouo.supabase.co')
  })
})
