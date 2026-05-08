---
name: playwright-e2e-automation
description: Multi-step Playwright E2E test automation using specialized agents (Planner, Implementer, Healer) with mandatory POM, externalized config, and AI-CONTEXT.md driven reuse
---

# Playwright E2E Test Automation

This skill orchestrates Playwright E2E test creation using three specialized agents working against a target repo (the repository where the E2E tests live, NOT this framework):

1. **Planner** — Analyzes the feature, reads `AI-CONTEXT.md`, plans scenarios and lists Page Objects / API helpers to reuse vs. create.
2. **Implementer** — Writes Playwright code following the strict structure below (POM mandatory, config externalized, API-first setup).
3. **Healer** — Fixes flaky tests by updating Page Objects (never specs) and proposes updates to `AI-CONTEXT.md`.

> **Terminology**: "target repo" = the repository that contains the E2E tests (its `e2e/` folder). All file paths in examples are relative to that repo, not to this framework.

## When to Use

- Adding E2E tests for new features.
- Achieving full screen coverage.
- Testing real-time updates with multiple sessions.
- Fixing flaky E2E tests.

---

## Project Structure (defaults + per-project override)

The framework targets very different repos (single-repo, monorepos with frontend under `apps/<x>/` or `services/<x>/`, multi-repo, etc.). Therefore the structure has **a default layout** plus a **declarable override** in `AI-CONTEXT.md`.

### Default layout (used when `AI-CONTEXT.md` does not declare overrides)

```
<e2eRoot>/
  AI-CONTEXT.md              # Read FIRST. Inventory + structural overrides.
  config/
    urls.ts                  # Routes + baseURL, sourced from env.
    users.ts                 # Users by role, credentials from env vars.
    env.ts                   # Loads + validates required env vars.
  pages/                     # Page Objects: <screen>.page.ts
  fixtures/                  # Custom Playwright fixtures (auth, seeded data, …)
  api/                       # API helpers used for arrange/cleanup
  specs/                     # *.e2e.spec.ts
  auth.setup.ts              # One-time login per role -> .auth/<role>.json (storageState)
playwright.config.ts         # Consumes baseURL from <e2eRoot>/config/urls.ts
```

`<e2eRoot>` defaults to `e2e/` at the repository root.

### Declaring overrides in `AI-CONTEXT.md`

When the default layout does not fit (e.g. monorepo with the frontend under `services/web-frontend/`), declare the actual paths in a `## Structure` section at the top of `AI-CONTEXT.md`:

```markdown
## Structure
- e2eRoot: services/web-frontend/e2e
- pages: pages           # default
- fixtures: fixtures     # default
- api: api               # default
- specs: specs           # default
- config: config         # default
- authSetup: auth.setup.ts
- playwrightConfig: services/web-frontend/playwright.config.ts
- storageStateDir: .auth
```

Rules:
- All keys are optional. Missing keys take their default values relative to `e2eRoot`.
- All paths in `AI-CONTEXT.md` are relative to the repository root, **except** subfolder names (`pages`, `fixtures`, `api`, `specs`, `config`) which are relative to `e2eRoot`.
- Once declared, every agent must resolve file locations through these values — never hardcode `e2e/...` paths in generated code.

### Non-negotiable rules (regardless of layout)

- Specs never contain URL literals, credential literals, or raw selectors.
- POMs are separated from specs.
- Auth state has a single producer (`auth.setup.ts` or equivalent) — no UI login duplicated per spec.
- Config (urls/users/env) is externalized.
- `AI-CONTEXT.md` lives at `<e2eRoot>/AI-CONTEXT.md` and is the source of truth for both inventory and structure.

---

## AI-CONTEXT.md (read FIRST, always)

Before planning or implementing anything, **every agent must read `e2e/AI-CONTEXT.md`** in the target repo. It is the source of truth for what already exists and can be reused.

If the file does not exist yet, the Planner generates it by scanning `e2e/pages/`, `e2e/fixtures/`, `e2e/api/` (if any) and committing the inventory before producing the test plan.

### Template (target repo only — placeholders, no SUT-specific names)

