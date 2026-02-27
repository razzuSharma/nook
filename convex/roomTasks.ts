import { mutation, query } from "./_generated/server"
import type { MutationCtx } from "./_generated/server"
import type { Id } from "./_generated/dataModel"
import { v } from "convex/values"

async function requireTaskEditorRole(
  ctx: MutationCtx,
  roomId: Id<"rooms">,
  userId?: string
) {
  if (!userId) {
    throw new Error("Task editing requires a signed-in room member.")
  }
  const membership = await ctx.db
    .query("roomMembers")
    .withIndex("by_room_user", (query) => query.eq("roomId", roomId).eq("userId", userId))
    .first()

  if (!membership || membership.status !== "active") {
    throw new Error("Join the room before editing tasks.")
  }
  if (membership.role === "viewer") {
    throw new Error("Viewers can view tasks, but cannot edit them.")
  }
}

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

export const listRecentActivityByUser = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("roomMembers")
      .withIndex("by_user", (query) => query.eq("userId", args.userId))
      .collect()
    const activeRoomIds = memberships
      .filter((membership) => membership.status === "active")
      .map((membership) => membership.roomId)
    if (activeRoomIds.length === 0) return []

    const limit = Math.min(Math.max(args.limit ?? 20, 1), 50)
    const eventDocs = await Promise.all(
      activeRoomIds.map((roomId) =>
        ctx.db
          .query("roomTaskEvents")
          .withIndex("by_room_task_createdAt", (query) =>
            query.eq("roomId", roomId)
          )
          .order("desc")
          .take(limit)
      )
    )
    const merged = eventDocs
      .flat()
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, limit)

    const taskTitleByKey = new Map<string, string>()
    const actorById = new Map<string, { name: string }>()
    await Promise.all(
      merged.map(async (event) => {
        const taskKey = `${event.roomId}:${event.taskId}`
        if (!taskTitleByKey.has(taskKey)) {
          const taskDoc = await ctx.db
            .query("roomTasks")
            .withIndex("by_room_taskId", (query) =>
              query.eq("roomId", event.roomId).eq("taskId", event.taskId)
            )
            .first()
          taskTitleByKey.set(taskKey, taskDoc?.title ?? event.taskId)
        }
        if (!actorById.has(event.actorUserId)) {
          const normalized = ctx.db.normalizeId("users", event.actorUserId)
          const actor = normalized ? await ctx.db.get(normalized) : null
          actorById.set(event.actorUserId, {
            name: actor?.name ?? "Teammate",
          })
        }
      })
    )

    return merged.map((event) => ({
      id: event._id,
      roomId: event.roomId,
      taskId: event.taskId,
      taskTitle: taskTitleByKey.get(`${event.roomId}:${event.taskId}`) ?? event.taskId,
      type: event.type,
      message: event.message,
      createdAt: event.createdAt,
      actorUserId: event.actorUserId,
      actorName: actorById.get(event.actorUserId)?.name ?? "Teammate",
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
    await requireTaskEditorRole(ctx, args.roomId, args.actorUserId)

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
    if (membership.role === "viewer") {
      throw new Error("Viewers can view tasks, but cannot create them.")
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

export const completeFromFocus = mutation({
  args: {
    roomId: v.id("rooms"),
    taskId: v.string(),
    actorUserId: v.string(),
    outcome: v.union(
      v.literal("done"),
      v.literal("progress"),
      v.literal("blocked")
    ),
    blockerNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireTaskEditorRole(ctx, args.roomId, args.actorUserId)

    const existingTask = await ctx.db
      .query("roomTasks")
      .withIndex("by_room_taskId", (query) =>
        query.eq("roomId", args.roomId).eq("taskId", args.taskId)
      )
      .first()

    if (!existingTask) {
      throw new Error("Task not found in this room.")
    }

    const now = Date.now()
    let nextStatus = existingTask.status
    if (args.outcome === "done") nextStatus = "completed"
    if (args.outcome === "blocked") nextStatus = "blocked"
    if (args.outcome === "progress" && existingTask.status === "todo") {
      nextStatus = "working"
    }

    await ctx.db.patch(existingTask._id, {
      status: nextStatus,
      updatedAt: now,
      completedAt: nextStatus === "completed" ? now : undefined,
    })

    const outcomeLabel =
      args.outcome === "done"
        ? "Done"
        : args.outcome === "progress"
          ? "Progress made"
          : "Blocked"
    await ctx.db.insert("roomTaskEvents", {
      roomId: args.roomId,
      taskId: existingTask.taskId,
      actorUserId: args.actorUserId,
      type: "focus_outcome",
      message: `Focus outcome: ${outcomeLabel}.`,
      createdAt: now,
    })

    let followUpTaskId: string | undefined = undefined
    if (args.outcome === "blocked") {
      const latestTask = await ctx.db
        .query("roomTasks")
        .withIndex("by_room_order", (query) => query.eq("roomId", args.roomId))
        .order("desc")
        .first()
      const order = latestTask ? latestTask.order + 1 : 0
      followUpTaskId = `followup-${now}-${Math.random().toString(36).slice(2, 8)}`
      const blockerNote = (args.blockerNote ?? "").trim()
      const followUpTitle = `Unblock: ${existingTask.title}`
      const followUpNote = blockerNote
        ? `Raised from focus session.\nBlocker: ${blockerNote}`
        : "Raised from focus session."

      await ctx.db.insert("roomTasks", {
        roomId: args.roomId,
        taskId: followUpTaskId,
        title: followUpTitle,
        note: followUpNote,
        assignee: existingTask.assignee,
        assigneeUserId: existingTask.assigneeUserId,
        priority: "high",
        effort: "quick",
        status: "todo",
        order,
        createdAt: now,
        updatedAt: now,
      })

      await ctx.db.insert("roomTaskEvents", {
        roomId: args.roomId,
        taskId: followUpTaskId,
        actorUserId: args.actorUserId,
        type: "created",
        message: `Created follow-up task from blocker in "${existingTask.title}".`,
        createdAt: now,
      })
    }

    return {
      updatedTaskId: existingTask.taskId,
      status: nextStatus,
      followUpTaskId,
    }
  },
})
