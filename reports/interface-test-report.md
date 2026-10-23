# Crystal's Content Creator — Interface Test Report

Date: 2026-10-22

## Local interface

Command:

    npm run start

URL:

    http://127.0.0.1:4181

## Browser verification

PASS — tested in the updated local browser interface.

Controls tested:

- Run fictional test mode
- Reset
- Dark mode and light mode toggle
- Preview draft
- Next Draft and Previous Draft navigation
- Copy
- Close

Visible-interface checks:

- The Structured research brief heading is not displayed.
- The large Brief JSON editor is not displayed.
- Load fictional example and Clear controls are not displayed.
- The expandable raw handoff JSON control is not displayed.
- External handoff support remains documented and available through `POST
  /api/content`.

Displayed-result checks:

- ready_for_review status displayed.
- Exactly three draft cards displayed.
- Each card displayed a hook, script, caption, hashtags, suggested viewer
  takeaway, suggested viewer action, and source reference.
- The output displayed human approval required and automatic publishing false.
- The result identified the writer as "Offline template writer".
- Footer stated that publishing, messaging, research gathering, and Listing
  Optimizer actions are unavailable.
- Three cards showed distinct labels: Seller education, Common seller
  mistakes, and Decision-making questions.
- The final refinement pass showed the smaller headline, reduced empty space,
  higher draft queue, and restrained coral accent in the refreshed interface.
- The final scripts read as viewer-facing homeowner guidance and do not include
  the internal phrase "use the supplied brief as context".
- The updated fictional workflow displayed three different hooks and angles:
  Seller education, Common seller mistakes, and Decision-making questions.
- The popup showed a natural script, clear viewer takeaway, complementary caption, useful next step,
  and the preserved fictional source reference/date.
- All three popup positions were checked: each showed its own non-empty viewer
  takeaway while navigating with Next Draft.
- Draft preview contained the hook, script, video concept, scene list,
  caption, hashtags, call to action, research reference, and review status.
- The Listing Optimizer review section showed original content beside suggested
  proposed content with field-level changes and a reason for each change,
  factual-support warnings, and missing-evidence status.
- Accept updated the selected working draft and refreshed the popup; Reject
  preserved the original; Restore original returned the selected draft to its
  original copy. Request revision produced a new fictional candidate and
  stopped after two automatic attempts.
- Review state reappeared after a browser reload from the local server review
  record, with the browser copy acting as a convenience recovery surface.
- After reload, reopening draft 2 restored its server-persisted Request Revision
  status and review history.
- Reset displayed an in-app confirmation, retained the local archive, and then
  cleared only the active view after confirmation.
- Closing the preview returned to the dashboard; no content was published and
  no customer was contacted.
- The requested 390x844 mobile review was completed. The browser capability's
  direct size setting is device-scaled in this environment, so a calibrated
  browser setting produced the exact page metrics `innerWidth: 390`,
  `innerHeight: 844`, and `scrollWidth: 390`.
- At that exact mobile viewport, the popup kept its content in a contained
  scroll area, stacked the responsive sections, and kept the footer controls
  usable. Next, Accept, the two-revision limit, Reset confirmation, and both
  themes were checked there.
- The first pass exposed a truncated top-level audience label. The label now
  wraps to show the full homeowner audience, and the focused regression test
  passes.
- The new AI-writer wiring was not enabled in the browser; no live or paid
  provider call was made. The default offline mode and visible writer identity
  were verified instead.
- The updated review API was exercised through the offline server: the fictional
  LIC workflow persisted a revision action, a stale version received a safe
  conflict, and the separate fictional Brooklyn handoff retained its audience.

## External brief acceptance

PASS — a separate clearly labeled fictional Brooklyn townhouse brief sent to
`POST /api/content` returned three drafts, preserved the supplied source date,
and returned `humanApprovalRequired: true`, `automaticallyPublished: false`,
and `customerContacted: false`.

The same handoff was rechecked against the separate AI-writer working copy on
port 4178. It returned `writer: offline_template`, `writerLabel: Offline
template writer`, three drafts, preserved the fictional source date, and kept
publishing and customer contact disabled.

## HTTP error handling

PASS — a malformed POST body returned:

    {"status":"error","message":"Request body must be valid JSON."}

PASS — the root interface asset returned HTTP 200 with HTML content.

## Environment note

The original 4174 server process was left untouched. The updated files were
verified through a separate offline-only local instance on port 4181; the
earlier 4175, 4176, 4177, and 4178 instances were also left untouched. The
4181 instance was stopped after verification.

The Groq provider was not enabled in the browser and no Groq or OpenAI API
call was made.

The dashboard now has a safe failure panel for writer status, plain-language
explanation, and next step. It shows only an HTTP status or status class when
the server provides one; it does not display provider response bodies or
headers.
The same panel now identifies when research verification is needed and tells
the user which source and evidence records the upstream Research Agent must
provide. The Content Creator does not live-check URLs.
