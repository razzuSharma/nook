import { api } from "@/convex/_generated/api"
import type { FunctionReference } from "convex/server"

type TasksApiShape = {
  list: FunctionReference<"query", "public", Record<string, never>, unknown>
  ensureDefaults: FunctionReference<"mutation", "public", Record<string, never>, unknown>
  sync: FunctionReference<
    "mutation",
    "public",
    {
      tasks: Array<{
        taskId: string
        title: string
        note: string
        dueDate: string
        dueTime: string
        priority: "low" | "medium" | "high"
        status: "todo" | "working" | "completed"
        order: number
      }>
    },
    unknown
  >
}

export const tasksApi = (api as unknown as { tasks: TasksApiShape }).tasks
