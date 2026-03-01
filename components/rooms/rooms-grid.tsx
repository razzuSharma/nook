"use client"

import * as React from "react"
import { useMutation, useQuery } from "convex/react"
import {
  Code2,
  Cpu,
  Ellipsis,
  Pin,
  Plus,
  LogOut,
  Rocket,
  Sparkles,
  type LucideIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"

import type { RoomAccess, RoomIconKey } from "@/components/rooms/types"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { roomsApi } from "@/lib/convex-rooms-api"
import type { Id } from "@/convex/_generated/dataModel"
import { useAuth } from "@/components/providers/auth-provider"

const iconMap: Record<RoomIconKey, LucideIcon> = {
  code: Code2,
  rocket: Rocket,
  cpu: Cpu,
  sparkles: Sparkles,
}

type RoomListItem = {
  _id: Id<"rooms">
  name: string
  description: string
  mode: string
  access?: RoomAccess
  membersCount: number
  membersMax: number
  createdAt: number
  joinCode?: string
  icon: RoomIconKey
  archivedAt?: number
}
type RoomSort = "recent" | "mostJoined"

function roomIcon(key: RoomIconKey) {
  return iconMap[key] ?? Sparkles
}

function accessLabel(access: RoomAccess) {
  if (access === "invite_only") return "Invite Only"
  if (access === "private") return "Private"
  return "Public"
}

export function RoomsGrid() {
  const router = useRouter()
  const { user } = useAuth()
  const userId = user?.id
  const roomDocs = useQuery(roomsApi.list) as RoomListItem[] | undefined
  const joinedRoomIds = (useQuery(
    roomsApi.joinedRoomIdsByUser,
    userId ? { userId } : "skip"
  ) ?? []) as Id<"rooms">[]
  const pinnedRoomIds = (useQuery(
    roomsApi.pinnedRoomIdsByUser,
    userId ? { userId } : "skip"
  ) ?? []) as Id<"rooms">[]
  const createRoomInDb = useMutation(roomsApi.create)
  const joinRoomInDb = useMutation(roomsApi.joinByRoomId)
  const joinByCodeInDb = useMutation(roomsApi.joinByCode)
  const leaveRoomInDb = useMutation(roomsApi.leaveRoom)
  const togglePinInDb = useMutation(roomsApi.togglePin)
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false)
  const [isJoinDrawerOpen, setIsJoinDrawerOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [mode, setMode] = React.useState("")
  const [access, setAccess] = React.useState<RoomAccess>("public")
  const [membersMax, setMembersMax] = React.useState("8")
  const [joinCode, setJoinCode] = React.useState("")
  const [joinError, setJoinError] = React.useState<string | null>(null)
  const [joinCandidate, setJoinCandidate] = React.useState<{
    id: Id<"rooms">
    name: string
  } | null>(null)
  const [sortBy, setSortBy] = React.useState<RoomSort>("recent")

  React.useEffect(() => {
    const openDrawer = () => setIsDrawerOpen(true)
    window.addEventListener("nook:create-room", openDrawer)
    return () => window.removeEventListener("nook:create-room", openDrawer)
  }, [])

  function resetForm() {
    setName("")
    setDescription("")
    setMode("")
    setAccess("public")
    setMembersMax("8")
  }

  async function createRoom() {
    if (!userId) return
    const trimmedName = name.trim()
    const trimmedDescription = description.trim()
    const trimmedMode = mode.trim()
    const safeMax = Number.parseInt(membersMax, 10)
    if (!trimmedName || !trimmedDescription || !trimmedMode || Number.isNaN(safeMax)) {
      return
    }

    await createRoomInDb({
      name: trimmedName,
      description: trimmedDescription,
      mode: trimmedMode,
      access,
      membersMax: safeMax,
      userId,
    })
    resetForm()
    setIsDrawerOpen(false)
  }

  async function joinRoom(roomId: Id<"rooms">) {
    if (!userId) return
    try {
      setJoinError(null)
      const result = await joinRoomInDb({
        roomId,
        userId,
      })
      router.push(`/dashboard/rooms/${result.roomId}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to join room."
      setJoinError(message)
    }
  }

  async function leaveRoom(roomId: Id<"rooms">) {
    if (!userId) return
    await leaveRoomInDb({
      roomId,
      userId,
    })
  }

  async function joinByCode() {
    if (!userId) return
    const trimmedCode = joinCode.trim().toUpperCase()
    if (!trimmedCode) {
      setJoinError("Join code is required.")
      return
    }

    try {
      setJoinError(null)
      const result = await joinByCodeInDb({
        code: trimmedCode,
        userId,
      })
      setJoinCode("")
      setIsJoinDrawerOpen(false)
      router.push(`/dashboard/rooms/${result.roomId}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to join with code."
      setJoinError(message)
    }
  }

  async function togglePin(roomId: Id<"rooms">) {
    if (!userId) return
    await togglePinInDb({
      roomId,
      userId,
    })
  }

  const canCreate =
    name.trim().length > 1 &&
    description.trim().length > 5 &&
    mode.trim().length > 2 &&
    Number.parseInt(membersMax, 10) >= 2

  const visibleRooms = React.useMemo(() => {
    const sorted = [...(roomDocs ?? [])].filter((room) => !room.archivedAt)
    if (sortBy === "mostJoined") {
      sorted.sort((left, right) => right.membersCount - left.membersCount)
      return sorted
    }
    sorted.sort((left, right) => right.createdAt - left.createdAt)
    return sorted
  }, [roomDocs, sortBy])

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">Your Rooms</h2>
        <div className="flex items-center gap-2">
          <Select
            value={sortBy}
            onValueChange={(value) => setSortBy(value as RoomSort)}
          >
            <SelectTrigger className="w-[170px] border-cyan-500/25">
              <SelectValue placeholder="Sort rooms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Most Recent</SelectItem>
              <SelectItem value="mostJoined">Most Joined</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            className="border-cyan-500/30 text-cyan-700 hover:bg-cyan-500/10 dark:text-cyan-200"
            onClick={() => setIsJoinDrawerOpen(true)}
          >
            Join by Code
          </Button>
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
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {visibleRooms.map((room) => {
          const Icon = roomIcon(room.icon)
          const isJoined = joinedRoomIds.includes(room._id)
          const isPinned = pinnedRoomIds.includes(room._id)
          return (
            <article
              key={room._id}
              className="rounded-2xl border border-cyan-500/20 bg-slate-50/40 p-5 shadow-md transition-shadow hover:shadow-lg backdrop-blur dark:bg-slate-900/40"
            >
              <div className="mb-5 flex items-start justify-between">
                <div className="rounded-lg bg-cyan-500/15 p-2 text-cyan-800 dark:text-cyan-300">
                  <Icon className="size-5" />
                </div>
                <Badge className="bg-cyan-500/20 text-cyan-800 dark:text-cyan-300">
                  {room.mode}
                </Badge>
              </div>
              <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
                {accessLabel((room.access ?? "public") as RoomAccess)}
              </p>
              <h3 className="text-xl font-semibold">{room.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{room.description}</p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-700 dark:text-emerald-300">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
                {Math.max(1, Math.min(room.membersCount, 4))} members active now
              </div>
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
              <div className="mt-4 flex items-center justify-between gap-2">
                {isJoined ? (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                      onClick={() => router.push(`/dashboard/rooms/${room._id}`)}
                    >
                      Enter Room
                    </Button>
                  </div>
                ) : (room.access ?? "public") === "public" ? (
                  <Button
                    type="button"
                    size="sm"
                    className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                    onClick={() => setJoinCandidate({ id: room._id, name: room.name })}
                  >
                    Join Room
                  </Button>
                ) : (
                  <Badge variant="secondary">
                    {(room.access ?? "public") === "invite_only"
                      ? "Invite only"
                      : "Private"}
                  </Badge>
                )}
                <div className="flex items-center gap-2">
                  {(room.access ?? "public") === "public" && room.joinCode ? (
                    <span className="text-xs text-muted-foreground">
                      Code: {room.joinCode}
                    </span>
                  ) : null}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" size="icon" variant="ghost" className="size-8">
                        <Ellipsis className="size-4" />
                        <span className="sr-only">More room actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => togglePin(room._id)}>
                        <Pin className="size-4" />
                        {isPinned ? "Unpin room" : "Pin room"}
                      </DropdownMenuItem>
                      {isJoined ? (
                        <DropdownMenuItem
                          className="text-red-700 focus:text-red-700 dark:text-red-300 dark:focus:text-red-300"
                          onClick={() => {
                            void leaveRoom(room._id)
                          }}
                        >
                          <LogOut className="size-4" />
                          Leave room
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </article>
          )
        })}

        <button
          type="button"
          className="group flex min-h-64 flex-col justify-center rounded-2xl border-2 border-dashed border-cyan-500/35 bg-cyan-500/5 p-5 text-left transition-colors hover:bg-cyan-500/10"
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
              <div className="space-y-2">
                <p className="text-sm font-medium">Access</p>
                <Select value={access} onValueChange={(value) => setAccess(value as RoomAccess)}>
                  <SelectTrigger className="border-cyan-500/25 bg-cyan-500/5 focus-visible:ring-cyan-500/30">
                    <SelectValue placeholder="Select access" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                    <SelectItem value="invite_only">Invite Only</SelectItem>
                  </SelectContent>
                </Select>
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

      <Drawer open={isJoinDrawerOpen} onOpenChange={setIsJoinDrawerOpen}>
        <DrawerContent className="border-cyan-500/20">
          <DrawerHeader>
            <DrawerTitle>Join Room</DrawerTitle>
            <DrawerDescription>
              Enter a room code shared by your team.
            </DrawerDescription>
          </DrawerHeader>
          <div className="space-y-3 px-4 pb-2">
            <Input
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              placeholder="NOOK-7F2A"
              className="border-cyan-500/25 bg-cyan-500/5 focus-visible:ring-cyan-500/30"
            />
            {joinError ? (
              <p className="text-sm text-red-600 dark:text-red-300">{joinError}</p>
            ) : null}
          </div>
          <DrawerFooter>
            <Button
              onClick={joinByCode}
              className="bg-[color:var(--nook-accent)] text-slate-950 hover:bg-[color:var(--nook-accent-strong)]"
            >
              Join
            </Button>
            <Button variant="outline" onClick={() => setIsJoinDrawerOpen(false)}>
              Cancel
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Drawer
        open={Boolean(joinCandidate)}
        onOpenChange={(open) => {
          if (!open) {
            setJoinCandidate(null)
          }
        }}
      >
        <DrawerContent className="border-cyan-500/20">
          <DrawerHeader>
            <DrawerTitle>Confirm Join</DrawerTitle>
            <DrawerDescription>
              Join <span className="font-medium">{joinCandidate?.name}</span> and open
              its workspace?
            </DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <Button
              onClick={() => {
                if (!joinCandidate) return
                void joinRoom(joinCandidate.id)
                setJoinCandidate(null)
              }}
              className="bg-[color:var(--nook-accent)] text-slate-950 hover:bg-[color:var(--nook-accent-strong)]"
            >
              Confirm Join
            </Button>
            <Button variant="outline" onClick={() => setJoinCandidate(null)}>
              Cancel
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  )
}
