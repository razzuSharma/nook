import test from "node:test"
import assert from "node:assert/strict"
import { getActivityFeedState } from "./activity-feed-state.mjs"

test("returns loading before any other state", () => {
  const state = getActivityFeedState({
    items: [],
    isLoading: true,
    errorMessage: "failed",
  })
  assert.equal(state, "loading")
})

test("returns error when not loading and error exists", () => {
  const state = getActivityFeedState({
    items: [],
    errorMessage: "failed",
  })
  assert.equal(state, "error")
})

test("returns empty when list has no items", () => {
  const state = getActivityFeedState({
    items: [],
  })
  assert.equal(state, "empty")
})

test("returns ready when items are present", () => {
  const state = getActivityFeedState({
    items: [{ id: 1 }],
  })
  assert.equal(state, "ready")
})
