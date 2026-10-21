import { readFile } from "node:fs/promises";
import { createContentDraft } from "./content-creator.js";

const path = process.argv[2] || "fixtures/fictional-research-brief.json";
const brief = JSON.parse(await readFile(path, "utf8"));
const result = createContentDraft(brief);

console.log(JSON.stringify({
  status: result.status,
  audience: result.audience,
  draftCount: result.drafts.length,
  warningCount: result.drafts.reduce((total, draft) => total + draft.warnings.length, 0),
  humanApprovalRequired: result.humanApprovalRequired,
  automaticallyPublished: result.automaticallyPublished,
  customerContacted: result.customerContacted
}, null, 2));
