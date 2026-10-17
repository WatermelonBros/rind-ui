/** QR Code's messages (English defaults), overridable per instance and through the provider. */
export const qrCodeMessages = {
  /** The frame's accessible name when the consumer gives none. */
  label: "QR code",
  /** The download trigger's name when it renders no content of its own. */
  download: "Download QR code",
} as const satisfies Record<string, string>

export type QrCodeMessages = { readonly label: string; readonly download: string }
