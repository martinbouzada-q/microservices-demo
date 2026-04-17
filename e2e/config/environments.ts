/**
 * Centralized environment configuration for E2E tests.
 *
 * Usage:
 *   BASE_URL=https://staging.example.com npx playwright test   (explicit override)
 *   TEST_ENV=staging npx playwright test                        (named environment)
 *   npx playwright test                                         (defaults to local)
 */

export interface EnvironmentConfig {
  baseUrl: string;
  name: string;
}

const environments: Record<string, EnvironmentConfig> = {
  local: {
    name: 'local',
    baseUrl: 'http://localhost:8080',
  },
  staging: {
    name: 'staging',
    baseUrl: 'https://staging.online-boutique.example.com',
  },
  production: {
    name: 'production',
    baseUrl: 'https://online-boutique.example.com',
  },
};

const env = process.env.TEST_ENV ?? 'local';

if (!(env in environments)) {
  throw new Error(
    `Unknown TEST_ENV="${env}". Valid values: ${Object.keys(environments).join(', ')}`
  );
}

const selected = environments[env];

/**
 * Active base URL for the current environment.
 * Precedence: BASE_URL env var > TEST_ENV selection > local default.
 */
export const BASE_URL: string = process.env.BASE_URL ?? selected.baseUrl;

export const ENV_NAME: string = process.env.BASE_URL ? `custom(${process.env.BASE_URL})` : selected.name;

export default environments;
