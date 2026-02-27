"use client"

import * as React from "react"
import { useMutation, useQuery } from "convex/react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { RightSidebar } from "@/components/right-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { focusSessionsApi } from "@/lib/convex-focus-sessions-api"
import { roomFocusApi } from "@/lib/convex-room-focus-api"
import { roomTasksApi } from "@/lib/convex-room-tasks-api"
import { useAuth } from "@/components/providers/auth-provider"
import type { Id } from "@/convex/_generated/dataModel"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Timer, ArrowRight, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

type SessionState = "START" | "RUNNING" | "REFLECT"
type FocusOutcome = "done" | "progress" | "blocked"

type FocusSessionRecord = {
  id: string
  intention: string
  reflection: string
  taskId?: string
  outcome?: FocusOutcome
  followUpTaskId?: string
  durationMinutes: number
  completedAt: string
}

type AssignedTask = {
  taskId: string
  title: string
  priority: "low" | "medium" | "high"
  status: "todo" | "working" | "blocked" | "completed"
  roomId: Id<"rooms">
  roomName: string
}

type RoomTaskCandidate = {
  taskId: string
  title: string
  status: "todo" | "working" | "blocked" | "completed"
}

type FocusRuntime = {
  state: SessionState
  selectedTaskId: string | null
  intention: string
  reflection: string
  outcome: FocusOutcome
  blockerNote: string
  durationMinutes: number
  sessionStartedAt: number | null
  sessionEndsAt: number | null
  sessionDurationSeconds: number
  ambientCopy: string
}

const AMBIENT_COPY = [
  "You're in Cafe Mode. Others are quietly working too.",
  "A calm room. One task. Take your time.",
  "Focusing...",
]

const MIN_DURATION = 5
const MAX_DURATION = 180
const RUNTIME_STORAGE_KEY = "nook.focus.runtime.v2"

function clampDuration(minutes: number) {
  return Math.min(Math.max(minutes, MIN_DURATION), MAX_DURATION)
}

function formatSessionTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function toLocalDateKey(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function readRuntime(): FocusRuntime | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(RUNTIME_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as FocusRuntime
  } catch {
    return null
  }
}

export default function FocusPage() {
  return (
    <React.Suspense fallback={<FocusPageFallback />}>
      <FocusPageContent />
    </React.Suspense>
  )
}

function FocusPageFallback() {
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
        <SiteHeader currentPage="Focus" />
        <div className="flex flex-1 items-center justify-center px-4 py-10">
          <p className="text-sm text-muted-foreground">Loading focus session...</p>
        </div>
      </SidebarInset>
      <RightSidebar />
    </SidebarProvider>
  )
}

