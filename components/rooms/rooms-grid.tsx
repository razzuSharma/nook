"use client"

import * as React from "react"
import { Code2, Cpu, Plus, Rocket, Sparkles, type LucideIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"

export type RoomIconKey = "code" | "rocket" | "cpu" | "sparkles"

export type Room = {
  id: string
  name: string
  description: string
  mode: string
  membersCount: number
  membersMax: number
  icon: RoomIconKey
}

const STORAGE_KEY = "nook.rooms.v1"

const iconMap: Record<RoomIconKey, LucideIcon> = {
  code: Code2,
  rocket: Rocket,
  cpu: Cpu,
  sparkles: Sparkles,
}

function roomIcon(key: RoomIconKey) {
  return iconMap[key] ?? Sparkles
}

export function RoomsGrid({ initialRooms }: { initialRooms: Room[] }) {
  const [rooms, setRooms] = React.useState<Room[]>(initialRooms)
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [mode, setMode] = React.useState("")
  const [membersMax, setMembersMax] = React.useState("8")

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Room[]
      if (Array.isArray(parsed) && parsed.length > 0) {
        setRooms(parsed)
      }
    } catch {
      // Ignore malformed local storage data.
    }
  }, [])

  React.useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms))
  }, [rooms])

  React.useEffect(() => {
    const openDrawer = () => setIsDrawerOpen(true)
    window.addEventListener("nook:create-room", openDrawer)
    return () => window.removeEventListener("nook:create-room", openDrawer)
  }, [])

  function resetForm() {
    setName("")
    setDescription("")
    setMode("")
    setMembersMax("8")
  }

  function createRoom() {
    const trimmedName = name.trim()
    const trimmedDescription = description.trim()
    const trimmedMode = mode.trim()
    const safeMax = Number.parseInt(membersMax, 10)
    if (!trimmedName || !trimmedDescription || !trimmedMode || Number.isNaN(safeMax)) {
      return
    }

    const newRoom: Room = {
      id: `room-${Date.now()}`,
      name: trimmedName,
      description: trimmedDescription,
      mode: trimmedMode.toUpperCase(),
      membersCount: 1,
      membersMax: Math.min(Math.max(safeMax, 2), 30),
      icon: "sparkles",
    }

    setRooms((prev) => [...prev, newRoom])
    window.dispatchEvent(new Event("nook:rooms-updated"))
    resetForm()
    setIsDrawerOpen(false)
  }

  const canCreate =
    name.trim().length > 1 &&
    description.trim().length > 5 &&
    mode.trim().length > 2 &&
    Number.parseInt(membersMax, 10) >= 2

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Your Rooms</h2>
        <Button
          type="button"
          variant="ghost"
          className="text-sm font-medium text-cyan-700 hover:text-cyan-600 dark:text-cyan-300 dark:hover:text-cyan-200"
          onClick={() => setIsDrawerOpen(true)}
        >
          <Plus className="size-4" />
          New Room
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {rooms.map((room) => {
          const Icon = roomIcon(room.icon)
          return (
            <article
              key={room.id}
              className="rounded-2xl border border-cyan-500/20 bg-slate-50/40 p-5 shadow-sm backdrop-blur dark:bg-slate-900/40"
            >
              <div className="mb-5 flex items-start justify-between">
                <div className="rounded-lg bg-cyan-500/15 p-2 text-cyan-800 dark:text-cyan-300">
                  <Icon className="size-5" />
                </div>
                <Badge className="bg-cyan-500/20 text-cyan-800 dark:text-cyan-300">
                  {room.mode}
                </Badge>
              </div>
              <h3 className="text-xl font-semibold">{room.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{room.description}</p>
              <div className="mt-6 flex items-center justify-between">
                <div className="flex items-center -space-x-2">
                  <div className="flex size-7 items-center justify-center rounded-full border border-cyan-500/20 bg-cyan-200/80 text-xs font-medium text-cyan-900">
                    {room.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex size-7 items-center justify-center rounded-full border border-cyan-500/20 bg-cyan-50 text-xs font-medium text-cyan-900">
                    +{Math.max(room.membersCount - 1, 0)}
                  </div>
                </div>
                <span className="text-sm text-muted-foreground">
                  {room.membersCount}/{room.membersMax} Members
                </span>
              </div>
            </article>
          )
        })}

        <button
          type="button"
          className="group rounded-2xl border border-dashed border-cyan-500/35 bg-cyan-500/5 p-5 text-left transition-colors hover:bg-cyan-500/10"
          onClick={() => setIsDrawerOpen(true)}
        >
          <div className="mb-5 flex items-start justify-between">
            <div className="rounded-full border border-cyan-500/30 p-2 text-cyan-700 dark:text-cyan-300">
              <Plus className="size-5" />
            </div>
            <Badge className="bg-cyan-500/15 text-cyan-800 dark:text-cyan-300">
              START NEW
            </Badge>
          </div>
          <h3 className="text-xl font-semibold">Create a new room</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Start a focused collaboration session.
          </p>
        </button>
      </div>

      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DrawerContent className="border-cyan-500/20 bg-[radial-gradient(circle_at_15%_-20%,rgba(6,182,212,0.18),transparent_42%),radial-gradient(circle_at_95%_5%,rgba(20,184,166,0.16),transparent_40%),linear-gradient(180deg,var(--background)_0%,color-mix(in_oklch,var(--background)_86%,var(--nook-accent)_14%)_100%)]">
          <DrawerHeader>
            <div className="flex items-center gap-2">
              <Badge className="bg-cyan-500/20 text-cyan-800 dark:text-cyan-300">
                ROOM SETUP
              </Badge>
              <Badge variant="secondary">Nook</Badge>
            </div>
            <DrawerTitle className="mt-2 text-2xl">Create Room</DrawerTitle>
            <DrawerDescription>
              Start a new space for focused collaboration.
            </DrawerDescription>
          </DrawerHeader>
          <Card className="mx-4 border-cyan-500/20 bg-background/75 backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Room Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Room name</p>
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Frontend Architecture Guild"
                  className="border-cyan-500/25 bg-cyan-500/5 focus-visible:ring-cyan-500/30"
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Description</p>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="min-h-20 w-full rounded-md border border-cyan-500/25 bg-cyan-500/5 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/30"
                  placeholder="What will this room focus on?"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Mode label</p>
                  <Input
                    value={mode}
                    onChange={(event) => setMode(event.target.value)}
                    placeholder="Build Sprint"
                    className="border-cyan-500/25 bg-cyan-500/5 focus-visible:ring-cyan-500/30"
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Max members</p>
                  <Input
                    type="number"
                    min={2}
                    max={30}
                    value={membersMax}
                    onChange={(event) => setMembersMax(event.target.value)}
                    className="border-cyan-500/25 bg-cyan-500/5 focus-visible:ring-cyan-500/30"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          <DrawerFooter>
            <Button
              onClick={createRoom}
              disabled={!canCreate}
              className="bg-[color:var(--nook-accent)] text-slate-950 hover:bg-[color:var(--nook-accent-strong)] disabled:opacity-50"
            >
              <Plus />
              Create Room
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                resetForm()
                setIsDrawerOpen(false)
              }}
            >
              Cancel
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  )
}
