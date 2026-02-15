import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { Badge } from "@/components/ui/badge"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Rocket, Code2, Cpu, Plus } from "lucide-react"

const metrics = [
  { label: "FOCUSED TIME", value: "4.2", suffix: "hours" },
  { label: "TEAM VELOCITY", value: "92%", suffix: "up this week" },
  { label: "ACTIVE COLLABORATORS", value: "14", suffix: "online" },
]

const rooms = [
  {
    name: "React Wizards",
    description: "Frontend architecture and component optimization.",
    mode: "CAFE MODE",
    members: "6/12 Members",
    icon: Code2,
  },
  {
    name: "SaaS Builders",
    description: "Collaborating on the next generation of SaaS tools.",
    mode: "BUILD SPRINT",
    members: "2/8 Members",
    icon: Rocket,
  },
  {
    name: "Rust Study Group",
    description: "Learning memory safety and performance together.",
    mode: "SESSION ACTIVE",
    members: "3/5 Members",
    icon: Cpu,
  },
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
        <div className="flex flex-1 flex-col px-4 py-5 md:px-6 md:py-6">
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

            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Your Rooms</h2>
              <a
                href="#"
                className="text-sm font-medium text-cyan-700 hover:text-cyan-600 dark:text-cyan-300 dark:hover:text-cyan-200"
              >
                View All
              </a>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {rooms.map((room) => (
                <article
                  key={room.name}
                  className="rounded-2xl border border-cyan-500/20 bg-slate-50/40 p-5 shadow-sm backdrop-blur dark:bg-slate-900/40"
                >
                  <div className="mb-5 flex items-start justify-between">
                    <div className="rounded-lg bg-cyan-500/15 p-2 text-cyan-800 dark:text-cyan-300">
                      <room.icon className="size-5" />
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
                        AR
                      </div>
                      <div className="flex size-7 items-center justify-center rounded-full border border-cyan-500/20 bg-cyan-100 text-xs font-medium text-cyan-900">
                        DP
                      </div>
                      <div className="flex size-7 items-center justify-center rounded-full border border-cyan-500/20 bg-cyan-50 text-xs font-medium text-cyan-900">
                        +2
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground">{room.members}</span>
                  </div>
                </article>
              ))}

              <button
                type="button"
                className="group rounded-2xl border border-dashed border-cyan-500/35 bg-cyan-500/5 p-5 text-left transition-colors hover:bg-cyan-500/10"
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

            <div className="mt-10">
              <h2 className="text-2xl font-semibold">Recent Activity</h2>
              <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                <p className="text-sm text-muted-foreground">
                  Alex opened <span className="font-medium text-foreground">React Wizards</span>{" "}
                  12 minutes ago and started a deep work timer.
                </p>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
