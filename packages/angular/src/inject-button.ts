import { afterNextRender, DestroyRef, inject, PLATFORM_ID, signal } from "@angular/core"
import type { Modality } from "@rind-ui/core"
import { injectModality, injectPress } from "./inject-press"
import { injectEnvironment } from "./provider"

/** Focus and modality of a button part, plus its press. Call it in a constructor. */
export function injectButton(
  onPress: (modality: Modality) => void,
  disabled: () => boolean = () => false,
) {
  const env = injectEnvironment()
  // The modality tracker must see the pointerdown that comes before focus.
  if (inject(PLATFORM_ID) === "browser") {
    const destroy = inject(DestroyRef)
    afterNextRender(() => destroy.onDestroy(env.modality.subscribe(() => {})))
  }
  const focused = signal(false)
  const modality = injectModality(env.modality, focused)
  const press = injectPress({
    env,
    send: (e) => {
      if (e.type === "PRESS") onPress(e.modality)
    },
    disabled,
  })
  const handlers = {
    onFocus: () => focused.set(true),
    onBlur: () => focused.set(false),
  }
  return { env, focused, modality, press, handlers }
}
