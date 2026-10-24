import type {
  SwipeDirection,
  Toaster as ToasterStore,
  ToastSnapshot,
  toasterConnect,
} from "@rind-ui/core"
import { createContext } from "../context"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import { usePress } from "../use-press.svelte"

export interface RegionHost {
  readonly store: ToasterStore
  readonly api: () => ReturnType<typeof toasterConnect>
  readonly swipeDirections: () => readonly SwipeDirection[]
  readonly setSwiping: (active: boolean) => void
  readonly leaving: (el: HTMLElement) => void
}
export const regionHost = createContext<RegionHost>("toaster")

export interface ToastHost {
  readonly region: RegionHost
  readonly toast: () => ToastSnapshot
  readonly rendered: () => { readonly title: boolean; readonly description: boolean }
  readonly mount: (part: "title" | "description", on: boolean) => void
}
export const toastHost = createContext<ToastHost>("toast")

/** A toast button's focus, modality and press. Call during initialisation. */
export function useButton(send: () => void) {
  const env = useEnvironment()
  $effect(() => env.modality.subscribe(() => {}))
  let focused = $state(false)
  const modality = useModality(env.modality, () => focused)
  const press = usePress({
    env,
    send: (e) => {
      if (e.type === "PRESS") send()
    },
  })
  return {
    get state() {
      return { focused, modality: modality.current, pressed: press.pressed }
    },
    press,
    handlers: {
      onfocus: () => {
        focused = true
      },
      onblur: () => {
        focused = false
      },
    },
  }
}
