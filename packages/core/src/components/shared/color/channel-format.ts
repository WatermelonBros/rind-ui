// Channel values as people read them: hue in degrees, saturation, lightness, brightness and
// alpha in percent, red, green and blue as integers; locale-formatted, for value text.

import { format } from "../../../i18n/messages"
import type { ColorChannel } from "./color"

/** The Intl options a channel is shown with (its value as given to `formatChannel`). */
export function channelFormatOptions(channel: ColorChannel): Intl.NumberFormatOptions {
  if (channel === "hue") {
    return { style: "unit", unit: "degree", unitDisplay: "narrow", maximumFractionDigits: 1 }
  }
  if (channel === "red" || channel === "green" || channel === "blue") {
    return { maximumFractionDigits: 0 }
  }
  return { style: "percent", maximumFractionDigits: 1 }
}

/** A channel value formatted for `locale` ("220°", "92%", "128"). */
export function formatChannel(channel: ColorChannel, value: number, locale = "en-US"): string {
  // Percent styles multiply by 100: 0–100 channels are divided first; alpha is already 0–1.
  const shown =
    channel === "saturation" || channel === "lightness" || channel === "brightness"
      ? value / 100
      : value
  return format.number(locale, channelFormatOptions(channel)).format(shown)
}
