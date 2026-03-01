import { api } from "@/convex/_generated/api"
import type { FunctionReference } from "convex/server"
import type { Id } from "@/convex/_generated/dataModel"

type RoomsApiShape = {
  list: FunctionReference<"query", "public", Record<string, never>, unknown>
  ensureDefaults: FunctionReference<"mutation", "public", Record<string, never>, unknown>
  joinedRoomIdsByUser: FunctionReference<
    "query",
    "public",
    { userId: string },
    unknown
  >
  pinnedRoomIdsByUser: FunctionReference<
    "query",
    "public",
    { userId: string },
    unknown
  >
  togglePin: FunctionReference<
    "mutation",
    "public",
    { roomId: Id<"rooms">; userId: string },
    { pinned: boolean }
  >
  joinByRoomId: FunctionReference<
    "mutation",
    "public",
    { roomId: Id<"rooms">; userId: string },
    { joined: boolean; roomId: Id<"rooms"> }
  >
  joinByCode: FunctionReference<
    "mutation",
    "public",
    { code: string; userId: string },
    { joined: boolean; roomId: Id<"rooms"> }
  >
  leaveRoom: FunctionReference<
    "mutation",
    "public",
    { roomId: Id<"rooms">; userId: string },
    { left: boolean }
  >
  create: FunctionReference<
    "mutation",
    "public",
    {
      name: string
      description: string
      mode: string
      access: "public" | "private" | "invite_only"
      icon?: "code" | "rocket" | "cpu" | "sparkles"
      membersMax: number
      userId: string
    },
    unknown
  >
  updateSettings: FunctionReference<
    "mutation",
    "public",
    {
      sessionToken: string
      roomId: Id<"rooms">
      name: string
      description: string
      access: "public" | "private" | "invite_only"
      membersMax: number
    },
    { updated: boolean }
  >
  archive: FunctionReference<
    "mutation",
    "public",
    { sessionToken: string; roomId: Id<"rooms"> },
    { archived: boolean }
  >
  unarchive: FunctionReference<
    "mutation",
    "public",
    { sessionToken: string; roomId: Id<"rooms"> },
    { archived: boolean }
  >
  deleteRoom: FunctionReference<
    "mutation",
    "public",
    { sessionToken: string; roomId: Id<"rooms">; confirmationName: string },
    { deleted: boolean }
  >
  listMembersByRoom: FunctionReference<
    "query",
    "public",
    { sessionToken: string; roomId: Id<"rooms"> },
    unknown
  >
}

export const roomsApi = (api as unknown as { rooms: RoomsApiShape }).rooms
