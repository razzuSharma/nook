export type ActivityItem = {
  name: string
  initials: string
  task: string
  activity: string
  time: string
}

export const recentActivityItems: ActivityItem[] = [
  {
    name: "Alex Rivers",
    initials: "AR",
    task: "React Wizards",
    activity: "moved 2 tasks to In Progress in",
    time: "12 min ago",
  },
  {
    name: "Dana Park",
    initials: "DP",
    task: "SaaS Builders",
    activity: "created a new room brief in",
    time: "27 min ago",
  },
  {
    name: "Kai Morgan",
    initials: "KM",
    task: "Rust Study Group",
    activity: "completed memory safety checklist in",
    time: "45 min ago",
  },
  {
    name: "Nora Patel",
    initials: "NP",
    task: "Design Systems",
    activity: "shared token updates in",
    time: "1 hr ago",
  },
]
