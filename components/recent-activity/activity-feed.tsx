import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import type { ActivityItem } from "@/components/recent-activity/data"

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-2 backdrop-blur">
      <ul className="divide-y divide-cyan-500/15">
        {items.map((item) => (
          <li
            key={`${item.name}-${item.task}-${item.time}`}
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
