"use client"

import * as React from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { RightSidebar } from "@/components/right-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

const AMBIENT_COPY = [
  "You’re in Café Mode. Others are quietly working too.",
  "A calm room. One task. Take your time.",
  "Focusing…",
]

const STORAGE_KEY = "nook.focus-sessions.v1"

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

export default function FocusPage() {
  const [state, setState] = React.useState<SessionState>("START")
  const [intention, setIntention] = React.useState("")
  const [reflection, setReflection] = React.useState("")
  const [timeLeft, setTimeLeft] = React.useState(45 * 60)
  const [sessionStartedAt, setSessionStartedAt] = React.useState<number | null>(null)
  const [ambientCopy, setAmbientCopy] = React.useState(AMBIENT_COPY[0])
  const [sessionHistory, setSessionHistory] = React.useState<FocusSessionRecord[]>([])

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as FocusSessionRecord[]
      if (Array.isArray(parsed)) {
        setSessionHistory(parsed)
      }
    } catch {
      // Ignore malformed local storage data.
    }
  }, [])

  React.useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionHistory))
  }, [sessionHistory])

  React.useEffect(() => {
    let timer: NodeJS.Timeout
    if (state === "RUNNING" && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1)
      }, 1000)
    } else if (timeLeft === 0) {
      setState("REFLECT")
    }
    return () => clearInterval(timer)
  }, [state, timeLeft])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const startSession = () => {
    setState("RUNNING")
    setSessionStartedAt(Date.now())
    setReflection("")
    setAmbientCopy(AMBIENT_COPY[Math.floor(Math.random() * AMBIENT_COPY.length)])
  }

  const finishSession = () => {
    setState("REFLECT")
  }

  const resetSession = () => {
    setState("START")
    setIntention("")
    setReflection("")
    setTimeLeft(45 * 60)
    setSessionStartedAt(null)
  }

  const saveSessionAndReset = (skipReflection: boolean) => {
    if (sessionStartedAt) {
      const elapsedSeconds = Math.max(1, 45 * 60 - timeLeft)
      const durationMinutes = Math.max(1, Math.round(elapsedSeconds / 60))
      const entry: FocusSessionRecord = {
        id: `session-${Date.now()}`,
        intention: intention.trim() || "Deep Work",
        reflection: skipReflection ? "" : reflection.trim(),
        durationMinutes,
        completedAt: new Date().toISOString(),
      }

      setSessionHistory((prev) => [entry, ...prev].slice(0, 20))
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
                  <span className="text-sm opacity-80">No pressure — just something you’d feel good finishing in 45 minutes.</span>
                </p>
                <div className="mt-10 flex flex-col gap-4">
                  <Input
                    placeholder="Today's focus:"
                    value={intention}
                    onChange={(e) => setIntention(e.target.value)}
                    className="h-14 border-cyan-500/20 bg-background/50 text-center text-lg placeholder:text-muted-foreground/50 focus-visible:ring-cyan-500/30"
                  />
                  <Button
                    size="lg"
                    onClick={startSession}
                    className="h-14 bg-cyan-500 text-slate-950 transition-all hover:bg-cyan-400 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Enter Cafe Mode
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
                  <p className="text-muted-foreground">
                    {ambientCopy}
                  </p>
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
                <p className="mt-4 text-muted-foreground">
                  Even small progress counts.
                </p>
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

          </div>
        </div>
      </SidebarInset>
      <RightSidebar />
    </SidebarProvider>
  )
}
