import { api } from "@/convex/_generated/api"
import type { FunctionReference } from "convex/server"
import type { Id } from "@/convex/_generated/dataModel"

type RoomInvitesApiShape = {
  listByRoom: FunctionReference<
    "query",
    "public",
    { sessionToken: string; roomId: Id<"rooms"> },
    unknown
  >
  create: FunctionReference<
    "mutation",
    "public",
    {
      sessionToken: string
      roomId: Id<"rooms">
      email: string
      role: "viewer" | "member" | "admin"
      siteUrl: string
    },
    { inviteLink: string }
  >
  revoke: FunctionReference<
    "mutation",
    "public",
    { sessionToken: string; inviteId: Id<"roomInvites"> },
    { revoked: boolean }
  >
  accept: FunctionReference<
    "mutation",
    "public",
    { sessionToken: string; token: string },
    { accepted: boolean; roomId: Id<"rooms"> }
  >
}

export const roomInvitesApi = (
  api as unknown as { roomInvites: RoomInvitesApiShape }
).roomInvites
