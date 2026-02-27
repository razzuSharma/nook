"use client"

import * as React from "react"
import Link from "next/link"
import { useMutation, useQuery } from "convex/react"
import {
  ArrowRight,
  ArrowUpRight,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  Flame,
  Pin,
  Target,
  Timer,
} from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { RightSidebar } from "@/components/right-sidebar"
import { ActivityFeed } from "@/components/recent-activity/activity-feed"
import type { ActivityItem } from "@/components/recent-activity/data"
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
import { roomFocusApi } from "@/lib/convex-room-focus-api"
import { focusSessionsApi } from "@/lib/convex-focus-sessions-api"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import type { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"

const DASHBOARD_ONBOARDING_KEY = "nook.dashboard.onboarding.v1"
const DASHBOARD_PLAN_ORDER_KEY = "nook.dashboard.today-plan.order.v1"
const DASHBOARD_PLAN_PINNED_KEY = "nook.dashboard.today-plan.pinned.v1"
const DASHBOARD_REVIEW_KEY = "nook.dashboard.daily-review.v1"
const APP_BOOT_TIME = Date.now()

type RoomListItem = {
  _id: Id<"rooms">
  name: string
  createdAt: number
  membersCount: number
}

type AssignedRoomTask = {
  taskId: string
  title: string
  priority: "low" | "medium" | "high"
  status: "todo" | "working" | "blocked" | "completed"
  dueAt?: number
  roomName: string
}

type RoomTaskMetricDoc = {
  taskId: string
  status: "todo" | "working" | "blocked" | "completed"
  dueAt?: number
  createdAt: number
  updatedAt: number
  completedAt?: number
  assigneeUserId?: string
}

type FocusSessionDoc = {
  durationMinutes: number
  createdAt: number
  completedAt: string
  outcome?: "done" | "progress" | "blocked"
}

type FocusPresenceDoc = {
  userId: string
  status: "idle" | "focusing" | "break" | "done"
  endsAt: number | null
}

type RoomActivityEventDoc = {
  id: string
  taskTitle: string
  type: string
  createdAt: number
  actorName: string
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

function formatDelta(current: number, previous: number, suffix = "") {
  if (previous <= 0 && current <= 0) return `No change${suffix}`
  if (previous <= 0) return `Up ${current}${suffix}`
  const delta = Math.round(((current - previous) / previous) * 100)
  if (delta === 0) return `Flat${suffix}`
  return `${delta > 0 ? "Up" : "Down"} ${Math.abs(delta)}%${suffix}`
}

function startOfDay(timestamp: number) {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function dayIndex(windowStart: number, timestamp: number) {
  return Math.floor((timestamp - windowStart) / (24 * 60 * 60 * 1000))
}

function formatRelativeTime(timestamp: number, now: number) {
  const seconds = Math.max(1, Math.floor((now - timestamp) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const mins = Math.floor(seconds / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function initialsFromName(name: string) {
  return name
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function RoomMetricsCollector({
  roomId,
  sessionToken,
  onTasks,
  onPresence,
}: {
  roomId: Id<"rooms">
  sessionToken: string | null
  onTasks: (roomId: string, tasks: RoomTaskMetricDoc[]) => void
  onPresence: (roomId: string, presence: FocusPresenceDoc[]) => void
}) {
  const tasks = useQuery(roomTasksApi.listByRoom, { roomId }) as RoomTaskMetricDoc[] | undefined
  const presence = useQuery(
    roomFocusApi.listPresence,
    sessionToken ? { sessionToken, roomId } : "skip"
  ) as FocusPresenceDoc[] | undefined

  React.useEffect(() => {
    if (tasks) onTasks(String(roomId), tasks)
  }, [roomId, tasks, onTasks])

  React.useEffect(() => {
    if (presence) onPresence(String(roomId), presence)
  }, [roomId, presence, onPresence])

  return null
}

export default function Page() {
  const { user, sessionToken } = useAuth()
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
  const focusSessions = useQuery(
    focusSessionsApi.list,
    sessionToken ? { sessionToken } : "skip"
  ) as FocusSessionDoc[] | undefined
  const recentActivityQuery = useQuery(
    roomTasksApi.listRecentActivityByUser,
    userId ? { userId, limit: 12 } : "skip"
  ) as RoomActivityEventDoc[] | undefined
  const [roomTasksByRoom, setRoomTasksByRoom] = React.useState<
    Record<string, RoomTaskMetricDoc[]>
  >({})
  const [roomPresenceByRoom, setRoomPresenceByRoom] = React.useState<
    Record<string, FocusPresenceDoc[]>
  >({})
  const [quickTask, setQuickTask] = React.useState("")
  const [nowTimestamp, setNowTimestamp] = React.useState(() => Date.now())
  const [focusGoalHours] = React.useState(6)
  const [onboardingOpen, setOnboardingOpen] = React.useState(false)
  const [dailyReviewOpen, setDailyReviewOpen] = React.useState(false)
  const [todayPlanEditMode, setTodayPlanEditMode] = React.useState(false)
  const [todayPlanOrderIds, setTodayPlanOrderIds] = React.useState<string[]>([])
  const [todayPlanPinnedIds, setTodayPlanPinnedIds] = React.useState<string[]>([])

  const latestJoinedRoomId = React.useMemo(() => {
    const sortedByRecency = [...(roomDocs ?? [])].sort(
      (left, right) => right.createdAt - left.createdAt
    )
    return sortedByRecency.find((room) => joinedRoomIds.includes(room._id))?._id
  }, [roomDocs, joinedRoomIds])
  const isDashboardLoading =
    roomDocs === undefined ||
    (Boolean(userId) && assignedTasksQuery === undefined) ||
    (Boolean(sessionToken) && focusSessions === undefined)

  const handleRoomTasks = React.useCallback((roomId: string, tasks: RoomTaskMetricDoc[]) => {
    setRoomTasksByRoom((prev) => (prev[roomId] === tasks ? prev : { ...prev, [roomId]: tasks }))
  }, [])
  const handleRoomPresence = React.useCallback((roomId: string, presence: FocusPresenceDoc[]) => {
    setRoomPresenceByRoom((prev) =>
      prev[roomId] === presence ? prev : { ...prev, [roomId]: presence }
    )
  }, [])

  React.useEffect(() => {
    const active = new Set(joinedRoomIds.map((roomId) => String(roomId)))
    setRoomTasksByRoom((prev) => {
      const next = Object.fromEntries(
        Object.entries(prev).filter(([roomId]) => active.has(roomId))
      )
      return Object.keys(next).length === Object.keys(prev).length ? prev : next
    })
    setRoomPresenceByRoom((prev) => {
      const next = Object.fromEntries(
        Object.entries(prev).filter(([roomId]) => active.has(roomId))
      )
      return Object.keys(next).length === Object.keys(prev).length ? prev : next
    })
  }, [joinedRoomIds])

  React.useEffect(() => {
    const timer = window.setInterval(() => setNowTimestamp(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const analytics = React.useMemo(() => {
    const now = nowTimestamp
    const todayStart = startOfDay(now)
    const windowStart = todayStart - 6 * 24 * 60 * 60 * 1000
    const prevWindowStart = windowStart - 7 * 24 * 60 * 60 * 1000

    const focusDailyMinutes = Array.from({ length: 7 }, () => 0)
    let focusMinutesToday = 0
    let focusMinutes7d = 0
    let focusMinutesPrev7d = 0
    let focusOutcomesTodayDone = 0
    let focusOutcomesTodayProgress = 0
    let focusOutcomesTodayBlocked = 0

    for (const session of focusSessions ?? []) {
      const stamp = new Date(session.completedAt).getTime()
      const timestamp = Number.isNaN(stamp) ? session.createdAt : stamp
      if (timestamp >= todayStart && timestamp <= now) {
        focusMinutesToday += session.durationMinutes
        if (session.outcome === "done") focusOutcomesTodayDone += 1
        else if (session.outcome === "progress") focusOutcomesTodayProgress += 1
        else if (session.outcome === "blocked") focusOutcomesTodayBlocked += 1
      }
      if (timestamp >= windowStart && timestamp <= now) {
        const index = dayIndex(windowStart, timestamp)
        if (index >= 0 && index < 7) {
          focusDailyMinutes[index] += session.durationMinutes
        }
        focusMinutes7d += session.durationMinutes
      } else if (timestamp >= prevWindowStart && timestamp < windowStart) {
        focusMinutesPrev7d += session.durationMinutes
      }
    }

    const allRoomTasks = Object.values(roomTasksByRoom).flat()
    const velocityDailyCompleted = Array.from({ length: 7 }, () => 0)
    let createdCurrent = 0
    let createdPrevious = 0
    let completedCurrent = 0
    let completedPrevious = 0

    for (const task of allRoomTasks) {
      if (task.createdAt >= windowStart && task.createdAt <= now) {
        createdCurrent += 1
      } else if (task.createdAt >= prevWindowStart && task.createdAt < windowStart) {
        createdPrevious += 1
      }
      if (!task.completedAt) continue
      if (task.completedAt >= windowStart && task.completedAt <= now) {
        completedCurrent += 1
        const index = dayIndex(windowStart, task.completedAt)
        if (index >= 0 && index < 7) velocityDailyCompleted[index] += 1
      } else if (task.completedAt >= prevWindowStart && task.completedAt < windowStart) {
        completedPrevious += 1
      }
    }

    const velocityPercent = Math.round((completedCurrent / Math.max(1, createdCurrent)) * 100)
    const velocityPrevPercent = Math.round(
      (completedPrevious / Math.max(1, createdPrevious)) * 100
    )

    const collaboratorDailySets = Array.from({ length: 7 }, () => new Set<string>())
    const activeCollaboratorsNowSet = new Set<string>()
    const activeCollaboratorsPrevSet = new Set<string>()

    for (const task of allRoomTasks) {
      if (!task.assigneeUserId) continue
      if (task.updatedAt >= now - 24 * 60 * 60 * 1000) {
        activeCollaboratorsNowSet.add(String(task.assigneeUserId))
      } else if (
        task.updatedAt >= now - 2 * 24 * 60 * 60 * 1000 &&
        task.updatedAt < now - 24 * 60 * 60 * 1000
      ) {
        activeCollaboratorsPrevSet.add(String(task.assigneeUserId))
      }
      if (task.updatedAt >= windowStart && task.updatedAt <= now) {
        const index = dayIndex(windowStart, task.updatedAt)
        if (index >= 0 && index < 7) {
          collaboratorDailySets[index].add(String(task.assigneeUserId))
        }
      }
    }

    for (const presence of Object.values(roomPresenceByRoom).flat()) {
      if (presence.status === "focusing" && (presence.endsAt ?? now) >= now) {
        activeCollaboratorsNowSet.add(String(presence.userId))
        collaboratorDailySets[6].add(String(presence.userId))
      }
    }

    const activeCollaboratorsDaily = collaboratorDailySets.map((set) => set.size)

    const totalTasks = allRoomTasks.length
    const completedTasks = allRoomTasks.filter((task) => task.status === "completed").length
    const openTasks = allRoomTasks.filter((task) => task.status !== "completed")
    const blockedOpen = openTasks.filter((task) => task.status === "blocked").length
    const overdueOpen = openTasks.filter((task) => Boolean(task.dueAt && task.dueAt < now)).length
    const completionRatio = totalTasks > 0 ? completedTasks / totalTasks : 0
    const blockedRatio = openTasks.length > 0 ? blockedOpen / openTasks.length : 0
    const overdueRatio = openTasks.length > 0 ? overdueOpen / openTasks.length : 0
    const focusCoverage = Math.min(1, focusMinutes7d / Math.max(120, joinedRoomIds.length * 180))
    const prevFocusCoverage = Math.min(
      1,
      focusMinutesPrev7d / Math.max(120, joinedRoomIds.length * 180)
    )
    const roomHealthScore = Math.round(
      45 * completionRatio +
        30 * (1 - blockedRatio) +
        20 * (1 - overdueRatio) +
        5 * focusCoverage
    )
    const roomHealthPrevScore = Math.round(
      45 * Math.max(0, completionRatio - completedCurrent / Math.max(1, totalTasks)) +
        30 * (1 - blockedRatio) +
        20 * (1 - overdueRatio) +
        5 * prevFocusCoverage
    )
    const maxFocusDaily = Math.max(1, ...focusDailyMinutes)
    const maxVelocityDaily = Math.max(1, ...velocityDailyCompleted)
    const maxCollaboratorDaily = Math.max(1, ...activeCollaboratorsDaily)
    const roomHealthDaily = Array.from({ length: 7 }, (_, index) =>
      Math.round(
        Math.min(
          100,
          35 * (velocityDailyCompleted[index] / maxVelocityDaily) +
            25 * (1 - blockedRatio) +
            20 * (1 - overdueRatio) +
            10 * (focusDailyMinutes[index] / maxFocusDaily) +
            10 * (activeCollaboratorsDaily[index] / maxCollaboratorDaily)
        )
      )
    )

    return {
      roomCount: joinedRoomIds.length,
      focusMinutesToday,
      focusMinutes7d,
      focusMinutesPrev7d,
      focusOutcomesTodayDone,
      focusOutcomesTodayProgress,
      focusOutcomesTodayBlocked,
      focusDailyMinutes,
      velocityPercent,
      velocityPrevPercent,
      velocityDailyCompleted,
      activeCollaboratorsNow: activeCollaboratorsNowSet.size,
      activeCollaboratorsPrev24h: activeCollaboratorsPrevSet.size,
      activeCollaboratorsDaily,
      roomHealthScore,
      roomHealthPrevScore,
      roomHealthDaily,
    }
  }, [focusSessions, joinedRoomIds.length, nowTimestamp, roomPresenceByRoom, roomTasksByRoom])

  const focusedHours = Number((analytics.focusMinutesToday / 60).toFixed(1))
  const focusPercent = Math.min(100, Math.round((focusedHours / focusGoalHours) * 100))
  const quickActions = React.useMemo(
    () => [
      {
        label: "Open focus mode",
        href: latestJoinedRoomId ? `/dashboard/rooms/${latestJoinedRoomId}/tasks` : "/dashboard",
      },
      {
        label: "Review timeline",
        href: "/dashboard/recent-activity",
      },
      {
        label: "Check saved tasks",
        href: "/dashboard/saved-tasks",
      },
    ],
    [latestJoinedRoomId]
  )
  const metrics = React.useMemo(
    () => [
      {
        label: "FOCUSED TIME",
        value: `${(analytics.focusMinutes7d / 60).toFixed(1)}h`,
        trend: formatDelta(
          analytics.focusMinutes7d,
          analytics.focusMinutesPrev7d,
          " vs prior 7d"
        ),
        points: analytics.focusDailyMinutes,
      },
      {
        label: "TEAM VELOCITY",
        value: `${analytics.velocityPercent}%`,
        trend: formatDelta(
          analytics.velocityPercent,
          analytics.velocityPrevPercent,
          " completion rate"
        ),
        points: analytics.velocityDailyCompleted,
      },
      {
        label: "ACTIVE COLLABORATORS",
        value: `${analytics.activeCollaboratorsNow}`,
        trend: formatDelta(
          analytics.activeCollaboratorsNow,
          analytics.activeCollaboratorsPrev24h,
          " vs previous 24h"
        ),
        points: analytics.activeCollaboratorsDaily,
      },
    ],
    [analytics]
  )
  const rankedAssignedTasks = React.useMemo(() => {
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
  }, [assignedTasksQuery])
  const todayPlan = React.useMemo(() => {
    const byId = new Map(rankedAssignedTasks.map((task) => [task.taskId, task]))
    const rankedIds = rankedAssignedTasks.map((task) => task.taskId)
    const orderedRanked = [
      ...todayPlanOrderIds.filter((taskId) => rankedIds.includes(taskId)),
      ...rankedIds.filter((taskId) => !todayPlanOrderIds.includes(taskId)),
    ]
    const pinned = [
      ...todayPlanOrderIds.filter(
        (taskId) => todayPlanPinnedIds.includes(taskId) && byId.has(taskId)
      ),
      ...rankedIds.filter(
        (taskId) =>
          todayPlanPinnedIds.includes(taskId) && !todayPlanOrderIds.includes(taskId)
      ),
    ]
    const merged = [...pinned, ...orderedRanked.filter((taskId) => !pinned.includes(taskId))]
    return merged
      .slice(0, 3)
      .map((taskId) => byId.get(taskId))
      .filter((task): task is AssignedRoomTask => Boolean(task))
  }, [rankedAssignedTasks, todayPlanOrderIds, todayPlanPinnedIds])
  const notificationItems = React.useMemo(() => {
    const blockedCount = (assignedTasksQuery ?? []).filter(
      (task) => task.status === "blocked"
    ).length
    const overdueCount = (assignedTasksQuery ?? []).filter(
      (task) => task.status !== "completed" && Boolean(task.dueAt && task.dueAt < nowTimestamp)
    ).length
    const roomTasksHref = latestJoinedRoomId
      ? `/dashboard/rooms/${latestJoinedRoomId}/tasks`
      : "/dashboard"
    return [
      {
        label: "Blocked tasks",
        value: blockedCount,
        hint: blockedCount > 0 ? "Review blockers and assign an unblock owner." : "All clear.",
        href: `${roomTasksHref}?status=blocked`,
        disabled: !latestJoinedRoomId,
      },
      {
        label: "Overdue tasks",
        value: overdueCount,
        hint: overdueCount > 0 ? "Rescope deadlines in room tasks." : "Deadlines on track.",
        href: `${roomTasksHref}?due=overdue&status=open`,
        disabled: !latestJoinedRoomId,
      },
      {
        label: "Mentions",
        value: 0,
        hint: "Coming soon",
        href: "/dashboard/recent-activity",
        disabled: false,
      },
    ]
  }, [assignedTasksQuery, latestJoinedRoomId, nowTimestamp])
  const recentActivityItems = React.useMemo((): ActivityItem[] => {
    if (!recentActivityQuery) return []
    return recentActivityQuery.slice(0, 8).map((event) => ({
      id: String(event.id),
      name: event.actorName,
      initials: initialsFromName(event.actorName),
      task: event.taskTitle,
      activity:
        event.type === "focus_outcome"
          ? "updated from focus:"
          : event.type.replaceAll("_", " "),
      time: formatRelativeTime(event.createdAt, nowTimestamp),
    }))
  }, [recentActivityQuery, nowTimestamp])

  React.useEffect(() => {
    const userKey = `${DASHBOARD_ONBOARDING_KEY}:${userId ?? "guest"}`
    const seen = window.localStorage.getItem(userKey)
    if (!seen) setOnboardingOpen(true)
  }, [userId])
  React.useEffect(() => {
    const userKey = `${DASHBOARD_PLAN_ORDER_KEY}:${userId ?? "guest"}`
    const pinnedKey = `${DASHBOARD_PLAN_PINNED_KEY}:${userId ?? "guest"}`
    try {
      const order = window.localStorage.getItem(userKey)
      const pinned = window.localStorage.getItem(pinnedKey)
      if (order) setTodayPlanOrderIds(JSON.parse(order) as string[])
      if (pinned) setTodayPlanPinnedIds(JSON.parse(pinned) as string[])
    } catch {
      setTodayPlanOrderIds([])
      setTodayPlanPinnedIds([])
    }
  }, [userId])
  React.useEffect(() => {
    const userKey = `${DASHBOARD_PLAN_ORDER_KEY}:${userId ?? "guest"}`
    const pinnedKey = `${DASHBOARD_PLAN_PINNED_KEY}:${userId ?? "guest"}`
    window.localStorage.setItem(userKey, JSON.stringify(todayPlanOrderIds))
    window.localStorage.setItem(pinnedKey, JSON.stringify(todayPlanPinnedIds))
  }, [todayPlanOrderIds, todayPlanPinnedIds, userId])
  React.useEffect(() => {
    if (onboardingOpen || !focusSessions) return
    const todayKey = new Date(startOfDay(nowTimestamp)).toISOString().slice(0, 10)
    const reviewStorageKey = `${DASHBOARD_REVIEW_KEY}:${userId ?? "guest"}:${todayKey}`
    const seen = window.localStorage.getItem(reviewStorageKey)
    const todaySessionCount = focusSessions.filter((session) => {
      const stamp = new Date(session.completedAt).getTime()
      const ts = Number.isNaN(stamp) ? session.createdAt : stamp
      return ts >= startOfDay(nowTimestamp)
    }).length
    if (!seen && todaySessionCount >= 2) {
      setDailyReviewOpen(true)
    }
  }, [focusSessions, onboardingOpen, nowTimestamp, userId])

  function completeOnboarding() {
    const userKey = `${DASHBOARD_ONBOARDING_KEY}:${userId ?? "guest"}`
    window.localStorage.setItem(userKey, "done")
    setOnboardingOpen(false)
  }
  function completeDailyReview() {
    const todayKey = new Date(startOfDay(nowTimestamp)).toISOString().slice(0, 10)
    const reviewStorageKey = `${DASHBOARD_REVIEW_KEY}:${userId ?? "guest"}:${todayKey}`
    window.localStorage.setItem(reviewStorageKey, "done")
    setDailyReviewOpen(false)
  }
  function moveTodayPlan(taskId: string, direction: "up" | "down") {
    const current = todayPlan.map((task) => task.taskId)
    const index = current.indexOf(taskId)
    if (index < 0) return
    const target = direction === "up" ? index - 1 : index + 1
    if (target < 0 || target >= current.length) return
    const swapped = [...current]
    const [item] = swapped.splice(index, 1)
    swapped.splice(target, 0, item)
    setTodayPlanOrderIds((prev) => {
      const rest = prev.filter((id) => !swapped.includes(id))
      return [...swapped, ...rest]
    })
  }
  function togglePinTodayTask(taskId: string) {
    setTodayPlanPinnedIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    )
    if (!todayPlanOrderIds.includes(taskId)) {
      setTodayPlanOrderIds((prev) => [taskId, ...prev])
    }
  }

  async function submitQuickTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = quickTask.trim()
    if (!title || !latestJoinedRoomId || !userId) return
    try {
      await createQuickTask({
        roomId: latestJoinedRoomId,
        userId,
        title,
      })
      setQuickTask("")
      toast("Task added", {
        description: "Added to your most recent active room.",
      })
    } catch (error) {
      toast("Unable to add task", {
        description: error instanceof Error ? error.message : "Permission denied.",
      })
    }
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
              <h1 className="bg-linear-to-r from-teal-700 via-cyan-700 to-teal-500 bg-clip-text text-4xl font-semibold tracking-tight text-transparent dark:from-cyan-200 dark:via-teal-200 dark:to-cyan-400 md:text-5xl">
                Good afternoon, {firstName}.
              </h1>
              <p className="mt-2 text-muted-foreground">
                Ready for focused collaboration? You have {analytics.roomCount} rooms active today.
              </p>
            </div>

            <section className="mb-5 rounded-2xl border border-cyan-500/20 bg-background/75 p-4 backdrop-blur">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold">Today Command Center</h2>
                <Badge variant="outline" className="text-xs">
                  {isDashboardLoading ? "Syncing data" : "Live"}
                </Badge>
              </div>
              <div className="grid gap-3 lg:grid-cols-[1.15fr_1fr]">
                <div className="grid gap-2 sm:grid-cols-3">
                  {quickActions.map((action) => (
                    <Link
                      key={action.label}
                      href={action.href}
                      className="flex items-center justify-between rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-sm font-medium transition-colors hover:bg-cyan-500/10"
                    >
                      {action.label}
                      <ArrowRight className="size-4 text-cyan-700 dark:text-cyan-300" />
                    </Link>
                  ))}
                </div>
                <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                  {notificationItems.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      aria-disabled={item.disabled}
                      className={`rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 transition-colors ${
                        item.disabled
                          ? "pointer-events-none opacity-60"
                          : "hover:bg-cyan-500/10"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {item.label}
                        </p>
                        <Badge variant="secondary">{item.value}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p>
                    </Link>
                  ))}
                </div>
              </div>
            </section>

            <form
              id="quick-task"
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

            <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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

            {joinedRoomIds.map((roomId) => (
              <RoomMetricsCollector
                key={roomId}
                roomId={roomId}
                sessionToken={sessionToken}
                onTasks={handleRoomTasks}
                onPresence={handleRoomPresence}
              />
            ))}

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
                  className="relative h-full rounded-full bg-linear-to-r from-cyan-500 to-teal-400 transition-all"
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
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Tasks Done
                  </p>
                  <p className="text-sm font-semibold">{analytics.focusOutcomesTodayDone}</p>
                </div>
                <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Progress
                  </p>
                  <p className="text-sm font-semibold">{analytics.focusOutcomesTodayProgress}</p>
                </div>
                <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Blockers
                  </p>
                  <p className="text-sm font-semibold">{analytics.focusOutcomesTodayBlocked}</p>
                </div>
              </div>
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
                  onClick={() => setTodayPlanEditMode((prev) => !prev)}
                >
                  {todayPlanEditMode ? "Done Editing" : "Edit Plan"}
                </Button>
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
                          {todayPlanEditMode ? (
                            <>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="size-7"
                                onClick={() => moveTodayPlan(task.taskId, "up")}
                                aria-label="Move up"
                              >
                                <ChevronUp className="size-3.5" />
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="size-7"
                                onClick={() => moveTodayPlan(task.taskId, "down")}
                                aria-label="Move down"
                              >
                                <ChevronDown className="size-3.5" />
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="size-7"
                                onClick={() => togglePinTodayTask(task.taskId)}
                                aria-label="Pin task"
                              >
                                <Pin
                                  className={`size-3.5 ${
                                    todayPlanPinnedIds.includes(task.taskId)
                                      ? "text-cyan-700 dark:text-cyan-300"
                                      : "text-muted-foreground"
                                  }`}
                                />
                              </Button>
                            </>
                          ) : null}
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
                isLoading={recentActivityQuery === undefined}
                suggestions={[
                  "Enter your first room ->",
                  "Invite a teammate ->",
                  "Try Deep Work Mode ->",
                ]}
              />
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
            <DialogTitle>Your daily flow in 2 steps</DialogTitle>
            <DialogDescription>
              Plan, focus, and unblock without switching apps.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-1 text-sm">
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Step 1 of 2</span>
              <div className="flex items-center gap-1.5" aria-hidden>
                <span className="h-1.5 w-5 rounded-full bg-cyan-500" />
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
      <Dialog open={dailyReviewOpen} onOpenChange={setDailyReviewOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Daily Review</DialogTitle>
            <DialogDescription>
              Quick summary before you close the day.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
              <p className="text-xs text-muted-foreground">Focused time</p>
              <p className="text-lg font-semibold">{focusedHours.toFixed(1)}h</p>
            </div>
            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
              <p className="text-xs text-muted-foreground">Tasks moved</p>
              <p className="text-lg font-semibold">
                {analytics.focusOutcomesTodayDone + analytics.focusOutcomesTodayProgress}
              </p>
            </div>
            <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
              <p className="text-xs text-muted-foreground">Blockers</p>
              <p className="text-lg font-semibold">{analytics.focusOutcomesTodayBlocked}</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                completeDailyReview()
              }}
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={() => {
                completeDailyReview()
                toast("Plan tomorrow", {
                  description: "Pin your top 3 tasks in Today Plan before you sign off.",
                })
              }}
              className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
            >
              Plan Tomorrow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  )
}
