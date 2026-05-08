/**
 * Online Boutique has NO authentication or roles. Sessions are tracked via the
 * `shop_session-id` cookie (auto-created on first request, 48h TTL).
 *
 * This file exists to satisfy the skill's expected layout. Add real role
 * credentials here only if/when an auth flow is introduced.
 */

export const users = {} as const;

export type SessionRole = keyof typeof users;
