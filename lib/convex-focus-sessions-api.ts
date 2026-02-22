import { api } from "@/convex/_generated/api"
import type { FunctionReference } from "convex/server"

type FocusSessionsApiShape = {
  list: FunctionReference<
    "query",
    "public",
    { sessionToken: string },
    unknown
  >
  ensureDefaults: FunctionReference<
    "mutation",
    "public",
    { sessionToken: string },
    unknown
  >
  create: FunctionReference<
    "mutation",
    "public",
    {
      sessionToken: string
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
