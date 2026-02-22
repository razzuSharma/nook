import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import type { FunctionReference } from "convex/server"

type RoomTasksApiShape = {
  listByRoom: FunctionReference<
    "query",
    "public",
    { roomId: Id<"rooms"> },
    unknown
  >
  syncByRoom: FunctionReference<
    "mutation",
    "public",
    {
      roomId: Id<"rooms">
      tasks: Array<{
        taskId: string
        title: string
        note: string
        assignee: string
        assigneeUserId?: Id<"users">
        priority: "low" | "medium" | "high"
        status: "todo" | "working" | "completed"
        order: number
      }>
    },
    unknown
  >
}

export const roomTasksApi = (
  api as unknown as { roomTasks: RoomTasksApiShape }
).roomTasks
