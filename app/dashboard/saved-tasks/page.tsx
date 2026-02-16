import { AppSidebar } from "@/components/app-sidebar"
import { TaskBoard } from "@/components/saved-tasks/task-board"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

export default function SavedTasksPage() {
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
        <SiteHeader currentPage="Saved Tasks" actionLabel="New Task" />
        <div className="flex flex-1 flex-col px-4 py-5 md:px-6 md:py-6">
          <div className="mx-auto w-full max-w-6xl">
            <div className="mb-6">
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                Saved Tasks
              </h1>
              <p className="mt-2 text-muted-foreground">
                Organize what is planned, in progress, and completed in one
                board.
              </p>
            </div>
            <TaskBoard />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
