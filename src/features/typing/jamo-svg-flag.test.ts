import { afterEach, expect, test, vi } from 'vitest'
import {
  isJamoSvgRendererEnabled,
  JAMO_SVG_RENDERER_STORAGE_KEY,
} from './jamo-svg-flag'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  localStorage.clear()
})

test('production uses only the build flag', () => {
  vi.stubEnv('DEV', false)
  vi.stubEnv('VITE_JAMO_SVG_RENDERER', '1')
  localStorage.setItem(JAMO_SVG_RENDERER_STORAGE_KEY, '0')
  expect(isJamoSvgRendererEnabled()).toBe(true)
  vi.stubEnv('VITE_JAMO_SVG_RENDERER', '')
  localStorage.setItem(JAMO_SVG_RENDERER_STORAGE_KEY, '1')
  expect(isJamoSvgRendererEnabled()).toBe(false)
})

test('development lets localStorage override the build flag', () => {
  vi.stubEnv('DEV', true)
  vi.stubEnv('VITE_JAMO_SVG_RENDERER', '')
  expect(isJamoSvgRendererEnabled()).toBe(false)
  localStorage.setItem(JAMO_SVG_RENDERER_STORAGE_KEY, '1')
  expect(isJamoSvgRendererEnabled()).toBe(true)
  vi.stubEnv('VITE_JAMO_SVG_RENDERER', '1')
  localStorage.setItem(JAMO_SVG_RENDERER_STORAGE_KEY, '0')
  expect(isJamoSvgRendererEnabled()).toBe(false)
})

test('unavailable storage means no override', () => {
  vi.stubEnv('DEV', true)
  vi.stubEnv('VITE_JAMO_SVG_RENDERER', '1')
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  expect(isJamoSvgRendererEnabled()).toBe(true)
})
