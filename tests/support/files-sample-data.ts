import { addDays } from "@/lib/dates";
import type { FileEntry } from "@/lib/files/types";

/** A messy small-business folder: copies, odd names, files in the wrong place and a pile on the desktop. */
export function sampleFiles(today: string): FileEntry[] {
  const f = (path: string, size: number, ago: number, hash?: string): FileEntry => ({ path, size, modified: addDays(today, -ago), hash });
  return [
    f("Invoices/Invoice_03-14-2026_Acme.pdf", 52_000, 220, "h-acme"),
    f("Invoices/Invoice_03-14-2026_Acme (1).pdf", 52_000, 90, "h-acme"),
    f("Invoices/Invoice_04-02-2026_Globex.pdf", 48_500, 200, "h-globex"),
    f("Invoices/contract_northwind_2026.pdf", 210_000, 180, "h-nw"),
    f("Invoices/Q3 report FINAL FINAL v2.xlsx", 88_000, 40, "h-q3b"),
    f("Receipts/receipt_staples.jpg", 1_200_000, 150, "h-staples"),
    f("Receipts/Receipt Staples - Copy.jpg", 1_200_000, 30, "h-staples"),
    f("Downloads/W-9_Initech.pdf", 95_000, 120, "h-w9"),
    f("Downloads/W-9_Initech - Copy.pdf", 95_000, 20, "h-w9"),
    f("Downloads/setup_notes.txt", 3_100, 60, "h-notes"),
    f("Desktop/scan_0034 .PDF", 640_000, 14, "h-scan"),
    f("Desktop/IMG_2231.JPG", 3_400_000, 10, "h-img1"),
    f("Desktop/IMG_2232.JPG", 3_380_000, 10, "h-img2"),
    f("Desktop/Q3 report FINAL FINAL v2.xlsx", 87_500, 45, "h-q3a"),
    f("Misc/resume_priya_shah.docx", 41_000, 300, "h-resume"),
    f("Misc/Meeting_Notes_10_05_2026.docx", 22_000, 20, "h-meet"),
    f("Contracts/Lease Agreement 2025.pdf", 380_000, 400, "h-lease"),
    f("Contracts/Lease Agreement 2025.pdf.bak", 380_000, 399, "h-lease2"),
    f("Archive/old photos.zip", 9_800_000, 700, "h-zip"),
    f("Presentations/Sales deck.pptx", 5_600_000, 55, "h-deck"),
  ];
}
