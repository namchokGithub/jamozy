import { GoogleAuthProvider, createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut, type User } from 'firebase/auth'
import { auth } from './firebase'
import type { AuthRepository, AuthenticatedUser } from '../../domain/repositories/auth-repository'
const map = (user: User): AuthenticatedUser => ({ uid: user.uid, displayName: user.displayName })
export class FirebaseAuthRepository implements AuthRepository {
  async signUpWithEmail(email: string, password: string) { return map((await createUserWithEmailAndPassword(auth, email, password)).user) }
  async signInWithEmail(email: string, password: string) { return map((await signInWithEmailAndPassword(auth, email, password)).user) }
  async signInWithGoogle() { return map((await signInWithPopup(auth, new GoogleAuthProvider())).user) }
  signOut() { return signOut(auth) }
  getCurrentUser() { return auth.currentUser ? map(auth.currentUser) : null }
  onAuthStateChanged(listener: (user: AuthenticatedUser | null) => void) { return onAuthStateChanged(auth, (user) => listener(user ? map(user) : null)) }
}
