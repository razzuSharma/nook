"use client"

import * as React from "react"
import { useMutation, useQuery } from "convex/react"

import { AppSidebar } from "@/components/app-sidebar"
import { RightSidebar } from "@/components/right-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { focusSessionsApi } from "@/lib/convex-focus-sessions-api"
import { tasksApi } from "@/lib/convex-tasks-api"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

type FocusSessionItem = {
  _id: string
  sessionId: string
  intention: string
  durationMinutes: number
  completedAt: string
}

type TaskItem = {
  _id: string
  taskId: string
  status: "todo" | "working" | "completed"
  completedAt?: number
  updatedAt: number
}

function toLocalDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function fromLocalDateKey(key: string) {
  return new Date(`${key}T00:00:00`)
}

function lastDays(count: number) {
  const days: string[] = []
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(now)
    date.setDate(now.getDate() - i)
    days.push(toLocalDateKey(date))
  }
  return days
}

function pearson(xs: number[], ys: number[]) {
  if (xs.length !== ys.length || xs.length < 2) return null
  const n = xs.length
  const sumX = xs.reduce((acc, value) => acc + value, 0)
  const sumY = ys.reduce((acc, value) => acc + value, 0)
  const sumXY = xs.reduce((acc, value, index) => acc + value * ys[index], 0)
  const sumX2 = xs.reduce((acc, value) => acc + value * value, 0)
  const sumY2 = ys.reduce((acc, value) => acc + value * value, 0)

  const numerator = n * sumXY - sumX * sumY
  const denominator = Math.sqrt(
    (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
  )
  if (denominator === 0) return null
  return numerator / denominator
}

function describeCorrelation(value: number | null) {
  if (value === null) return "Not enough variance yet"
  const absolute = Math.abs(value)
  if (absolute >= 0.7) return value > 0 ? "Strong positive" : "Strong inverse"
  if (absolute >= 0.4) return value > 0 ? "Moderate positive" : "Moderate inverse"
  if (absolute >= 0.2) return value > 0 ? "Mild positive" : "Mild inverse"
  return "Weak / no clear pattern"
}

function computeCurrentStreak(activeDayKeys: Set<string>) {
  let streak = 0
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)

  while (activeDayKeys.has(toLocalDateKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}

export default function ProgressPage() {
  const focusDocs = useQuery(focusSessionsApi.list) as FocusSessionItem[] | undefined
  const taskDocs = useQuery(tasksApi.list) as TaskItem[] | undefined
  const ensureFocusDefaults = useMutation(focusSessionsApi.ensureDefaults)
  const ensureTaskDefaults = useMutation(tasksApi.ensureDefaults)

  React.useEffect(() => {
    void ensureFocusDefaults({})
    void ensureTaskDefaults({})
  }, [ensureFocusDefaults, ensureTaskDefaults])

  const summary = React.useMemo(() => {
    const sessions = focusDocs ?? []
    const tasks = taskDocs ?? []
    const keys = lastDays(7)

    const focusByDay = new Map<string, number>()
    const intentionsByDay = new Map<string, string[]>()
    for (const session of sessions) {
      const date = new Date(session.completedAt)
      if (Number.isNaN(date.getTime())) continue
      const key = toLocalDateKey(date)
      focusByDay.set(key, (focusByDay.get(key) ?? 0) + session.durationMinutes)
      intentionsByDay.set(key, [...(intentionsByDay.get(key) ?? []), session.intention])
    }

    const completedByDay = new Map<string, number>()
    for (const task of tasks) {
      if (task.status !== "completed") continue
      const stamp = task.completedAt ?? task.updatedAt
      const date = new Date(stamp)
      if (Number.isNaN(date.getTime())) continue
      const key = toLocalDateKey(date)
      completedByDay.set(key, (completedByDay.get(key) ?? 0) + 1)
    }

    const points = keys.map((key) => ({
      key,
      label: fromLocalDateKey(key).toLocaleDateString(undefined, { weekday: "short" }),
      focusMinutes: focusByDay.get(key) ?? 0,
      completedTasks: completedByDay.get(key) ?? 0,
      intentions: intentionsByDay.get(key) ?? [],
    }))

    const focusTotals = points.reduce((acc, point) => acc + point.focusMinutes, 0)
    const taskTotals = points.reduce((acc, point) => acc + point.completedTasks, 0)
    const today = points[points.length - 1]
    const maxFocus = Math.max(1, ...points.map((point) => point.focusMinutes))
    const maxCompleted = Math.max(1, ...points.map((point) => point.completedTasks))

    const activeDays = new Set(
      sessions
        .map((session) => {
          const date = new Date(session.completedAt)
          return Number.isNaN(date.getTime()) ? null : toLocalDateKey(date)
        })
        .filter((value): value is string => Boolean(value))
    )

    const correlationValue = pearson(
      points.map((point) => point.focusMinutes),
      points.map((point) => point.completedTasks)
    )

    return {
      points,
      today,
      focusTotals,
      taskTotals,
      maxFocus,
      maxCompleted,
      currentStreak: computeCurrentStreak(activeDays),
      correlationValue,
      correlationLabel: describeCorrelation(correlationValue),
      minutesPerCompletedTask:
        taskTotals > 0 ? Math.round((focusTotals / taskTotals) * 10) / 10 : null,
    }
  }, [focusDocs, taskDocs])

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
        <SiteHeader currentPage="Progress" actionLabel="Review Week" />
        <div className="flex flex-1 flex-col px-4 py-5 md:px-6 md:py-6 lg:pr-20">
          <div className="mx-auto w-full max-w-6xl space-y-6">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                Progress Dashboard
              </h1>
              <p className="mt-2 text-muted-foreground">
                Track focused minutes, completed work, and your momentum trend.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <Card className="border-cyan-500/20 bg-cyan-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Today Focus</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{summary.today.focusMinutes}m</p>
                </CardContent>
              </Card>
              <Card className="border-cyan-500/20 bg-cyan-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Current Streak</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{summary.currentStreak} days</p>
                </CardContent>
              </Card>
              <Card className="border-cyan-500/20 bg-cyan-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">7-Day Focus</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{summary.focusTotals}m</p>
                </CardContent>
              </Card>
              <Card className="border-cyan-500/20 bg-cyan-500/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">7-Day Tasks Done</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{summary.taskTotals}</p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-cyan-500/20 bg-background/70 backdrop-blur">
              <CardHeader>
                <CardTitle>Daily Trend (Last 7 Days)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {summary.points.map((point) => (
                  <div key={point.key} className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{point.label}</span>
                      <span className="text-muted-foreground">
                        {point.focusMinutes}m focus • {point.completedTasks} tasks
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="h-2 w-full overflow-hidden rounded bg-cyan-500/10">
                        <div
                          className="h-full rounded bg-cyan-500/70"
                          style={{
                            width: `${Math.round(
                              (point.focusMinutes / summary.maxFocus) * 100
                            )}%`,
                          }}
                        />
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded bg-emerald-500/10">
                        <div
                          className="h-full rounded bg-emerald-500/70"
                          style={{
                            width: `${Math.round(
                              (point.completedTasks / summary.maxCompleted) * 100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-cyan-500/20 bg-background/70">
                <CardHeader>
                  <CardTitle>Focus vs Completion Correlation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>
                    Correlation score:{" "}
                    <span className="font-semibold">
                      {summary.correlationValue === null
                        ? "n/a"
                        : summary.correlationValue.toFixed(2)}
                    </span>
                  </p>
                  <p className="text-muted-foreground">{summary.correlationLabel}</p>
                  <p>
                    Minutes per completed task:{" "}
                    <span className="font-semibold">
                      {summary.minutesPerCompletedTask === null
                        ? "n/a"
                        : `${summary.minutesPerCompletedTask} min/task`}
                    </span>
                  </p>
                </CardContent>
              </Card>

              <Card className="border-cyan-500/20 bg-background/70">
                <CardHeader>
                  <CardTitle>Today&apos;s Done List</CardTitle>
                </CardHeader>
                <CardContent>
                  {summary.today.intentions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No focus sessions completed yet today.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {summary.today.intentions.slice(0, 6).map((intention, index) => (
                        <li
                          key={`${summary.today.key}-${index}`}
                          className="rounded-md border border-cyan-500/15 bg-cyan-500/5 px-3 py-2 text-sm"
                        >
                          {intention}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3">
                    <Badge variant="secondary">
                      {summary.today.focusMinutes} min focused today
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </SidebarInset>
      <RightSidebar />
    </SidebarProvider>
  )
}
