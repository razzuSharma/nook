"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useMutation } from "convex/react"
import { roomInvitesApi } from "@/lib/convex-room-invites-api"
import { useAuth } from "@/components/providers/auth-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function AcceptInvitePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { sessionToken, user } = useAuth()
  const acceptInvite = useMutation(roomInvitesApi.accept)
  const [status, setStatus] = React.useState<"idle" | "joining" | "error">("idle")
  const [error, setError] = React.useState<string | null>(null)

  const token = searchParams.get("token")

  async function onAccept() {
    if (!sessionToken || !token) return
    setStatus("joining")
    setError(null)
    try {
      const result = await acceptInvite({
        sessionToken,
        token,
      })
      router.replace(`/dashboard/rooms/${result.roomId}`)
    } catch (acceptError) {
      setStatus("error")
      setError(
        acceptError instanceof Error ? acceptError.message : "Unable to accept invite."
      )
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_20%_0%,rgba(6,182,212,0.18),transparent_40%),linear-gradient(180deg,var(--nook-surface)_0%,var(--background)_100%)] px-4 py-10">
      <Card className="w-full max-w-lg border-cyan-500/20 bg-background/80 shadow-xl">
        <CardHeader>
          <CardTitle>Room Invite</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!token ? (
            <p className="text-sm text-red-600">Missing invite token.</p>
          ) : null}
          {!user ? (
            <p className="text-sm text-muted-foreground">
              Sign in, then accept this invite link to join the room.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Signed in as <span className="font-medium">{user.email}</span>.
            </p>
          )}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              disabled={!token || !sessionToken || status === "joining"}
              className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
              onClick={() => {
                void onAccept()
              }}
            >
              {status === "joining" ? "Joining..." : "Accept Invite"}
            </Button>
            {!user ? (
              <Button asChild variant="outline">
                <Link href="/sign-in">Sign in</Link>
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
