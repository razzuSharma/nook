export type TaskStatus = "todo" | "working" | "completed"

export type TaskPriority = "low" | "medium" | "high"

export type SavedTask = {
  id: string
  title: string
  note: string
  dueDate: string
  dueTime: string
  priority: TaskPriority
  status: TaskStatus
}
