import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('development command', () => {
  it('starts Vite and opens Google Chrome', async () => {
    const packageJson = JSON.parse(
      await readFile('./package.json', 'utf8'),
    ) as {
      scripts: Record<string, string>
    }

    expect(packageJson.scripts.dev).toBe("BROWSER='Google Chrome' vite --open")
  })
})
