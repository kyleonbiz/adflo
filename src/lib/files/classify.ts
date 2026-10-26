import { splitName, splitPath } from "./paths";

export type Category = "invoices" | "receipts" | "contracts" | "tax" | "hr" | "images" | "sheets" | "slides" | "archives";

export const TO_SORT = "00 To Sort";
export const DUPLICATES_FOLDER = "_Duplicates (review)";

export const FOLDER_FOR: Record<Category, string> = {
  invoices: "01 Invoices", receipts: "02 Receipts", contracts: "03 Contracts", tax: "04 Tax", hr: "05 HR",
  images: "06 Photos & Images", sheets: "07 Spreadsheets & Reports", slides: "08 Presentations", archives: "09 Archives",
};
export const LABEL_FOR: Record<Category, string> = {
  invoices: "invoice", receipts: "receipt", contracts: "contract", tax: "tax document", hr: "HR document",
  images: "photo or image", sheets: "spreadsheet", slides: "presentation", archives: "archive",
};

/** What a file's own name says it is. Only these count as strong evidence that a file is misplaced. */
const NAME_RULES: [Exclude<Category, "images" | "sheets" | "slides" | "archives">, RegExp][] = [
  ["invoices", /(^|[^a-z0-9])(invoices?|inv[-_ ]?\d+)(?![a-z])/i],
  ["receipts", /(^|[^a-z0-9])receipts?(?![a-z])/i],
  ["contracts", /(^|[^a-z0-9])(contracts?|agreements?|nda|leases?|sow)(?![a-z])/i],
  ["tax", /(^|[^a-z0-9])(tax(es)?|w[-_ ]?[0-9]|1099)(?![a-z0-9])/i],
  ["hr", /(^|[^a-z0-9])(resumes?|cv|payroll|timesheets?|offer[-_ ]letter|employees?|hr)(?![a-z])/i],
];

/** What a folder's name says it holds. */
const FOLDER_RULES: [Category, RegExp][] = [
  ["invoices", /^\W*(\d+\W+)?invoices?$/i],
  ["receipts", /^\W*(\d+\W+)?receipts?$/i],
  ["contracts", /^\W*(\d+\W+)?(contracts?|agreements?|leases?)$/i],
  ["tax", /^\W*(\d+\W+)?(tax(es)?|tax documents?)$/i],
  ["hr", /^\W*(\d+\W+)?(hr|human resources|payroll|employees?)$/i],
  ["images", /^\W*(\d+\W+)?(photos?|pictures?|images?)(\W.*)?$/i],
];

const EXTENSIONS: Record<string, Category> = {
  jpg: "images", jpeg: "images", png: "images", gif: "images", heic: "images", webp: "images", bmp: "images", tif: "images", tiff: "images",
  xls: "sheets", xlsx: "sheets", csv: "sheets", ods: "sheets",
  ppt: "slides", pptx: "slides", key: "slides", odp: "slides",
  zip: "archives", rar: "archives", "7z": "archives", tar: "archives", gz: "archives",
};

/** The category named in a file's name, or null. */
export function categoryFromName(fileName: string): Category | null {
  const { base } = splitName(fileName);
  return NAME_RULES.find(([, re]) => re.test(base))?.[0] ?? null;
}

/** The category a folder path implies (its deepest recognizable folder), or null. */
export function categoryFromFolder(dir: string): Category | null {
  for (const segment of dir.split("/").reverse()) {
    const hit = FOLDER_RULES.find(([, re]) => re.test(segment));
    if (hit) return hit[0];
  }
  return null;
}

/** Where a file belongs in the suggested structure: by name, else by type, else "To Sort". */
export function suggestedFolder(path: string): string {
  const { name } = splitPath(path);
  const cat = categoryFromName(name) ?? EXTENSIONS[splitName(name).ext.toLowerCase()];
  return cat ? FOLDER_FOR[cat] : TO_SORT;
}

/** A file whose name clearly says one thing sitting in a folder that clearly says another. */
export function misplacedCategory(path: string): Category | null {
  const { dir, name } = splitPath(path);
  const named = categoryFromName(name);
  const implied = categoryFromFolder(dir);
  return named && implied && named !== implied ? named : null;
}
