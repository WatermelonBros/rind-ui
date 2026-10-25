/** @jsxImportSource solid-js */
import { HoverCard } from "@rind-ui/solid"

export function Basic() {
  return (
    <div>
      Notes by{" "}
      <HoverCard.Root>
        <HoverCard.Trigger href="https://en.wikipedia.org/wiki/Ada_Lovelace">
          Ada Lovelace
        </HoverCard.Trigger>
        <HoverCard.Portal>
          <HoverCard.Positioner>
            <HoverCard.Content>
              <div class="profile-card">
                <span class="profile-avatar" aria-hidden="true">
                  AL
                </span>
                <div>
                  <strong>Ada Lovelace</strong>
                  <p>Wrote the first published algorithm. 1,815 followers.</p>
                </div>
              </div>
              <HoverCard.Arrow />
            </HoverCard.Content>
          </HoverCard.Positioner>
        </HoverCard.Portal>
      </HoverCard.Root>{" "}
      on the analytical engine.
    </div>
  )
}
