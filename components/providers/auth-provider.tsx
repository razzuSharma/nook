"use client"

import * as React from "react"
import { useMutation, useQuery } from "convex/react"
import { authApi } from "@/lib/convex-auth-api"

type AuthUser = {
  id: string
  name: string
  email: string
  avatarKey: string
  customAvatarUrl?: string
  username: string
  roleTitle: string
  timezone: string
  bio: string
  status: "available" | "busy" | "deep_work" | "offline"
  workingHours: string
  notificationEmail: boolean
  notificationInApp: boolean
  digestFrequency: "off" | "daily" | "weekly"
  themePreference: "system" | "light" | "dark"
  defaultRoomId?: string
  emailVerified: boolean
}

type SignInInput = {
  email: string
  password: string
}

type SignUpInput = {
  name: string
  email: string
  password: string
  avatarKey: string
}

type AuthContextValue = {
  isReady: boolean
  user: AuthUser | null
  sessionToken: string | null
  signIn: (input: SignInInput) => Promise<void>
  signUp: (input: SignUpInput) => Promise<{ verificationLink: string }>
  resendVerificationEmail: (email: string) => Promise<{ verificationLink: string }>
  requestPasswordReset: (email: string) => Promise<{ message: string }>
  resetPassword: (token: string, newPassword: string) => Promise<void>
  verifyEmail: (token: string) => Promise<void>
  updateProfile: (input: {
    name: string
    avatarKey: string
    customAvatarUrl?: string
    username?: string
    roleTitle?: string
    timezone?: string
    bio?: string
    status?: "available" | "busy" | "deep_work" | "offline"
    workingHours?: string
    notificationEmail?: boolean
    notificationInApp?: boolean
    digestFrequency?: "off" | "daily" | "weekly"
    themePreference?: "system" | "light" | "dark"
    defaultRoomId?: string
  }) => Promise<void>
  signOut: () => Promise<void>
}

const SESSION_STORAGE_KEY = "nook.auth.session.token.v1"
const AuthContext = React.createContext<AuthContextValue | null>(null)

function getSiteUrl() {
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin
  }
  return process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "http://localhost:3000"
}

function readStoredToken() {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(SESSION_STORAGE_KEY)
}

function writeStoredToken(token: string) {
  window.localStorage.setItem(SESSION_STORAGE_KEY, token)
}

