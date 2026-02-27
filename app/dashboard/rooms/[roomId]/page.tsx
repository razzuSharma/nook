"use client"

import * as React from "react"
import { useMutation, useQuery } from "convex/react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import type { Id } from "@/convex/_generated/dataModel"

import { AppSidebar } from "@/components/app-sidebar"
import { RightSidebar } from "@/components/right-sidebar"
import { SiteHeader } from "@/components/site-header"
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
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { roomsApi } from "@/lib/convex-rooms-api"
import { roomInvitesApi } from "@/lib/convex-room-invites-api"
import { roomTasksApi } from "@/lib/convex-room-tasks-api"
import { roomFocusApi } from "@/lib/convex-room-focus-api"
import { avatarSrcForKey } from "@/lib/avatar-options"
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

type RoomTaskDoc = {
  taskId: string
  title: string
  status: "todo" | "working" | "blocked" | "completed"
  assigneeUserId?: string
}

type FocusPresenceDoc = {
  userId: string
  status: "idle" | "focusing" | "break" | "done"
  intention: string
  taskId?: string
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
  const createInvite = useMutation(roomInvitesApi.create)
  const revokeInvite = useMutation(roomInvitesApi.revoke)
  const updateRoomSettings = useMutation(roomsApi.updateSettings)
  const [inviteEmail, setInviteEmail] = React.useState("")
  const [inviteRole, setInviteRole] = React.useState<"viewer" | "member" | "admin">(
    "member"
  )
  const [inviteLink, setInviteLink] = React.useState<string | null>(null)
  const [inviteError, setInviteError] = React.useState<string | null>(null)
  const [isInviteDrawerOpen, setIsInviteDrawerOpen] = React.useState(false)
  const [settingsName, setSettingsName] = React.useState("")
  const [settingsDescription, setSettingsDescription] = React.useState("")
  const [settingsAccess, setSettingsAccess] = React.useState<"public" | "private" | "invite_only">(
    "public"
  )
  const [settingsMembersMax, setSettingsMembersMax] = React.useState("8")
  const [settingsMessage, setSettingsMessage] = React.useState<string | null>(null)
  const [settingsError, setSettingsError] = React.useState<string | null>(null)

  const room = React.useMemo(
    () => rooms?.find((item) => item._id === roomId),
    [roomId, rooms]
  )
  const isJoined = room ? joinedRoomIds.includes(room._id) : false

  const roomMembersQuery = useQuery(
    roomsApi.listMembersByRoom,
    sessionToken && room && isJoined
      ? { sessionToken, roomId: room._id }
      : "skip"
  ) as
    | Array<{
    userId: string
    name: string
    role: "viewer" | "member" | "admin"
    email: string
    avatarKey: string
      }>
    | undefined
  const roomMembers = React.useMemo(() => roomMembersQuery ?? [], [roomMembersQuery])
  const roomTasksQuery = useQuery(
    roomTasksApi.listByRoom,
    room && isJoined ? { roomId: room._id } : "skip"
  ) as RoomTaskDoc[] | undefined
  const roomTasks = React.useMemo(() => roomTasksQuery ?? [], [roomTasksQuery])
  const roomFocusPresenceQuery = useQuery(
    roomFocusApi.listPresence,
    sessionToken && room && isJoined
      ? { sessionToken, roomId: room._id }
      : "skip"
  ) as FocusPresenceDoc[] | undefined
  const roomFocusPresence = React.useMemo(
    () => roomFocusPresenceQuery ?? [],
    [roomFocusPresenceQuery]
  )
  const currentMembership = React.useMemo(
    () => roomMembers.find((member) => member.userId === user?.id) ?? null,
    [roomMembers, user?.id]
  )
  const currentRole = currentMembership?.role ?? null
  const canManageInvites = currentRole === "admin"
  const canManageRoomSettings = currentRole === "admin"
  const roomInvites = (useQuery(
    roomInvitesApi.listByRoom,
    sessionToken && room && isJoined && canManageInvites
      ? { sessionToken, roomId: room._id }
      : "skip"
  ) ?? []) as RoomInvite[]
  const memberExecution = React.useMemo(() => {
    const taskById = new Map(roomTasks.map((task) => [task.taskId, task]))
    const focusByUser = new Map(
      roomFocusPresence
        .filter((item) => item.status === "focusing")
        .map((item) => [item.userId, item])
    )

    return roomMembers
      .map((member) => {
        const assigned = roomTasks.filter((task) => task.assigneeUserId === member.userId)
        const totalAssigned = assigned.length
        const completed = assigned.filter((task) => task.status === "completed").length
        const working = assigned.filter((task) => task.status === "working").length
        const blocked = assigned.filter((task) => task.status === "blocked").length
        const todo = assigned.filter((task) => task.status === "todo").length
        const progress = totalAssigned > 0 ? Math.round((completed / totalAssigned) * 100) : 0
        const focus = focusByUser.get(member.userId)
        const activeTask =
          focus?.taskId ? taskById.get(focus.taskId)?.title : working > 0 ? "In progress tasks" : null
        return {
          member,
          totalAssigned,
          completed,
          working,
          blocked,
          todo,
          progress,
          engagement: focus ? `Focusing: ${focus.intention || activeTask || "Deep work"}` : activeTask,
        }
      })
      .sort((left, right) => {
        if (right.totalAssigned !== left.totalAssigned) return right.totalAssigned - left.totalAssigned
        if (right.working !== left.working) return right.working - left.working
        return left.member.name.localeCompare(right.member.name)
      })
  }, [roomFocusPresence, roomMembers, roomTasks])

  const memberSuggestions = React.useMemo(() => {
    const suggestions: string[] = []
    const openUnassigned = roomTasks.filter(
      (task) => !task.assigneeUserId && task.status !== "completed"
    ).length
    const blocked = roomTasks.filter((task) => task.status === "blocked").length
    const assignedCounts = memberExecution.map((item) => item.totalAssigned)
    const busiest = assignedCounts.length > 0 ? Math.max(...assignedCounts) : 0
    const lightest = assignedCounts.length > 0 ? Math.min(...assignedCounts) : 0
    const topCompleter = memberExecution
      .filter((item) => item.totalAssigned >= 3)
      .sort((left, right) => right.progress - left.progress)[0]

    if (openUnassigned > 0) {
      suggestions.push(`${openUnassigned} open task(s) are unassigned. Assign owners to improve flow.`)
    }
    if (blocked > 0) {
      suggestions.push(`${blocked} blocked task(s) need unblock support in the next standup.`)
    }
    if (busiest - lightest >= 3) {
      suggestions.push("Workload is uneven across members. Rebalance assignments this week.")
    }
    if (topCompleter) {
      suggestions.push(
        `${topCompleter.member.name} has ${topCompleter.progress}% completion. Pair them on high-priority work.`
      )
    }
    if (suggestions.length === 0) {
      suggestions.push("Execution is balanced. Keep reviewing blockers and ownership daily.")
    }
    return suggestions
  }, [memberExecution, roomTasks])

  React.useEffect(() => {
    if (!room) return
    setSettingsName(room.name)
    setSettingsDescription(room.description)
    setSettingsAccess(room.access ?? "public")
    setSettingsMembersMax(String(room.membersMax))
  }, [room])

  React.useEffect(() => {
    function onOpenRoomInvite() {
      if (canManageInvites) {
        setIsInviteDrawerOpen(true)
      }
    }
    window.addEventListener("nook:open-room-invite", onOpenRoomInvite)
    return () => {
      window.removeEventListener("nook:open-room-invite", onOpenRoomInvite)
    }
  }, [canManageInvites])

  const sendInvite = React.useCallback(async () => {
    if (!room || !sessionToken || !canManageInvites) return
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
  }, [room, sessionToken, canManageInvites, createInvite, inviteEmail, inviteRole])

  const saveRoomSettings = React.useCallback(async () => {
    if (!room || !sessionToken || !canManageRoomSettings) return
    setSettingsError(null)
    setSettingsMessage(null)
    const membersMax = Number.parseInt(settingsMembersMax, 10)
    if (Number.isNaN(membersMax) || membersMax < 2 || membersMax > 30) {
      setSettingsError("Max members must be between 2 and 30.")
      return
    }
    try {
      await updateRoomSettings({
        sessionToken,
        roomId: room._id,
        name: settingsName,
        description: settingsDescription,
        access: settingsAccess,
        membersMax,
      })
      setSettingsMessage("Room settings updated.")
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "Unable to update settings.")
    }
  }, [
    room,
    sessionToken,
    canManageRoomSettings,
    settingsMembersMax,
    settingsName,
    settingsDescription,
    settingsAccess,
    updateRoomSettings,
  ])

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
        <SiteHeader
          currentPage={room ? room.name : "Room"}
          actionLabel={canManageInvites ? "Invite" : ""}
          actionEventName={canManageInvites ? "nook:open-room-invite" : ""}
        />
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
                  {currentRole ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Your role: <span className="font-medium capitalize">{currentRole}</span>
                    </p>
                  ) : null}
                  <div className="mt-4 flex items-center gap-2">
                    <Link
                      href={`/dashboard/rooms/${room._id}`}
                      className="rounded-md border border-cyan-500/35 bg-cyan-500/15 px-3 py-1.5 text-xs font-medium text-cyan-800 dark:text-cyan-200"
                    >
                      Overview
                    </Link>
                    <Link
                      href={`/dashboard/rooms/${room._id}/tasks`}
                      className="rounded-md border border-cyan-500/20 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-cyan-500/35 hover:text-foreground"
                    >
                      Task Board
                    </Link>
                  </div>
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
                              className="flex items-center gap-3 rounded-md border border-cyan-500/15 px-3 py-2"
                            >
                              <Avatar className="size-9 border border-cyan-500/30">
                                <AvatarImage
                                  src={avatarSrcForKey(member.avatarKey)}
                                  alt={member.name}
                                />
                                <AvatarFallback>
                                  {member.name
                                    .split(" ")
                                    .map((part) => part[0] ?? "")
                                    .join("")
                                    .slice(0, 2)
                                    .toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-medium">{member.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {member.email} • {member.role}
                                </p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                    <Card className="border-cyan-500/20 bg-background/70">
                      <CardHeader>
                        <CardTitle>Team Execution</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {memberExecution.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No member data available yet.</p>
                        ) : (
                          <div className="grid gap-3 md:grid-cols-2">
                            {memberExecution.map((item) => (
                              <article
                                key={item.member.userId}
                                className="rounded-lg border border-cyan-500/15 bg-cyan-500/5 p-3"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2">
                                    <Avatar className="size-9 border border-cyan-500/30">
                                      <AvatarImage
                                        src={avatarSrcForKey(item.member.avatarKey)}
                                        alt={item.member.name}
                                      />
                                      <AvatarFallback>
                                        {item.member.name
                                          .split(" ")
                                          .map((part) => part[0] ?? "")
                                          .join("")
                                          .slice(0, 2)
                                          .toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <p className="text-sm font-medium">{item.member.name}</p>
                                      <p className="text-xs text-muted-foreground capitalize">
                                        {item.member.role}
                                      </p>
                                    </div>
                                  </div>
                                  <Badge variant="secondary">{item.totalAssigned} assigned</Badge>
                                </div>
                                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-300/40 dark:bg-slate-700/60">
                                  <div
                                    className="h-full rounded-full bg-cyan-500 transition-all"
                                    style={{ width: `${item.progress}%` }}
                                  />
                                </div>
                                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                  <span>Done: {item.completed}</span>
                                  <span>In Progress: {item.working}</span>
                                  <span>Blocked: {item.blocked}</span>
                                  <span>Todo: {item.todo}</span>
                                </div>
                                <p className="mt-2 text-xs text-cyan-800 dark:text-cyan-200">
                                  {item.engagement ?? "Not currently focusing on a room task."}
                                </p>
                              </article>
                            ))}
                          </div>
                        )}
                        <div className="rounded-lg border border-cyan-500/15 bg-cyan-500/5 p-3">
                          <p className="text-sm font-medium">Suggestions</p>
                          <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                            {memberSuggestions.map((tip) => (
                              <li key={tip}>• {tip}</li>
                            ))}
                          </ul>
                        </div>
                      </CardContent>
                    </Card>
                    <RoomFocusPanel roomId={room._id} />
                    <Card className="border-cyan-500/20 bg-background/70">
                      <CardHeader>
                        <CardTitle>Room Workspace</CardTitle>
                      </CardHeader>
                      <CardContent className="flex items-center justify-between gap-3">
                        <p className="text-sm text-muted-foreground">
                          Open Task Board for task creation and kanban workflow.
                        </p>
                        <Button asChild className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">
                          <Link href={`/dashboard/rooms/${room._id}/tasks`}>
                            Open Task Board
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                    <Card className="border-cyan-500/20 bg-background/70">
                      <CardHeader>
                        <CardTitle>Room Settings</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {!canManageRoomSettings ? (
                          <p className="text-sm text-muted-foreground">
                            Only room admins can update room settings.
                          </p>
                        ) : null}
                        <div className="grid gap-3 md:grid-cols-2">
                          <Input
                            value={settingsName}
                            onChange={(event) => setSettingsName(event.target.value)}
                            placeholder="Room name"
                            disabled={!canManageRoomSettings}
                          />
                          <Input
                            value={settingsMembersMax}
                            onChange={(event) => setSettingsMembersMax(event.target.value)}
                            type="number"
                            min={2}
                            max={30}
                            placeholder="Max members"
                            disabled={!canManageRoomSettings}
                          />
                        </div>
                        <Input
                          value={settingsDescription}
                          onChange={(event) => setSettingsDescription(event.target.value)}
                          placeholder="Room description"
                          disabled={!canManageRoomSettings}
                        />
                        <Select
                          value={settingsAccess}
                          onValueChange={(value) =>
                            setSettingsAccess(value as "public" | "private" | "invite_only")
                          }
                          disabled={!canManageRoomSettings}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Access level" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="public">Public</SelectItem>
                            <SelectItem value="private">Private</SelectItem>
                            <SelectItem value="invite_only">Invite only</SelectItem>
                          </SelectContent>
                        </Select>
                        {settingsError ? <p className="text-sm text-red-600">{settingsError}</p> : null}
                        {settingsMessage ? (
                          <p className="text-sm text-emerald-600 dark:text-emerald-300">
                            {settingsMessage}
                          </p>
                        ) : null}
                        <Button
                          type="button"
                          onClick={() => {
                            void saveRoomSettings()
                          }}
                          disabled={!canManageRoomSettings}
                          className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                        >
                          Save Settings
                        </Button>
                      </CardContent>
                    </Card>
                  </>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      </SidebarInset>
      <RightSidebar />
      <Drawer open={isInviteDrawerOpen} onOpenChange={setIsInviteDrawerOpen}>
        <DrawerContent className="border-cyan-500/20">
          <DrawerHeader>
            <DrawerTitle>Invite Members</DrawerTitle>
            <DrawerDescription>
              Send invite links and manage pending invites for this room.
            </DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 px-4 pb-2">
            {!canManageInvites ? (
              <p className="text-sm text-muted-foreground">
                Only room admins can manage invites.
              </p>
            ) : null}
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="teammate@example.com"
                type="email"
                disabled={!canManageInvites}
              />
              <Select
                value={inviteRole}
                onValueChange={(value) => setInviteRole(value as "viewer" | "member" | "admin")}
                disabled={!canManageInvites}
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
                disabled={!canManageInvites}
                onClick={() => {
                  void sendInvite()
                }}
              >
                Send Invite
              </Button>
            </div>
            {inviteError ? <p className="text-sm text-red-600">{inviteError}</p> : null}
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
                          {invite.role} • expires {new Date(invite.expiresAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!canManageInvites}
                        onClick={() => {
                          if (!sessionToken || !canManageInvites) return
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
          </div>
          <DrawerFooter>
            <Button variant="outline" onClick={() => setIsInviteDrawerOpen(false)}>
              Close
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </SidebarProvider>
  )
}
