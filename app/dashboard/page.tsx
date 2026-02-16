import { AppSidebar } from "@/components/app-sidebar"
import { RightSidebar } from "@/components/right-sidebar"
import { ActivityFeed } from "@/components/recent-activity/activity-feed"
import { recentActivityItems } from "@/components/recent-activity/data"
import { RoomsGrid } from "@/components/rooms/rooms-grid"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

const metrics = [
  { label: "FOCUSED TIME", value: "4.2", suffix: "hours" },
  { label: "TEAM VELOCITY", value: "92%", suffix: "up this week" },
  { label: "ACTIVE COLLABORATORS", value: "14", suffix: "online" },
]

export default function Page() {
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
        <SiteHeader />
        <div className="flex flex-1 flex-col px-4 py-5 md:px-6 md:py-6 lg:pr-20">
          <div className="mx-auto w-full max-w-6xl">
            <div className="mb-6">
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                Good afternoon, Alex.
              </h1>
              <p className="mt-2 text-muted-foreground">
                Ready for focused collaboration? You have 3 rooms active today.
              </p>
            </div>

            <div className="mb-8 grid gap-4 md:grid-cols-3">
              {metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-5 backdrop-blur"
                >
                  <p className="text-xs font-semibold tracking-wide text-cyan-900/60 dark:text-cyan-100/70">
                    {metric.label}
                  </p>
                  <div className="mt-3 flex items-end gap-2">
                    <span className="text-3xl font-semibold">{metric.value}</span>
                    <span className="pb-1 text-sm text-muted-foreground">
                      {metric.suffix}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <RoomsGrid />

            <div className="mt-10">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-2xl font-semibold">Recent Activity</h2>
                <a
                  href="/dashboard/recent-activity"
                  className="text-sm font-medium text-cyan-700 hover:text-cyan-600 dark:text-cyan-300 dark:hover:text-cyan-200"
                >
                  View Timeline
                </a>
              </div>
              <ActivityFeed items={recentActivityItems} />
            </div>
          </div>
        </div>
      </SidebarInset>
      <RightSidebar />
    </SidebarProvider>
  )
}
