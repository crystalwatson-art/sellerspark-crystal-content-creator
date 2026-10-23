import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const REVIEW_STORE_VERSION = 1;

function clone(value) {
  return value === undefined ? null : JSON.parse(JSON.stringify(value));
}
function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function sanitizeBrief(brief) {
  if (!brief || typeof brief !== "object" || Array.isArray(brief)) return null;
  return {
    id: brief.id ?? null,
    audience: brief.audience ?? null,
    researchMode: brief.researchMode ?? null,
    topics: safeArray(brief.topics).slice(0, 3).map((topic) => ({
      id: topic?.id ?? null,
      title: topic?.title ?? null,
      question: topic?.question ?? null,
      sourceRefs: clone(topic?.sourceRefs || topic?.sources || []),
      claims: clone(topic?.claims || []),
      uncertaintyWarnings: clone(topic?.uncertaintyWarnings || topic?.uncertainties || []),
      warnings: clone(topic?.warnings || [])
    }))
  };
}

function sanitizeRecord(record) {
  return {
    id: record.id,
    version: record.version,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    brief: sanitizeBrief(record.brief),
    researchVerification: clone(record.researchVerification || null),
    listingReview: clone(record.listingReview)
  };
}

function now() {
  return new Date().toISOString();
}

export class ReviewStore {
  constructor({ filePath } = {}) {
    if (!filePath || typeof filePath !== "string") {
      throw new Error("ReviewStore requires an explicit filePath.");
    }
    this.filePath = filePath;
    this.records = new Map();
    this.initialized = false;
    this.corrupt = false;
    this.writeChain = Promise.resolve();
  }

  async init() {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== REVIEW_STORE_VERSION || !parsed.records || typeof parsed.records !== "object") {
        throw new Error("unsupported review store format");
      }
      this.records = new Map(Object.entries(parsed.records));
    } catch (error) {
      if (error?.code === "ENOENT") {
        this.records = new Map();
      } else {
        this.records = new Map();
        this.corrupt = true;
      }
    }
    this.initialized = true;
    return this;
  }

  status() {
    return {
      persistent: this.initialized && !this.corrupt,
      corrupt: this.corrupt,
      filePath: this.filePath,
      recordCount: this.records.size
    };
  }

  assertReady() {
    if (!this.initialized) throw new Error("ReviewStore has not been initialized.");
    if (this.corrupt) {
      const error = new Error("review store is unreadable");
      error.code = "store_corrupt";
      throw error;
    }
  }

  async save() {
    this.assertReady();
    const payload = {
      version: REVIEW_STORE_VERSION,
      records: Object.fromEntries([...this.records.entries()].map(([id, record]) => [id, sanitizeRecord(record)]))
    };
    const temporaryPath = this.filePath + ".tmp-" + randomUUID();
    await writeFile(temporaryPath, JSON.stringify(payload, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
    await rename(temporaryPath, this.filePath);
  }

  async enqueueWrite(operation) {
    const next = this.writeChain.then(operation, operation);
    this.writeChain = next.catch(() => {});
    return next;
  }

  async create({ brief, researchVerification, listingReview }) {
    return this.enqueueWrite(async () => {
      this.assertReady();
      const timestamp = now();
      const record = {
        id: "review-" + randomUUID(),
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
        brief: sanitizeBrief(brief),
        researchVerification: clone(researchVerification || null),
        listingReview: clone(listingReview)
      };
      this.records.set(record.id, record);
      await this.save();
      return sanitizeRecord(record);
    });
  }

  async get(id) {
    this.assertReady();
    const record = this.records.get(id);
    return record ? sanitizeRecord(record) : null;
  }

  async update(id, expectedVersion, updater) {
    return this.enqueueWrite(async () => {
      this.assertReady();
      const current = this.records.get(id);
      if (!current) {
        const error = new Error("review record not found");
        error.code = "not_found";
        throw error;
      }
      if (expectedVersion !== undefined && expectedVersion !== null && current.version !== expectedVersion) {
        const error = new Error("review record is out of date");
        error.code = "conflict";
        error.current = sanitizeRecord(current);
        throw error;
      }
      const next = clone(current);
      await updater(next);
      next.version = current.version + 1;
      next.updatedAt = now();
      this.records.set(id, next);
      await this.save();
      return sanitizeRecord(next);
    });
  }
}

