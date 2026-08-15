# Bringing the backend in-repo — strategy & runbook

**Status:** not started. This is the plan, not a record of work done.

**Owner:** _unassigned_ · **Estimated:** 1–2 days · **Risk:** medium (one step
can take production down; it is called out and sequenced)

---

## 1. What's wrong today

The AI backend lives at `/backend-welliva` — a directory on one developer's
machine, deployed to Render at `https://back-for-welliva.onrender.com`. It is not
in this repository. That produces four distinct problems, only one of which is
cosmetic:

1. **It holds the crown jewels.** `backend-welliva/.env` carries the Anthropic
   API key *and* the Supabase `service_role` key — the one that bypasses RLS on
   every table (`supabase/README.md` §Security notes). Neither is reviewable,
   version-controlled, or rotatable by anyone but its holder.
2. **It is on the critical path and unreviewed.** Every AI feature — diet
   generation, workout generation, the Gozlin coach, food parsing — runs through
   it. No CI, no typecheck, no test run, no second pair of eyes.
3. **The docs already describe a directory that doesn't exist.**
   `docs/architecture/05-api-and-contracts.md` §C refers to `server/`,
   `server/src/anthropic.ts` and `server/src/config.ts`. The architecture was
   written against a layout the repo never adopted. Anyone onboarding follows
   those references into nothing.
4. **In diligence it reads as an undisclosed dependency.** A technical acquirer
   asks for the repo, gets the app, and discovers the differentiating technology
   is somewhere else, unversioned, behind one person's credentials.

**The goal is not "tidiness."** It is: one repository, one review surface, one
green check, and a key that more than one person can rotate.

---

## 2. Target state

```
welliva/
├── app/  components/  services/   ← the Expo app (unchanged, stays at root)
├── server/                        ← was /backend-welliva
│   ├── package.json               ← own deps, own scripts
│   ├── tsconfig.json              ← Node target, NOT the RN one
│   ├── .env.example               ← documents required vars, holds no values
│   └── src/
│       ├── index.ts               ← app entry / routes
│       ├── config.ts              ← model lock (claude-haiku-*)
│       └── anthropic.ts           ← callToolValidated etc.
└── .github/workflows/ci.yml       ← gains a `server` job
```

`server/` is the name the architecture docs already use. Adopting it makes those
existing references correct instead of requiring a doc rewrite.

### The one design decision worth arguing about

The P4 fix note suggested making this an **npm workspace**. I'd push back, and
here's the tradeoff stated honestly:

| | Workspace (`workspaces: ["server"]`) | **Plain subdirectory (recommended)** |
|---|---|---|
| One repo / one review surface | ✅ | ✅ |
| One CI check | ✅ | ✅ |
| Shared root `node_modules` | ✅ (hoisted) | ❌ (server installs its own) |
| Metro resolution risk | ⚠️ server deps hoist into the same `node_modules` Metro walks; version conflicts (typescript, zod) resolve unpredictably | ✅ none — Metro never sees `server/` |
| Render deploy config | needs monorepo-aware install | ✅ Root Directory = `server`, done |
| Effort | higher | ✅ lower |

The Expo app **is** the root package here. Making the root also a workspace root
means server dependencies hoist into the exact `node_modules` tree Metro
resolves from. That's workable — Expo supports monorepos — but it costs metro
config changes (`watchFolders`, `nodeModulesPaths`) and introduces a new class of
"works locally, breaks in EAS" bug, weeks before launch, in exchange for a
slightly faster `npm install`.

**Take the plain subdirectory.** It achieves every stated diligence goal. If the
project later grows a third package (a web client, a shared types package),
restructure properly to `apps/mobile` + `apps/server` + `packages/shared` — but
do that deliberately, not as a side effect of this migration.

---

## 3. Pre-flight — do this before touching anything

### 3.1 🔴 BLOCKING: scan the backend's git history for secrets

If `backend-welliva` has its own git history, and a `.env` (or a key pasted into
a commit, a test fixture, a log) was ever committed, importing that history
imports the leaked secret into this repo **permanently** — and into every clone,
every fork, and every diligence data room.

```bash
cd /path/to/backend-welliva

# Was .env ever tracked, in any commit?
git log --all --full-history --oneline -- .env .env.* 2>/dev/null

# Any Anthropic-shaped or Supabase-service-role-shaped string, anywhere in history?
git grep -nI -E 'sk-ant-[A-Za-z0-9_-]{20,}' $(git rev-list --all) 2>/dev/null | head
git grep -nI -E '"role":\s*"service_role"|service_role' $(git rev-list --all) 2>/dev/null | head
```

**Decide from the result:**

| Result | Action |
|---|---|
| No history at all (never a git repo) | Nothing to leak. Use **squash import** (§4.1). |
| Clean history | Either import path is safe. Prefer **history-preserving** (§4.2). |
| **Any hit** | 🔴 Treat both keys as compromised. **Rotate them first** (§7.2), then use **squash import** (§4.1). Do *not* import the history, and do not rely on `git filter-repo` alone — a rotated key is the only real remediation for one that has already been on disk somewhere else. |

