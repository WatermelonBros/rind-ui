import { type KbdKeys, keyShortcuts } from "@rind-ui/core"
import { useEnvironment } from "../provider"

/**
 * The platform: the prop, else the environment's after mount; server and hydration render
 * "other", so the first client render matches the server's HTML. Read `.current`.
 */
export function usePlatform(own: () => "apple" | "other" | undefined) {
  const env = useEnvironment()
  let detected = $state<"apple" | "other">("other")
  $effect(() => {
    detected = env.platform.apple ? "apple" : "other"
  })
  return {
    get current() {
      return own() ?? detected
    },
  }
}

/**
 * The `aria-keyshortcuts` value for the control a shortcut activates, from the same keys a
 * Kbd shows, on the environment's platform (`undefined` for a sequence). Call it during
 * component initialisation; read `.current`.
 */
export function useKeyShortcuts(
  keys: () => KbdKeys,
  platform: () => "apple" | "other" | undefined = () => undefined,
) {
  const resolved = usePlatform(platform)
  return {
    get current() {
      return keyShortcuts(keys(), resolved.current === "apple")
    },
  }
}
