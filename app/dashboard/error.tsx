"use client"

import { Button } from "@/components/ui/button"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-[60vh] flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-rose-500/25 bg-rose-500/5 p-6">
        <h2 className="text-xl font-semibold">Dashboard failed to load</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {error.message || "An unexpected error occurred while loading your overview."}
        </p>
        <Button onClick={reset} className="mt-4">
          Try Again
        </Button>
      </div>
    </div>
  )
}
