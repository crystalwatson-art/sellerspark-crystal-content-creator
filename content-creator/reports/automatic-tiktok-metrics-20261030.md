# Automatic TikTok metrics and editable follower goals

## User request

Refresh follower and public-video view counts automatically in the TikTok Growth
workspace and let the user change the follower target. Preserve the integrated
studio, existing reviews, agent implementation and private stable address.

## Implemented behavior

- A signed-in studio checks the saved connection and reads its follower count
  automatically. It repeats every two minutes while the tab is visible and
  refreshes on return to the tab, with a fifteen-second minimum gap.
- No polling occurs after sign-out. Concurrent requests are deduplicated, old
  owner responses cannot update a new account, and failures preserve the last
  successful metric and schedule a retry. The tab does not run while closed.
- The current-follower field is read-only; the first successful refresh sets a
  starting count only when the optional starting field was blank.
- Video views are visible in the workspace. With `video.list` permission, the
  current video page loads automatically and refreshes without losing its cursor.
  Without consent, a clearly labeled **Allow TikTok video views** control appears.
  The app never attempts to grant itself permission. Counts are per-video views,
  not profile visits or a fabricated account-wide total.
- **Follower goal** accepts whole numbers from 1 to 1,000,000,000. Progress uses
  current followers / chosen target, capped at 100%. Invalid values show an error
  and do not overwrite the previous valid saved goal.
- Goals are stored per signed-in owner on this device and shared across audience
  locations. Existing local growth plans are migrated once to an owner-specific
  namespace without deleting the old data. The UI says the goal is saved on this
  device; this does not claim cross-device goal/calendar sync.
- Manual refresh remains as a backup. Posting, messaging, following accounts
  and other social actions are not automated.

## Verification

Full suite: **213 passed, 0 failed**. Targeted tests were repeated after the final
stale-permission guards and pass.

The added controller tests cover startup, polling, deduplication, hidden-tab
pausing, focus throttling, retries and sign-out invalidation. The JSDOM/real-HTTP
integration test verifies automatic follower and video loading, initial baseline,
read-only metric, goal recalculation, persistence across a fresh session and
locations, invalid-goal preservation, and omission of video requests without
consent. Controlled TikTok/database responses are explicitly test doubles.

The first rendered-browser automatic-refresh pass exposed a startup race: the
browser `pageshow` event could start polling using a remembered session before
the auth configuration was loaded. The controller now also requires configured
auth, and the `pageshow` handler checks that boundary. The integration test holds
the auth-config response, dispatches `pageshow`, proves no premature metric call
occurs, then releases configuration and observes automatic loading immediately.
The targeted automatic-metric tests pass after this correction.

Before this update, a real signed-in browser pass on the stable private studio
confirmed **Connected**, and the actual follower-count endpoint returned **0**.
The successful refresh was repeated after the preceding agent deployment at
7:34 PM Eastern on October 30. No tokens or secrets were read. This proves the
live follower API boundary, not the new timer by itself. A rendered-browser pass
of the automatic update follows deployment; authorized live video-count access
still requires the user's separate consent.

## Rendered browser result — 7:51 PM Eastern

The corrected build (190ea01976b36089e1ee7d56b124f42935046b55,
deployment dpl_4J1tyeidbXQxUjqnhpuLynJo7DXR) was assigned to the existing stable
private alias. In a fresh signed-in Chrome tab, reloading the studio
automatically produced **Connected**, follower count **0**, and a successful
TikTok update timestamp without pressing Refresh. The current-follower field is
read-only. Changing the target to **250**, saving and reloading restored **250
total followers**. The original target **100** was restored after testing.
The updated studio tab was left open. Video-view permission is not yet granted:
the visible one-time consent control is present, and no live video-view result
is claimed. The provider key for live AI remains unconfigured.

## Existing agent checkpoint (unchanged)

The Content Creator/Optimizer loops are saved in parent commit
c05d7bf7fa6d3fb6b16e639a790637c2d2901945 and remain included. The host still lacks
its private AI provider key. No template is labeled a live AI run, and the ten
live-model evaluations, contribution comparison and peer red-team remain pending.
