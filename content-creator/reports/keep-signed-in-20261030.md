# Optional remembered SellerSpark sign-in — October 30, 2026

Added an unchecked Keep me signed in checkbox with trusted-device help text to Account. Successful checked sign-in stores only the normalized authentication session in localStorage; unchecked sign-in uses sessionStorage. The password is not stored. Startup restores remembered sessions and the existing refresh flow rotates their tokens. Switching persistence clears the other store. Sign-out clears both stores, including when provider logout cannot be reached. Recovery redirects always use temporary storage.

This applies to the same site address and browser profile. It does not transfer sessions between preview hostnames, change Supabase settings or Vercel protection, or connect TikTok. No real credentials or sessions were inspected.

Verification: full suite 181/181 passed. Added synthetic tests for reopening and token refresh, sign-out cleanup, temporary sign-in replacing remembered sign-in, and temporary recovery. Actual browser close/reopen remains to be verified by the user on the protected preview.
