"use client"

import * as React from "react"
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
      url: "#",
      icon: Command,
    },
    {
      title: "Recent Activity",
      url: "#",
      icon: Clock3,
    },
    {
      title: "Saved Tasks",
      url: "#",
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
  return (
    <Sidebar
      collapsible="offcanvas"
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
      className="border-[color:var(--nook-sidebar-border)] [&_[data-sidebar=sidebar-inner]]:bg-gradient-to-b [&_[data-sidebar=sidebar-inner]]:from-[var(--nook-sidebar-bg-start)] [&_[data-sidebar=sidebar-inner]]:to-[var(--nook-sidebar-bg-end)] [&_[data-sidebar=menu-button]]:text-[color:var(--nook-sidebar-foreground-muted)] [&_[data-sidebar=menu-button]:hover]:bg-[color:var(--nook-sidebar-active)] [&_[data-sidebar=menu-button]:hover]:text-[color:var(--nook-sidebar-foreground)] [&_[data-sidebar=menu-button][data-active=true]]:bg-[color:var(--nook-sidebar-active)] [&_[data-sidebar=menu-button][data-active=true]]:text-[color:var(--nook-sidebar-foreground)] [&_[data-sidebar=group-label]]:text-[color:var(--nook-sidebar-foreground-muted)] [&_[data-sidebar=separator]]:bg-[color:var(--nook-sidebar-border)]"
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
          className="border-[color:var(--nook-sidebar-border)] bg-[color:var(--nook-sidebar-input-bg)] text-[color:var(--nook-sidebar-foreground)] placeholder:text-[color:var(--nook-sidebar-foreground-muted)] focus-visible:ring-[color:var(--nook-accent)]"
        />
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>GENERAL</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {data.primaryNav.map((item, index) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={index === 0}>
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
