"use client"

import * as React from "react"
import { useMutation, useQuery } from "convex/react"
import {
  ArrowRight,
  ArrowUpRight,
  ClipboardList,
  Flame,
  Keyboard,
  MessageSquare,
  Target,
  Timer,
} from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { RightSidebar } from "@/components/right-sidebar"
import { ActivityFeed } from "@/components/recent-activity/activity-feed"
import { recentActivityItems } from "@/components/recent-activity/data"
import { RoomsGrid } from "@/components/rooms/rooms-grid"
import { SiteHeader } from "@/components/site-header"
import { useAuth } from "@/components/providers/auth-provider"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { roomsApi } from "@/lib/convex-rooms-api"
import { roomTasksApi } from "@/lib/convex-room-tasks-api"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import type { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"

const DASHBOARD_ONBOARDING_KEY = "nook.dashboard.onboarding.v1"
const APP_BOOT_TIME = Date.now()

const metrics = [
  {
    label: "FOCUSED TIME",
    value: "4.2h",
    trend: "↑ 12% vs last week",
    points: [26, 32, 30, 35, 38, 44, 42],
  },
  {
    label: "TEAM VELOCITY",
    value: "92%",
    trend: "↑ 8% vs last week",
    points: [58, 62, 65, 68, 74, 88, 92],
  },
  {
    label: "ACTIVE COLLABORATORS",
    value: "14",
    trend: "↑ 2 active now",
    points: [6, 8, 7, 10, 12, 13, 14],
  },
]

type RoomListItem = {
  _id: Id<"rooms">
  name: string
  createdAt: number
}

type AssignedRoomTask = {
  taskId: string
  title: string
  priority: "low" | "medium" | "high"
  status: "todo" | "working" | "blocked" | "completed"
  dueAt?: number
  roomName: string
}

function formatPlanDue(dueAt?: number) {
  if (!dueAt) return "No deadline"
  const now = Date.now()
  if (dueAt < now) return "Overdue"
  return `Due ${new Date(dueAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })}`
}

function Sparkline({ points }: { points: number[] }) {
  const width = 88
  const height = 22
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const path = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * width
      const y = height - ((point - min) / range) * height
      return `${index === 0 ? "M" : "L"}${x},${y}`
    })
    .join(" ")

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <path d={path} fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

