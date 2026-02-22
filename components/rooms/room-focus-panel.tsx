"use client"

import * as React from "react"
import { useQuery } from "convex/react"
import type { Id } from "@/convex/_generated/dataModel"
import { useAuth } from "@/components/providers/auth-provider"
import { roomFocusApi } from "@/lib/convex-room-focus-api"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { avatarSrcForKey } from "@/lib/avatar-options"

type PresenceItem = {
  id: string
  userId: string
  userName: string
  userEmail: string
  userAvatarKey: string
  intention: string
  endsAt: number | null
}

function formatRemaining(endsAt: number | null, now: number) {
  if (!endsAt) return "No timer"
  const seconds = Math.max(0, Math.ceil((endsAt - now) / 1000))
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

export function RoomFocusPanel({ roomId }: { roomId: Id<"rooms"> }) {
  const { sessionToken, user } = useAuth()
  const [now, setNow] = React.useState(() => Date.now())
  const presence = useQuery(
    roomFocusApi.listPresence,
    sessionToken ? { sessionToken, roomId } : "skip"
  ) as PresenceItem[] | undefined

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <Card className="border-cyan-500/20 bg-background/70">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Now Focusing</CardTitle>
      </CardHeader>
      <CardContent>
        {!presence ? (
          <p className="text-sm text-muted-foreground">Loading focus presence...</p>
        ) : presence.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No active focus sessions in this room right now.
          </p>
        ) : (
          <ul className="space-y-2">
            {presence.map((item) => (
              <li
                key={item.id}
                className="rounded-md border border-cyan-500/15 bg-cyan-500/5 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="size-8 border border-cyan-500/30">
                      <AvatarImage
                        src={avatarSrcForKey(item.userAvatarKey)}
                        alt={item.userName}
                      />
                      <AvatarFallback>
                        {item.userName
                          .split(" ")
                          .map((part) => part[0] ?? "")
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <p className="text-sm font-medium">
                      {item.userName}
                      {user?.id === item.userId ? " (You)" : ""}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {formatRemaining(item.endsAt, now)}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.intention || "Deep Work"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
