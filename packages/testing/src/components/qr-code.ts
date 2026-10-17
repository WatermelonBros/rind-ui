import { qrCodeContractWith } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"
import { decodeQr } from "../qr/decode"

/**
 * The QR Code contract with the testing decoder: `decoded()` reads the rendered symbol back
 * and the decode invariant checks it against the value text.
 */
export const qrCodeDecodingContract = qrCodeContractWith((modules) => decodeQr(modules).text)

/**
 * A driver for the QR code whose frame is named `name` (default "QR code"), inside `within`
 * (a container element or a Playwright locator; default the target).
 */
export function getQrCode(
  target: Target,
  anchor: { readonly name?: string | RegExp; readonly within?: Target } = {},
  options?: DriverOptions,
) {
  const { within, name } = anchor
  return createDriverWith(
    qrCodeDecodingContract,
    within ?? target,
    [name === undefined ? {} : { name }],
    options,
  )
}
