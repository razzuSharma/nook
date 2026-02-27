"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/components/providers/auth-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export default function ResetPasswordPage() {
  return (
    <React.Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordContent />
    </React.Suspense>
  )
}

function ResetPasswordFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_20%_0%,rgba(6,182,212,0.2),transparent_40%),linear-gradient(180deg,var(--nook-surface)_0%,var(--background)_100%)] px-4 py-10">
      <Card className="w-full max-w-md border-cyan-500/20 bg-background/80 shadow-xl">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Loading reset form...
        </CardContent>
      </Card>
    </main>
  )
}

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { resetPassword } = useAuth()
  const token = searchParams.get("token")
  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    if (!token) {
      setError("Missing password reset token.")
      return
    }
    if (password.trim().length < 6) {
      setError("Password must be at least 6 characters.")
      return
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setIsSubmitting(true)
    try {
      await resetPassword(token, password)
      setNotice("Password reset successful. Redirecting to sign in...")
      setTimeout(() => {
        router.replace("/sign-in")
      }, 1000)
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to reset password."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_20%_0%,rgba(6,182,212,0.2),transparent_40%),linear-gradient(180deg,var(--nook-surface)_0%,var(--background)_100%)] px-4 py-10">
      <Card className="w-full max-w-md border-cyan-500/20 bg-background/80 shadow-xl">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl">Choose new password</CardTitle>
          <p className="text-sm text-muted-foreground">
            Set a new password for your account.
          </p>
        </CardHeader>
        <CardContent>
          {!token ? (
            <div className="space-y-3">
              <p className="text-sm text-red-600">Missing password reset token.</p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/forgot-password">Request another link</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="password">
                  New password
                </label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 6 characters"
                  minLength={6}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="confirmPassword">
                  Confirm new password
                </label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repeat password"
                  minLength={6}
                  required
                />
              </div>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              {notice ? <p className="text-sm text-emerald-600">{notice}</p> : null}
              <Button
                type="submit"
                className="w-full bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Resetting..." : "Reset password"}
              </Button>
            </form>
          )}
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Back to{" "}
            <Link href="/sign-in" className="font-medium text-cyan-700 dark:text-cyan-300">
              sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
