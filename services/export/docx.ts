/**
 * services/export/docx.ts — a small Word (.docx) writer, in plain JS.
 *
 * WHY NOT A LIBRARY. The usual one (`docx` on npm) is over a megabyte, wants
 * Node's Buffer, and would make the app heavier for one button. A .docx file
 * is a zip of a few XML files, and the zip can be "stored" (no compression),
 * which Word, Google Docs, Pages and LibreOffice all open. That is all this is:
 *
 *   [Content_Types].xml   what each part is
 *   _rels/.rels           where the document is
 *   docProps/core.xml     title and date
 *   word/document.xml     the content
 *   word/styles.xml       Title, Heading 1, Heading 2, a plain table style
 *
 * The content is a flat list of blocks (title, heading, paragraph, note,
 * table). Every piece of text is escaped, and characters XML can't hold are
 * dropped, so nothing a person typed can break the file.
 *
 * Pure: bytes in memory, no file system. services/export/saveFile writes them.
 */

export type DocBlock =
  | { kind: "title"; text: string }
  | { kind: "heading"; text: string; level?: 1 | 2 }
  | { kind: "paragraph"; text: string }
  | { kind: "note"; text: string }
  | { kind: "table"; header: string[]; rows: string[][] };

/* ─────────────────────────────── text ─────────────────────────────── */

/**
 * UTF-8 by hand: Hermes' TextEncoder has varied between builds. Written
 * straight into one preallocated buffer (a whole export can run to megabytes,
 * and an array of numbers would be eight times that on a low-end phone).
 *
 * A LONE SURROGATE (half an emoji, from text cut in the wrong place) has no
 * UTF-8 form; written as-is it makes bytes Word rejects as a corrupt file. It
 * becomes U+FFFD, the replacement character, like every standard encoder.
 */
export function utf8(text: string): Uint8Array {
  const out = new Uint8Array(text.length * 3);
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    let c = text.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdfff) {
      const d = i + 1 < text.length ? text.charCodeAt(i + 1) : 0;
      if (c <= 0xdbff && d >= 0xdc00 && d <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
        i++;
      } else {
        c = 0xfffd;
      }
    }
    if (c < 0x80) {
      out[n++] = c;
    } else if (c < 0x800) {
      out[n++] = 0xc0 | (c >> 6);
      out[n++] = 0x80 | (c & 63);
    } else if (c < 0x10000) {
      out[n++] = 0xe0 | (c >> 12);
      out[n++] = 0x80 | ((c >> 6) & 63);
      out[n++] = 0x80 | (c & 63);
    } else {
      // Two UTF-16 units in, four bytes out: still inside the 3-per-unit budget.
      out[n++] = 0xf0 | (c >> 18);
      out[n++] = 0x80 | ((c >> 12) & 63);
      out[n++] = 0x80 | ((c >> 6) & 63);
      out[n++] = 0x80 | (c & 63);
    }
  }
  return out.slice(0, n);
}

/** A control character XML 1.0 can't hold (tab, line feed and carriage return are fine). */
function forbidden(c: number): boolean {
  return c < 0x20 ? c !== 0x9 && c !== 0xa && c !== 0xd : c === 0xfffe || c === 0xffff;
}

