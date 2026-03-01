import { api } from "@/convex/_generated/api"
import type { FunctionReference } from "convex/server"
import type { Id } from "@/convex/_generated/dataModel"

type RoomTaskChatApiShape = {
  listThread: FunctionReference<
    "query",
    "public",
    { sessionToken: string; roomId: Id<"rooms">; taskId: string },
    unknown
  >
  sendMessage: FunctionReference<
    "mutation",
    "public",
    { sessionToken: string; roomId: Id<"rooms">; taskId: string; body: string },
    { sent: boolean }
  >
  markThreadRead: FunctionReference<
    "mutation",
    "public",
    { sessionToken: string; roomId: Id<"rooms">; taskId: string; readAt: number },
    { updated: boolean }
  >
  listTaskThreadSummaries: FunctionReference<
    "query",
    "public",
    { sessionToken: string; roomId: Id<"rooms"> },
    Array<{
      taskId: string
      latestMessageAt?: number
      latestAuthorUserId?: string
      latestAuthorName?: string
      latestBody?: string
      messageCount: number
      unreadCount: number
    }>
  >
  shareFile: FunctionReference<
    "mutation",
    "public",
    {
      sessionToken: string
      roomId: Id<"rooms">
      taskId: string
      name: string
      url: string
      mimeType?: string
      sizeBytes?: number
    },
    { shared: boolean }
  >
  generateUploadUrl: FunctionReference<
    "mutation",
    "public",
    { sessionToken: string; roomId: Id<"rooms">; taskId: string },
    { uploadUrl: string }
  >
  shareUploadedFile: FunctionReference<
    "mutation",
    "public",
    {
      sessionToken: string
      roomId: Id<"rooms">
      taskId: string
      name: string
      storageId: Id<"_storage">
      mimeType?: string
      sizeBytes?: number
    },
    { shared: boolean }
  >
}

export const roomTaskChatApi = (api as unknown as { roomTaskChat: RoomTaskChatApiShape })
  .roomTaskChat
