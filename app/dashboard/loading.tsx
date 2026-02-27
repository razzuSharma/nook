export default function DashboardLoading() {
  return (
    <div className="flex min-h-[60vh] flex-1 flex-col px-4 py-5 md:px-6 md:py-6 lg:pr-20">
      <div className="mx-auto w-full max-w-6xl animate-pulse space-y-4">
        <div className="h-10 w-72 rounded-lg bg-cyan-500/15" />
        <div className="h-4 w-96 rounded bg-cyan-500/10" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 rounded-xl bg-cyan-500/10" />
          ))}
        </div>
        <div className="h-24 rounded-2xl bg-cyan-500/10" />
        <div className="h-48 rounded-2xl bg-cyan-500/10" />
      </div>
    </div>
  )
}