### 3.2 Inventory what actually has to move

Do this before copying, because it determines the Render env-var list:

```bash
cd /path/to/backend-welliva
cat .env | sed -E 's/=.*/=<redacted>/'    # NAMES only — never paste values anywhere
cat package.json                          # deps, scripts, engines
node --version                            # what it actually runs on
```

Expected secret inventory (confirm against the real `.env`):

| Variable | What it is | Where it must live |
|---|---|---|
| `ANTHROPIC_API_KEY` | Billing-attached AI key | Render env only |
| `SUPABASE_URL` | Project URL | Render env (not secret, but keep together) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Bypasses all RLS** | Render env only |
| `SUPABASE_JWT_SECRET` / anon key | Verifies the client's user JWT | Render env only |
| `PORT` | Render supplies this | Render (do not hardcode) |

### 3.3 Capture the current deploy config

Screenshot or copy from the Render dashboard, because §6 changes it and you need
the "before" to roll back to:

- Service name, region, instance type
- **Root Directory** (currently blank/repo root)
- Build command, Start command
- Connected repo + branch
- The full env-var key list

---

## 4. Phase 1 — bring the code in

Do this on a branch. Nothing here touches production.

```bash
cd c:/Users/George/confidencial/welliva
git checkout -b chore/backend-in-repo
```

### 4.1 Squash import (use when history is dirty or absent)

```bash
# Copy source only — never node_modules, never .env, never .git
rsync -av --progress \
  --exclude node_modules --exclude .git --exclude .env --exclude dist --exclude build \
  /path/to/backend-welliva/ ./server/

# Prove no secret came along BEFORE the first commit
grep -rIn -E 'sk-ant-|service_role' server/ --exclude-dir=node_modules || echo "clean"
ls -a server/ | grep -E '^\.env$' && echo "🔴 .env present — delete it" || echo "no .env — good"
```

### 4.2 History-preserving import (use only when §3.1 came back clean)

```bash
git remote add backend /path/to/backend-welliva
git fetch backend
git merge -s ours --no-commit --allow-unrelated-histories backend/main
git read-tree --prefix=server/ -u backend/main
git commit -m "chore: import backend-welliva as server/ (history preserved)"
git remote remove backend
```

### 4.3 Make it safe by construction

Create `server/.env.example` documenting every variable **by name with empty
values**, and confirm the root `.gitignore` already covers the new location — it
does (`.env` and `.env*.local` are ignored, and those patterns are not
path-anchored, so `server/.env` is covered). Verify rather than assume:

```bash
echo "ANTHROPIC_API_KEY=leaked" > server/.env
git check-ignore -v server/.env    # must print a matching .gitignore rule
rm server/.env
```

---

## 5. Phase 2 — wire it into the repo's tooling

Four small edits. Each has a verification command.

### 5.1 `tsconfig.json` — exclude it from the app's typecheck

The server is Node, not React Native; compiling it under the RN lib settings will
produce nonsense errors. It gets its own `server/tsconfig.json`.

```jsonc
"exclude": ["node_modules", "catalogs-dist", "server"]
```

Verify: `npx tsc --noEmit` still exits 0.

### 5.2 `eslint.config.js` — give it Node globals

`server/**` is Node CommonJS/ESM, not RN. Extend the existing scripts override
pattern (the file already has one for `scripts/**`):

```js
{
  files: ['server/**/*.{ts,js,mjs}'],
  languageOptions: {
    globals: { process: 'readonly', Buffer: 'readonly', __dirname: 'readonly' },
  },
},
```

Verify: `npx eslint .` exits 0 and the warning count hasn't jumped.

### 5.3 `knip.json` — stop it reporting the whole server as dead

Knip runs from the app's perspective and will flag every server file as unused.
Add the entry point, or ignore the directory until the server has its own knip run:

```jsonc
"ignore": ["catalogs-dist/**", "dist/**", ".expo/**", "supabase/**", "server/**"]
```

Verify: `npx knip --no-exit-code` output is unchanged from today's baseline.

### 5.4 `metro.config.js` — **change nothing**

This is the point of the plain-subdirectory choice. Metro's project root is the
repo root and it only bundles what the app imports; nothing in `app/` imports
`server/`. Leave `metro.config.js` exactly as it is — in particular do **not**
re-add `watchFolders`, which was removed for good reason (see the note in that
file).

Verify: `npx expo export --platform ios` still succeeds and the bundle size is
unchanged (±0.01 MB).

---

## 6. Phase 3 — CI

Add a second job to `.github/workflows/ci.yml`. It is independent of `verify`, so
a server failure doesn't mask an app failure or vice versa.