export default function Page() {
  const { user } = useAuth()
  const firstName = user?.name?.trim().split(/\s+/)[0] ?? "there"
  const userId = user?.id
  const roomDocs = useQuery(roomsApi.list) as RoomListItem[] | undefined
  const joinedRoomIdsQuery = useQuery(
    roomsApi.joinedRoomIdsByUser,
    userId ? { userId } : "skip"
  ) as Id<"rooms">[] | undefined
  const joinedRoomIds = React.useMemo(
    () => joinedRoomIdsQuery ?? [],
    [joinedRoomIdsQuery]
  )
  const createQuickTask = useMutation(roomTasksApi.createQuickTask)
  const assignedTasksQuery = useQuery(
    roomTasksApi.listAssignedByUser,
    userId ? { userId } : "skip"
  ) as AssignedRoomTask[] | undefined
  const [quickTask, setQuickTask] = React.useState("")
  const [focusGoalHours] = React.useState(6)
  const [onboardingOpen, setOnboardingOpen] = React.useState(false)

  const latestJoinedRoomId = React.useMemo(() => {
    const sortedByRecency = [...(roomDocs ?? [])].sort(
      (left, right) => right.createdAt - left.createdAt
    )
    return sortedByRecency.find((room) => joinedRoomIds.includes(room._id))?._id
  }, [roomDocs, joinedRoomIds])

  const focusedHours = 4.2
  const focusPercent = Math.min(100, Math.round((focusedHours / focusGoalHours) * 100))
  const todayPlan = React.useMemo(() => {
    const scoreTask = (task: AssignedRoomTask) => {
      let score = 0
      if (task.status === "working") score += 35
      else if (task.status === "todo") score += 25
      else if (task.status === "blocked") score += 8

      if (task.priority === "high") score += 20
      else if (task.priority === "medium") score += 10

      if (!task.dueAt) return score + 2
      const delta = task.dueAt - APP_BOOT_TIME
      if (delta <= 0) return score + 30
      if (delta <= 24 * 60 * 60 * 1000) return score + 20
      if (delta <= 3 * 24 * 60 * 60 * 1000) return score + 10
      return score + 4
    }

    return (assignedTasksQuery ?? [])
      .filter((task) => task.status !== "completed")
      .sort((left, right) => scoreTask(right) - scoreTask(left))
      .slice(0, 3)
  }, [assignedTasksQuery])

  React.useEffect(() => {
    const userKey = `${DASHBOARD_ONBOARDING_KEY}:${userId ?? "guest"}`
    const seen = window.localStorage.getItem(userKey)
    if (!seen) setOnboardingOpen(true)
  }, [userId])

  function completeOnboarding() {
    const userKey = `${DASHBOARD_ONBOARDING_KEY}:${userId ?? "guest"}`
    window.localStorage.setItem(userKey, "done")
    setOnboardingOpen(false)
  }

  async function submitQuickTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = quickTask.trim()
    if (!title || !latestJoinedRoomId || !userId) return
    await createQuickTask({
      roomId: latestJoinedRoomId,
      userId,
      title,
    })
    setQuickTask("")
    toast("Task added", {
      description: "Added to your most recent active room.",
    })
  }

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
        <SiteHeader />
        <div className="flex flex-1 flex-col px-4 py-5 md:px-6 md:py-6 lg:pr-20">
          <div className="mx-auto w-full max-w-6xl">
            <div className="mb-6">
              <h1 className="bg-gradient-to-r from-teal-700 via-cyan-700 to-teal-500 bg-clip-text text-4xl font-semibold tracking-tight text-transparent dark:from-cyan-200 dark:via-teal-200 dark:to-cyan-400 md:text-5xl">
                Good afternoon, {firstName}.
              </h1>
              <p className="mt-2 text-muted-foreground">
                Ready for focused collaboration? You have 3 rooms active today.
              </p>
            </div>

            <form
              onSubmit={(event) => {
                void submitQuickTask(event)
              }}
              className="mb-5 flex flex-col gap-2 rounded-2xl border border-cyan-500/20 bg-background/75 p-3 backdrop-blur sm:flex-row sm:items-center"
            >
              <div
                className="flex items-center text-cyan-700 dark:text-cyan-300"
                aria-hidden
              >
                <Flame className="size-4" />
              </div>
              <Input
                value={quickTask}
                onChange={(event) => setQuickTask(event.target.value)}
                placeholder={
                  latestJoinedRoomId
                    ? "What are you working on today?"
                    : "Join a room to start adding tasks"
                }
                aria-label="Quick task input"
                disabled={!latestJoinedRoomId}
                className="h-9 border-cyan-500/25 bg-cyan-500/5"
              />
              <Button
                type="submit"
                disabled={!quickTask.trim() || !latestJoinedRoomId}
                className="h-9 bg-cyan-500 text-slate-950 hover:bg-cyan-400"
              >
                Add Task
              </Button>
            </form>

            <div className="mb-8 grid gap-4 md:grid-cols-3">
              {metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3.5 backdrop-blur"
                >
                  <p className="text-xs font-semibold tracking-wide text-cyan-900/60 dark:text-cyan-100/70">
                    {metric.label}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-2xl font-semibold">{metric.value}</span>
                    <div className="text-cyan-700 dark:text-cyan-300">
                      <Sparkline points={metric.points} />
                    </div>
                  </div>
                  <div className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    <ArrowUpRight className="size-3.5" />
                    {metric.trend}
                  </div>
                </div>
              ))}
            </div>

            <div className="mb-8 rounded-2xl border border-cyan-500/20 bg-background/70 p-4 backdrop-blur">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="size-4 text-cyan-700 dark:text-cyan-300" />
                  <h2 className="text-base font-semibold">Daily Focus Goal</h2>
                </div>
                <Badge className="bg-cyan-500/20 text-cyan-700 dark:text-cyan-300">
                  {focusedHours.toFixed(1)}h / {focusGoalHours}h
                </Badge>
              </div>
              <div className="relative h-1.5 rounded-full bg-cyan-500/10">
                <div
                  className="relative h-full rounded-full bg-gradient-to-r from-cyan-500 to-teal-400 transition-all"
                  style={{ width: `${focusPercent}%` }}
                >
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 rounded-full border border-cyan-500/30 bg-background px-1.5 py-0 text-[10px] font-semibold text-cyan-700 dark:text-cyan-300">
                    {focusPercent}%
                  </span>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {focusPercent}% complete. Keep the streak alive.
              </p>
            </div>

            <section className="mb-8 rounded-2xl border border-cyan-500/20 bg-background/70 p-4 backdrop-blur">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Today Plan</h2>
                  <p className="text-xs text-muted-foreground">
                    Top work to finish today from your assigned room tasks.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!latestJoinedRoomId}
                  onClick={() => {
                    if (!latestJoinedRoomId) return
                    window.location.href = `/dashboard/rooms/${latestJoinedRoomId}/tasks`
                  }}
                >
                  Open Room Tasks
                </Button>
              </div>
              {todayPlan.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No assigned tasks yet. Join a room and assign your first task.
                </p>
              ) : (
                <ul className="space-y-2">
                  {todayPlan.map((task, index) => (
                    <li
                      key={`${task.roomName}-${task.taskId}`}
                      className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-3 py-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium">
                          {index + 1}. {task.title}
                        </p>
                        <div className="flex items-center gap-1">
                          <Badge variant="secondary" className="capitalize">
                            {task.status === "working" ? "In Progress" : task.status}
                          </Badge>
                          <Badge variant="outline" className="capitalize">
                            {task.priority}
                          </Badge>
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {task.roomName} • {formatPlanDue(task.dueAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <RoomsGrid />

            <div className="mt-10">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-2xl font-semibold">Recent Activity</h2>
                <a
                  href="/dashboard/recent-activity"
                  className="text-sm font-medium text-cyan-700 hover:text-cyan-600 dark:text-cyan-300 dark:hover:text-cyan-200"
                >
                  View Timeline
                </a>
              </div>
              <ActivityFeed
                items={recentActivityItems}
                suggestions={[
                  "Enter your first room ->",
                  "Invite a teammate ->",
                  "Try Deep Work Mode ->",
                ]}
              />
            </div>

            <div className="fixed right-20 bottom-5 z-30 hidden rounded-full border border-cyan-500/35 bg-background/90 p-2 shadow-sm backdrop-blur md:flex">
              <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
                <span className="inline-flex size-5 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-300">
                  <Keyboard className="size-3.5" />
                </span>
                <span>Shortcuts: N new room, F focus mode</span>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
      <RightSidebar />
      <Dialog open={onboardingOpen} onOpenChange={setOnboardingOpen}>
        <DialogContent
          className="sm:max-w-[580px]"
          overlayClassName="bg-black/65 backdrop-blur-[3px]"
        >
          <DialogHeader>
            <DialogTitle>Your daily flow in 3 steps</DialogTitle>
            <DialogDescription>
              Plan, focus, and unblock without switching apps.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-1 text-sm">
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Step 1 of 3</span>
              <div className="flex items-center gap-1.5" aria-hidden>
                <span className="h-1.5 w-5 rounded-full bg-cyan-500" />
                <span className="h-1.5 w-5 rounded-full bg-cyan-500/25" />
                <span className="h-1.5 w-5 rounded-full bg-cyan-500/25" />
              </div>
            </div>
            <div className="rounded-lg border border-cyan-500/20 border-l-4 border-l-cyan-500 bg-cyan-500/5 p-4">
              <p className="flex items-center gap-2 font-medium">
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-300">
                  1
                </span>
                <ClipboardList className="size-4 text-cyan-700 dark:text-cyan-300" />
                Pick today&apos;s top tasks
              </p>
              <p className="mt-2 text-muted-foreground">
                Use the Today Plan and task board to lock in the top priorities.
              </p>
            </div>
            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4">
              <p className="flex items-center gap-2 font-medium">
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-300">
                  2
                </span>
                <Timer className="size-4 text-cyan-700 dark:text-cyan-300" />
                Start focused work from the task
              </p>
              <p className="mt-2 text-muted-foreground">
                Open a room task and start focus directly from that card.
              </p>
            </div>
            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4">
              <p className="flex items-center gap-2 font-medium">
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-300">
                  3
                </span>
                <MessageSquare className="size-4 text-cyan-700 dark:text-cyan-300" />
                Resolve blockers in task discussion
              </p>
              <p className="mt-2 text-muted-foreground">
                Keep chat, files, and history attached to the task to reduce context switching.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              onClick={completeOnboarding}
              className="gap-1.5 bg-cyan-500 text-slate-950 hover:bg-cyan-400"
            >
              Continue to Dashboard
              <ArrowRight className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                completeOnboarding()
                window.dispatchEvent(new Event("nook:create-room"))
              }}
            >
              Create Room
            </Button>
          </DialogFooter>
          <button
            type="button"
            className="mx-auto mt-1 block text-xs text-muted-foreground underline"
            onClick={completeOnboarding}
          >
            Don&apos;t show again
          </button>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  )
}
