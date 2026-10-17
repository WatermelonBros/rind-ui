/** Drawer's messages (English defaults): the Dialog's plus the handle's names. */
export const drawerMessages = {
  /** The name of a close trigger that renders no content of its own. */
  close: "Close",
  /** The handle's name when its press moves to a larger snap point. */
  expand: "Expand drawer",
  /** The handle's name when its press wraps to a smaller snap point. */
  collapse: "Collapse drawer",
} as const satisfies Record<string, string>

export type DrawerMessages = {
  readonly close: string
  readonly expand: string
  readonly collapse: string
}
