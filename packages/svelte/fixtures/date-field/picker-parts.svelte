<script lang="ts">
import { Calendar, DateField } from "../../src/index"
</script>

<!-- The picker parts around the Input: a Control, a trigger and the Calendar in a popover. -->
<DateField.Control
  ><DateField.Input /><DateField.Trigger><span aria-hidden="true">▾</span></DateField.Trigger
  ></DateField.Control
><DateField.Portal
  ><DateField.Positioner
    ><DateField.Content
      ><DateField.Calendar
        ><Calendar.Header><Calendar.PrevTrigger /><Calendar.Heading /><Calendar.NextTrigger /></Calendar.Header
        ><Calendar.Grid /></DateField.Calendar
      ></DateField.Content
    ></DateField.Positioner
  ></DateField.Portal
>
