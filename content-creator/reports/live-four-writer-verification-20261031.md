# SellerSpark four-writer verification — 2026-10-31

Source commit: 5c1336a07eaa41f4fa0944bb56a5e8e400214046.
READY Preview deployment: dpl_9YMmTuhSy7DFm89EnKegbbXoeuoM.
Stable address: https://sellerspark-content-creator-preview-crystalwatson-ai.vercel.app/

## Confirmed

- Vercel Preview metadata contains Groq, OpenRouter and Gemini sensitive credentials. No credential values were decrypted or displayed.
- Recovery order: Groq, OpenRouter, Gemini, then the explicitly labelled offline template writer after eligible transport/configuration failures. Evidence and invalid-output rejection remain enforced.
- Signed-in live logs recorded responses from all three AI services. Groq rate limiting caused recovery to OpenRouter. The Creator/Optimizer handoff and revision-feedback loop executed live.
- Later OpenRouter/Gemini timeouts or 503 responses caused the live Generate run to return three template drafts, clearly labelled Offline template fallback writer and saved to the account for human review.
- The template writer now also supports safe card rewrite recovery. Known template records use deterministic template rewriting without retrying unavailable AI services. Other card rewrites can fall back after eligible provider failure, while preserving unsafe/invalid-output rejection.
- Live Shorter on the first card changed its script and saved Version 2 with Template draft provenance and Revision Requested status. The other two card summaries were identical before and after. Copy remained hidden pending acceptance. Reloading the page preserved the revised script and status.
- All 223 automated tests passed. Added coverage includes the complete three-provider failure path through the authenticated API into a persisted template review, template rewriting without further provider calls, action-envelope correction, typed input arguments, prerequisite gates and bounded provider deadlines.
- Fixed an asynchronous browser-test teardown race by settling outstanding native fetch callbacks before closing JSDOM/removing globals.
- Source and saved review history were preserved. No approval, publication, TikTok upload, message or paid OpenAI call was performed.

## Limits

A complete AI-only generation/review/revision run has not succeeded in the live checks. AI services are connected but rate limits and upstream timeouts/503 responses still affect availability. The completed live output used the labelled template fallback. The selected research fixtures are fictional and do not establish a live research agent.

The agent run is bounded to 120 seconds, 20 model decisions and two revision handoffs; the Vercel function cap is 150 seconds. Individual provider deadlines remain bounded by the remaining run time. This stays within the documented Hobby Fluid Compute function duration limit; no plan upgrade was purchased.

Screenshot: [Template revision after reload](template-revision-live-20261031.png).
