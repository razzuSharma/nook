import { api } from "@/convex/_generated/api"
import type { FunctionReference } from "convex/server"

type TasksApiShape = {
  list: FunctionReference<
    "query",
    "public",
    { sessionToken: string },
    unknown
  >
  ensureDefaults: FunctionReference<
    "mutation",
    "public",
    { sessionToken: string },
    unknown
  >
  sync: FunctionReference<
    "mutation",
    "public",
    {
      sessionToken: string
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
