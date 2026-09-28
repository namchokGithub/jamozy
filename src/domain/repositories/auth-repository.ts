export interface AuthenticatedUser {
  uid: string
  displayName: string | null
}

export interface AuthRepository {
  signUpWithEmail(email: string, password: string): Promise<AuthenticatedUser>
  signInWithEmail(email: string, password: string): Promise<AuthenticatedUser>
  signInWithGoogle(): Promise<AuthenticatedUser>
  signOut(): Promise<void>
  getCurrentUser(): AuthenticatedUser | null
  onAuthStateChanged(listener: (user: AuthenticatedUser | null) => void): () => void
}
