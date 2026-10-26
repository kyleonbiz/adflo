export interface ParsedEmail {
  title: string;
  requester: string;
  description: string;
}

const MAX_TITLE = 120;
const MAX_BODY = 1000;

function senderName(from: string): string {
  const named = /^\s*"?([^"<]+?)"?\s*<[^>]+>\s*$/.exec(from);
  if (named) return named[1].trim();
  return from.replace(/[<>]/g, "").trim();
}

/**
 * Turns a pasted email into a request: Subject becomes the title, From the requester, the body the
 * description. Quoted replies ("> ...", "On ... wrote:", "-----Original Message-----") are dropped.
 * Without headers the first line is the title.
 */
export function parseEmailText(input: string): ParsedEmail {
  const lines = input.replace(/\r\n?/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;

  let subject = "";
  let from = "";
  const start = i;
  while (i < lines.length && /^[A-Za-z-]+:\s?/.test(lines[i]) && lines[i].trim() !== "") {
    const m = /^([A-Za-z-]+):\s*(.*)$/.exec(lines[i])!;
    if (m[1].toLowerCase() === "subject") subject = m[2];
    else if (m[1].toLowerCase() === "from") from = m[2];
    i++;
  }
  const hasHeaders = i > start && (subject !== "" || from !== "");
  if (!hasHeaders) i = start;

  let body = lines.slice(i);
  if (!hasHeaders) {
    const first = body.findIndex((l) => l.trim() !== "");
    subject = first >= 0 ? body[first].trim() : "";
    body = first >= 0 ? body.slice(first + 1) : [];
  }
  const cut = body.findIndex((l) => /^\s*(on .+ wrote:|-{2,}\s*original message\s*-{2,}|from:.+)\s*$/i.test(l) && body.indexOf(l) > 0);
  const kept = (cut >= 0 ? body.slice(0, cut) : body).filter((l) => !l.trimStart().startsWith(">"));

  const title = subject.replace(/^(\s*(re|fwd?)\s*:\s*)+/i, "").trim().slice(0, MAX_TITLE);
  return {
    title,
    requester: senderName(from).slice(0, 80),
    description: kept.join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_BODY),
  };
}
