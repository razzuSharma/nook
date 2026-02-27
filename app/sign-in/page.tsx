"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/providers/auth-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export default function SignInPage() {
  const router = useRouter()
  const { isReady, user, signIn, resendVerificationEmail } = useAuth()
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)
  const [verificationLink, setVerificationLink] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isResending, setIsResending] = React.useState(false)

  React.useEffect(() => {
    if (!isReady) return
    if (user) {
      router.replace("/dashboard")
    }
  }, [isReady, user, router])

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setVerificationLink(null)
    setIsSubmitting(true)
    try {
      await signIn({ email, password })
      router.replace("/dashboard")
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to sign in.")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function onResendVerification() {
    setError(null)
    setNotice(null)
    setVerificationLink(null)
    setIsResending(true)
    try {
      const result = await resendVerificationEmail(email)
      if (result.verificationLink) setVerificationLink(result.verificationLink)
      setNotice("If this email can receive verification, we sent a verification link.")
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to resend verification email."
      )
    } finally {
      setIsResending(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_20%_0%,rgba(6,182,212,0.2),transparent_40%),linear-gradient(180deg,var(--nook-surface)_0%,var(--background)_100%)] px-4 py-10">
      <Card className="w-full max-w-md border-cyan-500/20 bg-background/80 shadow-xl">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl">Sign in to Nook</CardTitle>
          <p className="text-sm text-muted-foreground">
            Use your email and password to open your workspace.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="email">
                Email
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="password">
                Password
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {notice ? <p className="text-sm text-emerald-600">{notice}</p> : null}
            {error?.toLowerCase().includes("verify your email") ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={isResending || !email.trim()}
                onClick={() => {
                  void onResendVerification()
                }}
              >
                {isResending ? "Resending..." : "Resend verification email"}
              </Button>
            ) : null}
            <Button
              type="submit"
              className="w-full bg-cyan-500 text-slate-950 hover:bg-cyan-400"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Signing in..." : "Sign In"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Forgot password?{" "}
              <Link href="/forgot-password" className="font-medium text-cyan-700 dark:text-cyan-300">
                Reset it
              </Link>
            </p>
          </form>
          {verificationLink ? (
            <div className="mt-4 rounded-md border border-cyan-500/30 bg-cyan-500/10 p-3 text-sm">
              <p className="font-medium">Verification link generated.</p>
              <p className="mt-1 text-muted-foreground">
                Check your email. For local/dev fallback, open this link:
              </p>
              <a
                href={verificationLink}
                className="mt-2 block break-all text-cyan-700 underline dark:text-cyan-300"
              >
                {verificationLink}
              </a>
            </div>
          ) : null}
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Need an account?{" "}
            <Link href="/sign-up" className="font-medium text-cyan-700 dark:text-cyan-300">
              Create one
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
