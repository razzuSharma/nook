"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BookmarkCheck,
  Clock3,
  Command,
  Sparkles,
  Users,
} from "lucide-react"

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

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()

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
    </Sidebar>
  )
}
