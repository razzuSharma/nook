import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import type { ActivityItem } from "@/components/recent-activity/data"
import { getActivityFeedState } from "@/lib/activity-feed-state.mjs"

export function ActivityFeed({
  items,
  isLoading = false,
  errorMessage = null,
  suggestions = [
    "Enter your first room ->",
    "Invite a teammate ->",
    "Try Deep Work Mode ->",
  ],
}: {
  items: ActivityItem[]
  isLoading?: boolean
  errorMessage?: string | null
  suggestions?: string[]
}) {
  const state = getActivityFeedState({ items, isLoading, errorMessage })

  if (state === "loading") {
    return (
      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-6 text-sm text-muted-foreground backdrop-blur">
        <p className="font-medium text-foreground">Loading recent activity...</p>
        <div className="mt-3 space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-10 animate-pulse rounded-md bg-cyan-500/10"
            />
          ))}
        </div>
      </div>
    )
  }

  if (state === "error") {
    return (
      <div className="rounded-2xl border border-rose-500/25 bg-rose-500/5 p-6 text-sm text-muted-foreground backdrop-blur">
        <p className="font-medium text-foreground">Could not load recent activity.</p>
        <p className="mt-2">{errorMessage}</p>
      </div>
    )
  }

  if (state === "empty") {
    return (
      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-6 text-sm text-muted-foreground backdrop-blur">
        <p className="font-medium text-foreground">No recent activity yet.</p>
        {suggestions.length > 0 ? (
          <ul className="mt-3 space-y-2 text-sm">
            {suggestions.map((suggestion) => (
              <li key={suggestion} className="rounded-md bg-cyan-500/10 px-3 py-2">
                {suggestion}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-2 backdrop-blur">
      <ul className="divide-y divide-cyan-500/15">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-start gap-3 px-3 py-4"
          >
            <Avatar className="size-9 border border-cyan-500/25 bg-cyan-500/15">
              <AvatarFallback className="bg-transparent text-xs font-semibold text-cyan-900 dark:text-cyan-100">
                {item.initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm">
                  <span className="font-semibold">{item.name}</span>{" "}
                  <span className="text-muted-foreground">{item.activity}</span>{" "}
                  <span className="font-medium text-cyan-700 dark:text-cyan-300">
                    {item.task}
                  </span>
                </p>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {item.time}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
