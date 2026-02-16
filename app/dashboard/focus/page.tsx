"use client"

import * as React from "react"
import { useMutation, useQuery } from "convex/react"
import { AppSidebar } from "@/components/app-sidebar"
import { RightSidebar } from "@/components/right-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { focusSessionsApi } from "@/lib/convex-focus-sessions-api"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Timer, ArrowRight, CheckCircle2 } from "lucide-react"

type SessionState = "START" | "RUNNING" | "REFLECT"

type FocusSessionRecord = {
  id: string
  intention: string
  reflection: string
  durationMinutes: number
  completedAt: string
}

type FocusRuntime = {
  state: SessionState
  intention: string
  reflection: string
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
const RUNTIME_STORAGE_KEY = "nook.focus.runtime.v1"

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
  const [state, setState] = React.useState<SessionState>("START")
  const [intention, setIntention] = React.useState("")
  const [reflection, setReflection] = React.useState("")
  const [durationMinutes, setDurationMinutes] = React.useState(45)
  const [timeLeft, setTimeLeft] = React.useState(45 * 60)
  const [sessionStartedAt, setSessionStartedAt] = React.useState<number | null>(null)
  const [sessionEndsAt, setSessionEndsAt] = React.useState<number | null>(null)
  const [sessionDurationSeconds, setSessionDurationSeconds] = React.useState(45 * 60)
  const [ambientCopy, setAmbientCopy] = React.useState(AMBIENT_COPY[0])
  const [runtimeReady, setRuntimeReady] = React.useState(false)

  const sessionDocs = useQuery(focusSessionsApi.list) as
    | Array<
        FocusSessionRecord & {
          _id: string
          sessionId: string
        }
      >
    | undefined
  const ensureDefaults = useMutation(focusSessionsApi.ensureDefaults)
  const createSession = useMutation(focusSessionsApi.create)
  const sessionHistory = React.useMemo(() => {
    if (!sessionDocs) return []
    return sessionDocs.map((session) => ({
      id: session.sessionId,
      intention: session.intention,
      reflection: session.reflection,
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

    const dailyMap = new Map<
      string,
      { minutes: number; sessions: number; intentions: string[] }
    >()

    for (const session of sessionHistory) {
      const date = new Date(session.completedAt)
      if (Number.isNaN(date.getTime())) continue
      const key = toLocalDateKey(date)
      const current = dailyMap.get(key) ?? { minutes: 0, sessions: 0, intentions: [] }
      current.minutes += session.durationMinutes
      current.sessions += 1
      current.intentions.push(session.intention)
      dailyMap.set(key, current)
    }

    const dailyEntries = Array.from(dailyMap.entries())
      .sort((left, right) => (left[0] < right[0] ? 1 : -1))
      .slice(0, 7)

    return {
      todaySessions,
      todayMinutes: todaySessions.reduce(
        (total, session) => total + session.durationMinutes,
        0
      ),
      weekMinutes,
      dailyEntries,
    }
  }, [sessionHistory])

  React.useEffect(() => {
    void ensureDefaults({})
  }, [ensureDefaults])

  React.useEffect(() => {
    const runtime = readRuntime()
    if (!runtime) {
      setRuntimeReady(true)
      return
    }

    setState(runtime.state)
    setIntention(runtime.intention)
    setReflection(runtime.reflection)
    setDurationMinutes(clampDuration(runtime.durationMinutes || 45))
    setSessionStartedAt(runtime.sessionStartedAt)
    setSessionEndsAt(runtime.sessionEndsAt)
    setSessionDurationSeconds(runtime.sessionDurationSeconds || 45 * 60)
    setAmbientCopy(runtime.ambientCopy || AMBIENT_COPY[0])

    if (runtime.state === "RUNNING" && runtime.sessionEndsAt) {
      const remaining = Math.max(
        0,
        Math.ceil((runtime.sessionEndsAt - Date.now()) / 1000)
      )
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
        setDurationMinutes(45)
        setTimeLeft(45 * 60)
        setSessionStartedAt(null)
        setSessionEndsAt(null)
        setSessionDurationSeconds(45 * 60)
        setAmbientCopy(AMBIENT_COPY[0])
        return
      }

      setState(runtime.state)
      setIntention(runtime.intention)
      setReflection(runtime.reflection)
      setDurationMinutes(clampDuration(runtime.durationMinutes || 45))
      setSessionStartedAt(runtime.sessionStartedAt)
      setSessionEndsAt(runtime.sessionEndsAt)
      setSessionDurationSeconds(runtime.sessionDurationSeconds || 45 * 60)
      setAmbientCopy(runtime.ambientCopy || AMBIENT_COPY[0])

      if (runtime.state === "RUNNING" && runtime.sessionEndsAt) {
        const remaining = Math.max(
          0,
          Math.ceil((runtime.sessionEndsAt - Date.now()) / 1000)
        )
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
      intention,
      reflection,
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
    intention,
    reflection,
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
        }
      }, 1000)
    }
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [state, sessionEndsAt])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const startSession = () => {
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
    setAmbientCopy(AMBIENT_COPY[Math.floor(Math.random() * AMBIENT_COPY.length)])
  }

  const finishSession = () => {
    setState("REFLECT")
    setSessionEndsAt(null)
  }

  const resetSession = () => {
    setState("START")
    setIntention("")
    setReflection("")
    setTimeLeft(durationMinutes * 60)
    setSessionStartedAt(null)
    setSessionEndsAt(null)
    setSessionDurationSeconds(durationMinutes * 60)
    window.localStorage.removeItem(RUNTIME_STORAGE_KEY)
  }

  const saveSessionAndReset = async (skipReflection: boolean) => {
    if (sessionStartedAt) {
      const elapsedSeconds = Math.max(1, sessionDurationSeconds - timeLeft)
      const durationCompletedMinutes = Math.max(1, Math.round(elapsedSeconds / 60))
      const entry: FocusSessionRecord = {
        id: `session-${Date.now()}`,
        intention: intention.trim() || "Deep Work",
        reflection: skipReflection ? "" : reflection.trim(),
        durationMinutes: durationCompletedMinutes,
        completedAt: new Date().toISOString(),
      }

      await createSession({
        sessionId: entry.id,
        intention: entry.intention,
        reflection: entry.reflection,
        durationMinutes: entry.durationMinutes,
        completedAt: entry.completedAt,
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
                  What are you focusing on right now?
                </h1>
                <p className="mt-4 text-muted-foreground">
                  Write one small, clear intention for this session.
                  <br />
                  <span className="text-sm opacity-80">No pressure, just something you&apos;d feel good finishing today.</span>
                </p>
                <div className="mt-10 flex flex-col gap-4">
                  <Input
                    placeholder="Today's focus:"
                    value={intention}
                    onChange={(e) => setIntention(e.target.value)}
                    className="h-14 border-cyan-500/20 bg-background/50 text-center text-lg placeholder:text-muted-foreground/50 focus-visible:ring-cyan-500/30"
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
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-xs text-muted-foreground">Custom:</span>
                      <Input
                        type="number"
                        min={MIN_DURATION}
                        max={MAX_DURATION}
                        value={durationMinutes}
                        onChange={(event) => {
                          const parsed = Number.parseInt(event.target.value, 10)
                          if (Number.isNaN(parsed)) return
                          setDurationMinutes(clampDuration(parsed))
                        }}
                        className="h-9 w-24 border-cyan-500/25 bg-background/70 focus-visible:ring-cyan-500/30"
                      />
                      <span className="text-xs text-muted-foreground">minutes</span>
                    </div>
                  </div>

                  <Button
                    size="lg"
                    onClick={startSession}
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
                    &quot;{intention || "Deep Work"}&quot;
                  </p>
                  <p className="text-muted-foreground">{ambientCopy}</p>
                </div>
                <div className="mt-16 flex items-center justify-center gap-6">
                  <button
                    onClick={finishSession}
                    className="text-sm font-medium text-muted-foreground transition-colors hover:text-cyan-600 dark:hover:text-cyan-400"
                  >
                    Finish quietly
                  </button>
                </div>
              </div>
            )}

            {state === "REFLECT" && (
              <div className="animate-in fade-in zoom-in duration-700">
                <div className="mx-auto mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-500">
                  <CheckCircle2 className="size-7" />
                </div>
                <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                  What did you move forward during this session?
                </h1>
                <p className="mt-4 text-muted-foreground">Even small progress counts.</p>
                <div className="mt-10 flex flex-col gap-4">
                  <Input
                    placeholder="Reflect on your progress..."
                    value={reflection}
                    onChange={(event) => setReflection(event.target.value)}
                    className="h-14 border-cyan-500/20 bg-background/50 text-center text-lg placeholder:text-muted-foreground/50 focus-visible:ring-cyan-500/30"
                  />
                  <Button
                    size="lg"
                    onClick={() => saveSessionAndReset(false)}
                    className="h-14 bg-cyan-500 text-slate-950 transition-all hover:bg-cyan-400"
                  >
                    Save and Finish
                  </Button>
                  <button
                    onClick={() => saveSessionAndReset(true)}
                    className="text-sm font-medium text-muted-foreground transition-colors hover:text-cyan-600"
                  >
                    Skip reflection
                  </button>
                </div>
                <p className="mt-12 text-sm text-muted-foreground/60">
                  Session complete. Nice work showing up.
                </p>
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
                      {session.reflection ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          &quot;{session.reflection}&quot;
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
                  Productivity Snapshot
                </h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
                    <p className="text-xs text-muted-foreground">Today</p>
                    <p className="mt-1 text-xl font-semibold">
                      {progressStats.todayMinutes} min
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {progressStats.todaySessions.length} sessions
                    </p>
                  </div>
                  <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
                    <p className="text-xs text-muted-foreground">Last 7 days</p>
                    <p className="mt-1 text-xl font-semibold">
                      {progressStats.weekMinutes} min
                    </p>
                    <p className="text-xs text-muted-foreground">Total focused work</p>
                  </div>
                  <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
                    <p className="text-xs text-muted-foreground">Latest done</p>
                    <p className="mt-1 line-clamp-2 text-sm font-medium">
                      {sessionHistory[0]?.intention ?? "No sessions yet"}
                    </p>
                  </div>
                </div>

                {progressStats.todaySessions.length > 0 ? (
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700/80 dark:text-cyan-300/80">
                      Today&apos;s Completed Work
                    </p>
                    <ul className="mt-2 space-y-2">
                      {progressStats.todaySessions.slice(0, 5).map((session) => (
                        <li
                          key={session.id}
                          className="rounded-md border border-cyan-500/15 bg-background/70 px-3 py-2 text-sm"
                        >
                          <span className="font-medium">{session.intention}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({session.durationMinutes} min)
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}

          </div>
        </div>
      </SidebarInset>
      <RightSidebar />
    </SidebarProvider>
  )
}
