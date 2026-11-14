import { describe, expect, it } from "vitest";
import { buildDocx, crc32, utf8, xmlText, zipStored, type DocBlock } from "../export/docx";
import { buildMyDataBlocks, parseCsv, type MyDataInput } from "../export/myData";
import { displayName, exportFileName } from "../export/names";

/** Read a stored zip back: name → bytes, checking every CRC on the way. */
function unzip(bytes: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const files = new Map<string, Uint8Array>();
  let at = 0;
  while (view.getUint32(at, true) === 0x04034b50) {
    const crc = view.getUint32(at + 14, true);
    const size = view.getUint32(at + 18, true);
    const nameLen = view.getUint16(at + 26, true);
    const extra = view.getUint16(at + 28, true);
    const name = new TextDecoder().decode(bytes.slice(at + 30, at + 30 + nameLen));
    const start = at + 30 + nameLen + extra;
    const data = bytes.slice(start, start + size);
    expect(crc32(data)).toBe(crc);
    files.set(name, data);
    at = start + size;
  }
  // Then the central directory, then the end record pointing back at it.
  const end = bytes.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  expect(view.getUint16(end + 10, true)).toBe(files.size);
  expect(view.getUint32(end + 16, true)).toBe(at);
  return files;
}

const text = (b: Uint8Array) => new TextDecoder().decode(b);

describe("the zip", () => {
  it("round-trips, with correct CRCs", () => {
    const files = unzip(zipStored([{ name: "a.txt", data: utf8("hello") }, { name: "b/c.txt", data: utf8("é ✓ 😀") }]));
    expect(text(files.get("a.txt")!)).toBe("hello");
    expect(text(files.get("b/c.txt")!)).toBe("é ✓ 😀");
  });

  it("crc32 matches the standard check value", () => {
    expect(crc32(utf8("123456789"))).toBe(0xcbf43926);
  });

  it("utf8 matches the platform encoder", () => {
    const s = "kg · 1 200 · naïve · 漢字 · 😀";
    expect([...utf8(s)]).toEqual([...new TextEncoder().encode(s)]);
  });

  it("turns half an emoji into the replacement character, as standard encoders do", () => {
    const emoji = "😀";
    const half = `a${emoji[0]}b${emoji[1]}`;
    expect([...utf8(half)]).toEqual([...new TextEncoder().encode(half)]);
    expect(new TextDecoder("utf-8", { fatal: true }).decode(utf8(half))).toBe("a�b�");
  });
});

describe("the Word file", () => {
  const blocks: DocBlock[] = [
    { kind: "title", text: "Your welliva data" },
    { kind: "heading", text: "Food <& drink>" },
    { kind: "paragraph", text: 'Line one\nLine "two"' },
    { kind: "table", header: ["Date", "What"], rows: [["14 Nov 2026", "Rice & beans"], ["15 Nov 2026"]] },
  ];

  it("has the parts Word needs, and well-formed escaped text", () => {
    const files = unzip(buildDocx("Your welliva data", blocks, new Date(2026, 10, 14, 9, 30)));
    expect([...files.keys()]).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "docProps/core.xml",
      "word/document.xml",
      "word/_rels/document.xml.rels",
      "word/styles.xml",
    ]);
    const doc = text(files.get("word/document.xml")!);
    expect(doc).toContain("Food &lt;&amp; drink&gt;");
    expect(doc).toContain("Rice &amp; beans");
    expect(doc).toContain("<w:br/>");
    // A short row is padded to the header's width.
    expect(doc.split("<w:tc>").length - 1).toBe(6);
    expect(doc).toContain('<w:pStyle w:val="Title"/>');
  });

  it("drops characters XML can't hold", () => {
    expect(xmlText(`a${String.fromCharCode(1)}b${String.fromCharCode(0xb)}c`)).toBe("abc");
  });
});

