// Every after-mount callback goes through here: Solid 2 replaces `onMount` with `onSettled`,
// so moving to it is a change to this file alone.
export { onMount as afterMount } from "solid-js"
