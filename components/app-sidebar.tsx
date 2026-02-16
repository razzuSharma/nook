"use client"

import * as React from "react"
import { useMutation, useQuery } from "convex/react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  BarChart3,
  BookmarkCheck,
  Clock3,
  Command,
  Sparkles,
  Timer,
  Users,
} from "lucide-react"
import { defaultRooms } from "@/components/rooms/types"
import type { Id } from "@/convex/_generated/dataModel"
import { DEMO_USER_ID } from "@/lib/demo-user"
import { roomsApi } from "@/lib/convex-rooms-api"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"

import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"

const data = {
  user: {
    name: "Alex Rivers",
    email: "Pro Plan",
    avatar: "",
  },
  primaryNav: [
    {
      title: "My Rooms",
      url: "/dashboard",
      icon: Command,
    },
    {
      title: "Recent Activity",
      url: "/dashboard/recent-activity",
      icon: Clock3,
    },
    {
      title: "Saved Tasks",
      url: "/dashboard/saved-tasks",
      icon: BookmarkCheck,
    },
    {
      title: "Progress",
      url: "/dashboard/progress",
      icon: BarChart3,
    },
  ],
  modes: [
    {
      title: "Focus Mode",
      url: "/dashboard/focus",
      icon: Timer,
    },
  ],
  teams: [
    {
      title: "Kore API",
      url: "#",
      icon: Users,
    },
    {
      title: "Design Systems",
      url: "#",
      icon: Sparkles,
    },
  ],
}