/** XML-safe text: escaped, and with the control characters XML 1.0 forbids removed. */
export function xmlText(text: string): string {
  let clean = text;
  let dirty = false;
  for (let i = 0; i < text.length && !dirty; i++) dirty = forbidden(text.charCodeAt(i));
  if (dirty) {
    const kept: string[] = [];
    for (let i = 0; i < text.length; i++) if (!forbidden(text.charCodeAt(i))) kept.push(text[i]);
    clean = kept.join("");
  }
  return clean.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ─────────────────────────────── zip ─────────────────────────────── */

let CRC_TABLE: Uint32Array | null = null;

function crcTable(): Uint32Array {
  if (CRC_TABLE) return CRC_TABLE;
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  CRC_TABLE = t;
  return t;
}

export function crc32(bytes: Uint8Array): number {
  const t = crcTable();
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = t[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** MS-DOS time and date, which is what a zip entry carries. */
function dosStamp(d: Date): { time: number; date: number } {
  const year = Math.max(1980, d.getFullYear());
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/** A "stored" (uncompressed) zip of the given files, in order. */
export function zipStored(files: { name: string; data: Uint8Array }[], when: Date = new Date()): Uint8Array {
  const { time, date } = dosStamp(when);
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const f of files) {
    const name = utf8(f.name);
    const crc = crc32(f.data);
    const size = f.data.length;

    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0x0800, true); // UTF-8 names
    lv.setUint16(8, 0, true); // stored
    lv.setUint16(10, time, true);
    lv.setUint16(12, date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);
    local.set(name, 30);
    parts.push(local, f.data);

    const entry = new Uint8Array(46 + name.length);
    const cv = new DataView(entry.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true); // version made by
    cv.setUint16(6, 20, true); // version needed
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    entry.set(name, 46);
    central.push(entry);

    offset += local.length + size;
  }

  const centralSize = central.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const all = [...parts, ...central, end];
  const out = new Uint8Array(all.reduce((s, p) => s + p.length, 0));
  let at = 0;
  for (const p of all) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/* ─────────────────────────────── word ─────────────────────────────── */

const W_NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

function run(text: string, opts: { bold?: boolean } = {}): string {
  const props = opts.bold ? "<w:rPr><w:b/></w:rPr>" : "";
  // Line breaks inside one piece of text become Word line breaks.
  const lines = text.split("\n").map((l) => `<w:t xml:space="preserve">${xmlText(l)}</w:t>`);
  return `<w:r>${props}${lines.join("<w:br/>")}</w:r>`;
}

function para(text: string, style?: string): string {
  const pPr = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : "";
  return `<w:p>${pPr}${run(text)}</w:p>`;
}

function cell(text: string, header: boolean): string {
  const shade = header ? '<w:shd w:val="clear" w:color="auto" w:fill="EDEDED"/>' : "";
  return `<w:tc><w:tcPr>${shade}</w:tcPr><w:p>${run(text, { bold: header })}</w:p></w:tc>`;
}

function table(header: string[], rows: string[][]): string {
  const width = header.length;
  const grid = header.map(() => "<w:gridCol/>").join("");
  const head = `<w:tr><w:trPr><w:tblHeader/></w:trPr>${header.map((h) => cell(h, true)).join("")}</w:tr>`;
  const body = rows
    .map((r) => {
      const cells = Array.from({ length: width }, (_, i) => cell(r[i] ?? "", false));
      return `<w:tr><w:trPr><w:cantSplit/></w:trPr>${cells.join("")}</w:tr>`;
    })
    .join("");
  // A table is followed by an empty paragraph: Word needs one between two tables.
  return (
    `<w:tbl><w:tblPr><w:tblStyle w:val="DataTable"/><w:tblW w:w="5000" w:type="pct"/></w:tblPr>` +
    `<w:tblGrid>${grid}</w:tblGrid>${head}${body}</w:tbl><w:p/>`
  );
}

function blockXml(b: DocBlock): string {
  switch (b.kind) {
    case "title":
      return para(b.text, "Title");
    case "heading":
      return para(b.text, b.level === 2 ? "Heading2" : "Heading1");
    case "paragraph":
      return para(b.text);
    case "note":
      return para(b.text, "Note");
    case "table":
      return table(b.header, b.rows);
  }
}

function documentXml(blocks: readonly DocBlock[]): string {
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document ${W_NS}><w:body>${blocks.map(blockXml).join("")}` +
    `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>` +
    `<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/>` +
    `</w:sectPr></w:body></w:document>`
  );
}

const STYLES_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<w:styles ${W_NS}>` +
  `<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>` +
  `<w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr></w:rPrDefault>` +
  `<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>` +
  `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>` +
  `<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/>` +
  `<w:pPr><w:spacing w:after="240"/></w:pPr><w:rPr><w:b/><w:sz w:val="44"/><w:szCs w:val="44"/></w:rPr></w:style>` +
  `<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/>` +
  `<w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="360" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr>` +
  `<w:rPr><w:b/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr></w:style>` +
  `<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/>` +
  `<w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="1"/></w:pPr>` +
  `<w:rPr><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>` +
  `<w:style w:type="paragraph" w:styleId="Note"><w:name w:val="Note"/><w:basedOn w:val="Normal"/>` +
  `<w:rPr><w:color w:val="666666"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:style>` +
  `<w:style w:type="table" w:styleId="DataTable"><w:name w:val="Data Table"/><w:tblPr>` +
  `<w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>` +
  `<w:left w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>` +
  `<w:right w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>` +
  `<w:insideV w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/></w:tblBorders>` +
  `<w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/>` +
  `<w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr>` +
  `<w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:style>` +
  `</w:styles>`;

const CONTENT_TYPES_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
  `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>` +
  `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
  `</Types>`;

const ROOT_RELS_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
  `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
  `</Relationships>`;

const DOC_RELS_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
  `</Relationships>`;

function coreXml(title: string, when: Date): string {
  const iso = when.toISOString().replace(/\.\d{3}Z$/, "Z");
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ` +
    `xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ` +
    `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<dc:title>${xmlText(title)}</dc:title><dc:creator>welliva</dc:creator>` +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created>` +
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified>` +
    `</cp:coreProperties>`
  );
}

/** The .docx file's bytes. */
export function buildDocx(title: string, blocks: readonly DocBlock[], when: Date = new Date()): Uint8Array {
  return zipStored(
    [
      { name: "[Content_Types].xml", data: utf8(CONTENT_TYPES_XML) },
      { name: "_rels/.rels", data: utf8(ROOT_RELS_XML) },
      { name: "docProps/core.xml", data: utf8(coreXml(title, when)) },
      { name: "word/document.xml", data: utf8(documentXml(blocks)) },
      { name: "word/_rels/document.xml.rels", data: utf8(DOC_RELS_XML) },
      { name: "word/styles.xml", data: utf8(STYLES_XML) },
    ],
    when,
  );
}

export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
