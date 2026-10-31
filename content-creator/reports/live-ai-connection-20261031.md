# Live AI connection checkpoint — October 31, 2026 UTC

The owner added OPENROUTER_API_KEY as a sensitive Preview environment variable. Only configuration metadata was inspected; the credential value was never retrieved. The stable protected Preview was redeployed with all prior UI, auth, persistence, card revision and TikTok changes preserved.

Runtime commit: 2f0a52d6dc99a571860e1b95aa715152e344e176.
Deployment: dpl_FFgoVd64E33tCLnxDyDdtxqZB7jr.
Stable URL: https://sellerspark-content-creator-preview-crystalwatson-ai.vercel.app/

## Actual browser observations

- The signed-in app recognizes AI mode and retains three earlier approved cards.
- Free-router attempts did not complete. One safe trace recorded two model decisions, a denied tool selection and a total time-limit stop; another stopped at the provider timeout on its first decision.
- The previous HTTP timeout covered headers only. It now covers response-body parsing as well; a regression test proves a slow body is aborted and classified as provider_timeout.
- Safe server diagnostics record only counters, action names and classified errors, never raw model payloads, credentials or private reasoning. The UI now shows the actual agent stop reason instead of Status unavailable.
- The model request uses a compact action protocol, bounded output and explicit action names. The pinned Liquid free model uses compatible JSON mode while the server still validates every selected action and draft.
- OPENROUTER_MODEL is configured for Preview as liquid/lfm-2.5-2.6b:free. The initial structured request returned HTTP 400. After compatibility changes, the latest real browser request displayed provider rate limit (HTTP 429 classification), kept the earlier approved cards and re-enabled Generate.
- Retrying was stopped after the provider rate-limit response. No paid models, account top-up, public sharing, publication or expanded permissions were used.

## Verification limits

215 software tests pass, including the response-body timeout and safe authentication-error classification regressions. These are controlled software tests, not completed live model evaluations. No successful live two-agent generation, ten-realistic-input success rate, human editorial grading, agent ablation or independent peer red-team result is claimed. Provider connection is configured; completed live generation remains unverified because of the observed provider failures.

The existing fixtures remain fictional. No Research Agent integration is claimed. TikTok follower synchronization was verified separately in the previous report; video-view permission remains a separate user consent step.
