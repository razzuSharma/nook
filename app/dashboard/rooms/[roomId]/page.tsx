"use client"

import * as React from "react"
import { useMutation, useQuery } from "convex/react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import type { Id } from "@/convex/_generated/dataModel"

import { AppSidebar } from "@/components/app-sidebar"
import { RightSidebar } from "@/components/right-sidebar"
import { SiteHeader } from "@/components/site-header"
import { RoomTaskBoard } from "@/components/rooms/room-task-board"
import type { RoomTaskFocusTarget } from "@/components/rooms/room-task-board"
import { RoomFocusPanel } from "@/components/rooms/room-focus-panel"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { roomsApi } from "@/lib/convex-rooms-api"
import { roomInvitesApi } from "@/lib/convex-room-invites-api"
import { useAuth } from "@/components/providers/auth-provider"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

type RoomDoc = {
  _id: Id<"rooms">
  name: string
  description: string
  mode: string
  access?: "public" | "private" | "invite_only"
  membersCount: number
  membersMax: number
  joinCode?: string
}

type RoomInvite = {
  _id: Id<"roomInvites">
  email: string
  role: "viewer" | "member" | "admin"
  status: "pending" | "accepted" | "revoked" | "expired"
  expiresAt: number
}

export default function RoomPage() {
  const router = useRouter()
  const { user, sessionToken } = useAuth()
  const params = useParams<{ roomId: string }>()
  const roomId = params.roomId

  const rooms = useQuery(roomsApi.list) as RoomDoc[] | undefined
  const joinedRoomIds = (useQuery(
    roomsApi.joinedRoomIdsByUser,
    user ? { userId: user.id } : "skip"
  ) ?? []) as Id<"rooms">[]
  const ensureDefaults = useMutation(roomsApi.ensureDefaults)
  const createInvite = useMutation(roomInvitesApi.create)
  const revokeInvite = useMutation(roomInvitesApi.revoke)
  const [inviteEmail, setInviteEmail] = React.useState("")
  const [inviteRole, setInviteRole] = React.useState<"viewer" | "member" | "admin">(
    "member"
  )
  const [inviteLink, setInviteLink] = React.useState<string | null>(null)
  const [inviteError, setInviteError] = React.useState<string | null>(null)

  const room = React.useMemo(
    () => rooms?.find((item) => item._id === roomId),
    [roomId, rooms]
  )
  const isJoined = room ? joinedRoomIds.includes(room._id) : false

  const roomInvites = (useQuery(
    roomInvitesApi.listByRoom,
    sessionToken && room && isJoined
      ? { sessionToken, roomId: room._id }
      : "skip"
  ) ?? []) as RoomInvite[]
  const roomMembers = (useQuery(
    roomsApi.listMembersByRoom,
    sessionToken && room && isJoined
      ? { sessionToken, roomId: room._id }
      : "skip"
  ) ?? []) as Array<{
    userId: string
    name: string
    role: "viewer" | "member" | "admin"
    email: string
    avatarKey: string
  }>

  React.useEffect(() => {
    void ensureDefaults({})
  }, [ensureDefaults])


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

  const sendInvite = React.useCallback(async () => {
    if (!room || !sessionToken) return
    setInviteError(null)
    setInviteLink(null)
    try {
      const result = await createInvite({
        sessionToken,
        roomId: room._id,
        email: inviteEmail,
        role: inviteRole,
        siteUrl: window.location.origin,
      })
      setInviteLink(result.inviteLink)
      setInviteEmail("")
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : "Unable to send invite.")
    }
  }, [room, sessionToken, createInvite, inviteEmail, inviteRole])

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
        <SiteHeader currentPage={room ? room.name : "Room"} actionLabel="Invite" />
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
                  <div className="mt-4">
                    <Button
                      type="button"
                      className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                      onClick={() => {
                        const query = new URLSearchParams({ roomId: room._id })
                        router.push(`/dashboard/focus?${query.toString()}`)
                      }}
                    >
                      Start Room Focus
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <Card className="border-cyan-500/20 bg-cyan-500/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Mode</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Badge className="bg-cyan-500/20 text-cyan-800 dark:text-cyan-300">
                        {room.mode}
                      </Badge>
                    </CardContent>
                  </Card>
                  <Card className="border-cyan-500/20 bg-cyan-500/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Members</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-lg font-semibold">
                        {room.membersCount}/{room.membersMax}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-cyan-500/20 bg-cyan-500/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Join Code</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-lg font-semibold">
                        {(room.access ?? "public") === "public" ? (room.joinCode ?? "N/A") : "N/A"}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-cyan-500/20 bg-cyan-500/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Access</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-lg font-semibold">
                        {(room.access ?? "public") === "invite_only"
                          ? "Invite Only"
                          : (room.access ?? "public") === "private"
                            ? "Private"
                            : "Public"}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {isJoined ? (
                  <Card className="border-cyan-500/20 bg-background/70">
                    <CardHeader>
                      <CardTitle>Invite Members</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-3">
                        <Input
                          value={inviteEmail}
                          onChange={(event) => setInviteEmail(event.target.value)}
                          placeholder="teammate@example.com"
                          type="email"
                        />
                        <Select
                          value={inviteRole}
                          onValueChange={(value) =>
                            setInviteRole(value as "viewer" | "member" | "admin")
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewer">Viewer</SelectItem>
                            <SelectItem value="member">Member</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                          onClick={() => {
                            void sendInvite()
                          }}
                        >
                          Send Invite
                        </Button>
                      </div>
                      {inviteError ? (
                        <p className="text-sm text-red-600">{inviteError}</p>
                      ) : null}
                      {inviteLink ? (
                        <div className="rounded-md border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-xs">
                          <p className="font-medium">Invite link (dev fallback)</p>
                          <a
                            href={inviteLink}
                            className="mt-1 block break-all text-cyan-700 underline dark:text-cyan-300"
                          >
                            {inviteLink}
                          </a>
                        </div>
                      ) : null}
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Pending invites</p>
                        {roomInvites.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No pending invites.</p>
                        ) : (
                          <ul className="space-y-2">
                            {roomInvites.map((invite) => (
                              <li
                                key={invite._id}
                                className="flex items-center justify-between rounded-md border border-cyan-500/15 px-3 py-2 text-sm"
                              >
                                <div>
                                  <p className="font-medium">{invite.email}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {invite.role} • expires{" "}
                                    {new Date(invite.expiresAt).toLocaleDateString()}
                                  </p>
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    if (!sessionToken) return
                                    void revokeInvite({
                                      sessionToken,
                                      inviteId: invite._id,
                                    })
                                  }}
                                >
                                  Revoke
                                </Button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ) : null}

                {!isJoined ? (
                  <Card className="border-amber-500/20 bg-background/70">
                    <CardHeader>
                      <CardTitle>Join Required</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                      <p>Join this room to see live focus presence and room tasks.</p>
                      <Button
                        type="button"
                        onClick={() => router.push("/dashboard")}
                        className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                      >
                        Back to Rooms
                      </Button>
                    </CardContent>
                  </Card>
                ) : null}

                <Card className="border-cyan-500/20 bg-background/70">
                  <CardHeader>
                    <CardTitle>Room Workspace</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>Manage room-specific work with assignees and status flow.</p>
                  </CardContent>
                </Card>
                {isJoined ? (
                  <>
                    <Card className="border-cyan-500/20 bg-background/70">
                      <CardHeader>
                        <CardTitle>Room Members</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="grid gap-2 md:grid-cols-2">
                          {roomMembers.map((member) => (
                            <li
                              key={member.userId}
                              className="rounded-md border border-cyan-500/15 px-3 py-2"
                            >
                              <p className="text-sm font-medium">{member.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {member.email} • {member.role}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                    <RoomFocusPanel roomId={room._id} />
                    <RoomTaskBoard
                      roomId={room._id}
                      onStartFocusTask={startFocusFromTask}
                    />
                  </>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </SidebarInset>
      <RightSidebar />
    </SidebarProvider>
  )
}
