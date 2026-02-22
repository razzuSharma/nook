"use client"

import * as React from "react"
import { useMutation, useQuery } from "convex/react"
import { authApi } from "@/lib/convex-auth-api"

type AuthUser = {
  id: string
  name: string
  email: string
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
}

type AuthContextValue = {
  isReady: boolean
  user: AuthUser | null
  sessionToken: string | null
  signIn: (input: SignInInput) => Promise<void>
  signUp: (input: SignUpInput) => Promise<{ verificationLink: string }>
  resendVerificationEmail: (email: string) => Promise<{ verificationLink: string }>
  verifyEmail: (token: string) => Promise<void>
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
    async ({ name, email, password }: SignUpInput) => {
      const result = await signUpMutation({
        name,
        email,
        password,
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

  return (
    <AuthContext.Provider
      value={{
        isReady,
        user,
        sessionToken,
        signIn,
        signUp,
        resendVerificationEmail,
        verifyEmail,
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
