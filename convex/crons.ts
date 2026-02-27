import { cronJobs } from "convex/server"
import { api } from "./_generated/api"

const crons = cronJobs()

crons.daily(
  "cleanup completed room tasks older than one week",
  { hourUTC: 2, minuteUTC: 0 },
  api.roomTasks.cleanupCompletedOlderThanWeek
)

export default crons
