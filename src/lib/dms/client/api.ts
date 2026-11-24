import type {
  Bootstrap,
  Category,
  BillRead, CertificateRead,
  DocumentDetail,
  DocumentPage,
  DocumentQuery,
  DocumentRecord,
  FileLink,
  Folder,
  Invite,
  Role,
  ShareLinkInfo,
  Team,
} from "../types";

export type ApiMode = "demo" | "dev" | "live";

export interface UploadArgs {
  file: File;
  folderId: string | null;
  category?: Category;
  /** Uploads a new version of this document instead of creating one. */
  documentId?: string;
  onProgress?: (loaded: number, total: number) => void;
  signal?: AbortSignal;
}

export interface DocumentChanges {
  displayName?: string;
  folderId?: string | null;
  starred?: boolean;
  tags?: string[];
  category?: Category;
  expiresAt?: string | null;
}

/** Everything the UI can ask of the backend. Implementations: HTTP (real) and in-browser (demo). */
export interface DmsApi {
  readonly mode: ApiMode;
  readonly capabilities: { share: boolean; team: boolean };
  bootstrap(): Promise<Bootstrap>;
  listDocuments(q: DocumentQuery): Promise<DocumentPage>;
  getDocument(id: string): Promise<DocumentDetail>;
  /** Reads an insurance document as a certificate of insurance (insured, policies, dates). */
  readCertificate(id: string): Promise<CertificateRead>;
  /** Reads an invoice or receipt (who it is from, number, dates, total). */
  readBill(id: string): Promise<BillRead>;
  /** Other documents that look like the same file (same size and name). */
  findDuplicates(id: string): Promise<DocumentRecord[]>;
  uploadFile(args: UploadArgs): Promise<DocumentRecord>;
  updateDocument(id: string, changes: DocumentChanges): Promise<DocumentRecord>;
  deleteDocument(id: string): Promise<void>;
  restoreDocument(id: string): Promise<DocumentRecord>;
  purgeDocument(id: string): Promise<void>;
  getFileLink(
    id: string,
    opts?: { versionNumber?: number; disposition?: "inline" | "attachment" },
  ): Promise<FileLink>;
  createShareLink(id: string, ttlMinutes: number, opts?: { emailTo?: string; message?: string }): Promise<{ url: string; expiresAt: string; emailedTo?: string; emailError?: string }>;
  listShareLinks(id: string): Promise<ShareLinkInfo[]>;
  revokeShareLink(id: string, linkId: string): Promise<void>;
  getTeam(): Promise<Team>;
  inviteMember(email: string, role: Role): Promise<Invite>;
  revokeInvite(inviteId: string): Promise<void>;
  changeMemberRole(userId: string, role: Role): Promise<void>;
  removeMember(userId: string): Promise<void>;
  createFolder(name: string): Promise<Folder>;
  renameFolder(id: string, name: string): Promise<Folder>;
  deleteFolder(id: string): Promise<void>;
}
