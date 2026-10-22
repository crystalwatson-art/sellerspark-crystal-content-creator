import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createContentDraft } from "./content-creator.js";
import { createOpenAIWriter } from "./openai-writer.js";
import { createGroqWriter, DEFAULT_GROQ_MODEL } from "./groq-writer.js";
import { createDraftHistory } from "./draft-history.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = path.join(projectRoot, "public");
const fixturePath = path.join(projectRoot, "fixtures", "fictional-research-brief.json");
const brooklynFixturePath = path.join(projectRoot, "fixtures", "fictional-brooklyn-townhouse-brief.json");
const port = Number(process.env.PORT || 3000);
const providerMode = process.env.CONTENT_CREATOR_PROVIDER || "template";
const draftHistory = createDraftHistory();
const openAIWriter = providerMode === "openai"
  ? createOpenAIWriter({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL,
    history: draftHistory
  })
  : null;
const groqWriter = providerMode === "groq"
  ? createGroqWriter({
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL,
    history: draftHistory
  })
  : null;

const assets = new Map([
  ["/", { file: path.join(publicRoot, "index.html"), type: "text/html; charset=utf-8" }],
  ["/index.html", { file: path.join(publicRoot, "index.html"), type: "text/html; charset=utf-8" }],
  ["/app.js", { file: path.join(publicRoot, "app.js"), type: "text/javascript; charset=utf-8" }],
  ["/styles.css", { file: path.join(publicRoot, "styles.css"), type: "text/css; charset=utf-8" }],
  ["/fixtures/fictional-research-brief.json", { file: fixturePath, type: "application/json; charset=utf-8" }],
  ["/fixtures/fictional-brooklyn-townhouse-brief.json", { file: brooklynFixturePath, type: "application/json; charset=utf-8" }]
]);

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body));
}

async function readBody(request, limit = 1024 * 1024) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error("request body is too large");
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://127.0.0.1");

    if (request.method === "GET" && assets.has(url.pathname)) {
      const asset = assets.get(url.pathname);
      const content = await readFile(asset.file);
      response.writeHead(200, { "Content-Type": asset.type, "Cache-Control": "no-store" });
      response.end(content);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/content") {
      let brief;
      try {
        brief = JSON.parse(await readBody(request));
      } catch (error) {
        sendJson(response, 400, {
          status: "error",
          message: error.message === "request body is too large"
            ? "The research brief is too large."
            : "Request body must be valid JSON."
        });
        return;
      }

      if (providerMode === "template") {
        sendJson(response, 200, createContentDraft(brief));
        return;
      }
      if (providerMode !== "openai" || !openAIWriter) {
        if (providerMode === "groq" && groqWriter) {
          sendJson(response, 200, await groqWriter.generate(brief));
          return;
        }
        sendJson(response, 200, {
          agent: "content_creator",
          writer: providerMode,
          writerLabel: "Unconfigured Content Creator writer",
          writerStatus: "not_configured",
          status: "needs_more_research",
          drafts: [],
          missingInformation: ["CONTENT_CREATOR_PROVIDER is not configured for a supported writer."],
          unsupportedClaims: [],
          humanApprovalRequired: true,
          automaticallyPublished: false,
          customerContacted: false
        });
        return;
      }

      sendJson(response, 200, await openAIWriter.generate(brief));
      return;
    }

    sendJson(response, 404, { status: "error", message: "Not found." });
  } catch {
    sendJson(response, 500, { status: "error", message: "The local demo could not complete that request safely." });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log("Crystal's Content Creator demo: http://127.0.0.1:" + port);
});
