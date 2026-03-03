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

function startOfToday() {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return now.getTime()
}

function startOfTomorrow() {
  return startOfToday() + 24 * 60 * 60 * 1000
}

export const get = query({
  args: {
    sessionToken: v.string(),
    notificationLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.sessionToken)
    const userId = user._id
    const today = startOfToday()
    const inTwoDays = startOfTomorrow() + 24 * 60 * 60 * 1000
    const notificationLimit = Math.min(Math.max(args.notificationLimit ?? 20, 1), 50)

    const [
      roomDocs,
      memberships,
      roomPins,
      focusSessions,
      personalTasks,
      roomTasks,
      notifications,
    ] = await Promise.all([
      ctx.db.query("rooms").withIndex("by_createdAt").collect(),
      ctx.db
        .query("roomMembers")
        .withIndex("by_user", (query) => query.eq("userId", String(userId)))
        .collect(),
      ctx.db
        .query("roomPins")
        .withIndex("by_user", (query) => query.eq("userId", String(userId)))
        .collect(),
      ctx.db
        .query("focusSessions")
        .withIndex("by_user_createdAt", (query) => query.eq("userId", userId))
        .order("desc")
        .collect(),
      ctx.db
        .query("tasks")
        .withIndex("by_user_order", (query) => query.eq("userId", userId))
        .collect(),
      ctx.db.query("roomTasks").collect(),
      ctx.db
        .query("userNotifications")
        .withIndex("by_user_createdAt", (query) => query.eq("userId", userId))
        .order("desc")
        .take(notificationLimit),
    ])

    const activeRoomIds = new Set(
      memberships
        .filter((membership) => membership.status === "active")
        .map((membership) => String(membership.roomId))
    )
    const pinnedRoomIds = roomPins
      .filter((pin) => activeRoomIds.has(String(pin.roomId)))
      .map((pin) => pin.roomId)

    const roomNameById = new Map(roomDocs.map((room) => [String(room._id), room.name]))

    const todayFocusMinutes = focusSessions
      .filter((session) => session.createdAt >= today)
      .reduce((sum, session) => sum + session.durationMinutes, 0)

    const assignedTasks = roomTasks
      .filter(
        (task) =>
          String(task.assigneeUserId ?? "") === String(userId) &&
          task.status !== "completed"
      )
      .sort(
        (left, right) =>
          (left.dueAt ?? Number.MAX_SAFE_INTEGER) - (right.dueAt ?? Number.MAX_SAFE_INTEGER)
      )
      .slice(0, 6)
      .map((task) => ({
        taskId: task.taskId,
        title: task.title,
        priority: task.priority,
        status: task.status,
        dueAt: task.dueAt,
        roomId: task.roomId,
        roomName: roomNameById.get(String(task.roomId)) ?? "Room",
      }))

    const upcomingPersonalTasks = personalTasks
      .filter((task) => task.status !== "completed" && task.dueDate)
      .map((task) => ({
        taskId: task.taskId,
        title: task.title,
        dueDate: task.dueDate,
        dueTime: task.dueTime,
        dueAt: new Date(`${task.dueDate}T${task.dueTime || "09:00"}`).getTime(),
      }))
      .filter((task) => !Number.isNaN(task.dueAt) && task.dueAt >= today && task.dueAt < inTwoDays)
      .sort((a, b) => a.dueAt - b.dueAt)
      .slice(0, 5)

    const activeRooms = roomDocs
      .filter((room) => room.membersCount > 0)
      .sort((a, b) => b.membersCount - a.membersCount)

    return {
      rooms: roomDocs.map((room) => ({
        _id: room._id,
        name: room.name,
        icon: room.icon,
        archivedAt: room.archivedAt,
        membersCount: room.membersCount,
      })),
      pinnedRoomIds,
      todayFocusHours: Number((todayFocusMinutes / 60).toFixed(1)),
      assignedTasks,
      upcomingPersonalTasks,
      activeMembersPreview: activeRooms.slice(0, 6).map((room, index) => ({
        key: room._id,
        initials: room.name
          .split(" ")
          .map((part) => part[0] ?? "")
          .join("")
          .slice(0, 2)
          .toUpperCase(),
        color:
          index % 3 === 0
            ? "bg-emerald-500"
            : index % 3 === 1
              ? "bg-amber-500"
              : "bg-cyan-500",
      })),
      totalOnlineCount: activeRooms.reduce((sum, room) => sum + room.membersCount, 0),
      notifications: {
        unreadCount: notifications.filter((item) => !item.readAt).length,
        items: notifications.map((doc) => ({
          id: doc._id,
          title: doc.title,
          message: doc.message,
          roomId: doc.roomId,
          taskId: doc.taskId,
          readAt: doc.readAt ?? null,
          createdAt: doc.createdAt,
        })),
      },
    }
  },
})
