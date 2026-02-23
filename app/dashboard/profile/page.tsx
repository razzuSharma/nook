"use client"

import * as React from "react"
import Image from "next/image"
import { useQuery } from "convex/react"
import { useTheme } from "next-themes"
import { Flame, Trophy, Upload, UserRound } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { useAuth } from "@/components/providers/auth-provider"
import { AvatarPicker } from "@/components/avatar/avatar-picker"
import { avatarSrcForKey, normalizeAvatarKey } from "@/lib/avatar-options"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { tasksApi } from "@/lib/convex-tasks-api"
import { focusSessionsApi } from "@/lib/convex-focus-sessions-api"
import { roomsApi } from "@/lib/convex-rooms-api"
import type { Id } from "@/convex/_generated/dataModel"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

const statusOptions = [
  { value: "available", label: "Available", emoji: "🟢" },
  { value: "busy", label: "Busy", emoji: "🟡" },
  { value: "deep_work", label: "In Deep Work", emoji: "🔴" },
  { value: "offline", label: "Off for the day", emoji: "🌙" },
] as const

const timezones = [
  "UTC",
  "Asia/Kathmandu",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Australia/Sydney",
]

type TaskDoc = {
  completedAt?: number
  createdAt: number
}

type FocusSessionDoc = {
  durationMinutes: number
  createdAt: number
}

type RoomListItem = {
  _id: Id<"rooms">
  name: string
}

function startOfLocalDay(timestamp: number) {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function dateLabel(timestamp: number) {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="border-b border-cyan-500/15 pb-2">
      <h3 className="text-sm font-semibold tracking-wide">{title}</h3>
      {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
    </div>
  )
}

function CompactSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 text-sm"
    >
      <span>{label}</span>
      <span
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          checked ? "bg-cyan-500" : "bg-slate-300 dark:bg-slate-700"
        }`}
      >
        <span
          className={`inline-block size-4 transform rounded-full bg-white transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  )
}

