"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/providers/auth-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export default function SignUpPage() {
  const router = useRouter()
  const { isReady, user, signUp } = useAuth()
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [verificationLink, setVerificationLink] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!isReady) return
    if (user) {
      router.replace("/dashboard")
    }
  }, [isReady, user, router])

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setVerificationLink(null)
    setIsSubmitting(true)
    try {
      const result = await signUp({ name, email, password })
      setVerificationLink(result.verificationLink)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to sign up.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_20%_0%,rgba(20,184,166,0.18),transparent_40%),linear-gradient(180deg,var(--nook-surface)_0%,var(--background)_100%)] px-4 py-10">
      <Card className="w-full max-w-md border-cyan-500/20 bg-background/80 shadow-xl">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl">Create your account</CardTitle>
          <p className="text-sm text-muted-foreground">
            Sign up with email/password, then verify your email.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="name">
                Name
              </label>
              <Input
                id="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Alex Rivers"
              />
            </div>
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
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
                minLength={6}
                required
              />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button
              type="submit"
              className="w-full bg-cyan-500 text-slate-950 hover:bg-cyan-400"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating account..." : "Create account and send verification email"}
            </Button>
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
            Already have an account?{" "}
            <Link href="/sign-in" className="font-medium text-cyan-700 dark:text-cyan-300">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
