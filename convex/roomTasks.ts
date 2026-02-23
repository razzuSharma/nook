import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

export const listByRoom = query({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("roomTasks")
      .withIndex("by_room_order", (query) => query.eq("roomId", args.roomId))
      .collect()
  },
})

export const listAssignedByUser = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const tasks = await ctx.db.query("roomTasks").collect()
    const assigned = tasks.filter(
      (task) => String(task.assigneeUserId ?? "") === args.userId
    )
    const roomIds = Array.from(new Set(assigned.map((task) => task.roomId)))
    const roomNames = new Map<string, string>()
    for (const roomId of roomIds) {
      const room = await ctx.db.get(roomId)
      if (room) roomNames.set(String(room._id), room.name)
    }

    return assigned
      .sort((left, right) => (left.dueAt ?? Number.MAX_SAFE_INTEGER) - (right.dueAt ?? Number.MAX_SAFE_INTEGER))
      .map((task) => ({
        taskId: task.taskId,
        title: task.title,
        priority: task.priority,
        effort: task.effort,
        status: task.status,
        dueAt: task.dueAt,
        roomId: task.roomId,
        roomName: roomNames.get(String(task.roomId)) ?? "Room",
      }))
  },
})

export const syncByRoom = mutation({
  args: {
    roomId: v.id("rooms"),
    actorUserId: v.optional(v.string()),
    tasks: v.array(
      v.object({
        taskId: v.string(),
        title: v.string(),
        note: v.string(),
        assignee: v.string(),
        assigneeUserId: v.optional(v.id("users")),
        priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
        effort: v.optional(
          v.union(
            v.literal("quick"),
            v.literal("half_day"),
            v.literal("full_day"),
            v.literal("multi_day")
          )
        ),
        status: v.union(
          v.literal("todo"),
          v.literal("working"),
          v.literal("blocked"),
          v.literal("completed")
        ),
        dueAt: v.optional(v.number()),
        order: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("roomTasks")
      .withIndex("by_room_order", (query) => query.eq("roomId", args.roomId))
      .collect()

    const existingByTaskId = new Map(existing.map((task) => [task.taskId, task]))
    const incomingTaskIds = new Set(args.tasks.map((task) => task.taskId))
    const actorUserId = args.actorUserId ?? "system"
    const now = Date.now()

    const logEvent = async (taskId: string, type: string, message: string) => {
      await ctx.db.insert("roomTaskEvents", {
        roomId: args.roomId,
        taskId,
        actorUserId,
        type,
        message,
        createdAt: Date.now(),
      })
    }

    for (const task of existing) {
      if (!incomingTaskIds.has(task.taskId)) {
        await ctx.db.delete(task._id)
        await logEvent(task.taskId, "deleted", `Removed task "${task.title}".`)
      }
    }

    for (const task of args.tasks) {
      const existingTask = existingByTaskId.get(task.taskId)
      if (existingTask) {
        const becomesCompleted =
          existingTask.status !== "completed" && task.status === "completed"
        const becomesActive =
          existingTask.status === "completed" && task.status !== "completed"

        await ctx.db.patch(existingTask._id, {
          title: task.title,
          note: task.note,
          assignee: task.assignee,
          assigneeUserId: task.assigneeUserId,
          priority: task.priority,
          effort: task.effort,
          status: task.status,
          order: task.order,
          dueAt: task.dueAt,
          completedAt: becomesCompleted
            ? now
            : becomesActive
              ? undefined
              : existingTask.completedAt,
          updatedAt: now,
        })

        if (existingTask.title !== task.title) {
          await logEvent(task.taskId, "title_updated", `Renamed task to "${task.title}".`)
        }
        if (existingTask.status !== task.status) {
          await logEvent(task.taskId, "status_updated", `Moved task to ${task.status}.`)
        }
        if (
          (existingTask.assigneeUserId ?? undefined) !==
          (task.assigneeUserId ?? undefined)
        ) {
          await logEvent(
            task.taskId,
            "assignee_updated",
            task.assignee
              ? `Assigned task to ${task.assignee}.`
              : "Cleared assignee."
          )
        }
        if ((existingTask.dueAt ?? undefined) !== (task.dueAt ?? undefined)) {
          await logEvent(
            task.taskId,
            "due_updated",
            task.dueAt
              ? `Set due date to ${new Date(task.dueAt).toLocaleString()}.`
              : "Cleared due date."
          )
        }
        if ((existingTask.effort ?? undefined) !== (task.effort ?? undefined)) {
          await logEvent(
            task.taskId,
            "effort_updated",
            task.effort ? `Set effort to ${task.effort}.` : "Cleared effort."
          )
        }
      } else {
        await ctx.db.insert("roomTasks", {
          roomId: args.roomId,
          taskId: task.taskId,
          title: task.title,
          note: task.note,
          assignee: task.assignee,
          assigneeUserId: task.assigneeUserId,
          priority: task.priority,
          effort: task.effort,
          status: task.status,
          order: task.order,
          dueAt: task.dueAt,
          createdAt: now,
          updatedAt: now,
          completedAt: task.status === "completed" ? now : undefined,
        })
        await logEvent(task.taskId, "created", `Created task "${task.title}".`)
      }
    }
  },
})

export const createQuickTask = mutation({
  args: {
    roomId: v.id("rooms"),
    userId: v.string(),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const trimmedTitle = args.title.trim()
    if (!trimmedTitle) {
      throw new Error("Task title is required.")
    }

    const membership = await ctx.db
      .query("roomMembers")
      .withIndex("by_room_user", (query) =>
        query.eq("roomId", args.roomId).eq("userId", args.userId)
      )
      .first()

    if (!membership || membership.status !== "active") {
      throw new Error("Join the room before creating tasks.")
    }

    const latestTask = await ctx.db
      .query("roomTasks")
      .withIndex("by_room_order", (query) => query.eq("roomId", args.roomId))
      .order("desc")
      .first()
    const order = latestTask ? latestTask.order + 1 : 0
    const now = Date.now()
    const taskId = `quick-${now}-${Math.random().toString(36).slice(2, 8)}`

    await ctx.db.insert("roomTasks", {
      roomId: args.roomId,
      taskId,
      title: trimmedTitle,
      note: "",
      assignee: "",
      priority: "medium",
      effort: "quick",
      status: "todo",
      order,
      createdAt: now,
      updatedAt: now,
    })

    await ctx.db.insert("roomTaskEvents", {
      roomId: args.roomId,
      taskId,
      actorUserId: args.userId,
      type: "created",
      message: `Created task "${trimmedTitle}".`,
      createdAt: now,
    })

    return { taskId }
  },
})
