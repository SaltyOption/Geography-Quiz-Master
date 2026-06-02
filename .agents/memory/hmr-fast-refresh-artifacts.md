---
name: HMR / Fast Refresh false-positive runtime errors
description: How to recognize transient Vite Fast Refresh errors vs. real React render bugs
---

When a reported React crash shows the pair "Invalid hook call" immediately followed by
"Maximum update depth exceeded" (often with a collateral "An error occurred in the <span>
component"), and the timestamps straddle a Vite `[vite] connecting...` / `[vite] connected.`
reconnect, it is almost certainly a **Fast Refresh / HMR artifact**, not a product bug.

**Why:** When you edit a component and Vite hot-swaps it while it is still mounted, the
hook graph of the new module can mismatch the mounted tree. React throws "Invalid hook
call" and the partial re-render cascades into "Maximum update depth". A full page reload
clears it.

**How to apply:** Before treating such an error as a real runtime bug, try to reproduce on
a CLEAN full page load (and via signed-in automation if auth-gated). If it does NOT
reproduce on clean loads/interactions and only appeared during active editing with Vite
reconnects in the logs, conclude HMR artifact. Still harden any genuinely fragile pattern
the error pointed at, but do not chase a non-reproducible "infinite loop".
