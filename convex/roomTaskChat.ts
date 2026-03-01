import { mutation, query } from "./_generated/server"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import type { Id } from "./_generated/dataModel"
import { v } from "convex/values"
import { buildMentionHandle, extractMentionHandles } from "../lib/mention-utils"

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

async function requireUserBySession(
  ctx: QueryCtx | MutationCtx,
  sessionToken: string
) {
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

async function requireActiveRoomMembership(
  ctx: QueryCtx | MutationCtx,
  roomId: Id<"rooms">,
  userId: string
) {
  const membership = await ctx.db
    .query("roomMembers")
    .withIndex("by_room_user", (indexQuery) =>
      indexQuery.eq("roomId", roomId).eq("userId", userId)
    )
    .first()

  if (!membership || membership.status !== "active") {
    throw new Error("Only joined room members can access task chat.")
  }

  return membership
}

function requireFileActionRole(role: "viewer" | "member" | "admin") {
  if (role === "viewer") {
    throw new Error("Viewers can view files, but cannot upload or share files.")
  }
}

async function requireTaskInRoom(
  ctx: QueryCtx | MutationCtx,
  roomId: Id<"rooms">,
  taskId: string
) {
  const task = await ctx.db
    .query("roomTasks")
    .withIndex("by_room_taskId", (indexQuery) =>
      indexQuery.eq("roomId", roomId).eq("taskId", taskId)
    )
    .first()

  if (!task) {
    throw new Error("Task not found in this room.")
  }

  return task
}

async function getActiveRoomMembersWithUsers(
  ctx: QueryCtx | MutationCtx,
  roomId: Id<"rooms">
) {
  const memberships = await ctx.db
    .query("roomMembers")
    .withIndex("by_room", (indexQuery) => indexQuery.eq("roomId", roomId))
    .collect()

  const activeMemberships = memberships.filter(
    (membership) => membership.status === "active"
  )

  return Promise.all(
    activeMemberships.map(async (membership) => {
      const normalizedUserId = ctx.db.normalizeId("users", membership.userId)
      const user = normalizedUserId ? await ctx.db.get(normalizedUserId) : null
      return {
        membership,
        user,
      }
    })
  )
}

export const listThread = query({
  args: {
    sessionToken: v.string(),
    roomId: v.id("rooms"),
    taskId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUserBySession(ctx, args.sessionToken)
    await requireActiveRoomMembership(ctx, args.roomId, user._id as string)
    await requireTaskInRoom(ctx, args.roomId, args.taskId)

    const [messages, files] = await Promise.all([
      ctx.db
        .query("roomTaskMessages")
        .withIndex("by_room_task_createdAt", (indexQuery) =>
          indexQuery.eq("roomId", args.roomId).eq("taskId", args.taskId)
        )
        .order("asc")
        .collect(),
      ctx.db
        .query("roomTaskFiles")
        .withIndex("by_room_task_createdAt", (indexQuery) =>
          indexQuery.eq("roomId", args.roomId).eq("taskId", args.taskId)
        )
        .order("asc")
        .collect(),
    ])
    const events = await ctx.db
      .query("roomTaskEvents")
      .withIndex("by_room_task_createdAt", (indexQuery) =>
        indexQuery.eq("roomId", args.roomId).eq("taskId", args.taskId)
      )
      .order("desc")
      .take(50)

    const userById = new Map<string, { name: string; avatarKey: string }>()
    const mentionedUserIds = new Set<string>()

    for (const message of messages) {
      mentionedUserIds.add(message.authorUserId)
    }
    for (const file of files) {
      mentionedUserIds.add(file.uploadedByUserId)
    }
    for (const event of events) {
      mentionedUserIds.add(event.actorUserId)
    }

    await Promise.all(
      Array.from(mentionedUserIds).map(async (userId) => {
        const normalized = ctx.db.normalizeId("users", userId)
        const doc = normalized ? await ctx.db.get(normalized) : null
        userById.set(userId, {
          name: doc?.name ?? "Unknown User",
          avatarKey: doc?.avatarKey ?? "avatar-1",
        })
      })
    )

    const filesWithResolvedUrl = await Promise.all(
      files.map(async (file) => {
        const resolvedUrl = file.storageId
          ? await ctx.storage.getUrl(file.storageId)
          : file.url
        return {
          id: file._id,
          taskId: file.taskId,
          roomId: file.roomId,
          name: file.name,
          url: resolvedUrl ?? file.url,
          mimeType: file.mimeType ?? "",
          sizeBytes: file.sizeBytes ?? null,
          storageId: file.storageId ?? null,
          createdAt: file.createdAt,
          uploadedByUserId: file.uploadedByUserId,
          uploadedByName:
            userById.get(file.uploadedByUserId)?.name ?? "Unknown User",
          uploadedByAvatarKey:
            userById.get(file.uploadedByUserId)?.avatarKey ?? "avatar-1",
        }
      })
    )

    return {
      messages: messages.map((message) => ({
        id: message._id,
        taskId: message.taskId,
        roomId: message.roomId,
        body: message.body,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
        authorUserId: message.authorUserId,
        authorName: userById.get(message.authorUserId)?.name ?? "Unknown User",
        authorAvatarKey:
          userById.get(message.authorUserId)?.avatarKey ?? "avatar-1",
      })),
      files: filesWithResolvedUrl,
      events: events.map((event) => ({
        id: event._id,
        type: event.type,
        message: event.message,
        createdAt: event.createdAt,
        actorUserId: event.actorUserId,
        actorName: userById.get(event.actorUserId)?.name ?? "Unknown User",
        actorAvatarKey: userById.get(event.actorUserId)?.avatarKey ?? "avatar-1",
      })),
    }
  },
})

export const listTaskThreadSummaries = query({
  args: {
    sessionToken: v.string(),
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const user = await requireUserBySession(ctx, args.sessionToken)
    await requireActiveRoomMembership(ctx, args.roomId, user._id as string)

    const tasks = await ctx.db
      .query("roomTasks")
      .withIndex("by_room_order", (indexQuery) => indexQuery.eq("roomId", args.roomId))
      .collect()
    const messages = await ctx.db
      .query("roomTaskMessages")
      .withIndex("by_room_task_createdAt", (indexQuery) => indexQuery.eq("roomId", args.roomId))
      .collect()
    const reads = await ctx.db
      .query("roomTaskThreadReads")
      .withIndex("by_room_user", (indexQuery) =>
        indexQuery.eq("roomId", args.roomId).eq("userId", user._id)
      )
      .collect()

    const latestByTaskId = new Map<
      string,
      {
        latestMessageAt: number
        latestAuthorUserId: string
        latestBody: string
        messageCount: number
        unreadCount: number
      }
    >()
    const readByTaskId = new Map(reads.map((read) => [read.taskId, read.lastReadAt]))
    const latestAuthorIds = new Set<string>()

    for (const task of tasks) {
      latestByTaskId.set(task.taskId, {
        latestMessageAt: 0,
        latestAuthorUserId: "",
        latestBody: "",
        messageCount: 0,
        unreadCount: 0,
      })
    }

    for (const message of messages) {
      latestAuthorIds.add(message.authorUserId)
      const existing = latestByTaskId.get(message.taskId) ?? {
        latestMessageAt: 0,
        latestAuthorUserId: "",
        latestBody: "",
        messageCount: 0,
        unreadCount: 0,
      }
      const lastReadAt = readByTaskId.get(message.taskId) ?? 0
      const isUnreadForViewer =
        message.createdAt > lastReadAt && message.authorUserId !== (user._id as string)
      latestByTaskId.set(message.taskId, {
        latestMessageAt: Math.max(existing.latestMessageAt, message.createdAt),
        latestAuthorUserId:
          message.createdAt >= existing.latestMessageAt
            ? message.authorUserId
            : existing.latestAuthorUserId,
        latestBody:
          message.createdAt >= existing.latestMessageAt
            ? message.body
            : existing.latestBody,
        messageCount: existing.messageCount + 1,
        unreadCount: existing.unreadCount + (isUnreadForViewer ? 1 : 0),
      })
    }

    const authorNameById = new Map<string, string>()
    await Promise.all(
      Array.from(latestAuthorIds).map(async (authorUserId) => {
        const normalized = ctx.db.normalizeId("users", authorUserId)
        const author = normalized ? await ctx.db.get(normalized) : null
        authorNameById.set(authorUserId, author?.name ?? "Teammate")
      })
    )

    return Array.from(latestByTaskId.entries()).map(([taskId, summary]) => ({
      taskId,
      latestMessageAt: summary.latestMessageAt || undefined,
      latestAuthorUserId: summary.latestAuthorUserId || undefined,
      latestAuthorName: summary.latestAuthorUserId
        ? authorNameById.get(summary.latestAuthorUserId) ?? "Teammate"
        : undefined,
      latestBody: summary.latestBody || undefined,
      messageCount: summary.messageCount,
      unreadCount: summary.unreadCount,
    }))
  },
})

export const markThreadRead = mutation({
  args: {
    sessionToken: v.string(),
    roomId: v.id("rooms"),
    taskId: v.string(),
    readAt: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireUserBySession(ctx, args.sessionToken)
    await requireActiveRoomMembership(ctx, args.roomId, user._id as string)
    await requireTaskInRoom(ctx, args.roomId, args.taskId)

    const existing = await ctx.db
      .query("roomTaskThreadReads")
      .withIndex("by_room_user_task", (indexQuery) =>
        indexQuery
          .eq("roomId", args.roomId)
          .eq("userId", user._id)
          .eq("taskId", args.taskId)
      )
      .first()

    if (existing) {
      if (args.readAt > existing.lastReadAt) {
        await ctx.db.patch(existing._id, { lastReadAt: args.readAt })
      }
      return { updated: true }
    }

    await ctx.db.insert("roomTaskThreadReads", {
      roomId: args.roomId,
      taskId: args.taskId,
      userId: user._id,
      lastReadAt: args.readAt,
    })
    return { updated: true }
  },
})

export const sendMessage = mutation({
  args: {
    sessionToken: v.string(),
    roomId: v.id("rooms"),
    taskId: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUserBySession(ctx, args.sessionToken)
    await requireActiveRoomMembership(ctx, args.roomId, user._id as string)
    const task = await requireTaskInRoom(ctx, args.roomId, args.taskId)

    const body = args.body.trim()
    if (!body) {
      throw new Error("Message cannot be empty.")
    }

    const now = Date.now()
    await ctx.db.insert("roomTaskMessages", {
      roomId: args.roomId,
      taskId: args.taskId,
      authorUserId: user._id as string,
      body,
      createdAt: now,
      updatedAt: now,
    })

    const room = await ctx.db.get(args.roomId)
    const mentionedHandles = extractMentionHandles(body)
    if (room && mentionedHandles.length > 0) {
      const members = await getActiveRoomMembersWithUsers(ctx, args.roomId)
      const uniqueRecipients = new Set<string>()

      for (const member of members) {
        if (!member.user) continue
        if (member.membership.userId === (user._id as string)) continue
        const handle = buildMentionHandle({
          username: member.user.username,
          name: member.user.name,
          email: member.user.email,
          userId: member.membership.userId,
        })
        if (!mentionedHandles.includes(handle)) continue
        if (uniqueRecipients.has(member.membership.userId)) continue
        uniqueRecipients.add(member.membership.userId)

        await ctx.db.insert("userNotifications", {
          userId: member.user._id,
          type: "task_mentioned",
          title: `${user.name ?? "Someone"} mentioned you`,
          message: `Mentioned you in "${task.title}" in ${room.name}.`,
          roomId: args.roomId,
          taskId: args.taskId,
          createdAt: now,
        })
      }
    }

    return { sent: true }
  },
})

export const shareFile = mutation({
  args: {
    sessionToken: v.string(),
    roomId: v.id("rooms"),
    taskId: v.string(),
    name: v.string(),
    url: v.string(),
    mimeType: v.optional(v.string()),
    sizeBytes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUserBySession(ctx, args.sessionToken)
    const membership = await requireActiveRoomMembership(
      ctx,
      args.roomId,
      user._id as string
    )
    requireFileActionRole(membership.role)
    await requireTaskInRoom(ctx, args.roomId, args.taskId)

    const name = args.name.trim()
    const url = args.url.trim()

    if (!name) {
      throw new Error("File name is required.")
    }
    if (!url) {
      throw new Error("File URL is required.")
    }
    if (!/^https?:\/\//i.test(url)) {
      throw new Error("File URL must start with http:// or https://")
    }

    await ctx.db.insert("roomTaskFiles", {
      roomId: args.roomId,
      taskId: args.taskId,
      uploadedByUserId: user._id as string,
      name,
      url,
      storageId: undefined,
      mimeType: args.mimeType?.trim() || undefined,
      sizeBytes: args.sizeBytes,
      createdAt: Date.now(),
    })

    return { shared: true }
  },
})

export const generateUploadUrl = mutation({
  args: {
    sessionToken: v.string(),
    roomId: v.id("rooms"),
    taskId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUserBySession(ctx, args.sessionToken)
    const membership = await requireActiveRoomMembership(
      ctx,
      args.roomId,
      user._id as string
    )
    requireFileActionRole(membership.role)
    await requireTaskInRoom(ctx, args.roomId, args.taskId)

    return {
      uploadUrl: await ctx.storage.generateUploadUrl(),
    }
  },
})

export const shareUploadedFile = mutation({
  args: {
    sessionToken: v.string(),
    roomId: v.id("rooms"),
    taskId: v.string(),
    name: v.string(),
    storageId: v.id("_storage"),
    mimeType: v.optional(v.string()),
    sizeBytes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUserBySession(ctx, args.sessionToken)
    const membership = await requireActiveRoomMembership(
      ctx,
      args.roomId,
      user._id as string
    )
    requireFileActionRole(membership.role)
    await requireTaskInRoom(ctx, args.roomId, args.taskId)

    const name = args.name.trim()
    if (!name) {
      throw new Error("File name is required.")
    }

    const fileUrl = await ctx.storage.getUrl(args.storageId)
    await ctx.db.insert("roomTaskFiles", {
      roomId: args.roomId,
      taskId: args.taskId,
      uploadedByUserId: user._id as string,
      name,
      url: fileUrl ?? "",
      storageId: args.storageId,
      mimeType: args.mimeType?.trim() || undefined,
      sizeBytes: args.sizeBytes,
      createdAt: Date.now(),
    })

    return { shared: true }
  },
})
