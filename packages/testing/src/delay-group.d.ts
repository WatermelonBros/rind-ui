import type { DelayGroup, DelayGroupMember, HoverIntent, HoverIntentTrackOptions } from "@rind-ui/core";
export interface FakeDelayGroup extends DelayGroup {
    /** The member ids, and which one is open. */
    readonly members: ReadonlyMap<string, DelayGroupMember>;
    readonly open: string | null;
    /** Makes the group warm (or cold) as if a member had just closed. */
    setWarm(warm: boolean): void;
}
/** A delay group without timers: warm while a member is open or after `setWarm(true)`. */
export declare function fakeDelayGroup(): FakeDelayGroup;
export interface FakeHoverIntent extends HoverIntent {
    /** The live `track()` calls (stopped ones removed). */
    readonly tracked: readonly HoverIntentTrackOptions[];
    /** The pointer left (or re-entered) every tracked hover zone. */
    leave(): void;
    enter(): void;
    inTransit: boolean;
}
export declare function fakeHoverIntent(): FakeHoverIntent;
