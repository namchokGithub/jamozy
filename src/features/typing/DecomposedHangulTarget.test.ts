import { afterEach, expect, test, vi } from 'vitest'
import { waitForHangulFont } from './DecomposedHangulTarget'

afterEach(() => {
  vi.unstubAllGlobals()
})

test('resolves when the web font fails to load, so the Canvas still draws', async () => {
  vi.stubGlobal('document', {
    fonts: {
      load: () => Promise.reject(new DOMException('offline', 'NetworkError')),
    },
  })
  await expect(waitForHangulFont('가')).resolves.toBeUndefined()
})
