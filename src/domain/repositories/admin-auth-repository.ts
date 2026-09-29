export interface AdminAuthRepository {
  isCurrentUserAdmin(): Promise<boolean>
}
