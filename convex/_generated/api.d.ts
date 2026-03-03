/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as email from "../email.js";
import type * as focusSessions from "../focusSessions.js";
import type * as notifications from "../notifications.js";
import type * as roomFocus from "../roomFocus.js";
import type * as roomInvites from "../roomInvites.js";
import type * as roomTaskChat from "../roomTaskChat.js";
import type * as roomTasks from "../roomTasks.js";
import type * as rooms from "../rooms.js";
import type * as sidebar from "../sidebar.js";
import type * as tasks from "../tasks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  crons: typeof crons;
  dashboard: typeof dashboard;
  email: typeof email;
  focusSessions: typeof focusSessions;
  notifications: typeof notifications;
  roomFocus: typeof roomFocus;
  roomInvites: typeof roomInvites;
  roomTaskChat: typeof roomTaskChat;
  roomTasks: typeof roomTasks;
  rooms: typeof rooms;
  sidebar: typeof sidebar;
  tasks: typeof tasks;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
