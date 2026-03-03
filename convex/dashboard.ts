import { query } from "./_generated/server"
import type { QueryCtx } from "./_generated/server"
import { v } from "convex/values"

function toHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest("SHA-256", data)
  return toHex(new Uint8Array(digest))
}

async function requireUser(ctx: QueryCtx, sessionToken: string) {
  const tokenHash = await sha256(sessionToken)
  const session = await ctx.db
    .query("authSessions")
    .withIndex("by_tokenHash", (indexQuery) =>
      indexQuery.eq("tokenHash", tokenHash)
    )
    .first()

  if (!session || session.expiresAt <= Date.now()) {
    throw new Error("Unauthorized.")
  }

  const user = await ctx.db.get(session.userId)
  if (!user) {
    throw new Error("Unauthorized.")
  }

  return user
}

function sanitizeText(value: string | undefined | null) {
  if (!value) return ""
  return value
    .replace(/\\/g, "\\\\")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
}

export const get = query({
  args: {
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.sessionToken)
    const userId = user._id

    const [roomDocs, memberships, roomTasks, focusSessions, allPresence, allRoomMembers] =
      await Promise.all([
        ctx.db.query("rooms").withIndex("by_createdAt").collect(),
        ctx.db
          .query("roomMembers")
          .withIndex("by_user", (query) => query.eq("userId", String(userId)))
          .collect(),
        ctx.db.query("roomTasks").collect(),
        ctx.db
          .query("focusSessions")
          .withIndex("by_user_createdAt", (query) => query.eq("userId", userId))
          .order("desc")
          .collect(),
        ctx.db.query("roomFocusPresence").collect(),
        ctx.db.query("roomMembers").collect(),
      ])

    const joinedRoomIds = memberships
      .filter((membership) => membership.status === "active")
      .map((membership) => membership.roomId)
    const joinedRoomIdSet = new Set(joinedRoomIds.map((roomId) => String(roomId)))

    const joinedRooms = roomDocs.filter((room) => joinedRoomIdSet.has(String(room._id)))
    const roomNameById = new Map(
      joinedRooms.map((room) => [String(room._id), sanitizeText(room.name)])
    )

    const assignedTasks = roomTasks
      .filter((task) => String(task.assigneeUserId ?? "") === String(userId))
      .sort(
        (left, right) =>
          (left.dueAt ?? Number.MAX_SAFE_INTEGER) - (right.dueAt ?? Number.MAX_SAFE_INTEGER)
      )
      .map((task) => ({
        taskId: task.taskId,
        title: sanitizeText(task.title),
        priority: task.priority,
        status: task.status,
        dueAt: task.dueAt,
        roomId: task.roomId,
        roomName: roomNameById.get(String(task.roomId)) ?? "Room",
      }))

    const roomTasksByRoom = Object.fromEntries(
      joinedRoomIds.map((roomId) => [
        String(roomId),
        roomTasks
          .filter((task) => String(task.roomId) === String(roomId))
          .map((task) => ({
            taskId: task.taskId,
            title: sanitizeText(task.title),
            status: task.status,
            dueAt: task.dueAt,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt,
            completedAt: task.completedAt,
            assigneeUserId: task.assigneeUserId,
          })),
      ])
    )

    const activeRoomMembers = allRoomMembers.filter(
      (membership) =>
        joinedRoomIdSet.has(String(membership.roomId)) && membership.status === "active"
    )
    const activeMemberIdsByRoom = new Map<string, Set<string>>()
    for (const membership of activeRoomMembers) {
      const key = String(membership.roomId)
      const current = activeMemberIdsByRoom.get(key) ?? new Set<string>()
      current.add(membership.userId)
      activeMemberIdsByRoom.set(key, current)
    }

    const uniqueUserIds = Array.from(new Set(activeRoomMembers.map((membership) => membership.userId)))
    const usersById = new Map<
      string,
      {
        name?: string
        username?: string
        email?: string
        avatarKey?: string
      } | null
    >()
    await Promise.all(
      uniqueUserIds.map(async (id) => {
        const normalized = ctx.db.normalizeId("users", id)
        usersById.set(id, normalized ? await ctx.db.get(normalized) : null)
      })
    )

    const roomMembersByRoom = Object.fromEntries(
      joinedRoomIds.map((roomId) => [
        String(roomId),
        activeRoomMembers
          .filter((membership) => String(membership.roomId) === String(roomId))
          .map((membership) => {
            const member = usersById.get(membership.userId)
            return {
              userId: membership.userId,
              name: sanitizeText(member?.name ?? "Unknown User"),
              username: sanitizeText(member?.username ?? ""),
              email: sanitizeText(member?.email ?? ""),
              role: membership.role,
              avatarKey: sanitizeText(member?.avatarKey ?? "avatar-1"),
            }
          }),
      ])
    )

    const roomPresenceByRoom = Object.fromEntries(
      joinedRoomIds.map((roomId) => [
        String(roomId),
        allPresence
          .filter((presence) => {
            if (String(presence.roomId) !== String(roomId)) return false
            if (presence.visibility === "private") return false
            if (presence.status !== "focusing") return false
            return activeMemberIdsByRoom.get(String(roomId))?.has(String(presence.userId))
          })
          .map((presence) => ({
            userId: presence.userId,
            status: presence.status,
            endsAt: presence.endsAt ?? null,
          })),
      ])
    )

    return {
      rooms: joinedRooms,
      joinedRoomIds,
      assignedTasks,
      focusSessions: focusSessions.map((session) => ({
        durationMinutes: session.durationMinutes,
        createdAt: session.createdAt,
        completedAt: session.completedAt,
        outcome: session.outcome,
      })),
      roomTasksByRoom,
      roomPresenceByRoom,
      roomMembersByRoom,
    }
  },
})