```yaml
  server:
    name: Server · Typecheck · Test
    runs-on: ubuntu-latest
    timeout-minutes: 15
    defaults:
      run:
        working-directory: server
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: server/package-lock.json
      - run: npm ci
      - name: Typecheck
        run: npx tsc --noEmit
      - name: Test
        if: always()
        run: npm test --if-present
      - name: Lint
        if: always()
        run: npx eslint . --if-present
```

Then add `server` to the required checks in branch protection, alongside
`verify`. **A green check nobody enforces is theater** — this step is the
deliverable, not the YAML.

---

## 7. Phase 4 — the deploy cutover 🔴

**This is the only step that can take production down.** Everything above is
additive and reversible; this changes where the running service gets its code.

### 7.1 Sequence (do not reorder)

1. **Merge the branch first.** `server/` must exist on `main` before Render can
   point at it.
2. **Do not repoint the existing service.** Create a **new** Render service from
   the app repo with **Root Directory = `server`**, same region and instance
   type. Copy every env var from §3.3 by hand.
3. **Verify the new service in isolation**, before any client points at it:
   ```bash
   curl -sS https://<new-service>.onrender.com/health
   # then a real authed call with a test account's token:
   curl -sS -X POST https://<new-service>.onrender.com/v1/coach/chat \
     -H "Authorization: Bearer <test user access_token>" \
     -H 'Content-Type: application/json' \
     -d '{"user":"hello"}'
   ```
4. **Cut the client over** by editing `eas.json` — it currently hardcodes
   `https://back-for-welliva.onrender.com` in **both** `preview` and
   `production`. Change `preview` first, ship an internal build, exercise the
   coach, then change `production`.
5. **Leave the old service running** for at least one full release cycle. Users
   on the previous build still call it. Decommission only when telemetry shows no
   traffic.

### 7.2 Key rotation — do it as part of this, not "later"

Any key that has lived in a `.env` on a laptop, in a chat message, or in a git
history should be considered spent. This migration is the natural moment:

1. Mint a **new** Anthropic key; set it on the new Render service; verify
   `/v1/coach/chat`; then revoke the old key in the Anthropic console.
2. If the Supabase `service_role` key was ever exposed, rotate it in the Supabase
   dashboard — and note that rotating it invalidates it *everywhere*, so update
   the new service before revoking.
3. Write the sequence down as `docs/api/key-rotation.md`. One page. The test of
   the runbook is whether a second person can execute it without asking you.

### 7.3 Rollback

Because §7.1 creates a new service instead of mutating the old one, rollback is a
one-line revert of `eas.json` plus a rebuild. The old service is still live and
still holds the old (working) key until step 7.2 revokes it — which is precisely
why revocation comes last.

---

## 8. Phase 5 — close the loop

- [ ] Update `services/api/config.ts` and `services/api/WellivaApi.ts` header
      comments: they say `/backend-welliva`; they should say `server/`.
- [ ] Update `supabase/README.md` §Security notes: `backend-welliva/.env` →
      `server/.env`.
- [ ] Update `docs/api/README.md` — delete the "lives outside this repository"
      status banner and the §Bringing the backend in-repo section, which this
      document supersedes.
- [ ] Reconcile `docs/api/README.md`'s endpoint table against the real routes.
      The client's view and `docs/architecture/05-api-and-contracts.md` §C
      disagree slightly — 05 lists three endpoints, the client calls five.
      **Writing this reconciliation usually surfaces at least one real
      inconsistency**; treat a mismatch as a bug in one of the two, not a typo.
- [ ] Delete `/backend-welliva` from the developer machine only after the new
      service has served production traffic for a full release cycle.

---

## 9. Definition of done

The migration is complete when **all** of these are true:

- [ ] `server/` is on `main`, with no secret in the working tree or in history
- [ ] `git check-ignore server/.env` matches a rule
- [ ] `npx tsc --noEmit` (app) exits 0 — unchanged
- [ ] `npx vitest run` — unchanged pass count
- [ ] `npx expo export --platform ios` succeeds, bundle size unchanged
- [ ] CI shows **two** green jobs (`verify`, `server`), both required on `main`
- [ ] `curl https://<new-service>/health` returns 200 + version
- [ ] `eas.json` production points at the new service and a production build has
      exercised the coach end to end
- [ ] The Anthropic key has been rotated and the old one revoked
- [ ] `docs/api/key-rotation.md` exists and a second person has followed it once

---

## 10. What this does *not* fix

Bringing the code in-repo makes it reviewable. It does not make it correct, and
it deliberately leaves the remaining §Operations items from
[`README.md`](./README.md) open:

- `GET /health` wired to an uptime monitor
- structured request logging (user id, endpoint, model, tokens, latency, outcome)
- a token-spend dashboard, per day and per active user
- the free-tier cold start itself — mitigated on the client
  ([`services/api/warmup.ts`](../../services/api/warmup.ts)) but only *closed* by
  moving to an always-on tier (~$7/mo)

Those are cheaper to do once the code is in CI, which is the argument for doing
this first.
