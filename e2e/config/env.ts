/**
 * Environment variable loader and validator.
 *
 * Online Boutique has no auth, so the only required var is BASE_URL.
 * TEST_ENV is supported as an alias for selecting a known environment.
 */

const ENVIRONMENTS = {
  local: 'http://localhost:8080',
  staging: 'https://staging.online-boutique.example.com',
  production: 'https://online-boutique.example.com',
} as const;

type EnvName = keyof typeof ENVIRONMENTS;

function resolveBaseUrl(): string {
  if (process.env.BASE_URL) return process.env.BASE_URL;
  const name = (process.env.TEST_ENV ?? 'local') as EnvName;
  if (!(name in ENVIRONMENTS)) {
    throw new Error(
      `Unknown TEST_ENV="${name}". Set BASE_URL or use one of: ${Object.keys(ENVIRONMENTS).join(', ')}`,
    );
  }
  return ENVIRONMENTS[name];
}

export const env = {
  BASE_URL: resolveBaseUrl(),
  ENV_NAME: process.env.BASE_URL ? `custom(${process.env.BASE_URL})` : (process.env.TEST_ENV ?? 'local'),
  CI: !!process.env.CI,
} as const;
