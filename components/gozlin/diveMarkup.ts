/**
 * DIVE MARKUP — the three shapes a deep dive is allowed to have.
 *
 * A deliberately tiny parser, not a markdown renderer. The model is told to
 * emit "## Heading", "- bullet" and plain paragraphs
 * (services/gozlin/agent/deepDive.ts), and this understands exactly those and
 * nothing else. Two reasons it stays this small:
 *
 *  · SURFACE AREA. A general markdown renderer brings links, images, tables,
 *    inline HTML and a dozen escaping rules into a sheet that needs headings,
 *    bullets and prose. Every one of those is a way for generated text to
 *    render as something other than text.
 *  · GRACEFUL FAILURE. Anything unrecognised falls through as a paragraph, so
 *    a stray asterisk or a heading the model wrote its own way is a cosmetic
 *    blemish rather than a broken screen.
 *
 * Lines inside a paragraph are JOINED WITH A SPACE rather than kept: a model
 * wrapping its prose at some arbitrary width is not expressing line breaks, and
 * honouring them would ragged-edge the whole panel on a narrow phone.
 */

/** One renderable run of a dive. */
export type DiveBlock =
  | { kind: "heading"; text: string }
  | { kind: "bullet"; text: string }
  | { kind: "para"; text: string };

/**
 * Leading bullet marks, in the forms a model actually produces.
 *
 * The mark must be followed by whitespace OR be the whole line: requiring
 * whitespace alone is what keeps "-5% over the week" as prose, and allowing the
 * bare mark is what stops a stray dangling "-" (the first character of a bullet
 * still being streamed) from rendering as a paragraph containing one hyphen.
 */
const BULLET = /^[-*•·](\s+|$)/;
/** A heading is one or more hashes and a space, or just hashes and text. */
const HEADING = /^#{1,6}\s*/;

export function parseDive(input: string): DiveBlock[] {
  const blocks: DiveBlock[] = [];
  let para: string[] = [];

  const flush = () => {
    if (para.length === 0) return;
    const text = para.join(" ").trim();
    if (text) blocks.push({ kind: "para", text });
    para = [];
  };

  for (const raw of input.split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (line.startsWith("#")) {
      flush();
      const text = line.replace(HEADING, "").trim();
      if (text) blocks.push({ kind: "heading", text });
      continue;
    }
    if (BULLET.test(line)) {
      flush();
      const text = line.replace(BULLET, "").trim();
      if (text) blocks.push({ kind: "bullet", text });
      continue;
    }
    para.push(line);
  }

  flush();
  return blocks;
}
