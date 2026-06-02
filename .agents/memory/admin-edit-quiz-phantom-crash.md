---
name: Admin edit-quiz "Maximum update depth / Invalid hook call" is an HMR artifact
description: Recurring phantom crash on the admin quiz-edit page; how to tell it's a Fast-Refresh artifact, not a merged-code bug.
---

# Admin edit-quiz phantom crash

The admin quiz-edit page has TWICE been reported as "crashed" with
`Maximum update depth exceeded` + `Invalid hook call` + an `<span>` error
boundary message. Both times the root cause was the same: a **Vite Fast-Refresh
/ HMR artifact**, not a bug in the merged code.

## How to recognize it
- The signature is `Invalid hook call` immediately followed by `Maximum update
  depth exceeded`, straddling a `[vite] connecting...` reconnect in the browser
  console. That ordering is the classic Fast-Refresh signature of hot-swapping a
  component that just gained/lost hooks while it was still mounted.
- It appears only **during an active edit session** on that file (e.g. while
  adding a new sub-component with its own hooks). On a **full page reload after a
  workflow restart it does NOT reproduce** — the console comes back clean.
- Cross-check crash timestamps against the api-server request log: if each crash
  lines up with an HMR update / page nav during editing, and a later clean reload
  of the same route is error-free, it's the artifact.

**Why:** don't go hunting for a render loop in merged code — there isn't one.
Verify with a clean reload first before changing logic.

## The one real, reproducible defect here (worth fixing)
`useForm` on this page had no `defaultValues`, only the reactive `values` prop
sourced from the fetched quiz. react-hook-form syncs `values` in an effect AFTER
the first render, so inputs mounted with `undefined` (uncontrolled) then became
controlled → the persistent "changing an uncontrolled input to be controlled"
warning. Fix = add `defaultValues` (empty strings) so fields are controlled from
first render. This also reduces render churn that makes Fast-Refresh flakier.
