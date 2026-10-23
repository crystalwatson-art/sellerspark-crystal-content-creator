import { readFile } from "node:fs/promises";
import { createContentDraft } from "./content-creator.js";

const path = process.argv[2] || "fixtures/fictional-research-brief.json";

try {
  const brief = JSON.parse(await readFile(path, "utf8"));
  const result = createContentDraft(brief);

  console.log(JSON.stringify({
    status: result.status,
    audience: result.audience ?? null,
    writer: result.writer ?? null,
    writerLabel: result.writerLabel ?? null,
    draftCount: result.drafts.length,
    warningCount: result.drafts.reduce((total, draft) => total + draft.warnings.length, 0),
    humanApprovalRequired: result.humanApprovalRequired,
    automaticallyPublished: result.automaticallyPublished,
    customerContacted: result.customerContacted
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    status: "error",
    message: error instanceof SyntaxError
      ? "Input file is not valid JSON."
      : "Unable to read or process the research brief safely."
  }, null, 2));
  process.exitCode = 1;
}