```markdown
# E2E AI Context — <project-name>

> Read this file FIRST before planning or implementing any E2E test.
> Update it whenever you add a Page Object, fixture, helper, or API helper.

## Structure
- e2eRoot: e2e                          # override if not at repo root
- pages: pages
- fixtures: fixtures
- api: api
- specs: specs
- config: config
- authSetup: auth.setup.ts
- playwrightConfig: playwright.config.ts
- storageStateDir: .auth

## Stack
- Frontend: <framework-and-version>
- Auth: <auth-provider-or-strategy>
- API base URL: see `<e2eRoot>/config/urls.ts`
- Realtime (if any): <protocol-or-none>

## Existing Page Objects (REUSE before creating new)
| Page Object   | File                              | Covers screen |
|---------------|-----------------------------------|---------------|
| <ScreenAPage> | e2e/pages/<screen-a>.page.ts      | <route-a>     |

## Existing Fixtures
| Fixture            | File                              | Provides                        |
|--------------------|-----------------------------------|---------------------------------|
| authenticatedPage  | e2e/fixtures/auth.fixture.ts      | page authenticated as <role>    |

## Existing API Helpers (prefer over UI for setup/teardown)
| Helper                       | File                       | Purpose                              |
|------------------------------|----------------------------|--------------------------------------|
| api.<resource>.create(...)   | e2e/api/<resource>.api.ts  | seed <resource> via REST/GraphQL     |
| api.<resource>.delete(id)    | e2e/api/<resource>.api.ts  | cleanup <resource>                   |

## Conventions for setup/teardown
- Prefer API calls for arrange/cleanup; UI is for what the test asserts.
- Auth: use `storageState` from `auth.setup.ts`; never log in via UI per test.
- Each test seeds its own data via API and cleans up in `afterEach`.

## Known gotchas
- <project-specific-gotcha-1>

## Out of scope for E2E
- Visual regression (separate skill/tool).
- Unit/contract tests (handled at service level).
```

### Reuse rules

- **Planner** must list, in its output, which POMs / fixtures / API helpers it will **reuse** vs. **create new**. Creating new is justified only when nothing existing fits.
- **Implementer** extends existing files instead of creating parallel ones (no `<screen>-v2.page.ts`). When adding a new POM, fixture, or API helper, it appends a row to `AI-CONTEXT.md` in the same change.
- **Healer** respects the inventory and proposes `AI-CONTEXT.md` updates when a fix introduces a new pattern.

---

## Configuration Files (target repo)

### `e2e/config/env.ts`
Loads and validates required env vars (`BASE_URL`, `E2E_<ROLE>_EMAIL`, `E2E_<ROLE>_PASSWORD`, …). Fails fast at startup if any are missing.

### `e2e/config/urls.ts`
Exports a typed object of routes plus `baseURL`. Routes are relative; specs use `urls.<name>` only.

```ts
import { env } from './env';

export const baseURL = env.BASE_URL;

export const urls = {
  home: '/',
  login: '/login',
  <screen>: '/<route>',
  <resource>: (id: string) => `/<resource>/${id}`,
} as const;
```

### `e2e/config/users.ts`
Exports users by role; credentials come from env vars only.

```ts
import { env } from './env';

export const users = {
  admin:  { email: env.E2E_ADMIN_EMAIL,  password: env.E2E_ADMIN_PASSWORD },
  member: { email: env.E2E_MEMBER_EMAIL, password: env.E2E_MEMBER_PASSWORD },
  viewer: { email: env.E2E_VIEWER_EMAIL, password: env.E2E_VIEWER_PASSWORD },
} as const;
```

### `playwright.config.ts`
Consumes `baseURL` from `e2e/config/urls.ts`. Adds an `auth.setup.ts` project as dependency to produce `.auth/<role>.json` storage states.

---

## Page Object Model (mandatory)

- One class per screen, in `e2e/pages/<screen>.page.ts`, exported as `<Screen>Page`.
- All locators are `private readonly` fields built with `page.getByRole / getByLabel / getByTestId`. **Selectors must not appear in specs.**
- Methods express business actions (`<businessAction>(...)`), not raw `click` / `fill`.
- Public getters expose only what specs need to assert (`get <field>(): Locator`).
- Optional `BasePage` for shared utilities (`waitForReady`, navigation helpers).
- Selector preference order: `getByTestId` → `getByRole` → `getByLabel` → CSS. `nth-child` and structural selectors are forbidden.

