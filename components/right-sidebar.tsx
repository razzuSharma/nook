"use client"

import * as React from "react"
import { useMutation, useQuery } from "convex/react"
import {
  Bell,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Target,
  Users,
} from "lucide-react"
import { useAuth } from "@/components/providers/auth-provider"
import { tasksApi } from "@/lib/convex-tasks-api"
import { roomTasksApi } from "@/lib/convex-room-tasks-api"
import { focusSessionsApi } from "@/lib/convex-focus-sessions-api"
import { roomsApi } from "@/lib/convex-rooms-api"
import { notificationsApi } from "@/lib/convex-notifications-api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type TaskDoc = {
  taskId: string
  title: string
  dueDate: string
  dueTime: string
  status: "todo" | "working" | "completed"
}

type AssignedRoomTask = {
  taskId: string
  title: string
  priority: "low" | "medium" | "high"
  status: "todo" | "working" | "blocked" | "completed"
  dueAt?: number
  roomName: string
}

type FocusSessionDoc = {
  durationMinutes: number
  createdAt: number
}

type RoomListItem = {
  _id: string
  name: string
  membersCount: number
}

type ViewerNotificationResult = {
  unreadCount: number
  items: Array<{
    id: string
    title: string
    message: string
    roomId?: string
    taskId?: string
    readAt: number | null
    createdAt: number
  }>
}

const COLLAPSED_STORAGE_KEY = "nook.right.sidebar.collapsed.v1"

function startOfToday() {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return now.getTime()
}

function startOfTomorrow() {
  return startOfToday() + 24 * 60 * 60 * 1000
}

