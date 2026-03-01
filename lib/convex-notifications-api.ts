import { api } from "@/convex/_generated/api"
import type { FunctionReference } from "convex/server"

type NotificationsApiShape = {
  listByViewer: FunctionReference<
    "query",
    "public",
    { sessionToken: string; limit?: number },
    {
      unreadCount: number
      items: Array<{
        id: string
        type: "task_assigned" | "task_mentioned"
        title: string
        message: string
        roomId?: string
        taskId?: string
        readAt: number | null
        createdAt: number
      }>
    }
  >
  markRead: FunctionReference<
    "mutation",
    "public",
    { sessionToken: string; notificationId: string },
    { updated: boolean }
  >
  markAllRead: FunctionReference<
    "mutation",
    "public",
    { sessionToken: string },
    { updated: number }
  >
}

export const notificationsApi = (
  api as unknown as { notifications: NotificationsApiShape }
).notifications
