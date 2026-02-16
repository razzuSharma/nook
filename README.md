# **Nook**

> **A calm, modern focus workspace for teams who build together.**

**Nook** is a Next.js app designed around focused collaboration. It combines shared rooms, activity tracking, saved task management, and a guided focus mode into one clean dashboard experience.

---

## **Preview**

> Add your app screenshot here:

![Nook App Preview](./public/readme-preview.png)

Create or replace this file with your screenshot:
`public/readme-preview.png`

---

## **What This App Is About**

Nook helps individuals and teams stay in flow by giving them a single place to:

- **Enter a focused workspace** from a welcoming landing screen
- **Manage collaboration rooms** and view active team spaces
- **Track recent activity** across work sessions
- **Organize saved tasks** in a board workflow
- **Run guided focus sessions** (intention -> timer -> reflection)

---

## **Core Screens**

- `/` - Welcome / entry screen
- `/dashboard` - Main collaboration dashboard (rooms + metrics + activity)
- `/dashboard/recent-activity` - Team activity timeline
- `/dashboard/saved-tasks` - Saved tasks board
- `/dashboard/focus` - Focus mode session flow

---

## **Tech Stack**

- **Next.js 16** (App Router)
- **React 19**
- **TypeScript**
- **Tailwind CSS 4**
- **shadcn/ui + Radix UI**
- **dnd-kit** (task interactions)

---

## **Getting Started**

### **1. Install dependencies**

```bash
npm install
```

### **2. Run development server**

```bash
npm run dev
```

Open: `http://localhost:3000`

### **3. Production build**

```bash
npm run build
npm run start
```

### **4. Lint**

```bash
npm run lint
```

---

## **Project Structure**

```text
app/
  page.tsx                     # Welcome screen
  dashboard/
    page.tsx                   # Main dashboard
    recent-activity/page.tsx   # Activity timeline
    saved-tasks/page.tsx       # Task board
    focus/page.tsx             # Focus mode
components/
  ...                          # Reusable UI + feature components
public/
  ...                          # Static assets and README preview image
```

---

## **Notes**

This project currently uses demo/mock content for rooms, activity, and tasks to showcase UX and flow.
