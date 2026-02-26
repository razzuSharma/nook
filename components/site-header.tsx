"use client"

import { Button } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { ChevronRight, Flame, Plus } from "lucide-react"
import { useRouter } from "next/navigation"

export function SiteHeader({
  currentPage = "Home Dashboard",
  actionLabel = "New Room",
  actionEventName = "nook:create-room",
}: {
  currentPage?: string
  actionLabel?: string
  actionEventName?: string
}) {
  const router = useRouter()
  const showAction = Boolean(actionLabel && actionEventName)

  return (
    <header className="flex h-(--header-height) shrink-0 items-center border-b border-cyan-500/15 bg-background/70 backdrop-blur transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-2 px-4 lg:px-6 lg:pr-20">
        <SidebarTrigger className="-ml-1" />
        <div className="hidden items-center gap-2 text-sm text-muted-foreground md:flex">
          <span>Workspace</span>
          <ChevronRight className="size-4" />
          <span className="text-foreground">{currentPage}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            className="hidden animate-pulse border border-cyan-300/40 bg-gradient-to-r from-cyan-500 via-teal-400 to-cyan-400 text-slate-950 shadow-[0_0_18px_rgba(45,212,191,0.45)] hover:brightness-105 md:inline-flex"
            onClick={() => {
              router.push("/dashboard/focus")
            }}
          >
            <Flame className="size-4" />
            DEEP WORK MODE
          </Button>
          {showAction ? (
            <Button
              size="sm"
              className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
              onClick={() => {
                window.dispatchEvent(new Event(actionEventName))
              }}
            >
              <Plus />
              {actionLabel}
            </Button>
          ) : null}
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
