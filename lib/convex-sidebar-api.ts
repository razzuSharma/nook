import { api } from "@/convex/_generated/api"
import type { FunctionReference } from "convex/server"

type SidebarApiShape = {
  get: FunctionReference<
    "query",
    "public",
    { sessionToken: string; notificationLimit?: number },
    unknown
  >
}

export const sidebarApi = (api as unknown as { sidebar: SidebarApiShape }).sidebar
