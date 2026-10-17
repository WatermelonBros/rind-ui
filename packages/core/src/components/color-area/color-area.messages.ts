// The Color Area's strings (spec "ARIA Semantics And Names", "Value Text"), on top of the
// shared colour strings.

import { type ColorMessages, colorMessages } from "../shared/color/messages"

export interface ColorAreaValueTextArgs {
  /** The channels to read, in order, with their locale-formatted values. */
  readonly channels: readonly { readonly name: string; readonly value: string }[]
  readonly colorName: string
}

export interface ColorAreaMessages extends ColorMessages {
  /** The group's name when the consumer gives none. */
  readonly areaLabel: string
  /** An input's name: the group's name (null when it is the default) and the channel's. */
  readonly inputLabel: (args: { readonly group: string | null; readonly channel: string }) => string
  readonly roleDescription: string
  readonly valueText: (args: ColorAreaValueTextArgs) => string
}

export const colorAreaMessages: ColorAreaMessages = {
  ...colorMessages,
  areaLabel: "Color area",
  inputLabel: ({ group, channel }) => (group ? `${group} ${channel}` : channel),
  roleDescription: "2D slider",
  valueText: ({ channels, colorName }) =>
    [...channels.map((c) => `${c.name} ${c.value}`), colorName].join(", "),
}
