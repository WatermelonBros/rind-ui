// Signature Pad's strings: every text that reaches assistive technology (spec "Signature Pad
// Messages").

export interface SignaturePadMessages {
  readonly [key: string]: string | ((...args: never) => string)
  /** The Status while empty. */
  readonly empty: string
  /** The Status once signed. */
  readonly signed: string
  /** The ClearTrigger's name (the Label follows). */
  readonly clear: string
  /** The UndoTrigger's name (the Label follows). */
  readonly undo: string
  /** Announced after a clear. */
  readonly cleared: string
  /** Announced after an undo. */
  readonly undone: string
}

export const signaturePadMessages: SignaturePadMessages = {
  empty: "Not signed",
  signed: "Signed",
  clear: "Clear",
  undo: "Undo",
  cleared: "Signature cleared",
  undone: "Last stroke removed",
}
