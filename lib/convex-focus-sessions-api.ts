import { api } from "@/convex/_generated/api"
import type { FunctionReference } from "convex/server"

type FocusSessionsApiShape = {
  list: FunctionReference<"query", "public", Record<string, never>, unknown>
  ensureDefaults: FunctionReference<
    "mutation",
    "public",
    Record<string, never>,
    unknown
  >
  create: FunctionReference<
    "mutation",
    "public",
    {
      sessionId: string
      intention: string
      reflection: string
      durationMinutes: number
      completedAt: string
    },
    unknown
  >
}

export const focusSessionsApi = (
  api as unknown as { focusSessions: FocusSessionsApiShape }
).focusSessions
