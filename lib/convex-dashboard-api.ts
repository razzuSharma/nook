import { api } from "@/convex/_generated/api"
import type { FunctionReference } from "convex/server"

type DashboardApiShape = {
  get: FunctionReference<
    "query",
    "public",
    { sessionToken: string },
    unknown
  >
}

export const dashboardApi = (api as unknown as { dashboard: DashboardApiShape }).dashboard
