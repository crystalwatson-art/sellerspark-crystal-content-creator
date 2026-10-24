import { randomUUID } from "node:crypto";

export const SUPABASE_REVIEW_TABLE = "sellerspark_listing_reviews";

function clone(value) {
  return value === undefined ? null : JSON.parse(JSON.stringify(value));
}

function now() {
  return new Date().toISOString();
}

function requireAccessToken(accessToken) {
  if (typeof accessToken !== "string" || !accessToken.trim()) {
    const error = new Error("A verified user session is required for review storage.");
    error.code = "authorization_required";
    throw error;
  }
  return accessToken;
}

function requireActorId(actorId) {
  if (typeof actorId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(actorId)) {
    const error = new Error("A trusted authenticated actor is required for review storage.");
    error.code = "authorization_required";
    throw error;
  }
  return actorId;
}

function requireReviewId(id) {
  if (typeof id !== "string" || !/^review-[0-9a-f-]{36}$/.test(id)) {
    const error = new Error("The review identifier is invalid.");
    error.code = "not_found";
    throw error;
  }
  return id;
}

function recordToRow(record, actorId) {
  return {
    id: record.id,
    owner_id: actorId,
    version: record.version,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    brief: clone(record.brief),
    research_verification: clone(record.researchVerification || null),
    listing_review: clone(record.listingReview)
  };
}

function rowToRecord(row) {
  return {
    id: row.id,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    brief: clone(row.brief),
    researchVerification: clone(row.research_verification || null),
    listingReview: clone(row.listing_review)
  };
}

function storageError(response) {
  const error = new Error("Supabase review storage request failed safely.");
  error.code = response.status === 401 || response.status === 403
    ? "authorization_failed"
    : "storage_unavailable";
  error.httpStatus = response.status;
  return error;
}

export class SupabaseReviewStore {
  constructor({ url, anonKey, fetchImpl = globalThis.fetch } = {}) {
    if (typeof url !== "string" || !/^https:\/\/[^/]+/.test(url)) {
      throw new Error("SupabaseReviewStore requires a server-only HTTPS URL.");
    }
    if (typeof anonKey !== "string" || !anonKey.trim()) {
      throw new Error("SupabaseReviewStore requires a Supabase public API key.");
    }
    if (typeof fetchImpl !== "function") throw new Error("SupabaseReviewStore requires fetch.");
    this.endpoint = url.replace(/\/+$/, "") + "/rest/v1/" + SUPABASE_REVIEW_TABLE;
    this.anonKey = anonKey;
    this.fetchImpl = fetchImpl;
    this.initialized = false;
  }

  async init() {
    this.initialized = true;
    return this;
  }

  status() {
    return { persistent: this.initialized, backend: "supabase", table: SUPABASE_REVIEW_TABLE };
  }

  headers(accessToken, extra = {}) {
    return {
      apikey: this.anonKey,
      Authorization: "Bearer " + requireAccessToken(accessToken),
      "Content-Type": "application/json",
      ...extra
    };
  }

  assertReady() {
    if (!this.initialized) throw new Error("SupabaseReviewStore has not been initialized.");
  }

  async request(url, options) {
    const response = await this.fetchImpl(url, options);
    if (!response.ok) throw storageError(response);
    return response.status === 204 ? [] : response.json();
  }

  async create({ brief, researchVerification, listingReview, actorId, actorToken }) {
    this.assertReady();
    const ownerId = requireActorId(actorId);
    requireAccessToken(actorToken);
    const timestamp = now();
    const record = {
      id: "review-" + randomUUID(),
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      brief: clone(brief),
      researchVerification: clone(researchVerification || null),
      listingReview: clone(listingReview)
    };
    const rows = await this.request(this.endpoint, {
      method: "POST",
      headers: this.headers(actorToken, { Prefer: "return=representation" }),
      body: JSON.stringify(recordToRow(record, ownerId))
    });
    return rowToRecord(rows[0]);
  }

  async get(id, { actorId, actorToken } = {}) {
    this.assertReady();
    const ownerId = requireActorId(actorId);
    requireAccessToken(actorToken);
    const reviewId = requireReviewId(id);
    const url = new URL(this.endpoint);
    url.searchParams.set("select", "*");
    url.searchParams.set("id", "eq." + reviewId);
    url.searchParams.set("owner_id", "eq." + ownerId);
    const rows = await this.request(url, { headers: this.headers(actorToken) });
    return rows[0] ? rowToRecord(rows[0]) : null;
  }

  async update(id, expectedVersion, updater, { actorId, actorToken } = {}) {
    this.assertReady();
    const ownerId = requireActorId(actorId);
    const reviewId = requireReviewId(id);
    const current = await this.get(reviewId, { actorId: ownerId, actorToken });
    if (!current) {
      const error = new Error("review record not found");
      error.code = "not_found";
      throw error;
    }
    if (current.version !== expectedVersion) {
      const error = new Error("review record is out of date");
      error.code = "conflict";
      error.current = current;
      throw error;
    }
    const next = clone(current);
    await updater(next);
    next.version = current.version + 1;
    next.updatedAt = now();
    const url = new URL(this.endpoint);
    url.searchParams.set("select", "*");
    url.searchParams.set("id", "eq." + reviewId);
    url.searchParams.set("owner_id", "eq." + ownerId);
    url.searchParams.set("version", "eq." + current.version);
    const rows = await this.request(url, {
      method: "PATCH",
      headers: this.headers(actorToken, { Prefer: "return=representation" }),
      body: JSON.stringify({
        version: next.version,
        updated_at: next.updatedAt,
        brief: next.brief,
        research_verification: next.researchVerification,
        listing_review: next.listingReview
      })
    });
    if (!rows[0]) {
      const error = new Error("review record is out of date");
      error.code = "conflict";
      error.current = await this.get(reviewId, { actorId: ownerId, actorToken });
      throw error;
    }
    return rowToRecord(rows[0]);
  }
}
