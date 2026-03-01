"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useMutation, useQuery } from "convex/react"
import {
  ArrowRight,
  ArrowUpRight,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  Flame,
  Pin,
  Play,
  Plus,
  Target,
  Timer,
} from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { RightSidebar } from "@/components/right-sidebar"
import { SiteHeader } from "@/components/site-header"
import { useAuth } from "@/components/providers/auth-provider"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar"
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
import { avatarSrcForKey } from "@/lib/avatar-options"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const DASHBOARD_ONBOARDING_KEY = "nook.dashboard.onboarding.v1"
const DASHBOARD_PLAN_ORDER_KEY = "nook.dashboard.today-plan.order.v1"
const DASHBOARD_PLAN_PINNED_KEY = "nook.dashboard.today-plan.pinned.v1"
const DASHBOARD_REVIEW_KEY = "nook.dashboard.daily-review.v1"
const APP_BOOT_TIME = Date.now()

type RoomListItem = {
  _id: Id<"rooms">
  name: string
  description?: string
  mode?: string
  joinCode?: string
  createdAt: number
  membersCount: number
  membersMax?: number
  icon?: RoomIconKey
  archivedAt?: number
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

type RoomMemberDoc = {
  userId: string
  name: string
  username: string
  email: string
  role: "viewer" | "member" | "admin"
  avatarKey: string
}

type RoomAccess = "public" | "private" | "invite_only"
type RoomIconKey = "code" | "rocket" | "cpu" | "sparkles"

const ROOM_TEMPLATES = [
  {
    id: "build-sprint",
    label: "Build Sprint",
    mode: "Build Sprint",
    description: "Execution room for shipping tasks this sprint.",
  },
  {
    id: "design-review",
    label: "Design Review",
    mode: "Design Review",
    description: "Review flows, UI details, and unblock design decisions.",
  },
  {
    id: "bug-bash",
    label: "Bug Bash",
    mode: "Bug Bash",
    description: "Triage, reproduce, and close quality issues quickly.",
  },
] as const

const ROOM_EMOJIS = ["🔥", "🚀", "🛠️", "🎯", "🧠", "⚡"] as const

const ROOM_ACCENTS: Array<{ label: string; value: RoomIconKey; className: string }> = [
  { label: "Cyan", value: "sparkles", className: "bg-cyan-500" },
  { label: "Emerald", value: "rocket", className: "bg-emerald-500" },
  { label: "Amber", value: "cpu", className: "bg-amber-500" },
  { label: "Rose", value: "code", className: "bg-rose-500" },
]

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
  const gradientId = React.useId()
  const width = 88
  const height = 28
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const coordinates = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * width
      const y = height - ((point - min) / range) * (height - 4) - 2
      return { x, y }
    })
  const path = coordinates
    .map((point, index) => {
      return `${index === 0 ? "M" : "L"}${point.x},${point.y}`
    })
    .join(" ")
  const areaPath = `${path} L${width},${height} L0,${height} Z`

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path d={path} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
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

function deltaTone(current: number, previous: number) {
  if (previous <= 0 && current <= 0) return "neutral"
  if (previous <= 0) return "positive"
  if (current === previous) return "neutral"
  return current > previous ? "positive" : "negative"
}