export default function ProfilePage() {
  const { user, updateProfile, sessionToken } = useAuth()
  const { setTheme } = useTheme()
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)

  const [name, setName] = React.useState(user?.name ?? "")
  const [avatarKey, setAvatarKey] = React.useState(user?.avatarKey ?? "avatar-1")
  const [customAvatarUrl, setCustomAvatarUrl] = React.useState(user?.customAvatarUrl ?? "")
  const [showAvatarUrlInput, setShowAvatarUrlInput] = React.useState(false)
  const [username, setUsername] = React.useState(user?.username ?? "")
  const [roleTitle, setRoleTitle] = React.useState(user?.roleTitle ?? "")
  const [timezone, setTimezone] = React.useState(user?.timezone ?? "UTC")
  const [bio, setBio] = React.useState(user?.bio ?? "")
  const [status, setStatus] = React.useState<
    "available" | "busy" | "deep_work" | "offline"
  >(user?.status ?? "available")
  const [workingHours, setWorkingHours] = React.useState(user?.workingHours ?? "")
  const [notificationEmail, setNotificationEmail] = React.useState(
    user?.notificationEmail ?? true
  )
  const [notificationInApp, setNotificationInApp] = React.useState(
    user?.notificationInApp ?? true
  )
  const [digestFrequency, setDigestFrequency] = React.useState<
    "off" | "daily" | "weekly"
  >(user?.digestFrequency ?? "daily")
  const [themePreference, setThemePreference] = React.useState<
    "system" | "light" | "dark"
  >(user?.themePreference ?? "system")
  const [defaultRoomId, setDefaultRoomId] = React.useState(user?.defaultRoomId ?? "")
  const [error, setError] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)

  const tasks = useQuery(tasksApi.list, sessionToken ? { sessionToken } : "skip") as
    | TaskDoc[]
    | undefined
  const focusSessions = useQuery(
    focusSessionsApi.list,
    sessionToken ? { sessionToken } : "skip"
  ) as FocusSessionDoc[] | undefined
  const roomDocs = useQuery(roomsApi.list) as RoomListItem[] | undefined

  React.useEffect(() => {
    if (!user) return
    setName(user.name)
    setAvatarKey(normalizeAvatarKey(user.avatarKey))
    setCustomAvatarUrl(user.customAvatarUrl ?? "")
    setUsername(user.username ?? "")
    setRoleTitle(user.roleTitle ?? "")
    setTimezone(user.timezone ?? "UTC")
    setBio(user.bio ?? "")
    setStatus(user.status ?? "available")
    setWorkingHours(user.workingHours ?? "")
    setNotificationEmail(user.notificationEmail ?? true)
    setNotificationInApp(user.notificationInApp ?? true)
    setDigestFrequency(user.digestFrequency ?? "daily")
    setThemePreference(user.themePreference ?? "system")
    setDefaultRoomId(user.defaultRoomId ?? "")
  }, [user])

  const weeklyStats = React.useMemo(() => {
    const now = Date.now()
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000
    const focusMinutes = (focusSessions ?? [])
      .filter((session) => session.createdAt >= weekAgo)
      .reduce((total, session) => total + session.durationMinutes, 0)
    const tasksCompleted = (tasks ?? []).filter(
      (task) => task.completedAt && task.completedAt >= weekAgo
    ).length
    return {
      focusHours: Number((focusMinutes / 60).toFixed(1)),
      tasksCompleted,
    }
  }, [focusSessions, tasks])

  const activityMap = React.useMemo(() => {
    const map = new Map<number, number>()
    for (const session of focusSessions ?? []) {
      const key = startOfLocalDay(session.createdAt)
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    for (const task of tasks ?? []) {
      const source = task.completedAt ?? task.createdAt
      const key = startOfLocalDay(source)
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return map
  }, [focusSessions, tasks])

  const contributionDays = React.useMemo(() => {
    const days: Array<{ day: number; count: number }> = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    for (let offset = 29; offset >= 0; offset -= 1) {
      const day = today.getTime() - offset * 24 * 60 * 60 * 1000
      days.push({ day, count: activityMap.get(day) ?? 0 })
    }
    return days
  }, [activityMap])

  const currentStreak = React.useMemo(() => {
    let streak = 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    for (let offset = 0; offset < 90; offset += 1) {
      const day = today.getTime() - offset * 24 * 60 * 60 * 1000
      if ((activityMap.get(day) ?? 0) > 0) streak += 1
      else break
    }
    return streak
  }, [activityMap])

  const selectedStatus = statusOptions.find((option) => option.value === status)
  const selectedAvatarSrc = customAvatarUrl || avatarSrcForKey(avatarKey)
  const totalActivity = React.useMemo(
    () => contributionDays.reduce((sum, item) => sum + item.count, 0),
    [contributionDays]
  )

  function contributionColor(count: number) {
    if (count === 0) return "bg-slate-200 dark:bg-slate-800"
    if (count === 1) return "bg-cyan-500/45"
    if (count === 2) return "bg-cyan-500/70"
    return "bg-cyan-500"
  }

  async function onCustomAvatarUpload(file: File | null) {
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result : ""
      setCustomAvatarUrl(value)
      setShowAvatarUrlInput(false)
      setError(null)
    }
    reader.readAsDataURL(file)
  }

  async function onSave() {
    setError(null)
    setIsSaving(true)
    try {
      await updateProfile({
        name,
        avatarKey: normalizeAvatarKey(avatarKey),
        customAvatarUrl: customAvatarUrl.trim() || undefined,
        username: username.replace(/^@+/, "").trim() || undefined,
        roleTitle: roleTitle.trim() || undefined,
        timezone,
        bio: bio.trim() || undefined,
        status,
        workingHours: workingHours.trim() || undefined,
        notificationEmail,
        notificationInApp,
        digestFrequency,
        themePreference,
        defaultRoomId: defaultRoomId || undefined,
      })
      setTheme(themePreference)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update profile.")
    } finally {
      setIsSaving(false)
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
        <SiteHeader currentPage="Profile" />
        <div className="flex flex-1 flex-col px-4 py-5 md:px-6 md:py-6 lg:pr-20">
          <div className="mx-auto w-full max-w-4xl space-y-5">
            <Card className="border-cyan-500/20 bg-background/70">
              <CardHeader>
                <CardTitle>Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="group relative size-[72px] overflow-hidden rounded-2xl border border-cyan-400/40 bg-cyan-500/10 shadow-[0_10px_30px_-16px_rgba(6,182,212,0.9)]">
                    <Image
                      src={selectedAvatarSrc}
                      alt="Selected avatar"
                      fill
                      sizes="72px"
                      className="object-cover transition-transform duration-200 group-hover:scale-110"
                    />
                    <span className="absolute -right-1 -bottom-1 inline-flex size-4 items-center justify-center rounded-full border border-background bg-background/80 text-[10px]">
                      {selectedStatus?.emoji}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{user?.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedStatus?.emoji} {selectedStatus?.label}
                    </p>
                  </div>
                </div>

                <Tabs defaultValue="identity" className="w-full">
                  <TabsList className="w-full justify-start overflow-x-auto">
                    <TabsTrigger value="identity">Identity</TabsTrigger>
                    <TabsTrigger value="availability">Availability</TabsTrigger>
                    <TabsTrigger value="avatar">Avatar</TabsTrigger>
                    <TabsTrigger value="stats">Stats</TabsTrigger>
                    <TabsTrigger value="preferences">Preferences</TabsTrigger>
                  </TabsList>

                  <TabsContent value="identity" className="space-y-4 pt-3">
                    <SectionTitle title="Identity" subtitle="Core profile details for mentions and team context." />
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium" htmlFor="profile-name">
                          Name
                        </label>
                        <Input
                          id="profile-name"
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          placeholder="Your name"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium" htmlFor="profile-username">
                          Username
                        </label>
                        <Input
                          id="profile-username"
                          value={username}
                          onChange={(event) => setUsername(event.target.value)}
                          placeholder="@raju"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium" htmlFor="profile-role">
                          Role / Title
                        </label>
                        <Input
                          id="profile-role"
                          value={roleTitle}
                          onChange={(event) => setRoleTitle(event.target.value)}
                          placeholder="Frontend Developer"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Timezone</label>
                        <Select value={timezone} onValueChange={setTimezone}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select timezone" />
                          </SelectTrigger>
                          <SelectContent>
                            {timezones.map((value) => (
                              <SelectItem key={value} value={value}>
                                {value}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="profile-bio">
                        Bio
                      </label>
                      <textarea
                        id="profile-bio"
                        value={bio}
                        onChange={(event) => setBio(event.target.value)}
                        placeholder="Tell your team what you are focused on..."
                        className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="availability" className="space-y-4 pt-3">
                    <SectionTitle title="Availability" subtitle="Let teammates know when and how to reach you." />
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Status</p>
                      <div className="flex flex-wrap gap-3 sm:gap-2">
                        {statusOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setStatus(option.value)}
                            className={`rounded-full border px-3 py-1 text-sm ${
                              status === option.value
                                ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300"
                                : "border-input text-muted-foreground"
                            }`}
                          >
                            {option.emoji} {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="profile-hours">
                        Working Hours
                      </label>
                      <Input
                        id="profile-hours"
                        value={workingHours}
                        onChange={(event) => setWorkingHours(event.target.value)}
                        placeholder="Mon-Fri, 9am-6pm NPT"
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="avatar" className="space-y-4 pt-3">
                    <SectionTitle title="Avatar" subtitle="Use a preset style or add a custom image." />
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => fileInputRef.current?.click()}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          fileInputRef.current?.click()
                        }
                      }}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault()
                        void onCustomAvatarUpload(event.dataTransfer.files?.[0] ?? null)
                      }}
                      className="rounded-xl border border-dashed border-cyan-500/35 bg-cyan-500/5 p-5 text-center"
                    >
                      <Upload className="mx-auto size-5 text-cyan-700 dark:text-cyan-300" />
                      <p className="mt-2 text-sm font-medium">Drag and drop an image</p>
                      <p className="text-xs text-muted-foreground">or click to browse</p>
                      <Input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) =>
                          void onCustomAvatarUpload(event.target.files?.[0] ?? null)
                        }
                      />
                    </div>

                    <button
                      type="button"
                      className="text-xs text-cyan-700 underline dark:text-cyan-300"
                      onClick={() => setShowAvatarUrlInput((prev) => !prev)}
                    >
                      Or paste a URL instead
                    </button>
                    {showAvatarUrlInput ? (
                      <Input
                        value={customAvatarUrl}
                        onChange={(event) => setCustomAvatarUrl(event.target.value)}
                        placeholder="https://..."
                      />
                    ) : null}

                    {customAvatarUrl ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCustomAvatarUrl("")}
                      >
                        Use preset avatars
                      </Button>
                    ) : null}
                    <AvatarPicker value={avatarKey} onChange={setAvatarKey} />
                  </TabsContent>

                  <TabsContent value="stats" className="space-y-4 pt-3">
                    <SectionTitle title="Productivity" subtitle="Track your focus and contribution momentum." />
                    {totalActivity === 0 ? (
                      <div className="rounded-xl border border-dashed border-cyan-500/30 bg-cyan-500/5 p-5 text-center">
                        <p className="text-sm font-medium">Start your first focus session.</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Your weekly stats and contribution graph will appear here.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="grid gap-4 md:grid-cols-3">
                          <Card className="border-cyan-500/20 bg-cyan-500/5">
                            <CardContent className="p-4">
                              <p className="text-xs text-muted-foreground">Focus Hours (7d)</p>
                              <p className="mt-1 flex items-center gap-2 text-2xl font-semibold">
                                <Flame className="size-5 text-cyan-600 dark:text-cyan-300" />
                                {weeklyStats.focusHours}
                              </p>
                            </CardContent>
                          </Card>
                          <Card className="border-cyan-500/20 bg-cyan-500/5">
                            <CardContent className="p-4">
                              <p className="text-xs text-muted-foreground">Tasks Completed (7d)</p>
                              <p className="mt-1 flex items-center gap-2 text-2xl font-semibold">
                                <UserRound className="size-5 text-cyan-600 dark:text-cyan-300" />
                                {weeklyStats.tasksCompleted}
                              </p>
                            </CardContent>
                          </Card>
                          <Card className="border-cyan-500/20 bg-cyan-500/5">
                            <CardContent className="p-4">
                              <p className="text-xs text-muted-foreground">Current Streak</p>
                              <p className="mt-1 flex items-center gap-2 text-2xl font-semibold">
                                <Trophy className="size-5 text-cyan-600 dark:text-cyan-300" />
                                {currentStreak} days
                              </p>
                            </CardContent>
                          </Card>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Contribution (last 30 days)</p>
                          <div className="rounded-xl border border-cyan-500/20 bg-background/50 p-3">
                            <div className="grid grid-cols-10 gap-1 sm:grid-cols-15">
                              {contributionDays.map((day) => (
                                <div
                                  key={day.day}
                                  className={`h-4 rounded-sm ${contributionColor(day.count)}`}
                                  title={`${dateLabel(day.day)} - ${day.count} activities`}
                                />
                              ))}
                            </div>
                            <div className="mt-3 flex items-center justify-end gap-2 text-[11px] text-muted-foreground">
                              <span>Less</span>
                              <span className="size-3 rounded-sm bg-slate-200 dark:bg-slate-800" />
                              <span className="size-3 rounded-sm bg-cyan-500/45" />
                              <span className="size-3 rounded-sm bg-cyan-500/70" />
                              <span className="size-3 rounded-sm bg-cyan-500" />
                              <span>More</span>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="preferences" className="space-y-4 pt-3">
                    <SectionTitle title="Preferences" subtitle="Customize notifications and startup behavior." />
                    <div className="grid gap-4 md:grid-cols-2">
                      <CompactSwitch
                        checked={notificationEmail}
                        onChange={setNotificationEmail}
                        label="Email notifications"
                      />
                      <CompactSwitch
                        checked={notificationInApp}
                        onChange={setNotificationInApp}
                        label="In-app notifications"
                      />
                      <div className="space-y-2">
                        <label className="text-xs text-muted-foreground">Digest frequency</label>
                        <Select
                          value={digestFrequency}
                          onValueChange={(value) =>
                            setDigestFrequency(value as "off" | "daily" | "weekly")
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="off">Off</SelectItem>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-muted-foreground">Theme</label>
                        <Select
                          value={themePreference}
                          onValueChange={(value) =>
                            setThemePreference(value as "system" | "light" | "dark")
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="system">System</SelectItem>
                            <SelectItem value="light">Light</SelectItem>
                            <SelectItem value="dark">Dark</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Default Room</label>
                      <Select
                        value={defaultRoomId || "__none"}
                        onValueChange={(value) =>
                          setDefaultRoomId(value === "__none" ? "" : value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose default room" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">Open dashboard home</SelectItem>
                          {(roomDocs ?? []).map((room) => (
                            <SelectItem key={room._id} value={room._id}>
                              {room.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </TabsContent>
                </Tabs>

                {error ? <p className="text-sm text-red-600">{error}</p> : null}

                <div className="flex justify-end">
                  <Button
                    type="button"
                    className="w-full bg-cyan-500 text-slate-950 hover:bg-cyan-400 sm:w-auto"
                    disabled={isSaving}
                    onClick={() => {
                      void onSave()
                    }}
                  >
                    {isSaving ? "Saving..." : "Save profile"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
