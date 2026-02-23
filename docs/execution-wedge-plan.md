# NOOK Product Direction (Execution Wedge)

## Positioning
- Target user: small product teams (2-8 people) doing async delivery work.
- Core problem: work is split across task tools, chat apps, and focus tools.
- Core promise: decide what to do now, execute with focus, and unblock in one place.

## Daily Value Loop
1. Team aligns on top tasks for today.
2. Members start focused work from the exact task card.
3. Blockers are discussed on that task thread (chat/files/history).
4. Day ends with clear moved-vs-blocked visibility.

## Today Plan Module Spec

### Goal
- Surface the top 3 tasks a user should execute today with no manual sorting.

### Inputs
- Assigned room tasks for current user:
  - `status`
  - `priority`
  - `dueAt`
  - `title`
  - `roomName`

### Ranking Behavior
- Exclude completed tasks.
- Prioritize in this order:
  - `In Progress` over `To Do` over `Blocked`
  - `High` priority over `Medium` over `Low`
  - overdue / due-soon tasks over no-deadline tasks
- Return top 3 tasks.

### UI Behavior
- Section title: `Today Plan`
- Show each item with:
  - rank number
  - title
  - status badge
  - priority badge
  - room name + due label
- Empty state:
  - "No assigned tasks yet. Join a room and assign your first task."
- CTA:
  - "Open Room Tasks" (to latest joined room task board).

### Success Metric
- Increase in daily `focus sessions started from task context`.
- Decrease in tasks marked blocked without discussion activity.

## First-Run Onboarding (3 Steps)
- Trigger: first dashboard visit per user.
- Steps:
  1. Pick today top tasks.
  2. Start focus from task card.
  3. Discuss blockers in task discussion.
- Completion:
  - "Continue to Dashboard" or "Create Room".
  - Mark onboarding as completed in local storage.

## Roadmap

### Keep (Now)
- Room-based kanban with drag-and-drop.
- Task discussion panel with chat/files/history.
- Focus mode and room presence.
- Dashboard + Today Plan + right productivity sidebar.

### Build Next (Near-Term)
1. Standup Snapshot:
   - auto-summary: done yesterday, doing today, blocked.
2. Blocker SLA:
   - blocked tasks >24h become highlighted and routed to owner.
3. Mentions + notification center:
   - `@name` mention and unread state across task discussions.
4. Command palette (`Cmd/Ctrl+K`):
   - jump rooms, open task, start focus, create task.

### Later (High-Level)
- GitHub/GitLab task linking.
- Calendar sync for focus blocks.
- Workspace analytics and role-based permissions.

### Cut or De-Emphasize (for now)
- Generic "all-in-one workspace" messaging.
- Secondary widgets that do not help the daily value loop.
- Feature work not tied to "plan -> focus -> unblock -> review".
