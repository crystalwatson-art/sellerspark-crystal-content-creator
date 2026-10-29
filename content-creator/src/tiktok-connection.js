export const TIKTOK_CONNECTION_STATUS = "not_configured";

export const TIKTOK_CONNECTION_PLAN = Object.freeze({
  status: TIKTOK_CONNECTION_STATUS,
  provider: "TikTok for Developers official APIs",
  requiredProducts: ["Login Kit", "User Info API"],
  readOnlyScopes: ["user.info.basic", "user.info.stats"],
  optionalVideoViewsScope: "video.list",
  optionalDraftHandoffScope: "video.upload",
  directPublishScope: "video.publish",
  directPublishEnabled: false,
  automaticEngagementEnabled: false,
  tokenHandling: "server_only_encrypted_at_rest",
  oauthFlow: "server_started_authorization_code_exchange",
  userInitiatedActionsOnly: true,
  requiredConfiguration: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "TIKTOK_REDIRECT_URI", "TIKTOK_TOKEN_ENCRYPTION_KEY", "SELLERSPARK_SUPABASE_SERVICE_ROLE_KEY"],
  blocker: "Crystal must register and authorize a TikTok developer app, apply the prepared connection and OAuth-state migration, and configure server-only values before account connection or follower-stat reads can be tested."
});

export function getTikTokConnectionPlan() {
  return JSON.parse(JSON.stringify(TIKTOK_CONNECTION_PLAN));
}

export function isTikTokConnectionReady(config = {}) {
  return Boolean(
    config.clientKey
    && config.clientSecret
    && /^https:\/\//.test(config.redirectUri || "")
    && /^[0-9a-f]{64}$/i.test(config.encryptionKey || "")
    && typeof config.serverKey === "string"
    && config.serverKey.trim()
    && config.authorizedScopes?.includes("user.info.stats")
  );
}