```ts
// e2e/pages/<screen>.page.ts
import type { Page, Locator } from '@playwright/test';
import { urls } from '../config/urls';

export class <Screen>Page {
  private readonly <actionTrigger>: Locator;
  private readonly <inputField>: Locator;
  readonly <assertableField>: Locator;

  constructor(private readonly page: Page) {
    this.<actionTrigger>   = page.getByRole('button', { name: '<label>' });
    this.<inputField>      = page.getByLabel('<label>');
    this.<assertableField> = page.getByTestId('<testid>');
  }

  async goto(id?: string) {
    await this.page.goto(id ? urls.<resource>(id) : urls.<screen>);
  }

  async <businessAction>(value: string) {
    await this.<inputField>.fill(value);
    await this.<actionTrigger>.click();
  }
}
```

---

## Test Pattern (canonical, agnostic)

```ts
import { test, expect } from '../fixtures';
import { urls } from '../config/urls';
import { users } from '../config/users';
import { api } from '../api';
import { <Screen>Page } from '../pages/<screen>.page';

test.describe('<Feature> - <action>', () => {
  let resourceId: string;

  test.beforeEach(async ({ request }) => {
    const res = await api.<resource>.create(request, { user: users.<role> });
    expect(res.ok()).toBeTruthy();
    resourceId = (await res.json()).id;
  });

  test('<expected behavior>', async ({ authenticatedPage }) => {
    const screen = new <Screen>Page(authenticatedPage);
    await screen.goto(resourceId);
    await screen.<businessAction>('<value>');
    await expect(screen.<assertableField>).toHaveText('<expected>');
  });

  test.afterEach(async ({ request }) => {
    if (resourceId) await api.<resource>.delete(request, resourceId).catch(() => {});
  });
});
```

---

## Multi-Session Real-Time Testing

For real-time features, use multiple browser contexts; both still consume `urls`/`users` and POMs.

```ts
test('<event> propagates to second user', async ({ browser }) => {
  const ctxA = await browser.newContext({ storageState: '.auth/<roleA>.json' });
  const ctxB = await browser.newContext({ storageState: '.auth/<roleB>.json' });

  const screenA = new <Screen>Page(await ctxA.newPage());
  const screenB = new <Screen>Page(await ctxB.newPage());

  await screenA.goto();
  await screenB.goto();

  await screenA.<emittingAction>('<value>');
  await expect(screenB.<assertableField>).toHaveText('<value>');
});
```

---

## Hooks: `beforeEach` / `afterEach` / `beforeAll` / `afterAll`

1. **API-first setup when available** — if an API exists for auth/seed, use it; UI login or UI seeding is acceptable as a fallback when no API is available, but encapsulated in a fixture (never repeated per spec).
2. **Thin hooks** — one responsibility (arrange or cleanup). >10 lines → move to a custom fixture.
3. **Per-test isolation** — each test owns its data with unique IDs (`crypto.randomUUID()`, `${testInfo.title}-${workerIndex}`). No mutable shared state across tests.
4. **Guaranteed cleanup** — every create has a delete in `afterEach`. `afterEach` runs even on failure.
5. **`beforeAll` only for costly, immutable setup** — reference data, storageState warmup. Never for mutable per-test data.
6. **`afterAll` for global teardown** — drop test tenant, close API clients.
7. **No UI navigation in hooks** — use `authenticatedPage` fixture or `test.use({ storageState })`.
8. **No behavior assertions in hooks** — only defensive guards (`expect(seedRes.ok()).toBeTruthy()`).
9. **Tolerant cleanup** — wrap each delete in try/catch or use `Promise.allSettled`; a broken cleanup must not mask the real failure.
10. **Idempotent and reentrant** — re-running a test must not collide with leftover data.
11. **Contextual logging** — include `testInfo.title` if logging from hooks.
12. **Prefer custom fixtures over duplicated hooks** — turn repeated `beforeEach` blocks into `test.extend({ <fixture> })`.
13. **No implicit ordering between files** — specs run in parallel; never rely on file execution order.

