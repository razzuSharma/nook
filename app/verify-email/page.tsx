"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/components/providers/auth-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function VerifyEmailPage() {
  return (
    <React.Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_20%_0%,rgba(6,182,212,0.18),transparent_40%),linear-gradient(180deg,var(--nook-surface)_0%,var(--background)_100%)] px-4 py-10">
          <Card className="w-full max-w-md border-cyan-500/20 bg-background/80 shadow-xl">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Email verification</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center">Loading verification…</p>
            </CardContent>
          </Card>
        </main>
      }
    >
      <VerifyEmailContent />
    </React.Suspense>
  )
}

function VerifyEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { verifyEmail } = useAuth()
  const token = searchParams.get("token")
  const [status, setStatus] = React.useState<"verifying" | "success" | "error">(
    "verifying"
  )
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!token) {
      setStatus("error")
      setError("Missing verification token.")
      return
    }

    void (async () => {
      try {
        await verifyEmail(token)
        setStatus("success")
        setTimeout(() => {
          router.replace("/dashboard")
        }, 1200)
      } catch (verifyError) {
        setStatus("error")
        setError(
          verifyError instanceof Error
            ? verifyError.message
            : "Unable to verify email."
        )
      }
    })()
  }, [token, verifyEmail, router])

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_20%_0%,rgba(6,182,212,0.18),transparent_40%),linear-gradient(180deg,var(--nook-surface)_0%,var(--background)_100%)] px-4 py-10">
      <Card className="w-full max-w-md border-cyan-500/20 bg-background/80 shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Email verification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {status === "verifying" ? (
            <p className="text-sm text-muted-foreground">
              Verifying your email now...
            </p>
          ) : null}

          {status === "success" ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-300">
              Email verified successfully. Redirecting to dashboard...
            </p>
          ) : null}

          {status === "error" ? (
            <>
              <p className="text-sm text-red-600">{error ?? "Verification failed."}</p>
              <Button asChild className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">
                <Link href="/sign-in">Back to sign in</Link>
              </Button>
            </>
          ) : null}
        </CardContent>
      </Card>
    </main>
  )
}
