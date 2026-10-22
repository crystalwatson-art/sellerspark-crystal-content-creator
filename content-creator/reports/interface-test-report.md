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
- Closing the preview returned to the dashboard; Reset cleared the cards and
  returned the audience and status to their initial state.
- The narrow in-app browser viewport kept the popup content in its own scroll
  container and stacked the responsive sections without introducing a full-page
  editor.
- The popup was verified in the separate safe local browser preview; a final
  390x844 visual pass remains a simple follow-up for independent review.
- The new AI-writer wiring was not enabled in the browser; no live or paid
  provider call was made. The default offline mode and visible writer identity
  were verified instead.

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
earlier 4175, 4176, 4177, and 4178 instances were also left untouched.

The Groq provider was not enabled in the browser and no Groq or OpenAI API
call was made.

The dashboard now has a safe failure panel for writer status, plain-language
explanation, and next step. It shows only an HTTP status or status class when
the server provides one; it does not display provider response bodies or
headers.
