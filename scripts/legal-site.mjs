#!/usr/bin/env node
/**
 * LEGAL SITE — the public copies of the legal documents, rendered from the app.
 *
 *   npm run legal:site       build into .legal-site/ (open index.html to check)
 *   npm run legal:publish    build, then push it to the gh-pages branch
 *
 * Both app stores and Facebook Login refuse to go live without a privacy policy
 * (and, for Facebook, data-deletion instructions) at a public URL. The text
 * users accept in-app lives in constants/legal.ts, so the public copy is
 * GENERATED from that file rather than written twice: a hand-kept copy is
 * exactly the mismatch reviewers look for, and the kind nobody notices.
 *
 * Needs Node's type stripping to import the .ts file — the npm scripts pass
 * `--experimental-strip-types` (Node 22.6+; on by default from Node 23.6).
 *
 * PUBLISHING never touches your checkout. The commit is built with plumbing —
 * a throwaway index, `write-tree`, `commit-tree` — and pushed straight to
 * `refs/heads/gh-pages`, so the working tree, the real index and your local
 * branches are left exactly as they were, uncommitted work included.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, ".legal-site");
const BRANCH = "gh-pages";

const legal = await import("../constants/legal.ts");
const {
  LEGAL_DOCS,
  LEGAL_DOC_ORDER,
  DATA_DELETION_INSTRUCTIONS,
  LEGAL_CONTACT_EMAIL,
  LEGAL_LAST_UPDATED,
  LEGAL_SITE_URL,
} = legal;

// ─────────────────────────────────────────────────────────────────────────────
// Rendering
// ─────────────────────────────────────────────────────────────────────────────

const escape = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Escape, then turn the URLs and email addresses the copy mentions into links.
 * A trailing full stop belongs to the sentence, not the URL.
 */
