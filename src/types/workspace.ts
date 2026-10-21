export type FolderItem = {
  id: string;
  name: string;
  pinned: boolean;
  priority: number;
  parentId?: string;
  depth?: number;
};

export type NoteItem = {
  id: string;
  folderId: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  pinned?: boolean;
  locked?: boolean;
  journalDate?: string;
  priority?: number;
  encryptedPayload?: string;
  size?: 'compact' | 'regular' | 'expanded';
  inContext?: boolean;
  aiGenerated?: boolean;
};

export type SecurityConfig = {
  salt: string;
  verifier: string;
};

export type NoteRevision = {
  id: string;
  noteId: string;
  title: string;
  content: string;
  tags: string[];
  capturedAt: string;
};

export type RetrievalTrace = {
  id: string;
  query: string;
  noteIds: string[];
  scores: number[];
  latencyMs: number;
  answer: string;
  createdAt: string;
};

export type Workspace = {
  folders: FolderItem[];
  notes: NoteItem[];
  trash?: NoteItem[];
  security?: SecurityConfig;
  revisions?: NoteRevision[];
  traces?: RetrievalTrace[];
  syncMode?: 'local' | 'git-backup' | 'encrypted-cloud';
};
