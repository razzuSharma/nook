"use client"

import * as React from "react"
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useMutation, useQuery } from "convex/react"
import { Edit3, GripVertical, Plus, Trash2, UserRound } from "lucide-react"

import type { Id } from "@/convex/_generated/dataModel"
import { roomTasksApi } from "@/lib/convex-room-tasks-api"
import { roomsApi } from "@/lib/convex-rooms-api"
import { useAuth } from "@/components/providers/auth-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { avatarSrcForKey } from "@/lib/avatar-options"
import { cn } from "@/lib/utils"

type TaskStatus = "todo" | "working" | "completed"
type TaskPriority = "low" | "medium" | "high"

type RoomMember = {
  userId: string
  name: string
  email: string
  role: "viewer" | "member" | "admin"
  avatarKey: string
}

type RoomTask = {
  id: string
  title: string
  note: string
  assignee: string
  assigneeUserId?: string
  priority: TaskPriority
  status: TaskStatus
}

export type RoomTaskFocusTarget = {
  id: string
  title: string
}

type TaskBoardState = Record<TaskStatus, RoomTask[]>

const boardColumns: Array<{
  id: TaskStatus
  label: string
  subtitle: string
}> = [
  { id: "todo", label: "To Do", subtitle: "Planned next" },
  { id: "working", label: "In Progress", subtitle: "Being built now" },
  { id: "completed", label: "Completed", subtitle: "Done and verified" },
]

const statusOrder: TaskStatus[] = ["todo", "working", "completed"]

function toBoardState(tasks: RoomTask[]): TaskBoardState {
  return {
    todo: tasks.filter((task) => task.status === "todo"),
    working: tasks.filter((task) => task.status === "working"),
    completed: tasks.filter((task) => task.status === "completed"),
  }
}

function flattenBoard(board: TaskBoardState): RoomTask[] {
  return statusOrder.flatMap((status) => board[status])
}

function tasksEqual(a: RoomTask[], b: RoomTask[]) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (
      a[i].id !== b[i].id ||
      a[i].title !== b[i].title ||
      a[i].note !== b[i].note ||
      a[i].assignee !== b[i].assignee ||
      a[i].assigneeUserId !== b[i].assigneeUserId ||
      a[i].priority !== b[i].priority ||
      a[i].status !== b[i].status
    ) {
      return false
    }
  }
  return true
}

function priorityClass(priority: TaskPriority) {
  if (priority === "high") return "bg-red-500/15 text-red-700 dark:text-red-300"
  if (priority === "medium") return "bg-amber-500/15 text-amber-700 dark:text-amber-300"
  return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
}

function cardStatusClass(status: TaskStatus) {
  if (status === "completed") return "bg-emerald-500/12"
  if (status === "working") return "bg-cyan-500/10"
  return "bg-amber-500/10"
}

function TaskCard({
  task,
  onEdit,
  onStartFocus,
}: {
  task: RoomTask
  onEdit: (task: RoomTask) => void
  onStartFocus?: (task: RoomTaskFocusTarget) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: task.id,
  })

  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "cursor-grab rounded-xl border border-[color:var(--nook-sidebar-border)] bg-background/80 p-3 active:cursor-grabbing",
        cardStatusClass(task.status)
      )}
      {...attributes}
      {...listeners}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <GripVertical className="mt-0.5 size-4 text-muted-foreground" />
          <h4 className="text-sm font-medium">{task.title}</h4>
        </div>
        <div className="flex items-center gap-2">
          {onStartFocus ? (
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[10px]"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                onStartFocus({ id: task.id, title: task.title })
              }}
            >
              Focus
            </Button>
          ) : null}
          <Badge className={cn("capitalize", priorityClass(task.priority))}>
            {task.priority}
          </Badge>
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              onEdit(task)
            }}
          >
            <Edit3 className="size-4" />
            <span className="sr-only">Edit task</span>
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{task.note}</p>
      <div className="mt-3 flex items-center justify-between">
        <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <UserRound className="size-3.5" />
          {task.assignee || "Unassigned"}
        </div>
        <span className="text-xs text-muted-foreground">Drag to reorder</span>
      </div>
    </article>
  )
}

function ColumnDropZone({
  id,
  children,
}: {
  id: TaskStatus
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <section
      ref={setNodeRef}
      className={cn(
        "rounded-2xl border border-[color:var(--nook-sidebar-border)] bg-background/55 p-3 backdrop-blur transition-colors",
        isOver && "bg-[color:var(--nook-sidebar-input-bg)]"
      )}
    >
      {children}
    </section>
  )
}