function input(over: Partial<MyDataInput> = {}): MyDataInput {
  return {
    exportedAt: new Date(2026, 10, 14, 9, 30),
    name: "Ada",
    email: null,
    bio: null,
    goals: { targetWeightKg: 70 },
    bodyLogs: [],
    dietHistory: [],
    meals: [],
    water: [],
    workouts: [],
    effort: [],
    pain: [],
    habits: [],
    moods: [],
    cycle: { status: "off" },
    coach: { preferences: [], constraints: [], episodes: [], conversations: [] },
    ...over,
  };
}

const allText = (blocks: DocBlock[]) =>
  blocks
    .map((b) => (b.kind === "table" ? [...b.header, ...b.rows.flat()].join(" | ") : b.text))
    .join("\n");

describe("what goes in the document", () => {
  it("says so when a section is empty, rather than leaving it out", () => {
    const t = allText(buildMyDataBlocks(input()));
    expect(t).toContain("No weigh-ins logged.");
    expect(t).toContain("No food logged.");
    expect(t).toContain("Cycle tracking is off");
    expect(t).toContain("Goal weight | 70 kg");
  });

  it("lists records with dates as people write them", () => {
    const t = allText(
      buildMyDataBlocks(
        input({
          bodyLogs: [{ date: "2026-11-13", weightKg: 81.25, waistCm: 90 }],
          meals: [{ date: "2026-11-13", slot: "dinner", name: "Jollof rice", kcal: 640, source: "log" }],
          workouts: [
            {
              id: "r1",
              date: "2026-11-12",
              sessionId: "s1",
              sessionLabel: "Full body A",
              exercisesCompleted: 6,
              totalExercises: 6,
              completionPercent: 100,
              durationMinutes: 32,
              completedAt: "2026-11-12T18:00:00Z",
            },
          ],
          effort: [{ date: "2026-11-12", workoutId: "s1", effort: "hard" }],
          pain: [{ runId: "r1", date: "2026-11-12", answer: "pain", areas: ["knee"], at: "x" }],
          moods: [{ date: "2026-11-13", valence: -1 / 3, labels: ["Tired"], createdAt: new Date(2026, 10, 13, 21, 5).getTime() }],
        }),
      ),
    );
    expect(t).toContain("13 Nov 2026 | 81.3 | 90");
    expect(t).toContain("Dinner | Jollof rice | 640 | Logged");
    expect(t).toContain("Full body A | 32 | 100% | Hard");
    expect(t).toContain("Sharp or joint pain | Knee");
    expect(t).toContain("21:05 | Slightly Unpleasant | Tired");
  });

  it("explains a locked cycle log instead of including it", () => {
    expect(allText(buildMyDataBlocks(input({ cycle: { status: "locked" } })))).toContain("Your cycle log is locked");
  });

  it("turns the cycle CSV into a table", () => {
    const csv = 'type,date,end,detail\nperiod,2026-11-01,2026-11-05,"heavy, then light"\n';
    const blocks = buildMyDataBlocks(input({ cycle: { status: "included", csv } }));
    const t = allText(blocks);
    expect(t).toContain("Type | Date | End | Detail");
    expect(t).toContain("period | 1 Nov 2026 | 5 Nov 2026 | heavy, then light");
  });
});

describe("csv", () => {
  it("handles quotes, commas and line breaks", () => {
    expect(parseCsv('a,b\n"x, y","say ""hi"""\r\n')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
    ]);
  });
});

describe("names read back to people", () => {
  it("reads Android and iOS addresses as plain names", () => {
    expect(displayName("content://com.android.externalstorage.documents/tree/primary%3ADownload")).toBe("Download");
    expect(
      displayName(
        "content://com.android.externalstorage.documents/tree/primary%3ADownload/document/primary%3ADownload%2Fwelliva-data-2026-11-14%20(1).docx",
      ),
    ).toBe("welliva-data-2026-11-14 (1).docx");
    expect(displayName("file:///private/var/mobile/Containers/Shared/AppGroup/X/File%20Provider%20Storage/Health/")).toBe(
      "Health",
    );
  });

  it("names the file in lowercase, by day", () => {
    expect(exportFileName("2026-11-14")).toBe("welliva-data-2026-11-14.docx");
  });
});
