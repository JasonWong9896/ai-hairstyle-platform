import { api } from './api'

export type AuthUser = {
  id: string
  email: string
  name: string | null
  role: AuthRole
  emailVerified: boolean
  createdAt: string
}

export type AuthRole = 'customer' | 'salon' | 'stylist'

export type AuthResponse = {
  token: string
  user: AuthUser
}

export type RegisterResponse = {
  emailVerificationRequired: true
  email: string
  role: AuthRole
}

export type AuthInput = {
  email: string
  password: string
  name?: string
  role?: AuthRole
}

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000

export async function login(input: AuthInput) {
  const res = await api.post<AuthResponse>('/auth/login', input)
  return res.data
}

export async function register(input: AuthInput) {
  const res = await api.post<RegisterResponse>('/auth/register', input)
  return res.data
}

export async function confirmEmail(token: string) {
  const res = await api.post<{ confirmed: true }>('/auth/confirm-email', { token })
  return res.data
}

export async function resendConfirmation(input: Pick<AuthInput, 'email' | 'role'>) {
  const res = await api.post<RegisterResponse>('/auth/resend-confirmation', input)
  return res.data
}

export async function requestPasswordReset(input: Pick<AuthInput, 'email' | 'role'>) {
  const res = await api.post<{ resetRequested: true }>('/auth/forgot-password', input)
  return res.data
}

export async function resetPassword(input: {
  token?: string
  email?: string
  role?: AuthRole
  code?: string
  newPassword: string
}) {
  const res = await api.post<{ reset: true }>('/auth/reset-password', input)
  return res.data
}

export async function changePassword(
  input: { currentPassword: string; newPassword: string },
  role?: AuthRole,
) {
  const token = getAuthToken(role)
  const res = await api.patch(
    '/auth/password',
    input,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    },
  )

  return res.data
}

export async function changeEmail(
  input: { newEmail: string; currentPassword: string },
  role?: AuthRole,
) {
  const token = getAuthToken(role)
  const res = await api.patch<AuthResponse>(
    '/auth/email',
    input,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    },
  )

  saveAuth(res.data)
  return res.data
}

export function saveAuth(auth: AuthResponse) {
  const role = auth.user.role
  localStorage.setItem(authKey(role, 'token'), auth.token)
  localStorage.setItem(authKey(role, 'user'), JSON.stringify(auth.user))
  localStorage.setItem(authKey(role, 'expiresAt'), String(Date.now() + SESSION_DURATION_MS))
  localStorage.setItem('activeAuthRole', role)
  clearLegacyAuth()
}

export function clearAuth(role?: AuthRole) {
  const roleToClear = role ?? getActiveAuthRole()

  if (roleToClear) {
    clearRoleAuth(roleToClear)
    if (localStorage.getItem('activeAuthRole') === roleToClear) {
      const nextRole = (['customer', 'salon', 'stylist'] as const).find((item) =>
        isAuthSessionActive(item),
      )
      if (nextRole) {
        localStorage.setItem('activeAuthRole', nextRole)
      } else {
        localStorage.removeItem('activeAuthRole')
      }
    }
    return
  }

  clearLegacyAuth()
  localStorage.removeItem('activeAuthRole')
}

export function getStoredAuthUser(role?: AuthRole): AuthUser | null {
  if (typeof window === 'undefined' || !isAuthSessionActive(role)) {
    return null
  }

  const sessionRole = role ?? getActiveAuthRole()
  const raw = sessionRole
    ? localStorage.getItem(authKey(sessionRole, 'user'))
    : localStorage.getItem('authUser')
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    clearAuth(role)
    return null
  }
}

export function getAuthToken(role?: AuthRole): string | null {
  if (typeof window === 'undefined' || !isAuthSessionActive(role)) {
    return null
  }

  const sessionRole = role ?? getActiveAuthRole()
  return sessionRole
    ? localStorage.getItem(authKey(sessionRole, 'token'))
    : localStorage.getItem('authToken')
}

export function authHeaders(role?: AuthRole) {
  const token = getAuthToken(role)
  return token ? { Authorization: `Bearer ${token}` } : undefined
}

export function isAuthSessionActive(role?: AuthRole) {
  if (typeof window === 'undefined') {
    return false
  }

  const sessionRole = role ?? getActiveAuthRole()
  if (!sessionRole) {
    return migrateLegacySession(role)
  }

  const token = localStorage.getItem(authKey(sessionRole, 'token'))
  const expiresAt = Number(localStorage.getItem(authKey(sessionRole, 'expiresAt')) ?? 0)

  if (!token || !expiresAt || expiresAt <= Date.now()) {
    clearRoleAuth(sessionRole)
    return false
  }

  return true
}

function authKey(role: AuthRole, key: 'token' | 'user' | 'expiresAt') {
  return `auth:${role}:${key}`
}

function clearRoleAuth(role: AuthRole) {
  localStorage.removeItem(authKey(role, 'token'))
  localStorage.removeItem(authKey(role, 'user'))
  localStorage.removeItem(authKey(role, 'expiresAt'))
}

function clearLegacyAuth() {
  localStorage.removeItem('authToken')
  localStorage.removeItem('authUser')
  localStorage.removeItem('authExpiresAt')
}

function getActiveAuthRole(): AuthRole | null {
  const activeRole = localStorage.getItem('activeAuthRole')
  if (isAuthRole(activeRole)) {
    return activeRole
  }

  return legacyAuthRole()
}

function legacyAuthRole(): AuthRole | null {
  const raw = localStorage.getItem('authUser')
  if (!raw) {
    return null
  }

  try {
    const user = JSON.parse(raw) as Partial<AuthUser>
    return isAuthRole(user.role) ? user.role : null
  } catch {
    clearLegacyAuth()
    return null
  }
}

function migrateLegacySession(role?: AuthRole) {
  const legacyRole = legacyAuthRole()
  if (!legacyRole || (role && legacyRole !== role)) {
    return false
  }

  const token = localStorage.getItem('authToken')
  const user = localStorage.getItem('authUser')
  const expiresAt = Number(localStorage.getItem('authExpiresAt') ?? 0)
  if (!token || !user || !expiresAt || expiresAt <= Date.now()) {
    clearLegacyAuth()
    return false
  }

  localStorage.setItem(authKey(legacyRole, 'token'), token)
  localStorage.setItem(authKey(legacyRole, 'user'), user)
  localStorage.setItem(authKey(legacyRole, 'expiresAt'), String(expiresAt))
  localStorage.setItem('activeAuthRole', legacyRole)
  clearLegacyAuth()
  return true
}

function isAuthRole(value: unknown): value is AuthRole {
  return value === 'customer' || value === 'salon' || value === 'stylist'
}