function FocusPageContent() {
  const searchParams = useSearchParams()
  const { sessionToken, user } = useAuth()
  const roomIdParam = searchParams.get("roomId")
  const taskIdParam = searchParams.get("taskId")
  const intentionParam = searchParams.get("intention")

  const [state, setState] = React.useState<SessionState>("START")
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(taskIdParam)
  const [intention, setIntention] = React.useState("")
  const [reflection, setReflection] = React.useState("")
  const [outcome, setOutcome] = React.useState<FocusOutcome>("progress")
  const [blockerNote, setBlockerNote] = React.useState("")
  const [durationMinutes, setDurationMinutes] = React.useState(45)
  const [timeLeft, setTimeLeft] = React.useState(45 * 60)
  const [sessionStartedAt, setSessionStartedAt] = React.useState<number | null>(null)
  const [sessionEndsAt, setSessionEndsAt] = React.useState<number | null>(null)
  const [sessionDurationSeconds, setSessionDurationSeconds] = React.useState(45 * 60)
  const [ambientCopy, setAmbientCopy] = React.useState(AMBIENT_COPY[0])
  const [runtimeReady, setRuntimeReady] = React.useState(false)

  const assignedTasksQuery = useQuery(
    roomTasksApi.listAssignedByUser,
    user?.id ? { userId: user.id } : "skip"
  ) as AssignedTask[] | undefined
  const roomTasksQuery = useQuery(
    roomTasksApi.listByRoom,
    roomIdParam ? { roomId: roomIdParam as Id<"rooms"> } : "skip"
  ) as RoomTaskCandidate[] | undefined

  const focusCandidates = React.useMemo(() => {
    if (roomIdParam) {
      const roomId = roomIdParam as Id<"rooms">
      return (roomTasksQuery ?? [])
        .filter((task) => task.status !== "completed")
        .map((task) => ({
          taskId: task.taskId,
          title: task.title,
          priority: "medium" as const,
          status: task.status,
          roomId,
          roomName: "Selected room",
        }))
    }

    return (assignedTasksQuery ?? []).filter((task) => task.status !== "completed")
  }, [assignedTasksQuery, roomIdParam, roomTasksQuery])

  const selectedTask = React.useMemo(
    () => focusCandidates.find((task) => task.taskId === selectedTaskId) ?? null,
    [focusCandidates, selectedTaskId]
  )

  const selectedRoomId = selectedTask?.roomId ?? (roomIdParam as Id<"rooms"> | null)

  const sessionDocs = useQuery(
    focusSessionsApi.list,
    sessionToken ? { sessionToken } : "skip"
  ) as
    | Array<
        FocusSessionRecord & {
          _id: string
          sessionId: string
        }
      >
    | undefined

  const createSession = useMutation(focusSessionsApi.create)
  const startRoomFocus = useMutation(roomFocusApi.start)
  const markRoomFocusDone = useMutation(roomFocusApi.markDone)
  const completeRoomFocus = useMutation(roomFocusApi.complete)
  const completeTaskFromFocus = useMutation(roomTasksApi.completeFromFocus)

  const sessionHistory = React.useMemo(() => {
    if (!sessionDocs) return []
    return sessionDocs.map((session) => ({
      id: session.sessionId,
      intention: session.intention,
      reflection: session.reflection,
      taskId: session.taskId,
      outcome: session.outcome,
      followUpTaskId: session.followUpTaskId,
      durationMinutes: session.durationMinutes,
      completedAt: session.completedAt,
    }))
  }, [sessionDocs])

  const progressStats = React.useMemo(() => {
    const now = new Date()
    const todayKey = toLocalDateKey(now)
    const todaySessions = sessionHistory.filter((session) => {
      const date = new Date(session.completedAt)
      return !Number.isNaN(date.getTime()) && toLocalDateKey(date) === todayKey
    })

    const oneWeekAgo = new Date(now)
    oneWeekAgo.setDate(now.getDate() - 6)
    oneWeekAgo.setHours(0, 0, 0, 0)
    const weekMinutes = sessionHistory.reduce((total, session) => {
      const date = new Date(session.completedAt)
      if (Number.isNaN(date.getTime()) || date < oneWeekAgo) return total
      return total + session.durationMinutes
    }, 0)

    const movedTasksToday = todaySessions.filter(
      (session) => session.outcome === "done" || session.outcome === "progress"
    ).length
    const blockersRaisedToday = todaySessions.filter(
      (session) => session.outcome === "blocked"
    ).length

    return {
      todaySessions,
      todayMinutes: todaySessions.reduce(
        (total, session) => total + session.durationMinutes,
        0
      ),
      weekMinutes,
      movedTasksToday,
      blockersRaisedToday,
    }
  }, [sessionHistory])

  React.useEffect(() => {
    if (focusCandidates.length === 0) return
    if (!selectedTaskId || !focusCandidates.some((task) => task.taskId === selectedTaskId)) {
      setSelectedTaskId(focusCandidates[0].taskId)
    }
  }, [focusCandidates, selectedTaskId])

  React.useEffect(() => {
    if (intention.trim().length > 0) return
    if (selectedTask?.title) {
      setIntention(selectedTask.title)
      return
    }
    if (intentionParam) setIntention(intentionParam)
  }, [intention, intentionParam, selectedTask])

  React.useEffect(() => {
    const runtime = readRuntime()
    if (!runtime) {
      setRuntimeReady(true)
      return
    }

    setState(runtime.state)
    setSelectedTaskId(runtime.selectedTaskId)
    setIntention(runtime.intention)
    setReflection(runtime.reflection)
    setOutcome(runtime.outcome)
    setBlockerNote(runtime.blockerNote)
    setDurationMinutes(clampDuration(runtime.durationMinutes || 45))
    setSessionStartedAt(runtime.sessionStartedAt)
    setSessionEndsAt(runtime.sessionEndsAt)
    setSessionDurationSeconds(runtime.sessionDurationSeconds || 45 * 60)
    setAmbientCopy(runtime.ambientCopy || AMBIENT_COPY[0])

    if (runtime.state === "RUNNING" && runtime.sessionEndsAt) {
      const remaining = Math.max(0, Math.ceil((runtime.sessionEndsAt - Date.now()) / 1000))
      setTimeLeft(remaining)
      if (remaining === 0) {
        setState("REFLECT")
        setSessionEndsAt(null)
      }
      setRuntimeReady(true)
      return
    }

    if (runtime.state === "REFLECT") {
      setTimeLeft(0)
      setRuntimeReady(true)
      return
    }

    setTimeLeft(clampDuration(runtime.durationMinutes || 45) * 60)
    setRuntimeReady(true)
  }, [])

  React.useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== RUNTIME_STORAGE_KEY) return
      const runtime = readRuntime()
      if (!runtime) {
        setState("START")
        setIntention("")
        setReflection("")
        setOutcome("progress")
        setBlockerNote("")
        setDurationMinutes(45)
        setTimeLeft(45 * 60)
        setSessionStartedAt(null)
        setSessionEndsAt(null)
        setSessionDurationSeconds(45 * 60)
        setAmbientCopy(AMBIENT_COPY[0])
        return
      }

      setState(runtime.state)
      setSelectedTaskId(runtime.selectedTaskId)
      setIntention(runtime.intention)
      setReflection(runtime.reflection)
      setOutcome(runtime.outcome)
      setBlockerNote(runtime.blockerNote)
      setDurationMinutes(clampDuration(runtime.durationMinutes || 45))
      setSessionStartedAt(runtime.sessionStartedAt)
      setSessionEndsAt(runtime.sessionEndsAt)
      setSessionDurationSeconds(runtime.sessionDurationSeconds || 45 * 60)
      setAmbientCopy(runtime.ambientCopy || AMBIENT_COPY[0])

      if (runtime.state === "RUNNING" && runtime.sessionEndsAt) {
        const remaining = Math.max(0, Math.ceil((runtime.sessionEndsAt - Date.now()) / 1000))
        setTimeLeft(remaining)
      }
    }

    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [])

  React.useEffect(() => {
    if (!runtimeReady) return
    const runtime: FocusRuntime = {
      state,
      selectedTaskId,
      intention,
      reflection,
      outcome,
      blockerNote,
      durationMinutes,
      sessionStartedAt,
      sessionEndsAt,
      sessionDurationSeconds,
      ambientCopy,
    }
    window.localStorage.setItem(RUNTIME_STORAGE_KEY, JSON.stringify(runtime))
  }, [
    runtimeReady,
    state,
    selectedTaskId,
    intention,
    reflection,
    outcome,
    blockerNote,
    durationMinutes,
    sessionStartedAt,
    sessionEndsAt,
    sessionDurationSeconds,
    ambientCopy,
  ])

  React.useEffect(() => {
    let timer: NodeJS.Timeout
    if (state === "RUNNING" && sessionEndsAt) {
      timer = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((sessionEndsAt - Date.now()) / 1000))
        setTimeLeft(remaining)

        if (remaining === 0) {
          setState("REFLECT")
          setSessionEndsAt(null)
          if (sessionToken && selectedRoomId) {
            void markRoomFocusDone({
              sessionToken,
              roomId: selectedRoomId,
            })
          }
        }
      }, 1000)
    }
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [state, sessionEndsAt, sessionToken, selectedRoomId, markRoomFocusDone])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const startSession = () => {
    if (!selectedTask || !selectedRoomId) {
      toast("Pick a task first", {
        description: "Focus sessions must be linked to a task so outcomes can update work.",
      })
      return
    }

    const safeMinutes = clampDuration(durationMinutes)
    const totalSeconds = safeMinutes * 60
    const startAt = Date.now()
    const endAt = startAt + totalSeconds * 1000

    setDurationMinutes(safeMinutes)
    setState("RUNNING")
    setSessionStartedAt(startAt)
    setSessionEndsAt(endAt)
    setSessionDurationSeconds(totalSeconds)
    setTimeLeft(totalSeconds)
    setReflection("")
    setOutcome("progress")
    setBlockerNote("")
    setAmbientCopy(AMBIENT_COPY[Math.floor(Math.random() * AMBIENT_COPY.length)])

    if (sessionToken) {
      void startRoomFocus({
        sessionToken,
        roomId: selectedRoomId,
        intention: (intention || selectedTask.title).trim() || "Deep Work",
        durationMinutes: safeMinutes,
        taskId: selectedTask.taskId,
        visibility: "room",
      })
    }
  }

  const finishSession = () => {
    setState("REFLECT")
    setSessionEndsAt(null)
    if (sessionToken && selectedRoomId) {
      void markRoomFocusDone({
        sessionToken,
        roomId: selectedRoomId,
      })
    }
  }

  const resetSession = () => {
    setState("START")
    setReflection("")
    setOutcome("progress")
    setBlockerNote("")
    setTimeLeft(durationMinutes * 60)
    setSessionStartedAt(null)
    setSessionEndsAt(null)
    setSessionDurationSeconds(durationMinutes * 60)
    window.localStorage.removeItem(RUNTIME_STORAGE_KEY)
  }

  const saveSessionAndReset = async () => {
    if (!sessionToken || !sessionStartedAt || !selectedTask || !selectedRoomId || !user?.id) {
      resetSession()
      return
    }

    const elapsedSeconds = Math.max(1, sessionDurationSeconds - timeLeft)
    const durationCompletedMinutes = Math.max(1, Math.round(elapsedSeconds / 60))

    try {
      const taskUpdate = await completeTaskFromFocus({
        roomId: selectedRoomId,
        taskId: selectedTask.taskId,
        actorUserId: user.id,
        outcome,
        blockerNote: blockerNote.trim() || undefined,
      })

      const entry: FocusSessionRecord = {
        id: `session-${Date.now()}`,
        intention: intention.trim() || selectedTask.title,
        reflection: reflection.trim(),
        taskId: selectedTask.taskId,
        outcome,
        followUpTaskId: taskUpdate.followUpTaskId,
        durationMinutes: durationCompletedMinutes,
        completedAt: new Date().toISOString(),
      }

      await createSession({
        sessionToken,
        sessionId: entry.id,
        intention: entry.intention,
        reflection: entry.reflection,
        roomId: selectedRoomId,
        taskId: entry.taskId,
        outcome: entry.outcome,
        blockerNote: blockerNote.trim() || undefined,
        followUpTaskId: entry.followUpTaskId,
        durationMinutes: entry.durationMinutes,
        completedAt: entry.completedAt,
      })

      await completeRoomFocus({
        sessionToken,
        roomId: selectedRoomId,
        reflection: entry.reflection,
        outcome,
        blockerNote: blockerNote.trim() || undefined,
        followUpTaskId: entry.followUpTaskId,
      })

      toast("Focus session saved", {
        description:
          outcome === "done"
            ? "Marked task complete."
            : outcome === "blocked"
              ? "Marked blocked and created follow-up task."
              : "Updated task to in progress.",
      })
    } catch (error) {
      toast("Unable to save focus outcome", {
        description: error instanceof Error ? error.message : "Please try again.",
      })
    }

    resetSession()
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
      <SidebarInset className="relative overflow-hidden bg-[radial-gradient(circle_at_20%_-10%,rgba(6,182,212,0.2),transparent_35%),radial-gradient(circle_at_95%_5%,rgba(20,184,166,0.2),transparent_35%),linear-gradient(180deg,#f4fbfc_0%,#eef9fb_100%)] dark:bg-[radial-gradient(circle_at_20%_-10%,rgba(6,182,212,0.22),transparent_35%),radial-gradient(circle_at_95%_5%,rgba(20,184,166,0.2),transparent_35%),linear-gradient(180deg,#05171a_0%,#031116_100%)]">
        {state === "RUNNING" && (
          <div className="pointer-events-none absolute inset-0 z-0">
            <div className="absolute inset-0 animate-pulse bg-cyan-500/5 duration-[6000ms]" />
          </div>
        )}

        <SiteHeader currentPage="Focus Mode" />

        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-5 md:px-6 md:py-6 lg:pr-20">
          <div className="w-full max-w-xl text-center">
            {state === "START" && (
              <div className="animate-in fade-in zoom-in duration-700">
                <div className="mx-auto mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-500">
                  <Timer className="size-7" />
                </div>
                <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                  Start from one task
                </h1>
                <p className="mt-4 text-muted-foreground">
                  Every session must be linked to a task so your outcome updates real work.
                </p>

                <div className="mt-8 space-y-2 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-left">
                  <p className="text-xs font-medium uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
                    Focus Task
                  </p>
                  {roomIdParam ? roomTasksQuery === undefined : assignedTasksQuery === undefined ? (
                    <p className="text-sm text-muted-foreground">
                      {roomIdParam ? "Loading room tasks..." : "Loading your assigned tasks..."}
                    </p>
                  ) : focusCandidates.length === 0 ? (
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>No active assigned tasks found. Pick a task from a room board first.</p>
                      <Link
                        href="/dashboard"
                        className="inline-flex text-cyan-700 hover:text-cyan-600 dark:text-cyan-300"
                      >
                        Go to dashboard
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {focusCandidates.slice(0, 6).map((task) => (
                        <button
                          key={`${task.roomId}-${task.taskId}`}
                          type="button"
                          onClick={() => {
                            setSelectedTaskId(task.taskId)
                            setIntention(task.title)
                          }}
                          className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                            selectedTaskId === task.taskId
                              ? "border-cyan-500/50 bg-cyan-500/20"
                              : "border-cyan-500/20 bg-background/60 hover:border-cyan-500/40"
                          }`}
                        >
                          <p className="font-medium">{task.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {task.roomName} • {task.status}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-col gap-4">
                  <Input
                    placeholder="Session intention"
                    value={intention}
                    onChange={(e) => setIntention(e.target.value)}
                    className="h-12 border-cyan-500/20 bg-background/50 text-center text-base placeholder:text-muted-foreground/50 focus-visible:ring-cyan-500/30"
                  />

                  <div className="space-y-2 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-left">
                    <p className="text-xs font-medium uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
                      Session Length
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {[25, 45, 60, 90].map((minutes) => (
                        <button
                          key={minutes}
                          type="button"
                          onClick={() => setDurationMinutes(minutes)}
                          className={`rounded-md border px-3 py-1 text-sm transition-colors ${
                            durationMinutes === minutes
                              ? "border-cyan-500/50 bg-cyan-500/20 text-cyan-800 dark:text-cyan-200"
                              : "border-cyan-500/20 bg-background/60 text-muted-foreground hover:border-cyan-500/40"
                          }`}
                        >
                          {minutes}m
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button
                    size="lg"
                    onClick={startSession}
                    disabled={!selectedTask || !selectedRoomId}
                    className="h-14 bg-cyan-500 text-slate-950 transition-all hover:bg-cyan-400 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Start Focus Session
                    <ArrowRight className="ml-2 size-5" />
                  </Button>
                </div>
              </div>
            )}

            {state === "RUNNING" && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
                <p className="text-sm font-medium tracking-widest text-cyan-600 dark:text-cyan-400">
                  SESSION IN PROGRESS
                </p>
                <h1 className="mt-8 text-8xl font-light tracking-tighter tabular-nums text-slate-900 dark:text-slate-100 md:text-9xl">
                  {formatTime(timeLeft)}
                </h1>
                <div className="mt-10 space-y-2">
                  <p className="text-xl font-medium italic text-slate-800 dark:text-slate-200">
                    &quot;{intention || selectedTask?.title || "Deep Work"}&quot;
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Task: {selectedTask?.title ?? "Selected task"}
                  </p>
                  <p className="text-muted-foreground">{ambientCopy}</p>
                </div>
                <div className="mt-16 flex items-center justify-center gap-6">
                  <button
                    onClick={finishSession}
                    className="text-sm font-medium text-muted-foreground transition-colors hover:text-cyan-600 dark:hover:text-cyan-400"
                  >
                    End session
                  </button>
                </div>
              </div>
            )}

            {state === "REFLECT" && (
              <div className="animate-in fade-in zoom-in duration-700">
                <div className="mx-auto mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-500">
                  <CheckCircle2 className="size-7" />
                </div>
                <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">What changed?</h1>
                <p className="mt-4 text-muted-foreground">
                  Pick an outcome. We will update your linked task automatically.
                </p>

                <div className="mt-8 grid gap-2 text-left sm:grid-cols-3">
                  {[
                    { key: "done", label: "Done" },
                    { key: "progress", label: "Progress made" },
                    { key: "blocked", label: "Blocked" },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setOutcome(item.key as FocusOutcome)}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        outcome === item.key
                          ? "border-cyan-500/50 bg-cyan-500/20"
                          : "border-cyan-500/20 bg-background/60"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {outcome === "blocked" ? (
                  <Input
                    placeholder="What blocked you?"
                    value={blockerNote}
                    onChange={(event) => setBlockerNote(event.target.value)}
                    className="mt-4 h-12 border-cyan-500/20 bg-background/50 text-center text-base placeholder:text-muted-foreground/50 focus-visible:ring-cyan-500/30"
                  />
                ) : null}

                <Input
                  placeholder="Optional reflection"
                  value={reflection}
                  onChange={(event) => setReflection(event.target.value)}
                  className="mt-4 h-12 border-cyan-500/20 bg-background/50 text-center text-base placeholder:text-muted-foreground/50 focus-visible:ring-cyan-500/30"
                />
                <Button
                  size="lg"
                  onClick={() => {
                    void saveSessionAndReset()
                  }}
                  className="mt-4 h-14 w-full bg-cyan-500 text-slate-950 transition-all hover:bg-cyan-400"
                >
                  Save Outcome
                </Button>
              </div>
            )}

            {sessionHistory.length > 0 && state !== "RUNNING" && (
              <div className="mt-12 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-left backdrop-blur">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
                    Recent Sessions
                  </h2>
                  <Badge variant="secondary">{sessionHistory.length}</Badge>
                </div>
                <ul className="space-y-2">
                  {sessionHistory.slice(0, 5).map((session) => (
                    <li
                      key={session.id}
                      className="rounded-lg border border-cyan-500/20 bg-background/70 p-3"
                    >
                      <p className="text-sm font-medium">{session.intention}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {session.durationMinutes} min • {formatSessionTime(session.completedAt)}
                      </p>
                      {session.outcome ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Outcome: {session.outcome}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {state !== "RUNNING" && (
              <div className="mt-6 rounded-2xl border border-cyan-500/20 bg-background/60 p-4 text-left">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
                  Focus Impact Today
                </h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
                    <p className="text-xs text-muted-foreground">Focused time</p>
                    <p className="mt-1 text-xl font-semibold">
                      {progressStats.todayMinutes} min
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {progressStats.todaySessions.length} sessions
                    </p>
                  </div>
                  <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
                    <p className="text-xs text-muted-foreground">Tasks moved</p>
                    <p className="mt-1 text-xl font-semibold">{progressStats.movedTasksToday}</p>
                    <p className="text-xs text-muted-foreground">Done or progress</p>
                  </div>
                  <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
                    <p className="text-xs text-muted-foreground">Blockers raised</p>
                    <p className="mt-1 text-xl font-semibold">{progressStats.blockersRaisedToday}</p>
                    <p className="text-xs text-muted-foreground">Auto follow-ups created</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </SidebarInset>
      <RightSidebar />
    </SidebarProvider>
  )
}
