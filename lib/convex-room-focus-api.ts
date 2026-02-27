import { api } from "@/convex/_generated/api"
import type { FunctionReference } from "convex/server"
import type { Id } from "@/convex/_generated/dataModel"

type RoomFocusApiShape = {
  listPresence: FunctionReference<
    "query",
    "public",
    { sessionToken: string; roomId: Id<"rooms"> },
    unknown
  >
  start: FunctionReference<
    "mutation",
    "public",
    {
      sessionToken: string
      roomId: Id<"rooms">
      intention: string
      durationMinutes: number
      taskId?: string
      visibility: "private" | "room" | "room_with_reflection"
    },
    unknown
  >
  markDone: FunctionReference<
    "mutation",
    "public",
    { sessionToken: string; roomId: Id<"rooms"> },
    unknown
  >
  complete: FunctionReference<
    "mutation",
    "public",
    {
      sessionToken: string
      roomId: Id<"rooms">
      reflection?: string
      outcome?: "done" | "progress" | "blocked"
      blockerNote?: string
      followUpTaskId?: string
    },
    unknown
  >
}

export const roomFocusApi = (
  api as unknown as { roomFocus: RoomFocusApiShape }
).roomFocus
