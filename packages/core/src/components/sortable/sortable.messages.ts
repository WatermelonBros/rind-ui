// Sortable's strings: the handle's name and instructions, the move buttons, and the
// announcements, each with the item's position from the current order.

export interface SortableMessages {
  readonly [key: string]: string | ((...args: never) => string)
  /** The handle's name: "Reorder Apple". */
  readonly handleLabel: (label: string) => string
  /** The handle's description. */
  readonly instructions: string
  readonly moveUp: (label: string) => string
  readonly moveDown: (label: string) => string
  readonly pickedUp: (label: string, position: number, count: number) => string
  readonly moved: (label: string, position: number, count: number) => string
  readonly dropped: (label: string, position: number, count: number) => string
  readonly cancelled: (label: string, position: number, count: number) => string
  readonly quickMoved: (label: string, position: number, count: number) => string
}

export const sortableMessages: SortableMessages = {
  handleLabel: (label) => `Reorder ${label}`,
  instructions:
    "Space to pick up, arrow keys to move, Space to drop. Alt with an arrow moves one place.",
  moveUp: (label) => `Move ${label} up`,
  moveDown: (label) => `Move ${label} down`,
  pickedUp: (label, i, n) =>
    `Picked up ${label}, position ${i} of ${n}. Arrow keys move, Space drops, Escape cancels.`,
  moved: (_label, i, n) => `Position ${i} of ${n}`,
  dropped: (label, i, n) => `${label} dropped at position ${i} of ${n}`,
  cancelled: (label, i, n) => `${label} returned to position ${i} of ${n}`,
  quickMoved: (label, i, n) => `${label} moved to position ${i} of ${n}`,
}
