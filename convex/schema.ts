import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  rooms: defineTable({
    name: v.string(),
    description: v.string(),
    mode: v.string(),
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
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
    status: v.union(
      v.literal("todo"),
      v.literal("working"),
      v.literal("completed")
    ),
    order: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_room_order", ["roomId", "order"])
    .index("by_room_taskId", ["roomId", "taskId"]),
  tasks: defineTable({
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
    .index("by_taskId", ["taskId"]),
  focusSessions: defineTable({
    sessionId: v.string(),
    intention: v.string(),
    reflection: v.string(),
    durationMinutes: v.number(),
    completedAt: v.string(),
    createdAt: v.number(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_sessionId", ["sessionId"]),
})