export function RoomTaskBoard({
  roomId,
  onStartFocusTask,
}: {
  roomId: Id<"rooms">
  onStartFocusTask?: (task: RoomTaskFocusTarget) => void
}) {
  const { sessionToken } = useAuth()
  const docs = useQuery(roomTasksApi.listByRoom, { roomId }) as
    | Array<{
        taskId: string
        title: string
        note: string
        assignee: string
        assigneeUserId?: string
        priority: TaskPriority
        status: TaskStatus
      }>
    | undefined
  const membersQuery = useQuery(
    roomsApi.listMembersByRoom,
    sessionToken ? { sessionToken, roomId } : "skip"
  ) as RoomMember[] | undefined
  const members = React.useMemo(() => membersQuery ?? [], [membersQuery])

  const memberNameById = React.useMemo(
    () => new Map(members.map((member) => [member.userId, member.name])),
    [members]
  )

  const syncByRoom = useMutation(roomTasksApi.syncByRoom)

  const serverTasks = React.useMemo(() => {
    if (!docs) return []
    return docs.map((task) => ({
      id: task.taskId,
      title: task.title,
      note: task.note,
      assignee: task.assignee,
      assigneeUserId: task.assigneeUserId,
      priority: task.priority,
      status: task.status,
    }))
  }, [docs])

  const [board, setBoard] = React.useState<TaskBoardState>(() => toBoardState([]))
  const [draftTitle, setDraftTitle] = React.useState("")
  const [draftNote, setDraftNote] = React.useState("")
  const [draftAssigneeUserId, setDraftAssigneeUserId] = React.useState("none")
  const [draftPriority, setDraftPriority] = React.useState<TaskPriority>("medium")
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [editingTaskId, setEditingTaskId] = React.useState<string | null>(null)
  const [editTitle, setEditTitle] = React.useState("")
  const [editNote, setEditNote] = React.useState("")
  const [editAssigneeUserId, setEditAssigneeUserId] = React.useState("none")
  const [editPriority, setEditPriority] = React.useState<TaskPriority>("medium")
  const [editStatus, setEditStatus] = React.useState<TaskStatus>("todo")

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  React.useEffect(() => {
    const boardTasks = flattenBoard(board)
    if (!tasksEqual(boardTasks, serverTasks)) {
      setBoard(toBoardState(serverTasks))
    }
  }, [board, serverTasks])

  function persist(next: TaskBoardState) {
    const payload = flattenBoard(next).map((task, index) => ({
      taskId: task.id,
      title: task.title,
      note: task.note,
      assignee: task.assignee,
      assigneeUserId: task.assigneeUserId as Id<"users"> | undefined,
      priority: task.priority,
      status: task.status,
      order: index,
    }))
    void syncByRoom({
      roomId,
      tasks: payload,
    })
  }

  const findContainer = React.useCallback(
    (id: UniqueIdentifier): TaskStatus | null => {
      const value = String(id)
      if (statusOrder.includes(value as TaskStatus)) return value as TaskStatus
      for (const status of statusOrder) {
        if (board[status].some((task) => task.id === value)) return status
      }
      return null
    },
    [board]
  )

  const activeTask = React.useMemo(() => {
    if (!activeId) return null
    for (const status of statusOrder) {
      const task = board[status].find((item) => item.id === activeId)
      if (task) return task
    }
    return null
  }, [activeId, board])

  const editingTask = React.useMemo(() => {
    if (!editingTaskId) return null
    for (const status of statusOrder) {
      const task = board[status].find((item) => item.id === editingTaskId)
      if (task) return task
    }
    return null
  }, [editingTaskId, board])

  function addTask() {
    const title = draftTitle.trim()
    const note = draftNote.trim()
    if (!title || !note) return

    const assigneeUserId = draftAssigneeUserId === "none" ? undefined : draftAssigneeUserId
    const assignee = assigneeUserId ? memberNameById.get(assigneeUserId) ?? "" : ""

    const task: RoomTask = {
      id: `rt-${Date.now()}`,
      title,
      note,
      assignee,
      assigneeUserId,
      priority: draftPriority,
      status: "todo",
    }

    setBoard((prev) => {
      const next = {
        ...prev,
        todo: [task, ...prev.todo],
      }
      persist(next)
      return next
    })
    setDraftTitle("")
    setDraftNote("")
    setDraftAssigneeUserId("none")
    setDraftPriority("medium")
  }

  function openEdit(task: RoomTask) {
    setEditingTaskId(task.id)
    setEditTitle(task.title)
    setEditNote(task.note)
    setEditAssigneeUserId(task.assigneeUserId ?? "none")
    setEditPriority(task.priority)
    setEditStatus(task.status)
  }

  function saveTaskEdit() {
    if (!editingTaskId) return
    const nextStatus = editStatus
    const assigneeUserId = editAssigneeUserId === "none" ? undefined : editAssigneeUserId
    const assignee = assigneeUserId ? memberNameById.get(assigneeUserId) ?? "" : ""

    setBoard((prev) => {
      const next = { ...prev }
      let updated: RoomTask | null = null
      for (const status of statusOrder) {
        next[status] = prev[status].filter((task) => {
          if (task.id !== editingTaskId) return true
          updated = {
            ...task,
            title: editTitle.trim() || task.title,
            note: editNote.trim() || task.note,
            assignee,
            assigneeUserId,
            priority: editPriority,
            status: nextStatus,
          }
          return false
        })
      }
      if (!updated) return prev
      next[nextStatus] = [updated, ...next[nextStatus]]
      persist(next)
      return next
    })
    setEditingTaskId(null)
  }

  function deleteTask(taskId: string) {
    setBoard((prev) => {
      const next = { ...prev }
      for (const status of statusOrder) {
        next[status] = prev[status].filter((task) => task.id !== taskId)
      }
      persist(next)
      return next
    })
    setEditingTaskId(null)
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const activeContainer = findContainer(active.id)
    const overContainer = findContainer(over.id)
    if (!activeContainer || !overContainer) return

    if (activeContainer === overContainer) {
      setBoard((prev) => {
        const items = [...prev[activeContainer]]
        const oldIndex = items.findIndex((task) => task.id === String(active.id))
        const overIndex = items.findIndex((task) => task.id === String(over.id))
        if (oldIndex < 0 || overIndex < 0 || oldIndex === overIndex) return prev
        const next = {
          ...prev,
          [activeContainer]: arrayMove(items, oldIndex, overIndex),
        }
        persist(next)
        return next
      })
      return
    }

    setBoard((prev) => {
      const sourceItems = [...prev[activeContainer]]
      const targetItems = [...prev[overContainer]]
      const sourceIndex = sourceItems.findIndex((task) => task.id === String(active.id))
      if (sourceIndex < 0) return prev
      const [moved] = sourceItems.splice(sourceIndex, 1)
      const overId = String(over.id)
      const overIsColumn = overId === overContainer
      const targetIndex = overIsColumn
        ? targetItems.length
        : targetItems.findIndex((task) => task.id === overId)
      const insertAt = targetIndex < 0 ? targetItems.length : targetIndex
      targetItems.splice(insertAt, 0, { ...moved, status: overContainer })
      const next = {
        ...prev,
        [activeContainer]: sourceItems,
        [overContainer]: targetItems,
      }
      persist(next)
      return next
    })
  }

  const canAddTask = draftTitle.trim().length > 0 && draftNote.trim().length > 0
  const boardTasks = React.useMemo(() => flattenBoard(board), [board])
  const memberProgress = React.useMemo(() => {
    return members
      .map((member) => {
        const assigned = boardTasks.filter((task) => task.assigneeUserId === member.userId)
        const total = assigned.length
        const completed = assigned.filter((task) => task.status === "completed").length
        const working = assigned.filter((task) => task.status === "working").length
        const todo = assigned.filter((task) => task.status === "todo").length
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0
        return {
          member,
          total,
          completed,
          working,
          todo,
          progress,
        }
      })
      .sort((left, right) => {
        if (right.total !== left.total) return right.total - left.total
        if (right.working !== left.working) return right.working - left.working
        return left.member.name.localeCompare(right.member.name)
      })
  }, [boardTasks, members])

  return (
    <div className="space-y-5">
      <Card className="border-[color:var(--nook-sidebar-border)] bg-background/70 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Add Room Task</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            placeholder="Task title"
            className="border-[color:var(--nook-sidebar-border)] bg-[color:var(--nook-sidebar-input-bg)]"
          />
          <textarea
            value={draftNote}
            onChange={(event) => setDraftNote(event.target.value)}
            placeholder="What needs to be done?"
            className="min-h-20 w-full rounded-md border border-[color:var(--nook-sidebar-border)] bg-[color:var(--nook-sidebar-input-bg)] px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nook-accent)]"
          />
          <div className="grid gap-3 md:grid-cols-3">
            <Select value={draftAssigneeUserId} onValueChange={setDraftAssigneeUserId}>
              <SelectTrigger className="w-full border-[color:var(--nook-sidebar-border)]">
                <SelectValue placeholder="Assign to" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {members.map((member) => (
                  <SelectItem key={member.userId} value={member.userId}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={draftPriority}
              onValueChange={(value) => setDraftPriority(value as TaskPriority)}
            >
              <SelectTrigger className="w-full border-[color:var(--nook-sidebar-border)]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              onClick={addTask}
              disabled={!canAddTask}
              className="bg-[color:var(--nook-accent)] text-slate-950 hover:bg-[color:var(--nook-accent-strong)] disabled:opacity-50"
            >
              <Plus />
              Add Task
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-[color:var(--nook-sidebar-border)] bg-background/70 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Member Progress</CardTitle>
        </CardHeader>
        <CardContent>
          {memberProgress.length === 0 ? (
            <p className="text-sm text-muted-foreground">No room members found.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {memberProgress.map((item) => {
                const initials = item.member.name
                  .split(" ")
                  .map((part) => part[0] ?? "")
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()

                return (
                  <article
                    key={item.member.userId}
                    className="rounded-xl border border-[color:var(--nook-sidebar-border)] bg-[color:var(--nook-sidebar-input-bg)] p-3"
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Avatar className="size-9 border border-cyan-500/30">
                          <AvatarImage
                            src={avatarSrcForKey(item.member.avatarKey)}
                            alt={item.member.name}
                          />
                          <AvatarFallback>{initials}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium leading-tight">{item.member.name}</p>
                          <p className="text-xs text-muted-foreground">{item.member.role}</p>
                        </div>
                      </div>
                      <Badge variant="secondary">{item.total} tasks</Badge>
                    </div>

                    <div className="mb-2 h-2 overflow-hidden rounded-full bg-slate-300/40 dark:bg-slate-700/60">
                      <div
                        className={cn(
                          "h-full rounded-full bg-cyan-500 transition-all",
                          item.progress === 100 && "bg-emerald-500"
                        )}
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <span className="text-muted-foreground">Done: {item.completed}</span>
                      <span className="text-muted-foreground">Doing: {item.working}</span>
                      <span className="text-muted-foreground">Todo: {item.todo}</span>
                      <span className="text-right font-medium">{item.progress}%</span>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {boardColumns.map((column) => {
            const items = board[column.id]
            return (
              <ColumnDropZone key={column.id} id={column.id}>
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-semibold">{column.label}</h3>
                    <p className="text-xs text-muted-foreground">{column.subtitle}</p>
                  </div>
                  <Badge variant="secondary">{items.length}</Badge>
                </div>
                <SortableContext
                  items={items.map((task) => task.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {items.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-[color:var(--nook-sidebar-border)] px-3 py-6 text-center text-sm text-muted-foreground">
                        No tasks yet
                      </p>
                    ) : null}
                    {items.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onEdit={openEdit}
                        onStartFocus={onStartFocusTask}
                      />
                    ))}
                  </div>
                </SortableContext>
              </ColumnDropZone>
            )
          })}
        </div>
        <DragOverlay>
          {activeTask ? (
            <article className="w-[280px] rounded-xl border border-[color:var(--nook-sidebar-border)] bg-background/95 p-3 shadow-xl">
              <div className="mb-2 flex items-start justify-between gap-2">
                <h4 className="text-sm font-medium">{activeTask.title}</h4>
                <Badge className={cn("capitalize", priorityClass(activeTask.priority))}>
                  {activeTask.priority}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{activeTask.note}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Assigned: {activeTask.assignee || "Unassigned"}
              </p>
            </article>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Drawer
        open={Boolean(editingTask)}
        onOpenChange={(open) => {
          if (!open) setEditingTaskId(null)
        }}
      >
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Edit Room Task</DrawerTitle>
            <DrawerDescription>Update details and assignee.</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 px-4 pb-2">
            <Input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} />
            <textarea
              value={editNote}
              onChange={(event) => setEditNote(event.target.value)}
              className="min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Select value={editAssigneeUserId} onValueChange={setEditAssigneeUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Assign to" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {members.map((member) => (
                  <SelectItem key={member.userId} value={member.userId}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                value={editPriority}
                onValueChange={(value) => setEditPriority(value as TaskPriority)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={editStatus}
                onValueChange={(value) => setEditStatus(value as TaskStatus)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="working">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DrawerFooter>
            <Button
              onClick={saveTaskEdit}
              className="bg-[color:var(--nook-accent)] text-slate-950 hover:bg-[color:var(--nook-accent-strong)]"
            >
              Save Changes
            </Button>
            {editingTask ? (
              <Button variant="outline" onClick={() => deleteTask(editingTask.id)}>
                <Trash2 />
                Delete Task
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setEditingTaskId(null)}>
              Cancel
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
