import '@testing-library/jest-dom/vitest'

// Tests must not depend on a developer's .env.local: the Jamo SVG renderer
// flag stays off unless a test turns it on.
vi.stubEnv('VITE_JAMO_SVG_RENDERER', '')
