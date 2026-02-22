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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { cn } from "@/lib/utils"

type TaskStatus = "todo" | "working" | "completed"
type TaskPriority = "low" | "medium" | "high"

type RoomTask = {
  id: string
  title: string
  note: string
  assignee: string
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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: task.id })

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
  const docs = useQuery(roomTasksApi.listByRoom, { roomId }) as
    | Array<{
        taskId: string
        title: string
        note: string
        assignee: string
        priority: TaskPriority
        status: TaskStatus
      }>
    | undefined
  const syncByRoom = useMutation(roomTasksApi.syncByRoom)

  const serverTasks = React.useMemo(() => {
    if (!docs) return []
    return docs.map((task) => ({
      id: task.taskId,
      title: task.title,
      note: task.note,
      assignee: task.assignee,
      priority: task.priority,
      status: task.status,
    }))
  }, [docs])

  const [board, setBoard] = React.useState<TaskBoardState>(() => toBoardState([]))
  const [draftTitle, setDraftTitle] = React.useState("")
  const [draftNote, setDraftNote] = React.useState("")
  const [draftAssignee, setDraftAssignee] = React.useState("")
  const [draftPriority, setDraftPriority] = React.useState<TaskPriority>("medium")
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [editingTaskId, setEditingTaskId] = React.useState<string | null>(null)
  const [editTitle, setEditTitle] = React.useState("")
  const [editNote, setEditNote] = React.useState("")
  const [editAssignee, setEditAssignee] = React.useState("")
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

    const task: RoomTask = {
      id: `rt-${Date.now()}`,
      title,
      note,
      assignee: draftAssignee.trim(),
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
    setDraftAssignee("")
    setDraftPriority("medium")
  }

  function openEdit(task: RoomTask) {
    setEditingTaskId(task.id)
    setEditTitle(task.title)
    setEditNote(task.note)
    setEditAssignee(task.assignee)
    setEditPriority(task.priority)
    setEditStatus(task.status)
  }

  function saveTaskEdit() {
    if (!editingTaskId) return
    const nextStatus = editStatus

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
            assignee: editAssignee.trim(),
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
            <Input
              value={draftAssignee}
              onChange={(event) => setDraftAssignee(event.target.value)}
              placeholder="Assign to (name)"
              className="border-[color:var(--nook-sidebar-border)] bg-[color:var(--nook-sidebar-input-bg)]"
            />
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
            <Input
              value={editAssignee}
              onChange={(event) => setEditAssignee(event.target.value)}
              placeholder="Assign to (name)"
            />
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
