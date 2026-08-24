/**
 * Note status. v0.1 only persists `inbox`; the union documents the
 * future-proof shape so later releases can extend it without churn.
 *
 * `'permanent'` is reserved for the v0.2 inbox-review workflow that
 * promotes a fleeting inbox note into a self-contained permanent note.
 */
export type NoteStatus = "inbox" | "permanent";
