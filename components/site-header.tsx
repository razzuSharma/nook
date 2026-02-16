import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { ChevronRight, Plus } from "lucide-react"

export function SiteHeader({
  currentPage = "Home Dashboard",
  actionLabel = "New Room",
}: {
  currentPage?: string
  actionLabel?: string
}) {
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
          <Badge className="hidden bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 md:inline-flex">
            DEEP WORK MODE
          </Badge>
          <Button
            size="sm"
            className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
          >
            <Plus />
            {actionLabel}
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
