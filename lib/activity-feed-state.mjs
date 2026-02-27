export function getActivityFeedState({ items, isLoading = false, errorMessage = null }) {
  if (isLoading) return "loading"
  if (errorMessage) return "error"
  if (!Array.isArray(items) || items.length === 0) return "empty"
  return "ready"
}