### Anti-patterns (forbidden)

```ts
// ❌ UI login repeated in every spec's beforeEach (instead of a fixture / auth.setup.ts)
// UI login is acceptable as a fallback when no auth API exists, but only ONCE,
// inside `auth.setup.ts` (producing storageState) or a custom fixture — never duplicated per spec.
test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.fill('#email', '<email>');
  await page.fill('#password', '<password>');
  await page.click('button[type=submit]');
});

// ❌ Mutable state shared across tests
let sharedId: string;
test.beforeAll(async ({ request }) => { sharedId = await api.<resource>.create(request); });
test('A modifies it', async () => {});
test('B asserts result of A', async () => {}); // coupling

// ❌ Cleanup that does not run on failure
test('flow', async ({ page }) => {
  const id = await api.<resource>.create();
  await doStuff(page);   // throws -> delete never runs
  await api.<resource>.delete(id);
});

// ❌ afterEach that swallows or surfaces cleanup errors as the test failure
test.afterEach(async () => { await api.cleanup(); });
```

---

## Additional Best Practices

1. **API-first arrange/cleanup** — UI only for what the test actually asserts.
2. **Auth via `storageState`** — `auth.setup.ts` logs in each role once, persists `.auth/<role>.json`; specs use `test.use({ storageState })`.
3. **Stable selectors first** — `getByTestId` → `getByRole` → `getByLabel` → CSS. No `nth-child`.
4. **Web-first assertions** — `expect(locator).toHaveText(...)`, `toBeVisible()`. Forbidden: `expect(await locator.textContent())`.
5. **No `waitForTimeout` outside debug** — wait for a concrete event (`waitForResponse`, `waitForURL`, `expect(...).toBeVisible({ timeout })`).
6. **Test isolation** — unique IDs per test, cleanup in `afterEach`.
7. **Tags and projects** — `@smoke`, `@critical`, `@realtime`, `@slow`. Define Playwright `projects` per browser/role as needed.
8. **Bounded retries** — `retries: process.env.CI ? 2 : 0`. Never hide flakiness behind high retries.
9. **Artifacts on failure only** — `trace: 'retain-on-failure'`, `video: 'retain-on-failure'`, `screenshot: 'only-on-failure'`.
10. **Explicit network mocking** — per-test `page.route(...)`, cleared in `afterEach`. No hidden global mocks.
11. **Realistic per-test data** — use `@faker-js/faker`. Never `"test123"`.
12. **Comment intent, not mechanics** — the test title states the behavior; comments only flag workarounds or non-obvious invariants.
13. **Naming convention** — `<feature>.e2e.spec.ts`, `<screen>.page.ts`, `<feature>.api.ts`, `<feature>.fixture.ts`.
14. **Optional a11y suite** — `@axe-core/playwright` under a `@a11y` tag, runnable separately.
15. **CI reporters** — `reporter: [['list'], ['html', { open: 'never' }], ['junit', ...]]`.

---

## Commands (target repo)

```bash
# Run all E2E tests
<pkg-runner> test:e2e

# Run a specific spec
<pkg-runner> test:e2e -- <feature>.e2e.spec.ts

# Headed / debug
<pkg-runner> test:e2e -- --headed
<pkg-runner> test:e2e -- --debug
```

---

## Agent Invocation Pattern

```ts
// 1. Plan (reads AI-CONTEXT.md, lists reuse vs. new)
Task({ subagent_type: 'general-purpose', model: 'opus',
  prompt: `[Read ./agents/planner.md and inject feature context]` });

// 2. Implement (POM, configs, API-first setup, updates AI-CONTEXT.md)
Task({ subagent_type: 'general-purpose', model: 'sonnet',
  prompt: `[Read ./agents/implementer.md and inject the test plan]` });

// 3. Heal (fixes in POMs, never specs; proposes AI-CONTEXT.md updates)
Task({ subagent_type: 'general-purpose', model: 'sonnet',
  prompt: `[Read ./agents/healer.md and inject failure logs]` });
```
