import type { Block, TextRun } from "./parse";

/** Who the document comes from: shown at the top of the first page and in the footer of every page. */
export interface Letterhead { name: string; /** Address, phone and email lines. */ lines: string[] }

/** A finished document, ready to lay out as a PDF or an HTML page. Every placeholder is already filled. */
export interface DocumentSpec {
  title: string;
  letterhead: Letterhead;
  /** Label and value pairs shown in a panel under the title, such as who filled it in and when. */
  meta: [label: string, value: string][];
  blocks: Block<TextRun>[];
}
