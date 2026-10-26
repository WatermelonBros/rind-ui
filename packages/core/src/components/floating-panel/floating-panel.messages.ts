// Floating Panel's strings (spec "Floating Panel Messages").

export interface FloatingPanelMessages {
  readonly [key: string]: string | ((...args: never) => string)
  readonly move: string
  /** The DragTrigger's description. */
  readonly moveHint: string
  readonly minimize: string
  readonly maximize: string
  readonly restore: string
  readonly close: string
}

export const floatingPanelMessages: FloatingPanelMessages = {
  move: "Move panel",
  moveHint: "Arrow keys move, Alt plus arrow keys resize, Enter maximises",
  minimize: "Minimise",
  maximize: "Maximise",
  restore: "Restore",
  close: "Close",
}