function clearStoredToken() {
  window.localStorage.removeItem(SESSION_STORAGE_KEY)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [sessionToken, setSessionToken] = React.useState<string | null>(null)
  const [storageReady, setStorageReady] = React.useState(false)

  const signInMutation = useMutation(authApi.signIn)
  const signUpMutation = useMutation(authApi.signUp)
  const verifyEmailMutation = useMutation(authApi.verifyEmail)
  const resendVerificationMutation = useMutation(authApi.resendVerificationEmail)
  const requestPasswordResetMutation = useMutation(authApi.requestPasswordReset)
  const resetPasswordMutation = useMutation(authApi.resetPassword)
  const updateProfileMutation = useMutation(authApi.updateProfile)
  const signOutMutation = useMutation(authApi.signOut)

  React.useEffect(() => {
    setSessionToken(readStoredToken())
    setStorageReady(true)
  }, [])

  React.useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== SESSION_STORAGE_KEY) return
      setSessionToken(readStoredToken())
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const viewer = useQuery(authApi.viewer, sessionToken ? { sessionToken } : "skip")
  const isReady = storageReady && (sessionToken ? viewer !== undefined : true)

  const user = React.useMemo<AuthUser | null>(() => {
    if (!viewer) return null
    return {
      id: viewer.id,
      name: viewer.name,
      email: viewer.email,
      avatarKey: viewer.avatarKey,
      customAvatarUrl: viewer.customAvatarUrl,
      username: viewer.username,
      roleTitle: viewer.roleTitle,
      timezone: viewer.timezone,
      bio: viewer.bio,
      status: viewer.status,
      workingHours: viewer.workingHours,
      notificationEmail: viewer.notificationEmail,
      notificationInApp: viewer.notificationInApp,
      digestFrequency: viewer.digestFrequency,
      themePreference: viewer.themePreference,
      defaultRoomId: viewer.defaultRoomId,
      emailVerified: viewer.emailVerified,
    }
  }, [viewer])

  React.useEffect(() => {
    if (!storageReady) return
    if (sessionToken && viewer === null) {
      clearStoredToken()
      setSessionToken(null)
    }
  }, [storageReady, sessionToken, viewer])

  const signIn = React.useCallback(
    async ({ email, password }: SignInInput) => {
      const result = await signInMutation({ email, password })
      writeStoredToken(result.sessionToken)
      setSessionToken(result.sessionToken)
    },
    [signInMutation]
  )

  const signUp = React.useCallback(
    async ({ name, email, password, avatarKey }: SignUpInput) => {
      const result = await signUpMutation({
        name,
        email,
        password,
        avatarKey,
        siteUrl: getSiteUrl(),
      })
      return { verificationLink: result.verificationLink }
    },
    [signUpMutation]
  )

  const resendVerificationEmail = React.useCallback(
    async (email: string) => {
      const result = await resendVerificationMutation({
        email,
        siteUrl: getSiteUrl(),
      })
      return { verificationLink: result.verificationLink }
    },
    [resendVerificationMutation]
  )

  const requestPasswordReset = React.useCallback(
    async (email: string) => {
      const result = await requestPasswordResetMutation({
        email,
        siteUrl: getSiteUrl(),
      })
      return { message: result.message }
    },
    [requestPasswordResetMutation]
  )

  const resetPassword = React.useCallback(
    async (token: string, newPassword: string) => {
      await resetPasswordMutation({ token, newPassword })
    },
    [resetPasswordMutation]
  )

  const verifyEmail = React.useCallback(
    async (token: string) => {
      const result = await verifyEmailMutation({ token })
      writeStoredToken(result.sessionToken)
      setSessionToken(result.sessionToken)
    },
    [verifyEmailMutation]
  )

  const signOut = React.useCallback(async () => {
    const currentToken = readStoredToken()
    if (currentToken) {
      await signOutMutation({ sessionToken: currentToken })
    }
    clearStoredToken()
    setSessionToken(null)
  }, [signOutMutation])

  const updateProfile = React.useCallback(
    async ({
      name,
      avatarKey,
      customAvatarUrl,
      username,
      roleTitle,
      timezone,
      bio,
      status,
      workingHours,
      notificationEmail,
      notificationInApp,
      digestFrequency,
      themePreference,
      defaultRoomId,
    }: {
      name: string
      avatarKey: string
      customAvatarUrl?: string
      username?: string
      roleTitle?: string
      timezone?: string
      bio?: string
      status?: "available" | "busy" | "deep_work" | "offline"
      workingHours?: string
      notificationEmail?: boolean
      notificationInApp?: boolean
      digestFrequency?: "off" | "daily" | "weekly"
      themePreference?: "system" | "light" | "dark"
      defaultRoomId?: string
    }) => {
      if (!sessionToken) {
        throw new Error("Not signed in.")
      }
      await updateProfileMutation({
        sessionToken,
        name,
        avatarKey,
        customAvatarUrl,
        username,
        roleTitle,
        timezone,
        bio,
        status,
        workingHours,
        notificationEmail,
        notificationInApp,
        digestFrequency,
        themePreference,
        defaultRoomId,
      })
    },
    [sessionToken, updateProfileMutation]
  )

  return (
    <AuthContext.Provider
      value={{
        isReady,
        user,
        sessionToken,
        signIn,
        signUp,
        resendVerificationEmail,
        requestPasswordReset,
        resetPassword,
        verifyEmail,
        updateProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = React.useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.")
  }
  return context
}
