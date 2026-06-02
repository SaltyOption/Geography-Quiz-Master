---
name: Avoid react-query-derived arrays in useEffect deps that setState
description: Pattern that risks render loops in this codebase's admin dialogs
---

Do not write `useEffect(() => { if (open) setLocalState(queryData.someArray.map(...)) },
[open, queryData.someArray])`. `queryData.someArray` (e.g. `question.categories` from the
quiz query) is a referentially-unstable array: parent rerenders/refetches produce a new
reference, re-firing the effect and resetting local state — exactly the dependency pattern
React's "Maximum update depth exceeded" error names.

**Why:** react-query structural sharing keeps stable refs only for unchanged subtrees; an
edited/ refetched item gets a fresh array reference, so the effect refires unexpectedly.

**How to apply:** Seed dialog-local selection state in the open handler instead, e.g.
`handleOpenChange(next) { if (next) setIds((q.categories ?? []).map(c => c.id)); setOpen(next); }`.
Route every open/close (button onClick, Dialog onOpenChange, Cancel) through that one
handler. Always guard the array with `?? []`.
