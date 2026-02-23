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
  listAssignedByUser: FunctionReference<
    "query",
    "public",
    { userId: string },
    Array<{
      taskId: string
      title: string
      priority: "low" | "medium" | "high"
      effort?: "quick" | "half_day" | "full_day" | "multi_day"
      status: "todo" | "working" | "blocked" | "completed"
      dueAt?: number
      roomId: Id<"rooms">
      roomName: string
    }>
  >
  syncByRoom: FunctionReference<
    "mutation",
    "public",
    {
      roomId: Id<"rooms">
      actorUserId?: string
      tasks: Array<{
        taskId: string
        title: string
        note: string
        assignee: string
        assigneeUserId?: Id<"users">
        priority: "low" | "medium" | "high"
        effort?: "quick" | "half_day" | "full_day" | "multi_day"
        status: "todo" | "working" | "blocked" | "completed"
        dueAt?: number
        order: number
      }>
    },
    unknown
  >
  createQuickTask: FunctionReference<
    "mutation",
    "public",
    {
      roomId: Id<"rooms">
      userId: string
      title: string
    },
    { taskId: string }
  >
}

export const roomTasksApi = (
  api as unknown as { roomTasks: RoomTasksApiShape }
).roomTasks
