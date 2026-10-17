// The Combobox model over the "disabled neighbour" props class (helper: combobox-model.tsx).
import { CITIES, config } from "./combobox-model"

config("disabled neighbour", {
  items: CITIES.map((c) => (c.key === "paris" ? { ...c, disabled: true } : c)),
})
