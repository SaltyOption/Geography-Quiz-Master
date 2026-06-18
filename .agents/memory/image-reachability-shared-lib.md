---
name: Image reachability shared lib
description: The transient-never-blocks rule for image-URL reachability shared across the broken-image script, API save guard, and frontend.
---

# Image reachability check

External (http/https) image-URL reachability has one shared implementation, consumed by both the maintenance/scheduled broken-image script and the api-server's write-time save guard. Keep them on the one shared lib so classification stays identical — grep `@workspace/image-check` to find it.

**Rule: a "transient" result must NEVER hard-block.** Reachability is classified ok / broken / transient. Only `broken` (genuine 4xx or 2xx-non-image) is an error. `transient` (timeout, DNS/network, 429, 5xx) must not fail a save, the preflight check, or the deploy/scheduled gate.

**Why:** a flaky CDN or a momentary blip should never stop an admin from saving content or block a publish. Admins edit image URLs through the live admin UI, so the same logic backs both the per-form save guard and the batch/scheduled check.

**How to apply:** local optimized paths (`/regions/`, `/landmarks/`) are verified by on-disk file existence (sync); external URLs additionally go through an async reachability check on single-form saves. Bulk import paths stay sync local-only to avoid a network request per item.
