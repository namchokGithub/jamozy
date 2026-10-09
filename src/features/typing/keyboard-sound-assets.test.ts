import { describe, expect, it } from 'vitest'
import { keyboardSoundAssets } from './keyboard-sound-assets'

describe('keyboardSoundAssets', () => {
  it('resolves every bundled pack to its own Vite asset URLs', () => {
    const turquoise = keyboardSoundAssets('turquoise')
    const mxblack = keyboardSoundAssets('mxblack')
    const mxblue = keyboardSoundAssets('mxblue')

    expect(Object.keys(turquoise)).toHaveLength(12)
    expect(Object.keys(mxblack)).toHaveLength(12)
    expect(Object.keys(mxblue)).toHaveLength(6)
    expect(turquoise['press/GENERIC_R2']).toBeTruthy()
    expect(mxblack['press/GENERIC_R2']).not.toBe(turquoise['press/GENERIC_R2'])
    expect(mxblue['press/BACKSPACE']).toBeUndefined()
  })
})
