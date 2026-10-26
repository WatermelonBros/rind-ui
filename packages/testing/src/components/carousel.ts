import { carouselContract } from "@rind-ui/core"
import { createDriverWith, type DriverOptions, type Target } from "../driver"

/** A driver for the Carousel region named `name`, or the only one in `target`. */
export function getCarousel(
  target: Target,
  anchor?: { readonly name: string | RegExp },
  options?: DriverOptions,
) {
  return createDriverWith(carouselContract, target, anchor ? [anchor] : [], options)
}
