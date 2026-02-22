# **Nook**

> **A calm, modern focus workspace for teams who build together.**

**Nook** is a Next.js app designed around focused collaboration. It combines shared rooms, activity tracking, saved task management, and a guided focus mode into one clean dashboard experience.

---

## **Preview**

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
- `/sign-in` - Email/password sign-in
- `/sign-up` - Email/password sign-up
- `/verify-email` - Email verification callback
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

### **Auth + Email verification env (optional email sending)**

Add these for real email delivery via Resend:

```bash
RESEND_API_KEY=...
RESEND_FROM_EMAIL=Nook <no-reply@yourdomain.com>
```

Without these vars, verification links are still generated and shown in UI/dev logs.

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

Auth now persists users/sessions in Convex. Some activity and analytics views still use demo/mock content.
