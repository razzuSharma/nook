import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  users: defineTable({
    email: v.string(),
    name: v.string(),
    avatarKey: v.optional(v.string()),
    passwordHash: v.string(),
    passwordSalt: v.string(),
    emailVerifiedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_email", ["email"]),
  authSessions: defineTable({
    userId: v.id("users"),
    tokenHash: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_user", ["userId"]),
  emailVerificationTokens: defineTable({
    userId: v.id("users"),
    tokenHash: v.string(),
    email: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_user", ["userId"]),
  rooms: defineTable({
    name: v.string(),
    description: v.string(),
    mode: v.string(),
    access: v.optional(
      v.union(v.literal("public"), v.literal("private"), v.literal("invite_only"))
    ),
    membersCount: v.number(),
    membersMax: v.number(),
    joinCode: v.optional(v.string()),
    icon: v.union(
      v.literal("code"),
      v.literal("rocket"),
      v.literal("cpu"),
      v.literal("sparkles")
    ),
    createdAt: v.number(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_joinCode", ["joinCode"]),
  roomMembers: defineTable({
    roomId: v.id("rooms"),
    userId: v.string(),
    role: v.union(v.literal("viewer"), v.literal("member"), v.literal("admin")),
    status: v.union(v.literal("active"), v.literal("left")),
    joinedAt: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_user", ["userId"])
    .index("by_room_user", ["roomId", "userId"]),
  roomPins: defineTable({
    roomId: v.id("rooms"),
    userId: v.string(),
    pinnedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_room_user", ["roomId", "userId"]),
  roomTasks: defineTable({
    roomId: v.id("rooms"),
    taskId: v.string(),
    title: v.string(),
    note: v.string(),
    assignee: v.string(),
    assigneeUserId: v.optional(v.id("users")),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    status: v.union(
      v.literal("todo"),
      v.literal("working"),
      v.literal("completed")
    ),
    order: v.number(),
    dueAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_room_order", ["roomId", "order"])
    .index("by_room_taskId", ["roomId", "taskId"]),
  roomTaskEvents: defineTable({
    roomId: v.id("rooms"),
    taskId: v.string(),
    actorUserId: v.string(),
    type: v.string(),
    message: v.string(),
    createdAt: v.number(),
  }).index("by_room_task_createdAt", ["roomId", "taskId", "createdAt"]),
  roomTaskMessages: defineTable({
    roomId: v.id("rooms"),
    taskId: v.string(),
    authorUserId: v.string(),
    body: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_room_task_createdAt", ["roomId", "taskId", "createdAt"])
    .index("by_task_createdAt", ["taskId", "createdAt"]),
  roomTaskFiles: defineTable({
    roomId: v.id("rooms"),
    taskId: v.string(),
    uploadedByUserId: v.string(),
    name: v.string(),
    url: v.string(),
    storageId: v.optional(v.id("_storage")),
    mimeType: v.optional(v.string()),
    sizeBytes: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_room_task_createdAt", ["roomId", "taskId", "createdAt"])
    .index("by_task_createdAt", ["taskId", "createdAt"]),
  roomInvites: defineTable({
    roomId: v.id("rooms"),
    email: v.string(),
    role: v.union(v.literal("viewer"), v.literal("member"), v.literal("admin")),
    invitedByUserId: v.id("users"),
    tokenHash: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("revoked"),
      v.literal("expired")
    ),
    createdAt: v.number(),
    expiresAt: v.number(),
    acceptedAt: v.optional(v.number()),
  })
    .index("by_room_status", ["roomId", "status"])
    .index("by_tokenHash", ["tokenHash"])
    .index("by_room_email_status", ["roomId", "email", "status"]),
  roomFocusPresence: defineTable({
    roomId: v.id("rooms"),
    userId: v.id("users"),
    status: v.union(
      v.literal("idle"),
      v.literal("focusing"),
      v.literal("break"),
      v.literal("done")
    ),
    intention: v.string(),
    taskId: v.optional(v.string()),
    visibility: v.union(
      v.literal("private"),
      v.literal("room"),
      v.literal("room_with_reflection")
    ),
    startedAt: v.optional(v.number()),
    endsAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_room_updatedAt", ["roomId", "updatedAt"])
    .index("by_room_user", ["roomId", "userId"])
    .index("by_user", ["userId"]),
  roomFocusSessions: defineTable({
    roomId: v.id("rooms"),
    userId: v.id("users"),
    intention: v.string(),
    taskId: v.optional(v.string()),
    durationMinutes: v.number(),
    reflection: v.string(),
    visibility: v.union(
      v.literal("private"),
      v.literal("room"),
      v.literal("room_with_reflection")
    ),
    completedAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_room_completedAt", ["roomId", "completedAt"])
    .index("by_user_completedAt", ["userId", "completedAt"]),
  tasks: defineTable({
    userId: v.optional(v.id("users")),
    taskId: v.string(),
    title: v.string(),
    note: v.string(),
    dueDate: v.string(),
    dueTime: v.string(),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    status: v.union(
      v.literal("todo"),
      v.literal("working"),
      v.literal("completed")
    ),
    order: v.number(),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_order", ["order"])
    .index("by_taskId", ["taskId"])
    .index("by_user_order", ["userId", "order"])
    .index("by_user_taskId", ["userId", "taskId"]),
  focusSessions: defineTable({
    userId: v.optional(v.id("users")),
    sessionId: v.string(),
    intention: v.string(),
    reflection: v.string(),
    durationMinutes: v.number(),
    completedAt: v.string(),
    createdAt: v.number(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_sessionId", ["sessionId"])
    .index("by_user_createdAt", ["userId", "createdAt"]),
})