type RoomListItem = {
  _id: Id<"rooms">
  name: string
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter()
  const pathname = usePathname()
  const roomDocs = useQuery(roomsApi.list) as RoomListItem[] | undefined
  const joinedRoomIds = (useQuery(roomsApi.joinedRoomIdsByUser, {
    userId: DEMO_USER_ID,
  }) ?? []) as Id<"rooms">[]
  const pinnedRoomIdsQuery = useQuery(roomsApi.pinnedRoomIdsByUser, {
    userId: DEMO_USER_ID,
  }) as Id<"rooms">[] | undefined
  const ensureDefaults = useMutation(roomsApi.ensureDefaults)
  const joinRoomInDb = useMutation(roomsApi.joinByRoomId)
  const leaveRoomInDb = useMutation(roomsApi.leaveRoom)
  const roomNames = React.useMemo(() => {
    if (!roomDocs || roomDocs.length === 0) {
      return defaultRooms.map((room) => room.name)
    }
    return roomDocs.map((room) => room.name)
  }, [roomDocs])
  const pinnedRooms = React.useMemo(
    () =>
      (roomDocs ?? []).filter((room) =>
        (pinnedRoomIdsQuery ?? []).includes(room._id)
      ),
    [pinnedRoomIdsQuery, roomDocs]
  )

  React.useEffect(() => {
    void ensureDefaults({})
  }, [ensureDefaults])

  const [joinCandidate, setJoinCandidate] = React.useState<{
    id: Id<"rooms">
    name: string
  } | null>(null)

  async function openRoom(roomId: Id<"rooms">) {
    router.push(`/dashboard/rooms/${roomId}`)
  }

  async function joinRoom(roomId: Id<"rooms">) {
    await joinRoomInDb({
      roomId,
      userId: DEMO_USER_ID,
    })
    router.push(`/dashboard/rooms/${roomId}`)
  }

  async function leaveRoom(roomId: Id<"rooms">) {
    await leaveRoomInDb({
      roomId,
      userId: DEMO_USER_ID,
    })
  }

  const isNavItemActive = (title: string, url: string) => {
    const routePath = url.split("#")[0]
    if (title === "My Rooms") {
      return pathname === "/dashboard"
    }
    if (title === "Recent Activity") {
      return pathname === "/dashboard/recent-activity"
    }
    if (title === "Saved Tasks") {
      return pathname === "/dashboard/saved-tasks"
    }
    if (title === "Focus Mode") {
      return pathname === "/dashboard/focus"
    }
    if (title === "Progress") {
      return pathname === "/dashboard/progress"
    }
    return pathname === routePath
  }

  return (
    <Sidebar
      collapsible="icon"
      {...props}
      style={
        {
          "--sidebar": "var(--nook-sidebar-bg-start)",
          "--sidebar-foreground": "var(--nook-sidebar-foreground)",
          "--sidebar-border": "var(--nook-sidebar-border)",
          "--sidebar-accent": "var(--nook-sidebar-active)",
          "--sidebar-accent-foreground": "var(--nook-sidebar-foreground)",
          "--sidebar-ring": "var(--nook-accent)",
        } as React.CSSProperties
      }
      className="nook-border [&_[data-sidebar=sidebar-inner]]:bg-gradient-to-b [&_[data-sidebar=sidebar-inner]]:from-[var(--nook-sidebar-bg-start)] [&_[data-sidebar=sidebar-inner]]:to-[var(--nook-sidebar-bg-end)] [&_[data-sidebar=menu-button]]:text-[color:var(--nook-sidebar-foreground-muted)] [&_[data-sidebar=menu-button]:hover]:bg-[color:var(--nook-sidebar-active)] [&_[data-sidebar=menu-button]:hover]:text-[color:var(--nook-sidebar-foreground)] [&_[data-sidebar=menu-button][data-active=true]]:bg-[color:var(--nook-sidebar-active)] [&_[data-sidebar=menu-button][data-active=true]]:text-[color:var(--nook-sidebar-foreground)] [&_[data-sidebar=group-label]]:text-[color:var(--nook-sidebar-foreground-muted)] [&_[data-sidebar=separator]]:bg-[color:var(--nook-sidebar-border)]"
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-2"
            >
              <a href="#">
                <div className="flex size-6 items-center justify-center rounded-md bg-nook-accent/20 text-nook-accent">
                  <Command className="size-4" />
                </div>
                <span className="text-base font-semibold">Nook</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarInput
          placeholder="Search rooms..."
          className="nook-input text-[color:var(--nook-sidebar-foreground)] group-data-[collapsible=icon]:hidden"
        />
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>GENERAL</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {data.primaryNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isNavItemActive(item.title, item.url)}
                  >
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>MODES</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {data.modes.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isNavItemActive(item.title, item.url)}
                  >
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>PINNED</SidebarGroupLabel>
          <SidebarGroupContent className="rounded-lg border border-cyan-500/15 bg-background/25 p-1 shadow-sm">
            <SidebarMenu>
              {pinnedRooms.length === 0 ? (
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <span>No pinned rooms</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : (
                pinnedRooms.map((room) => (
                  <SidebarMenuItem key={room._id}>
                    <div className="flex items-center justify-between gap-2 rounded-md px-2 py-1">
                      <span className="inline-flex items-center gap-2 text-sm">
                        <Sparkles className="size-4" />
                        <span>{room.name}</span>
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 border-cyan-500/25 px-2 text-[11px]"
                        onClick={() => {
                          void openRoom(room._id)
                        }}
                      >
                        Enter
                      </Button>
                    </div>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>MY ROOMS</SidebarGroupLabel>
          <SidebarGroupContent className="rounded-lg border border-cyan-500/15 bg-background/25 p-1 shadow-sm">
            <SidebarMenu>
              {roomDocs?.map((room) => (
                <SidebarMenuItem key={room._id}>
                  <div className="flex items-center justify-between gap-2 rounded-md px-2 py-1">
                    <span className="inline-flex min-w-0 items-center gap-2 text-sm">
                      <Users className="size-4 shrink-0" />
                      <span className="truncate">{room.name}</span>
                    </span>
                    <div className="flex items-center gap-1">
                      {joinedRoomIds.includes(room._id) ? (
                        <>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-300">
                            Joined
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 border-cyan-500/25 px-2 text-[11px]"
                            onClick={() => {
                              void openRoom(room._id)
                            }}
                          >
                            Enter
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 border-red-500/25 px-2 text-[11px] text-red-700 hover:bg-red-500/10 dark:text-red-300"
                            onClick={() => {
                              void leaveRoom(room._id)
                            }}
                          >
                            Leave
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          className="h-7 bg-cyan-500 px-2 text-[11px] text-slate-950 hover:bg-cyan-400"
                          onClick={() =>
                            setJoinCandidate({
                              id: room._id,
                              name: room.name,
                            })
                          }
                        >
                          Join
                        </Button>
                      )}
                    </div>
                  </div>
                </SidebarMenuItem>
              ))}
              {!roomDocs?.length
                ? roomNames.map((name) => (
                    <SidebarMenuItem key={name}>
                      <SidebarMenuButton>
                        <Users />
                        <span>{name}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))
                : null}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>TEAMS</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {data.teams.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <div className="mt-auto p-2 text-[11px] text-[color:var(--nook-sidebar-foreground-muted)]">
          Stay in flow mode.
        </div>
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>

      <Drawer
        open={Boolean(joinCandidate)}
        onOpenChange={(open) => {
          if (!open) setJoinCandidate(null)
        }}
      >
        <DrawerContent className="border-cyan-500/20">
          <DrawerHeader>
            <DrawerTitle>Confirm Join</DrawerTitle>
            <DrawerDescription>
              Join <span className="font-medium">{joinCandidate?.name}</span> and
              open the room?
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
    </Sidebar>
  )
}
