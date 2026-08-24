/**
 * Note status. v0.1 only persists `inbox`; the union documents the
 * future-proof shape so later releases can extend it without churn.
 */
export type NoteStatus = "inbox";