function startOfDay(timestamp: number) {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function dayIndex(windowStart: number, timestamp: number) {
  return Math.floor((timestamp - windowStart) / (24 * 60 * 60 * 1000))
}

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
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

function slugifyRoomName(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
  return slug || "new-room"
}

function roomAccent(icon?: RoomIconKey) {
  if (icon === "rocket") {
    return {
      border: "border-l-emerald-400",
      glow: "hover:shadow-[0_18px_50px_-24px_rgba(16,185,129,0.55)]",
      badge: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/25",
      dot: "bg-emerald-400",
      panel: "bg-emerald-500/[0.08]",
    }
  }
  if (icon === "cpu") {
    return {
      border: "border-l-amber-400",
      glow: "hover:shadow-[0_18px_50px_-24px_rgba(245,158,11,0.55)]",
      badge: "bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/25",
      dot: "bg-amber-400",
      panel: "bg-amber-500/[0.08]",
    }
  }
  if (icon === "code") {
    return {
      border: "border-l-fuchsia-400",
      glow: "hover:shadow-[0_18px_50px_-24px_rgba(217,70,239,0.55)]",
      badge: "bg-fuchsia-500/15 text-fuchsia-800 dark:text-fuchsia-200 border-fuchsia-500/25",
      dot: "bg-fuchsia-400",
      panel: "bg-fuchsia-500/[0.08]",
    }
  }
  return {
    border: "border-l-cyan-400",
    glow: "hover:shadow-[0_18px_50px_-24px_rgba(6,182,212,0.55)]",
    badge: "bg-cyan-500/15 text-cyan-800 dark:text-cyan-200 border-cyan-500/25",
    dot: "bg-cyan-400",
    panel: "bg-cyan-500/[0.08]",
  }
}

function modeBadgeClass(mode?: string) {
  const value = (mode ?? "").toLowerCase()
  if (value.includes("build")) return "border-blue-500/30 bg-blue-500/15 text-blue-800 dark:text-blue-200"
  if (value.includes("refin") || value.includes("design")) {
    return "border-fuchsia-500/30 bg-fuchsia-500/15 text-fuchsia-800 dark:text-fuchsia-200"
  }
  if (value.includes("bug")) return "border-amber-500/30 bg-amber-500/15 text-amber-800 dark:text-amber-200"
  return "border-cyan-500/30 bg-cyan-500/15 text-cyan-800 dark:text-cyan-200"
}

function RoomMetricsCollector({
  roomId,
  sessionToken,
  onTasks,
  onPresence,
  onMembers,
}: {
  roomId: Id<"rooms">
  sessionToken: string | null
  onTasks: (roomId: string, tasks: RoomTaskMetricDoc[]) => void
  onPresence: (roomId: string, presence: FocusPresenceDoc[]) => void
  onMembers: (roomId: string, members: RoomMemberDoc[]) => void
}) {
  const tasks = useQuery(roomTasksApi.listByRoom, { roomId }) as RoomTaskMetricDoc[] | undefined
  const presence = useQuery(
    roomFocusApi.listPresence,
    sessionToken ? { sessionToken, roomId } : "skip"
  ) as FocusPresenceDoc[] | undefined
  const members = useQuery(
    roomsApi.listMembersByRoom,
    sessionToken ? { sessionToken, roomId } : "skip"
  ) as RoomMemberDoc[] | undefined

  React.useEffect(() => {
    if (tasks) onTasks(String(roomId), tasks)
  }, [roomId, tasks, onTasks])

  React.useEffect(() => {
    if (presence) onPresence(String(roomId), presence)
  }, [roomId, presence, onPresence])

  React.useEffect(() => {
    if (members) onMembers(String(roomId), members)
  }, [members, onMembers, roomId])

  return null
}

export default function Page() {
  const router = useRouter()
  const searchParams = useSearchParams()
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
  const joinRoomByCode = useMutation(roomsApi.joinByCode)
  const createRoomInDb = useMutation(roomsApi.create)
  const assignedTasksQuery = useQuery(
    roomTasksApi.listAssignedByUser,
    userId ? { userId } : "skip"
  ) as AssignedRoomTask[] | undefined
  const focusSessions = useQuery(
    focusSessionsApi.list,
    sessionToken ? { sessionToken } : "skip"
  ) as FocusSessionDoc[] | undefined
  const [roomTasksByRoom, setRoomTasksByRoom] = React.useState<
    Record<string, RoomTaskMetricDoc[]>
  >({})
  const [roomPresenceByRoom, setRoomPresenceByRoom] = React.useState<
    Record<string, FocusPresenceDoc[]>
  >({})
  const [roomMembersByRoom, setRoomMembersByRoom] = React.useState<
    Record<string, RoomMemberDoc[]>
  >({})
  const [quickTask, setQuickTask] = React.useState("")
  const [nowTimestamp, setNowTimestamp] = React.useState(() => Date.now())
  const [focusGoalHours] = React.useState(6)
  const [onboardingOpen, setOnboardingOpen] = React.useState(false)
  const [dailyReviewOpen, setDailyReviewOpen] = React.useState(false)
  const [todayPlanEditMode, setTodayPlanEditMode] = React.useState(false)
  const [todayPlanOrderIds, setTodayPlanOrderIds] = React.useState<string[]>([])
  const [todayPlanPinnedIds, setTodayPlanPinnedIds] = React.useState<string[]>([])
  const [createRoomOpen, setCreateRoomOpen] = React.useState(false)
  const [roomName, setRoomName] = React.useState("")
  const [roomDescription, setRoomDescription] = React.useState("")
  const [roomMode, setRoomMode] = React.useState("")
  const [roomMembersMax, setRoomMembersMax] = React.useState("8")
  const [roomAccess, setRoomAccess] = React.useState<RoomAccess>("public")
  const [roomEmoji, setRoomEmoji] = React.useState<string>("🔥")
  const [roomIcon, setRoomIcon] = React.useState<RoomIconKey>("sparkles")
  const [isCreatingRoom, setIsCreatingRoom] = React.useState(false)
  const [joinRoomCode, setJoinRoomCode] = React.useState("")
  const [joiningRoom, setJoiningRoom] = React.useState(false)
  const [statusEntries, setStatusEntries] = React.useState<
    Array<{ id: string; text: string; createdAt: number }>
  >([])

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
  const handleRoomMembers = React.useCallback((roomId: string, members: RoomMemberDoc[]) => {
    setRoomMembersByRoom((prev) => (prev[roomId] === members ? prev : { ...prev, [roomId]: members }))
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
    setRoomMembersByRoom((prev) => {
      const next = Object.fromEntries(
        Object.entries(prev).filter(([roomId]) => active.has(roomId))
      )
      return Object.keys(next).length === Object.keys(prev).length ? prev : next
    })
  }, [joinedRoomIds])

  React.useEffect(() => {
    const timer = window.setInterval(() => setNowTimestamp(Date.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [])

  React.useEffect(() => {
    const openCreateRoomDialog = () => setCreateRoomOpen(true)
    window.addEventListener("nook:create-room", openCreateRoomDialog)
    return () => window.removeEventListener("nook:create-room", openCreateRoomDialog)
  }, [])

  React.useEffect(() => {
    if (searchParams.get("createRoom") !== "1") return
    setCreateRoomOpen(true)
    router.replace("/dashboard")
  }, [router, searchParams])

  function resetCreateRoomForm() {
    setRoomName("")
    setRoomDescription("")
    setRoomMode("")
    setRoomMembersMax("8")
    setRoomAccess("public")
    setRoomEmoji("🔥")
    setRoomIcon("sparkles")
  }

  async function createRoom() {
    if (!userId || isCreatingRoom) return
    const name = roomName.trim()
    const description = roomDescription.trim()
    const mode = roomMode.trim()
    const maxMembers = Number.parseInt(roomMembersMax, 10)
    if (!name || !description || !mode || Number.isNaN(maxMembers)) {
      toast.error("Complete all room fields before creating the room.")
      return
    }

    try {
      setIsCreatingRoom(true)
      const displayName = `${roomEmoji} ${name}`.trim()
      const result = (await createRoomInDb({
        name: displayName,
        description,
        mode,
        access: roomAccess,
        icon: roomIcon,
        membersMax: Math.max(2, maxMembers),
        userId,
      })) as Id<"rooms"> | { roomId?: Id<"rooms"> } | undefined

      resetCreateRoomForm()
      setCreateRoomOpen(false)
      toast.success("Room created.")
      const createdRoomId =
        typeof result === "string" ? result : result?.roomId
      if (createdRoomId) {
        router.push(`/dashboard/rooms/${createdRoomId}`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create room."
      toast.error(message)
    } finally {
      setIsCreatingRoom(false)
    }
  }

  const canCreateRoom =
    roomName.trim().length > 1 &&
    roomDescription.trim().length > 5 &&
    roomMode.trim().length > 2 &&
    Number.parseInt(roomMembersMax, 10) >= 2 &&
    !isCreatingRoom
  const roomDescriptionCount = roomDescription.trim().length
  const roomSlugPreview = slugifyRoomName(roomName)
  const joinedRooms = React.useMemo(
    () =>
      (roomDocs ?? [])
        .filter((room) => joinedRoomIds.includes(room._id) && !room.archivedAt)
        .sort((left, right) => right.createdAt - left.createdAt),
    [joinedRoomIds, roomDocs]
  )
  const archivedJoinedRooms = React.useMemo(
    () =>
      (roomDocs ?? [])
        .filter((room) => joinedRoomIds.includes(room._id) && Boolean(room.archivedAt))
        .sort((left, right) => (right.archivedAt ?? 0) - (left.archivedAt ?? 0)),
    [joinedRoomIds, roomDocs]
  )

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
  const greeting = React.useMemo(() => {
    const now = new Date(nowTimestamp)
    return {
      text: greetingForHour(now.getHours()),
      context: now.toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    }
  }, [nowTimestamp])
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

  React.useEffect(() => {
    const storageKey = `nook.dashboard.status-entries.v1:${userId ?? "guest"}`
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) {
        setStatusEntries([])
        return
      }
      const parsed = JSON.parse(raw) as Array<{ id: string; text: string; createdAt: number }>
      setStatusEntries(Array.isArray(parsed) ? parsed : [])
    } catch {
      setStatusEntries([])
    }
  }, [userId])

  React.useEffect(() => {
    const storageKey = `nook.dashboard.status-entries.v1:${userId ?? "guest"}`
    window.localStorage.setItem(storageKey, JSON.stringify(statusEntries.slice(0, 5)))
  }, [statusEntries, userId])

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
      setStatusEntries((prev) => [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          text: title,
          createdAt: Date.now(),
        },
        ...prev,
      ])
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

  async function submitJoinByCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!userId || joiningRoom) return
    const code = joinRoomCode.trim().toUpperCase()
    if (!code) return
    try {
      setJoiningRoom(true)
      const result = await joinRoomByCode({
        code,
        userId,
      })
      setJoinRoomCode("")
      router.push(`/dashboard/rooms/${result.roomId}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to join room.")
    } finally {
      setJoiningRoom(false)
    }
  }

  async function copyJoinCode(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      toast.success("Room code copied.")
    } catch {
      toast.error("Unable to copy code.")
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
                {greeting.text}, {firstName}.
              </h1>
              <p className="mt-3 text-base text-muted-foreground md:text-lg">
                Ready for focused collaboration? You have {joinedRooms.length} rooms active today.
              </p>
              <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground/80">
                {greeting.context}
              </p>
            </div>

            <section
              id="rooms-section"
              className="mb-8 rounded-2xl border border-cyan-500/20 bg-background/75 p-5 backdrop-blur"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Your Rooms</h2>
                <a
                  href="/dashboard#rooms-section"
                  className="text-xs font-medium text-cyan-700 hover:text-cyan-600 dark:text-cyan-300"
                >
                  View All
                </a>
              </div>
              {isDashboardLoading ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {Array.from({ length: 4 }, (_, index) => (
                    <div
                      key={`room-card-skeleton-${index}`}
                      className="h-36 animate-pulse rounded-xl border border-cyan-500/20 bg-cyan-500/10"
                    />
                  ))}
                </div>
              ) : joinedRooms.length === 0 ? (
                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                  <p className="text-sm text-muted-foreground">
                    You have no joined rooms yet. Create a room or join with a shared code.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {joinedRooms.slice(0, 3).map((room) => (
                    <article
                      key={room._id}
                      className={cn(
                        "rounded-2xl border border-cyan-500/18 border-l-4 bg-background/80 p-4 transition-all duration-200 hover:-translate-y-0.5",
                        roomAccent(room.icon).border,
                        roomAccent(room.icon).glow
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-base font-semibold">{room.name}</p>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {room.description || "Focused collaboration room."}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn("border text-[10px] uppercase", modeBadgeClass(room.mode))}
                        >
                          {room.mode || "ROOM"}
                        </Badge>
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <AvatarGroup>
                            {(roomMembersByRoom[String(room._id)] ?? []).slice(0, 3).map((member) => (
                              <Avatar key={member.userId} size="sm">
                                <AvatarImage src={avatarSrcForKey(member.avatarKey)} alt={member.name} />
                                <AvatarFallback>{member.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                              </Avatar>
                            ))}
                            {room.membersCount > 3 ? (
                              <AvatarGroupCount className="size-6 text-xs">
                                +{room.membersCount - 3}
                              </AvatarGroupCount>
                            ) : null}
                          </AvatarGroup>
                          <p className="text-xs text-muted-foreground">
                            {room.membersCount}/{room.membersMax ?? 30} members
                          </p>
                        </div>
                        <Link
                          href={`/dashboard/rooms/${room._id}`}
                          className="text-xs font-medium text-cyan-700 hover:text-cyan-600 dark:text-cyan-300"
                        >
                          Open
                        </Link>
                      </div>
                      {room.joinCode ? (
                        <div className={cn("mt-3 flex items-center justify-between rounded-md border px-2 py-1.5", roomAccent(room.icon).badge)}>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {room.joinCode}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-[11px]"
                            onClick={() => {
                              void copyJoinCode(room.joinCode as string)
                            }}
                          >
                            Copy
                          </Button>
                        </div>
                      ) : null}
                    </article>
                  ))}
                  <button
                    type="button"
                    className="group flex min-h-36 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-cyan-500/35 bg-cyan-500/5 p-4 text-center transition-all hover:-translate-y-0.5 hover:bg-cyan-500/10 hover:shadow-[0_18px_50px_-24px_rgba(6,182,212,0.45)]"
                    onClick={() => setCreateRoomOpen(true)}
                  >
                    <span className="mb-3 flex size-12 items-center justify-center rounded-full border border-dashed border-cyan-500/35 bg-background/70 text-cyan-700 dark:text-cyan-300">
                      <Plus className="size-5" />
                    </span>
                    <p className="text-base font-semibold">Create a new room</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Start a focused collaboration session.
                    </p>
                  </button>
                </div>
              )}
              <form
                onSubmit={(event) => {
                  void submitJoinByCode(event)
                }}
                className="mt-3 flex flex-col gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-2.5 sm:flex-row sm:items-center"
              >
                <Input
                  value={joinRoomCode}
                  onChange={(event) => setJoinRoomCode(event.target.value.toUpperCase())}
                  placeholder="Join with code (NOOK-7F2A)"
                  className="h-8 border-cyan-500/25 bg-background/70"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!joinRoomCode.trim() || joiningRoom || !userId}
                  className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                >
                  {joiningRoom ? "Joining..." : "Join Room"}
                </Button>
              </form>
              {archivedJoinedRooms.length > 0 ? (
                <div className="mt-4 rounded-xl border border-cyan-500/15 bg-background/60 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">Archived Rooms</p>
                    <Badge variant="secondary">{archivedJoinedRooms.length}</Badge>
                  </div>
                  <ul className="space-y-2">
                    {archivedJoinedRooms.slice(0, 4).map((room) => (
                      <li
                        key={room._id}
                        className="flex items-center justify-between gap-2 rounded-md border border-cyan-500/15 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium">{room.name}</p>
                          <p className="text-xs text-muted-foreground">Archived room</p>
                        </div>
                        <Link
                          href={`/dashboard/rooms/${room._id}`}
                          className="text-xs font-medium text-cyan-700 hover:text-cyan-600 dark:text-cyan-300"
                        >
                          Open
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>

            <form
              id="quick-task"
              onSubmit={(event) => {
                void submitQuickTask(event)
              }}
              className="mb-6 flex flex-col gap-2 rounded-2xl border border-cyan-500/20 bg-background/75 p-3 backdrop-blur sm:flex-row sm:items-center"
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
            {statusEntries.length > 0 ? (
              <div className="mb-5 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Recent updates
                </p>
                <ul className="mt-2 space-y-1.5">
                  {statusEntries.slice(0, 3).map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-cyan-500/15 bg-background/60 px-2.5 py-1.5 text-xs"
                    >
                      <span className="truncate">{entry.text}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {formatRelativeTime(entry.createdAt, nowTimestamp)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

              <div className="mb-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4 backdrop-blur"
                >
                  <p className="text-xs font-semibold tracking-wide text-cyan-900/60 dark:text-cyan-100/70">
                    {metric.label}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-4xl font-bold tracking-tight">{metric.value}</span>
                    <div className="text-cyan-700 dark:text-cyan-300">
                      <Sparkline points={metric.points} />
                    </div>
                  </div>
                  <div
                    className={cn(
                      "mt-3 inline-flex items-center gap-1 text-xs font-medium",
                      deltaTone(
                        metric.label === "FOCUSED TIME"
                          ? analytics.focusMinutes7d
                          : metric.label === "TEAM VELOCITY"
                            ? analytics.velocityPercent
                            : analytics.activeCollaboratorsNow,
                        metric.label === "FOCUSED TIME"
                          ? analytics.focusMinutesPrev7d
                          : metric.label === "TEAM VELOCITY"
                            ? analytics.velocityPrevPercent
                            : analytics.activeCollaboratorsPrev24h
                      ) === "negative"
                        ? "text-rose-700 dark:text-rose-300"
                        : deltaTone(
                              metric.label === "FOCUSED TIME"
                                ? analytics.focusMinutes7d
                                : metric.label === "TEAM VELOCITY"
                                  ? analytics.velocityPercent
                                  : analytics.activeCollaboratorsNow,
                              metric.label === "FOCUSED TIME"
                                ? analytics.focusMinutesPrev7d
                                : metric.label === "TEAM VELOCITY"
                                  ? analytics.velocityPrevPercent
                                  : analytics.activeCollaboratorsPrev24h
                            ) === "neutral"
                          ? "text-muted-foreground"
                          : "text-emerald-700 dark:text-emerald-300"
                    )}
                  >
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
                onMembers={handleRoomMembers}
              />
            ))}

            <div className="mb-10 rounded-2xl border border-cyan-500/20 bg-background/70 p-5 backdrop-blur">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="size-4 text-cyan-700 dark:text-cyan-300" />
                  <h2 className="text-base font-semibold">Daily Focus Goal</h2>
                </div>
                <Badge className="bg-cyan-500/20 text-cyan-700 dark:text-cyan-300">
                  {focusedHours.toFixed(1)}h / {focusGoalHours}h
                </Badge>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-cyan-500/10 ring-1 ring-cyan-500/15">
                  <div
                    className="absolute inset-y-0 left-0 min-w-1 rounded-full bg-linear-to-r from-cyan-500 to-teal-400 transition-all"
                    style={{ width: `${focusPercent}%` }}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    window.location.href = "/dashboard/focus"
                  }}
                  className="shrink-0 bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                >
                  <Play className="size-4" />
                  Start Focus
                </Button>
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

            <section
              id="today-plan"
              className="mb-8 rounded-2xl border border-cyan-500/20 bg-background/70 p-4 backdrop-blur"
            >
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

          </div>
        </div>
      </SidebarInset>
      <RightSidebar />
      <Dialog open={createRoomOpen} onOpenChange={setCreateRoomOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Create Room</DialogTitle>
            <DialogDescription>
              Start a focused collaboration room for your team.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <p className="text-sm font-medium">Template</p>
              <div className="flex flex-wrap gap-2">
                {ROOM_TEMPLATES.map((template) => (
                  <Button
                    key={template.id}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setRoomMode(template.mode)
                      setRoomDescription(template.description)
                    }}
                  >
                    {template.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <p className="text-sm font-medium">Emoji</p>
              <div className="flex flex-wrap gap-2">
                {ROOM_EMOJIS.map((emoji) => (
                  <Button
                    key={emoji}
                    type="button"
                    size="icon"
                    variant={roomEmoji === emoji ? "default" : "outline"}
                    className={roomEmoji === emoji ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400" : ""}
                    onClick={() => setRoomEmoji(emoji)}
                    aria-label={`Use ${emoji} emoji`}
                  >
                    <span>{emoji}</span>
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <label htmlFor="create-room-name" className="text-sm font-medium">
                Room name
              </label>
              <Input
                id="create-room-name"
                value={roomName}
                onChange={(event) => setRoomName(event.target.value)}
                placeholder="Frontend Architecture Guild"
                className="border-cyan-500/25 bg-cyan-500/5 focus-visible:ring-cyan-500/30"
              />
              <p className="text-xs text-muted-foreground">
                URL preview: <span className="font-mono">/dashboard/rooms/{roomSlugPreview}</span>
              </p>
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="create-room-description" className="text-sm font-medium">
                  Description
                </label>
                <span className="text-xs text-muted-foreground">{roomDescriptionCount}/180</span>
              </div>
              <textarea
                id="create-room-description"
                value={roomDescription}
                onChange={(event) => setRoomDescription(event.target.value)}
                placeholder="What will this room focus on?"
                maxLength={180}
                className="min-h-20 w-full rounded-md border border-cyan-500/25 bg-cyan-500/5 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/30"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <label htmlFor="create-room-mode" className="text-sm font-medium">
                  Mode label
                </label>
                <Input
                  id="create-room-mode"
                  value={roomMode}
                  onChange={(event) => setRoomMode(event.target.value)}
                  placeholder="Build Sprint"
                  className="border-cyan-500/25 bg-cyan-500/5 focus-visible:ring-cyan-500/30"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="create-room-members-max" className="text-sm font-medium">
                  Max members
                </label>
                <Input
                  id="create-room-members-max"
                  type="number"
                  min={2}
                  max={30}
                  value={roomMembersMax}
                  onChange={(event) => setRoomMembersMax(event.target.value)}
                  className="border-cyan-500/25 bg-cyan-500/5 focus-visible:ring-cyan-500/30"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <p className="text-sm font-medium">Room accent</p>
              <div className="flex flex-wrap gap-2">
                {ROOM_ACCENTS.map((accent) => (
                  <Button
                    key={accent.value}
                    type="button"
                    size="sm"
                    variant={roomIcon === accent.value ? "default" : "outline"}
                    className={roomIcon === accent.value ? "bg-cyan-500 text-slate-950 hover:bg-cyan-400" : ""}
                    onClick={() => setRoomIcon(accent.value)}
                  >
                    <span className={`mr-2 inline-block size-2.5 rounded-full ${accent.className}`} />
                    {accent.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <label htmlFor="create-room-access" className="text-sm font-medium">
                Access
              </label>
              <select
                id="create-room-access"
                value={roomAccess}
                onChange={(event) => setRoomAccess(event.target.value as RoomAccess)}
                className="h-10 rounded-md border border-cyan-500/25 bg-cyan-500/5 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/30"
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
                <option value="invite_only">Invite only</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetCreateRoomForm()
                setCreateRoomOpen(false)
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
              onClick={() => {
                void createRoom()
              }}
              disabled={!canCreateRoom}
            >
              {isCreatingRoom ? "Creating..." : "Create Room"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
