import type { SavedTask } from "@/components/saved-tasks/types"

export const initialSavedTasks: SavedTask[] = [
  {
    id: "t-1",
    title: "Finalize onboarding copy",
    note: "Update welcome messaging and CTA labels.",
    dueDate: "2026-02-15",
    dueTime: "10:00",
    priority: "high",
    status: "todo",
  },
  {
    id: "t-2",
    title: "Prepare sprint board",
    note: "Create initial cards for Q1 delivery scope.",
    dueDate: "2026-02-16",
    dueTime: "13:30",
    priority: "medium",
    status: "todo",
  },
  {
    id: "t-3",
    title: "Refine dashboard metrics",
    note: "Align data labels and card emphasis.",
    dueDate: "2026-02-15",
    dueTime: "15:00",
    priority: "medium",
    status: "working",
  },
  {
    id: "t-4",
    title: "Theme token cleanup",
    note: "Consolidate Nook tokens in globals.",
    dueDate: "2026-02-14",
    dueTime: "17:45",
    priority: "low",
    status: "completed",
  },
]
