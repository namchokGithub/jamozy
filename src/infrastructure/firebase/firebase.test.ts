import { describe, expect, it } from 'vitest'
import { auth, db, firebaseApp } from './firebase'

describe('firebase', () => {
  it('initializes the app, auth, and firestore instances', () => {
    expect(firebaseApp).toBeDefined()
    expect(auth).toBeDefined()
    expect(db).toBeDefined()
  })
})
