"use client"

import * as React from "react"
import { useQuery } from "convex/react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  BarChart3,
  Bell,
  BookmarkCheck,
  ChevronRight,
  ClipboardList,
  Command,
  Sparkles,
  Timer,
  Users,
} from "lucide-react"
import type { Id } from "@/convex/_generated/dataModel"
import { roomsApi } from "@/lib/convex-rooms-api"
import { avatarSrcForKey } from "@/lib/avatar-options"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/providers/auth-provider"

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
  useSidebar,
} from "@/components/ui/sidebar"

const data = {
  primaryNav: [
    {
      title: "My Rooms",
      url: "/dashboard",
      icon: Command,
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
    {
      title: "Profile",
      url: "/dashboard/profile",
      icon: Users,
    },
  ],
  modes: [
    {
      title: "Focus Mode",
      url: "/dashboard/focus",
      icon: Timer,
    },
  ],
  dashboardRefs: [
    {
      title: "Today Plan",
      url: "/dashboard#today-plan",
      icon: ClipboardList,
    },
    {
      title: "Notifications",
      url: "/dashboard#command-center",
      icon: Bell,
    },
  ],
}

type RoomListItem = {
  _id: Id<"rooms">
  name: string
  icon?: "code" | "rocket" | "cpu" | "sparkles"
  archivedAt?: number
}

function roomDotClass(icon?: RoomListItem["icon"]) {
  if (icon === "rocket") return "bg-emerald-400"
  if (icon === "cpu") return "bg-amber-400"
  if (icon === "code") return "bg-fuchsia-400"
  return "bg-cyan-400"
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { state: sidebarState } = useSidebar()
  const router = useRouter()
  const { user, signOut } = useAuth()
  const pathname = usePathname()
  const [hash, setHash] = React.useState("")
  const userId = user?.id
  const roomDocs = useQuery(roomsApi.list) as RoomListItem[] | undefined
  const pinnedRoomIdsQuery = useQuery(
    roomsApi.pinnedRoomIdsByUser,
    userId ? { userId } : "skip"
  ) as Id<"rooms">[] | undefined
  const pinnedRooms = React.useMemo(
    () =>
      (roomDocs ?? []).filter((room) =>
        (pinnedRoomIdsQuery ?? []).includes(room._id)
      ),
    [pinnedRoomIdsQuery, roomDocs]
  )
  const recentRooms = React.useMemo(
    () => (roomDocs ?? []).filter((room) => !room.archivedAt).slice(0, 3),
    [roomDocs]
  )

  React.useEffect(() => {
    const readHash = () => {
      if (typeof window === "undefined") return
      setHash(window.location.hash || "")
    }
    readHash()
    window.addEventListener("hashchange", readHash)
    return () => window.removeEventListener("hashchange", readHash)
  }, [])

  async function openRoom(roomId: Id<"rooms">) {
    router.push(`/dashboard/rooms/${roomId}`)
  }

  const navUser = {
    name: user?.name ?? "Nook User",
    email: user?.email ?? "Signed out",
    avatar: user?.customAvatarUrl || avatarSrcForKey(user?.avatarKey),
    avatarKey: user?.avatarKey ?? "avatar-1",
    status: user?.status ?? "available",
    roleTitle: user?.roleTitle ?? "",
  }

  const isNavItemActive = (title: string, url: string) => {
    const routePath = url.split("#")[0]
    if (title === "My Rooms") {
      return pathname === "/dashboard" && !hash
    }
    if (title === "Today Plan") {
      return pathname === "/dashboard" && hash === "#today-plan"
    }
    if (title === "Notifications") {
      return pathname === "/dashboard" && hash === "#command-center"
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
    if (title === "Profile") {
      return pathname === "/dashboard/profile"
    }
    return pathname === routePath
  }
  const isFocusModeActive = pathname.startsWith("/dashboard/focus")
  const isIconCollapsed = sidebarState === "collapsed"

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
              size="lg"
              className="data-[slot=sidebar-menu-button]:!pt-0.5 group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-0 hover:bg-transparent! active:bg-transparent! data-[active=true]:bg-transparent!"
            >
              <a href="#" className="flex items-center justify-start w-full">

                <div className="relative flex h-full w-full items-center">
                  {/* Collapsed Icon Version */}
                  <img
                    src="/nook-logo.png"
                    alt="Nook logo"
                    className="absolute inset-0 h-8 w-8 object-contain transition-opacity duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] group-data-[collapsible=icon]:opacity-100 opacity-0 dark:block hidden"
                  />
                  <img
                    src="/nook-logo-light.png"
                    alt="Nook logo"
                    className="absolute inset-0 h-8 w-8 scale-[0.85] -translate-y-[2px] object-contain transition-opacity duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] group-data-[collapsible=icon]:opacity-100 opacity-0 dark:hidden block"
                  />

                  {/* Expanded Full Logo */}
                  <img
                    src="/nook.png"
                    alt="Nook logo"
                    className="h-10 w-auto object-contain transition-opacity duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] group-data-[collapsible=icon]:opacity-0 opacity-100 dark:block hidden"
                  />
                  <img
                    src="/nook-light.png"
                    alt="Nook logo"
                    className="h-10 w-auto scale-[0.78] -translate-x-[12px] -translate-y-[3px] object-contain transition-opacity duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] group-data-[collapsible=icon]:opacity-0 opacity-100 dark:hidden block"
                  />
                </div>

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
          <SidebarGroupLabel>QUICK LINKS</SidebarGroupLabel>
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
            {!isIconCollapsed ? (
              <div className="mt-2 space-y-1 rounded-lg border border-cyan-500/10 bg-background/15 px-2 py-2">
                {data.dashboardRefs.map((item) => (
                  <Link
                    key={item.title}
                    href={item.url}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-[color:var(--nook-sidebar-foreground-muted)] transition-colors hover:bg-[color:var(--nook-sidebar-active)] hover:text-[color:var(--nook-sidebar-foreground)]",
                      isNavItemActive(item.title, item.url) &&
                        "bg-[color:var(--nook-sidebar-active)] text-[color:var(--nook-sidebar-foreground)]"
                    )}
                  >
                    <item.icon className="size-4" />
                    <span>{item.title}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <SidebarMenu className="mt-2">
                {data.dashboardRefs.map((item) => (
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
            )}
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>MODES</SidebarGroupLabel>
          <SidebarGroupContent
            className={
              isIconCollapsed
                ? undefined
                : "rounded-lg border border-cyan-500/15 bg-background/25 p-2 shadow-sm"
            }
          >
            <SidebarMenu>
              <SidebarMenuItem>
                {isIconCollapsed ? (
                  <SidebarMenuButton
                    isActive={isFocusModeActive}
                    onClick={() => {
                      router.push(isFocusModeActive ? "/dashboard" : "/dashboard/focus")
                    }}
                  >
                    <Timer />
                    <span>Focus Mode</span>
                  </SidebarMenuButton>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      router.push(isFocusModeActive ? "/dashboard" : "/dashboard/focus")
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                      isFocusModeActive
                        ? "border-cyan-500/30 bg-cyan-500/12 text-[color:var(--nook-sidebar-foreground)]"
                        : "border-cyan-500/12 bg-background/20 text-[color:var(--nook-sidebar-foreground-muted)] hover:bg-[color:var(--nook-sidebar-active)] hover:text-[color:var(--nook-sidebar-foreground)]"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-9 items-center justify-center rounded-lg border",
                        isFocusModeActive
                          ? "border-cyan-400/40 bg-cyan-400/15"
                          : "border-cyan-500/15 bg-background/30"
                      )}
                    >
                      <Timer className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">Focus Mode</span>
                    </span>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                        isFocusModeActive
                          ? "border-cyan-400/40 bg-cyan-400/15 text-[color:var(--nook-sidebar-foreground)]"
                          : "border-cyan-500/15 bg-background/35"
                      )}
                    >
                      {isFocusModeActive ? "Live" : "Enter"}
                    </span>
                    <ChevronRight className="size-4 opacity-70" />
                  </button>
                )}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {!isIconCollapsed && recentRooms.length > 0 ? (
          <SidebarGroup>
            <SidebarGroupLabel>RECENT ROOMS</SidebarGroupLabel>
            <SidebarGroupContent className="rounded-lg border border-cyan-500/10 bg-background/20 p-1 shadow-sm">
              <SidebarMenu>
                {recentRooms.map((room) => (
                  <SidebarMenuItem key={room._id}>
                    <SidebarMenuButton
                      onClick={() => {
                        void openRoom(room._id)
                      }}
                    >
                      <Command />
                      <span className={cn("size-2 rounded-full", roomDotClass(room.icon))} />
                      <span className="line-clamp-2 break-words">{room.name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
        {!isIconCollapsed && pinnedRooms.length > 0 ? (
          <SidebarGroup>
            <SidebarGroupLabel>PINNED</SidebarGroupLabel>
            <SidebarGroupContent className="rounded-lg border border-cyan-500/15 bg-background/25 p-1 shadow-sm">
              <SidebarMenu>
                {pinnedRooms.map((room) => (
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
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
        <div className="mt-auto p-2 text-[11px] text-[color:var(--nook-sidebar-foreground-muted)] group-data-[collapsible=icon]:hidden">
          Stay in flow mode.
        </div>
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter>
        <NavUser
          user={navUser}
          onLogout={() => {
            void signOut()
            router.push("/sign-in")
          }}
        />
      </SidebarFooter>
    </Sidebar>
  )
}
