"use client"

import * as React from "react"
import { useQuery } from "convex/react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import type { Id } from "@/convex/_generated/dataModel"

import { AppSidebar } from "@/components/app-sidebar"
import { RightSidebar } from "@/components/right-sidebar"
import { SiteHeader } from "@/components/site-header"
import { RoomTaskBoard } from "@/components/rooms/room-task-board"
import type { RoomTaskFocusTarget } from "@/components/rooms/room-task-board"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { roomsApi } from "@/lib/convex-rooms-api"
import { useAuth } from "@/components/providers/auth-provider"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

type RoomDoc = {
  _id: Id<"rooms">
  name: string
  description: string
}

export default function RoomTasksPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const params = useParams<{ roomId: string }>()
  const roomId = params.roomId

  const rooms = useQuery(roomsApi.list) as RoomDoc[] | undefined
  const joinedRoomIds = (useQuery(
    roomsApi.joinedRoomIdsByUser,
    user ? { userId: user.id } : "skip"
  ) ?? []) as Id<"rooms">[]

  const room = React.useMemo(
    () => rooms?.find((item) => item._id === roomId),
    [roomId, rooms]
  )
  const isJoined = room ? joinedRoomIds.includes(room._id) : false
  const initialDueFilter = React.useMemo(() => {
    const due = searchParams.get("due")
    if (due === "overdue" || due === "today" || due === "week" || due === "none") {
      return due
    }
    return "all"
  }, [searchParams])
  const initialStatusFilter = React.useMemo(() => {
    const status = searchParams.get("status")
    if (
      status === "open" ||
      status === "todo" ||
      status === "working" ||
      status === "blocked" ||
      status === "completed"
    ) {
      return status
    }
    return "all"
  }, [searchParams])

  const startFocusFromTask = React.useCallback(
    (task: RoomTaskFocusTarget) => {
      if (!room) return
      const query = new URLSearchParams({
        roomId: room._id,
        taskId: task.id,
        intention: task.title,
      })
      router.push(`/dashboard/focus?${query.toString()}`)
    },
    [room, router]
  )

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 64)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="sidebar" />
      <SidebarInset className="overflow-hidden bg-[radial-gradient(circle_at_20%_-10%,rgba(6,182,212,0.2),transparent_35%),radial-gradient(circle_at_95%_5%,rgba(20,184,166,0.2),transparent_35%),linear-gradient(180deg,#f4fbfc_0%,#eef9fb_100%)] dark:bg-[radial-gradient(circle_at_20%_-10%,rgba(6,182,212,0.22),transparent_35%),radial-gradient(circle_at_95%_5%,rgba(20,184,166,0.2),transparent_35%),linear-gradient(180deg,#05171a_0%,#031116_100%)]">
        <SiteHeader currentPage={room ? `${room.name} • Tasks` : "Room Tasks"} />
        <div className="flex flex-1 flex-col px-4 py-5 md:px-6 md:py-6 lg:pr-20">
          <div className="mx-auto w-full max-w-6xl space-y-5">
            {!rooms ? (
              <Card className="border-cyan-500/20 bg-background/70">
                <CardContent className="py-8 text-sm text-muted-foreground">
                  Loading room...
                </CardContent>
              </Card>
            ) : null}

            {rooms && !room ? (
              <Card className="border-red-500/20 bg-background/70">
                <CardContent className="space-y-3 py-8">
                  <p className="text-sm text-muted-foreground">Room not found.</p>
                  <Link
                    href="/dashboard"
                    className="text-sm font-medium text-cyan-700 hover:text-cyan-600 dark:text-cyan-300"
                  >
                    Back to Dashboard
                  </Link>
                </CardContent>
              </Card>
            ) : null}

            {room ? (
              <>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                    {room.name}
                  </h1>
                  <p className="mt-2 text-muted-foreground">{room.description}</p>
                  <div className="mt-4 flex items-center gap-2">
                    <Link
                      href={`/dashboard/rooms/${room._id}`}
                      className="rounded-md border border-cyan-500/20 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-cyan-500/35 hover:text-foreground"
                    >
                      Overview
                    </Link>
                    <Link
                      href={`/dashboard/rooms/${room._id}/tasks`}
                      className="rounded-md border border-cyan-500/35 bg-cyan-500/15 px-3 py-1.5 text-xs font-medium text-cyan-800 dark:text-cyan-200"
                    >
                      Task Board
                    </Link>
                  </div>
                </div>

                {!isJoined ? (
                  <Card className="border-amber-500/20 bg-background/70">
                    <CardHeader>
                      <CardTitle>Join Required</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                      <p>Join this room to access its task board.</p>
                      <Button
                        type="button"
                        onClick={() => router.push(`/dashboard/rooms/${room._id}`)}
                        className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                      >
                        Back to Overview
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <RoomTaskBoard
                    roomId={room._id}
                    onStartFocusTask={startFocusFromTask}
                    initialDueFilter={initialDueFilter}
                    initialStatusFilter={initialStatusFilter}
                  />
                )}
              </>
            ) : null}
          </div>
        </div>
      </SidebarInset>
      <RightSidebar />
    </SidebarProvider>
  )
}