function inline(text) {
  return escape(text)
    .replace(/https:\/\/[^\s<]+[^\s<.,;:)]/g, (url) => `<a href="${url}">${url}</a>`)
    .replace(
      /(^|[\s(])([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g,
      (_, lead, email) => `${lead}<a href="mailto:${email}">${email}</a>`,
    );
}

/** Every page, in the order the footer lists them. `slug` is the URL folder. */
const PAGES = [
  ...LEGAL_DOC_ORDER.map((id) => ({ slug: id, doc: LEGAL_DOCS[id] })),
  { slug: "data-deletion", doc: DATA_DELETION_INSTRUCTIONS },
];

const STYLE = `
:root {
  color-scheme: light dark;
  --bg: #FBF7F0; --surface: #FFFFFF; --text: #1C1206; --muted: #6B5B45;
  --rule: #E8DDCB; --accent: #8A6410; --mark: #CE9914;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0E0A05; --surface: #17110A; --text: #F3EBDD; --muted: #B5A68F;
    --rule: #2E2415; --accent: #F6CF54; --mark: #F6CF54;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--bg); color: var(--text);
  font: 17px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  -webkit-text-size-adjust: 100%;
}
main, header, footer { max-width: 44rem; margin: 0 auto; padding: 0 16px; }
header { padding-top: 28px; }
.brand { font-weight: 700; font-size: 1.15rem; letter-spacing: -0.01em; color: var(--text); text-decoration: none; }
.brand::before { content: ""; display: inline-block; width: .6em; height: .6em; margin-right: .45em; border-radius: 50%; background: var(--mark); vertical-align: .05em; }
h1 { font-size: 2rem; line-height: 1.2; letter-spacing: -0.02em; margin: 36px 0 8px; }
.summary { color: var(--muted); margin: 0 0 4px; font-size: 1.05rem; }
.updated { color: var(--muted); font-size: .9rem; margin: 0 0 28px; }
h2 { font-size: 1.2rem; margin: 36px 0 8px; padding-top: 20px; border-top: 1px solid var(--rule); }
p, li { overflow-wrap: anywhere; }
ul { padding-left: 1.25rem; }
li { margin: 4px 0; }
a { color: var(--accent); }
.docs { list-style: none; padding: 0; margin: 28px 0; }
.docs li { margin: 0 0 12px; }
.docs a { display: block; padding: 16px 18px; border: 1px solid var(--rule); border-radius: 14px; background: var(--surface); text-decoration: none; color: var(--text); }
.docs strong { display: block; color: var(--accent); }
.docs span { color: var(--muted); font-size: .95rem; }
footer { margin-top: 56px; padding-bottom: 40px; color: var(--muted); font-size: .9rem; border-top: 1px solid var(--rule); padding-top: 20px; }
footer nav a { margin-right: 16px; white-space: nowrap; }
`;

function layout({ title, description, canonical, body }) {
  const nav = PAGES.map(({ slug, doc }) => `<a href="../${slug}/">${escape(doc.title)}</a>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<meta name="description" content="${escape(description)}">
<link rel="canonical" href="${canonical}">
<style>${STYLE}</style>
</head>
<body>
<header><a class="brand" href="${LEGAL_SITE_URL}/">welliva</a></header>
<main>
${body}
</main>
<footer>
<nav>${nav}</nav>
<p>Questions: <a href="mailto:${LEGAL_CONTACT_EMAIL}">${LEGAL_CONTACT_EMAIL}</a></p>
</footer>
</body>
</html>
`;
}

function renderDoc({ slug, doc }) {
  const sections = doc.sections
    .map((s) => {
      const paras = (s.body ?? []).map((p) => `<p>${inline(p)}</p>`).join("\n");
      const bullets = s.bullets?.length
        ? `<ul>\n${s.bullets.map((b) => `<li>${inline(b)}</li>`).join("\n")}\n</ul>`
        : "";
      return `<h2>${escape(s.heading)}</h2>\n${paras}\n${bullets}`;
    })
    .join("\n");
  return layout({
    title: `${doc.title} · welliva`,
    description: doc.summary,
    canonical: `${LEGAL_SITE_URL}/${slug}/`,
    body:
      `<h1>${escape(doc.title)}</h1>\n` +
      `<p class="summary">${inline(doc.summary)}</p>\n` +
      `<p class="updated">Last updated ${escape(LEGAL_LAST_UPDATED)}</p>\n` +
      sections,
  });
}

function renderIndex() {
  const items = PAGES.map(
    ({ slug, doc }) =>
      `<li><a href="${slug}/"><strong>${escape(doc.title)}</strong><span>${escape(doc.summary)}</span></a></li>`,
  ).join("\n");
  // The index lives one level up from the documents, so its footer links must
  // not climb out of the site: rewrite the shared "../slug/" hrefs.
  return layout({
    title: "welliva · Legal",
    description: "welliva's privacy policy, terms of use, medical disclaimer and data deletion instructions.",
    canonical: `${LEGAL_SITE_URL}/`,
    body: `<h1>Legal</h1>\n<p class="summary">The documents behind the welliva app, in full.</p>\n<ul class="docs">\n${items}\n</ul>`,
  }).replace(/href="\.\.\//g, 'href="');
}

function build() {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  // Tell GitHub Pages to serve the files as-is instead of running Jekyll.
  writeFileSync(join(outDir, ".nojekyll"), "");
  writeFileSync(join(outDir, "index.html"), renderIndex());
  for (const page of PAGES) {
    mkdirSync(join(outDir, page.slug), { recursive: true });
    writeFileSync(join(outDir, page.slug, "index.html"), renderDoc(page));
  }
  console.log(`Built ${PAGES.length + 1} pages into ${outDir}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Publishing
// ─────────────────────────────────────────────────────────────────────────────

function git(args, env) {
  return execFileSync("git", args, {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function publish(message) {
  const remoteHead = git(["ls-remote", "origin", `refs/heads/${BRANCH}`]).split(/\s+/)[0] || null;
  let parent = null;
  if (remoteHead) {
    git(["fetch", "--quiet", "origin", `refs/heads/${BRANCH}`]);
    parent = git(["rev-parse", "FETCH_HEAD"]);
  }

  // A throwaway index over .legal-site: nothing the user has staged is touched.
  const indexFile = join(tmpdir(), `welliva-legal-index-${process.pid}`);
  const env = { GIT_INDEX_FILE: indexFile };
  try {
    git(["--work-tree", outDir, "add", "--all", "."], env);
    const tree = git(["write-tree"], env);
    if (parent && git(["rev-parse", `${parent}^{tree}`]) === tree) {
      console.log(`${BRANCH} already matches constants/legal.ts — nothing to publish.`);
      return;
    }
    const commit = git(
      ["commit-tree", tree, ...(parent ? ["-p", parent] : []), "-m", message],
    );
    git(["push", "origin", `${commit}:refs/heads/${BRANCH}`]);
    console.log(`Pushed ${commit.slice(0, 7)} to ${BRANCH}.`);
  } finally {
    rmSync(indexFile, { force: true });
  }

  console.log(`\nLive within a minute or two at:`);
  for (const { slug, doc } of PAGES) console.log(`  ${doc.title.padEnd(18)} ${LEGAL_SITE_URL}/${slug}/`);
  if (!remoteHead) {
    console.log(
      `\nFirst publish: if ${LEGAL_SITE_URL}/ still 404s after a few minutes, turn Pages on once —\n` +
        `GitHub repo -> Settings -> Pages -> Source: Deploy from a branch -> ${BRANCH} / (root).`,
    );
  }
}

build();
if (process.argv.includes("--publish")) {
  const i = process.argv.indexOf("--message");
  publish(i > -1 ? process.argv[i + 1] : "Publish legal pages from constants/legal.ts");
}