function formatDue(timestamp?: number) {
  if (!timestamp) return "No due"
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function RightSidebar() {
  const { user, sessionToken } = useAuth()
  const [collapsed, setCollapsed] = React.useState(false)
  const [hasLoadedCollapsedPref, setHasLoadedCollapsedPref] = React.useState(false)
  const [notificationsOpen, setNotificationsOpen] = React.useState(false)
  const collapsedStorageKey = React.useMemo(
    () => `${COLLAPSED_STORAGE_KEY}:${user?.id ?? "guest"}`,
    [user?.id]
  )

  const focusSessions = useQuery(
    focusSessionsApi.list,
    sessionToken ? { sessionToken } : "skip"
  ) as FocusSessionDoc[] | undefined
  const personalTasks = useQuery(
    tasksApi.list,
    sessionToken ? { sessionToken } : "skip"
  ) as TaskDoc[] | undefined
  const assignedTasks = useQuery(
    roomTasksApi.listAssignedByUser,
    user?.id ? { userId: user.id } : "skip"
  ) as AssignedRoomTask[] | undefined
  const roomDocs = useQuery(roomsApi.list) as RoomListItem[] | undefined
  const notifications = useQuery(
    notificationsApi.listByViewer,
    sessionToken ? { sessionToken, limit: 20 } : "skip"
  ) as ViewerNotificationResult | undefined
  const markAllNotificationsRead = useMutation(notificationsApi.markAllRead)

  React.useEffect(() => {
    const saved = window.localStorage.getItem(collapsedStorageKey)
    if (saved === "1") {
      setCollapsed(true)
    } else {
      // First visit defaults to expanded.
      setCollapsed(false)
    }
    setHasLoadedCollapsedPref(true)
  }, [collapsedStorageKey])

  React.useEffect(() => {
    if (!hasLoadedCollapsedPref) return
    window.localStorage.setItem(collapsedStorageKey, collapsed ? "1" : "0")
  }, [collapsed, collapsedStorageKey, hasLoadedCollapsedPref])

  const todayFocusHours = React.useMemo(() => {
    const today = startOfToday()
    const minutes = (focusSessions ?? [])
      .filter((session) => session.createdAt >= today)
      .reduce((sum, session) => sum + session.durationMinutes, 0)
    return Number((minutes / 60).toFixed(1))
  }, [focusSessions])
  const focusGoalHours = 6
  const focusPercent = Math.min(100, Math.round((todayFocusHours / focusGoalHours) * 100))

  const myAssignedTasks = React.useMemo(() => {
    return (assignedTasks ?? []).filter((task) => task.status !== "completed").slice(0, 6)
  }, [assignedTasks])

  const upcoming = React.useMemo(() => {
    const from = startOfToday()
    const to = startOfTomorrow() + 24 * 60 * 60 * 1000
    return (personalTasks ?? [])
      .filter((task) => task.status !== "completed" && task.dueDate)
      .map((task) => ({
        ...task,
        dueAt: new Date(`${task.dueDate}T${task.dueTime || "09:00"}`).getTime(),
      }))
      .filter((task) => !Number.isNaN(task.dueAt) && task.dueAt >= from && task.dueAt < to)
      .sort((a, b) => a.dueAt - b.dueAt)
      .slice(0, 5)
  }, [personalTasks])

  const activeMembersPreview = React.useMemo(() => {
    return (roomDocs ?? [])
      .filter((room) => room.membersCount > 0)
      .sort((a, b) => b.membersCount - a.membersCount)
      .slice(0, 6)
      .map((room, index) => ({
        key: room._id,
        initials: room.name
          .split(" ")
          .map((part) => part[0] ?? "")
          .join("")
          .slice(0, 2)
          .toUpperCase(),
        color:
          index % 3 === 0
            ? "bg-emerald-500"
            : index % 3 === 1
              ? "bg-amber-500"
              : "bg-cyan-500",
      }))
  }, [roomDocs])

  const totalOnlineCount = React.useMemo(() => {
    return (roomDocs ?? []).reduce((sum, room) => sum + room.membersCount, 0)
  }, [roomDocs])

  const actions = [
    { icon: Bell, label: "Notifications", onClick: () => setNotificationsOpen(true) },
  ]

  return (
    <aside className="fixed top-0 right-0 z-40 hidden h-screen md:flex">
      <div
        className={`overflow-hidden border-l border-cyan-500/15 bg-background/65 backdrop-blur-md transition-[width,opacity] duration-300 ${
          collapsed ? "w-0 opacity-0" : "w-80 opacity-100"
        }`}
      >
        <div className="flex h-full flex-col px-3 pb-3 pt-16">
          <div className="space-y-4 overflow-y-auto pr-1">
            <section className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Target className="size-4 text-cyan-700 dark:text-cyan-300" />
                Today&apos;s Focus
              </div>
              <div className="text-sm text-muted-foreground">
                {todayFocusHours}h / {focusGoalHours}h
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-cyan-500/15">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-400"
                  style={{ width: `${focusPercent}%` }}
                />
              </div>
            </section>

            <section className="rounded-xl border border-cyan-500/20 bg-background/60 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <ClipboardList className="size-4 text-cyan-700 dark:text-cyan-300" />
                My Tasks
              </div>
              <div className="space-y-2">
                {myAssignedTasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No assigned tasks across rooms.</p>
                ) : (
                  myAssignedTasks.map((task) => (
                    <div key={`${task.roomName}-${task.taskId}`} className="rounded-md border border-cyan-500/15 px-2 py-1.5">
                      <p className="line-clamp-1 text-sm">{task.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {task.roomName} • {formatDue(task.dueAt)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-xl border border-cyan-500/20 bg-background/60 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Users className="size-4 text-cyan-700 dark:text-cyan-300" />
                Active Members
              </div>
              <p className="text-xs text-muted-foreground">{totalOnlineCount} active now</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {activeMembersPreview.map((member) => (
                  <div key={member.key} className="relative inline-flex size-8 items-center justify-center rounded-full border border-cyan-500/20 bg-cyan-100/70 text-[10px] font-semibold text-cyan-900 dark:bg-cyan-900/35 dark:text-cyan-100">
                    {member.initials}
                    <span className={`absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border border-background ${member.color}`} />
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-cyan-500/20 bg-background/60 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <CalendarClock className="size-4 text-cyan-700 dark:text-cyan-300" />
                Upcoming
              </div>
              <div className="space-y-2">
                {upcoming.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nothing due today or tomorrow.</p>
                ) : (
                  upcoming.map((task) => (
                    <div key={task.taskId} className="rounded-md border border-cyan-500/15 px-2 py-1.5">
                      <p className="line-clamp-1 text-sm">{task.title}</p>
                      <p className="text-[11px] text-muted-foreground">{formatDue(task.dueAt)}</p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </div>

      <div className="flex h-full w-14 flex-col border-l border-cyan-500/15 bg-background/40 backdrop-blur-md lg:w-16">
        <div className="flex flex-1 flex-col items-center gap-6 py-4 pt-16">
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-cyan-500/10 hover:text-cyan-600 dark:hover:text-cyan-400"
                  onClick={() => setCollapsed((prev) => !prev)}
                >
                  {collapsed ? <ChevronLeft className="size-5" /> : <ChevronRight className="size-5" />}
                  <span className="sr-only">Toggle right panel</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" className="bg-slate-900 text-slate-50">
                <p>{collapsed ? "Open panel" : "Collapse panel"}</p>
              </TooltipContent>
            </Tooltip>

            {actions.map((action) => (
              <Tooltip key={action.label}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className={`relative flex size-10 items-center justify-center rounded-xl transition-colors hover:bg-cyan-500/10 hover:text-cyan-600 dark:hover:text-cyan-400 ${
                      action.label === "Notifications" && notificationsOpen
                        ? "bg-cyan-500/15 text-cyan-600 dark:text-cyan-300"
                        : "text-muted-foreground"
                    }`}
                    onClick={action.onClick}
                  >
                    <action.icon className="size-5" />
                    {action.label === "Notifications" && (notifications?.unreadCount ?? 0) > 0 ? (
                      <span className="absolute mt-[-16px] ml-[18px] inline-flex min-w-4 items-center justify-center rounded-full bg-cyan-500 px-1 text-[10px] font-semibold text-slate-950">
                        {Math.min(9, notifications?.unreadCount ?? 0)}
                      </span>
                    ) : null}
                    <span className="sr-only">{action.label}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" className="bg-slate-900 text-slate-50">
                  <p>{action.label}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        </div>

      </div>
      <Sheet open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b border-cyan-500/15 px-5 py-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <SheetTitle>Notifications</SheetTitle>
                <SheetDescription>Assignment alerts and updates.</SheetDescription>
              </div>
              <Badge variant="secondary">{notifications?.unreadCount ?? 0} unread</Badge>
            </div>
          </SheetHeader>
          <div className="flex h-full flex-col px-4 py-3">
            <div className="mb-3 flex justify-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!sessionToken || !notifications || notifications.unreadCount === 0}
                onClick={() => {
                  if (!sessionToken) return
                  void markAllNotificationsRead({ sessionToken })
                }}
              >
                Mark all read
              </Button>
            </div>
            <div className="space-y-2 overflow-y-auto">
              {!notifications ? (
                <p className="text-sm text-muted-foreground">Loading notifications...</p>
              ) : notifications.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No notifications yet.</p>
              ) : (
                notifications.items.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{item.title}</p>
                      {!item.readAt ? <Badge variant="secondary">new</Badge> : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{item.message}</p>
                  </article>
                ))
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </aside>
  )
}
