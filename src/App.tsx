import { ChangeEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  Bold,
  CalendarDays,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Download,
  Eye,
  FileText,
  Folder,
  FolderPlus,
  GitBranch,
  GripVertical,
  Hash,
  Heading1,
  History,
  Italic,
  Link,
  Link2,
  List,
  LockKeyhole,
  Maximize2,
  MessageCircle,
  Minimize2,
  Moon,
  MoreHorizontal,
  Network,
  PanelLeft,
  Pin,
  Plus,
  RotateCcw,
  Save,
  Search,
  Send,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Strikethrough,
  Sun,
  Table2,
  Tag,
  TerminalSquare,
  Trash2,
  Type,
  Upload,
  X,
} from 'lucide-react';
import { RichTextEditor, RichTextEditorHandle } from './components/RichTextEditor';

type FolderItem = { id: string; name: string; pinned: boolean; priority: number; parentId?: string };
type NoteItem = {
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
type SecurityConfig = { salt: string; verifier: string };
type NoteRevision = { id: string; noteId: string; title: string; content: string; tags: string[]; capturedAt: string };
type RetrievalTrace = { id: string; query: string; noteIds: string[]; scores: number[]; latencyMs: number; answer: string; createdAt: string };
type Workspace = {
  folders: FolderItem[];
  notes: NoteItem[];
  trash?: NoteItem[];
  security?: SecurityConfig;
  revisions?: NoteRevision[];
  traces?: RetrievalTrace[];
  syncMode?: 'local' | 'git-backup' | 'encrypted-cloud';
};

const STORAGE_KEY = 'inknote-workspace-v1';
const THEME_KEY = 'inknote-theme';

const seedWorkspace: Workspace = {
  folders: [
    { id: 'inbox', name: 'Inbox', pinned: true, priority: 0 },
    { id: 'projects', name: 'Projects', pinned: true, priority: 1 },
    { id: 'inknote', name: 'Inknote', parentId: 'projects', pinned: false, priority: 0 },
    { id: 'journal', name: 'Journal', pinned: false, priority: 0 },
    { id: 'references', name: 'References', pinned: false, priority: 1 },
  ],
  notes: [
    {
      id: 'welcome',
      folderId: 'inbox',
      title: 'A quieter place to think',
      content: 'Inknote keeps the important things close. Make a folder, write a note, and let the rest stay out of the way.\n\n- [x] Streamline workspace\n- [ ] Write down great ideas\n- [ ] Link thoughts with @references',
      tags: ['welcome'],
      pinned: true,
      createdAt: '2026-10-20T08:00:00.000Z',
      updatedAt: '2026-10-20T08:00:00.000Z',
    },
    {
      id: 'ideas',
      folderId: 'inbox',
      title: 'Ideas worth returning to',
      content: '- [ ] Shape the search experience\n- [ ] Add contextual retrieval\n\nA simple note system should feel like paper: immediate, tactile, and easy to revisit. Search surfaces the right thought before it disappears.',
      tags: ['ideas'],
      createdAt: '2026-10-19T10:30:00.000Z',
      updatedAt: '2026-10-19T10:30:00.000Z',
    },
    {
      id: 'project-brief',
      folderId: 'inknote',
      title: 'Inknote direction',
      content: 'A black-and-white note space with folders, priorities, pins, keyword search, and context-aware retrieval. Keep interactions calm, fluid, and dynamic.\n\nUse @A quieter place to think to connect a note.',
      tags: ['product', 'inknote'],
      createdAt: '2026-10-18T09:00:00.000Z',
      updatedAt: '2026-10-20T07:15:00.000Z',
    },
  ],
};

function getInitialWorkspace(): Workspace {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Workspace;
      if (Array.isArray(parsed.folders) && Array.isArray(parsed.notes)) return parsed;
    }
  } catch {
    // Malformed storage fallback
  }
  return seedWorkspace;
}

function makeId(prefix: string) {
  const value = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return `${prefix}-${value}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
}

function snippet(note: NoteItem) {
  const value = note.content.replace(/\s+/g, ' ').trim();
  return value || 'An empty page.';
}

function scoreNote(note: NoteItem, folderName: string, query: string): number {
  const terms = query.toLowerCase().match(/[a-z0-9]{2,}/g) ?? [];
  if (!terms.length) return 0;
  const title = note.title.toLowerCase();
  const content = note.content.toLowerCase();
  const folder = folderName.toLowerCase();
  const tags = (note.tags ?? []).join(' ').toLowerCase();
  let score = 0;
  for (let i = 0; i < terms.length; i++) {
    const term = terms[i];
    if (title.includes(term)) score += 5;
    if (folder.includes(term)) score += 3;
    if (tags.includes(term)) score += 2;
    if (content.includes(term)) score += 1;
  }
  return score;
}

const semanticMap: Record<string, string[]> = {
  app: ['product', 'project', 'software', 'application'],
  design: ['ui', 'interface', 'visual', 'layout'],
  plan: ['roadmap', 'direction', 'strategy', 'brief'],
  idea: ['concept', 'thought', 'brainstorm'],
  note: ['writing', 'page', 'document'],
};

function conceptTerms(value: string) {
  const raw = value.toLowerCase().match(/[a-z0-9]{2,}/g) ?? [];
  return new Set(raw.flatMap((term) => [term, ...(semanticMap[term] ?? []), ...Object.entries(semanticMap).filter(([, words]) => words.includes(term)).map(([key]) => key)]));
}

function semanticScore(note: NoteItem, folderName: string, query: string): number {
  const exact = scoreNote(note, folderName, query);
  const queryTerms = conceptTerms(query);
  const noteTerms = conceptTerms(`${note.title} ${note.content} ${folderName} ${(note.tags ?? []).join(' ')}`);
  const overlap = [...queryTerms].filter((term) => noteTerms.has(term)).length;
  const coverage = queryTerms.size ? overlap / queryTerms.size : 0;
  return Number(exact) + overlap * 2 + coverage * 6;
}

function downloadFile(fileName: string, content: string, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

// PBKDF2 + AES-GCM Cryptographic operations
const encoder = new TextEncoder();
const bytesToBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const base64ToBytes = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
const cryptoBuffer = (bytes: Uint8Array) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

async function passcodeVerifier(passcode: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(passcode), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: cryptoBuffer(salt), iterations: 210000 }, material, 256);
  return bytesToBase64(new Uint8Array(bits));
}

async function encryptionKey(passcode: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(passcode), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: cryptoBuffer(salt), iterations: 210000 }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

async function encryptNotePayload(note: NoteItem, passcode: string, salt: Uint8Array) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await encryptionKey(passcode, salt);
  const plain = encoder.encode(JSON.stringify({ title: note.title, content: note.content, tags: note.tags ?? [] }));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain);
  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(cipher))}`;
}

async function decryptNotePayload(payload: string, passcode: string, salt: Uint8Array) {
  const [ivValue, cipherValue] = payload.split('.');
  const key = await encryptionKey(passcode, salt);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(ivValue) }, key, base64ToBytes(cipherValue));
  return JSON.parse(new TextDecoder().decode(plain)) as Pick<NoteItem, 'title' | 'content' | 'tags'>;
}

export default function App() {
  const [workspace, setWorkspace] = useState<Workspace>(getInitialWorkspace);
  const [activeFolderId, setActiveFolderId] = useState('inbox');
  const [selectedNoteId, setSelectedNoteId] = useState('welcome');
  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [showTasksOnly, setShowTasksOnly] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Modern Drawer & Overlays
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'assistant' | 'graph' | 'history' | 'sync'>('assistant');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');

  // Note Card States
  const [activeMenuNoteId, setActiveMenuNoteId] = useState<string | null>(null);
  const [previewNoteIds, setPreviewNoteIds] = useState<string[]>([]);
  const [formattingNoteId, setFormattingNoteId] = useState<string | null>(null);
  const [tagDraftNoteId, setTagDraftNoteId] = useState<string | null>(null);
  const [tagDraftText, setTagDraftText] = useState('');

  // AI Assistant State
  const [ask, setAsk] = useState('');
  const [lastQuestion, setLastQuestion] = useState('');
  const [contextMatches, setContextMatches] = useState<NoteItem[]>([]);
  const [contextAnswer, setContextAnswer] = useState('Ask about a topic, plan, or detail. Inknote searches across the notes you have included in context.');

  // Folders & Security
  const [isFolderComposerOpen, setIsFolderComposerOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [unlockedNoteIds, setUnlockedNoteIds] = useState<string[]>([]);
  const [securityDialog, setSecurityDialog] = useState<{ mode: 'setup' | 'unlock'; noteId: string } | null>(null);
  const [pendingLockNoteId, setPendingLockNoteId] = useState<string | null>(null);
  const [passcode, setPasscode] = useState('');
  const [sessionPasscode, setSessionPasscode] = useState('');
  const [securityError, setSecurityError] = useState('');
  const [isSecuring, setIsSecuring] = useState(false);

  // Drag & Mentions
  const [mentionQuery, setMentionQuery] = useState('');
  const [draggedFolderId, setDraggedFolderId] = useState<string | null>(null);
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);
  const [history, setHistory] = useState<Workspace[]>([]);

  // Theme
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem(THEME_KEY) === 'dark' || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  const folderInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const noteEditors = useRef<Record<string, RichTextEditorHandle | null>>({});

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  }, [workspace]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem(THEME_KEY, 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem(THEME_KEY, 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (isFolderComposerOpen) folderInputRef.current?.focus();
  }, [isFolderComposerOpen]);

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.card-menu-dropdown') && !target.closest('.card-menu-trigger')) {
        setActiveMenuNoteId(null);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const commitWorkspace = (next: Workspace) => {
    setHistory((previous) => [...previous.slice(-29), workspace]);
    setWorkspace(next);
  };

  const folders = useMemo(() => {
    const sort = (items: FolderItem[]) => [...items].sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.priority - b.priority);
    const walk = (parentId: string | undefined, depth = 0): Array<FolderItem & { depth: number }> =>
      sort(workspace.folders.filter((folder) => folder.parentId === parentId)).flatMap((folder) => [{ ...folder, depth }, ...walk(folder.id, depth + 1)]);
    return walk(undefined);
  }, [workspace.folders]);

  const activeFolder = workspace.folders.find((folder) => folder.id === activeFolderId);

  const visibleNotes = useMemo(() => {
    let list = activeFolderId === 'all' ? workspace.notes : workspace.notes.filter((note) => note.folderId === activeFolderId);
    if (showTasksOnly) {
      list = list.filter((note) => /- \[ \]/.test(note.content));
    }
    if (tagFilter) {
      list = list.filter((note) => (note.tags ?? []).includes(tagFilter));
    }
    return [...list].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || (a.priority ?? 0) - (b.priority ?? 0) || +new Date(b.updatedAt) - +new Date(a.updatedAt));
  }, [activeFolderId, workspace.notes, showTasksOnly, tagFilter]);

  const selectedNote = workspace.notes.find((note) => note.id === selectedNoteId) ?? visibleNotes[0] ?? workspace.notes[0];
  const contextNotes = useMemo(() => workspace.notes.filter((note) => note.inContext !== false && (!note.locked || unlockedNoteIds.includes(note.id))), [workspace.notes, unlockedNoteIds]);

  const searchResults = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return workspace.notes
      .map((note) => ({ note, score: semanticScore(note, workspace.folders.find((folder) => folder.id === note.folderId)?.name ?? '', normalized) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || +new Date(b.note.updatedAt) - +new Date(a.note.updatedAt))
      .slice(0, 6);
  }, [query, workspace]);

  const selectNote = (note: NoteItem) => {
    if (note.locked && !unlockedNoteIds.includes(note.id)) {
      setSecurityDialog({ mode: 'unlock', noteId: note.id });
      return;
    }
    setSelectedNoteId(note.id);
    setActiveFolderId(note.folderId);
    setQuery('');
  };

  const createFolder = (event: FormEvent) => {
    event.preventDefault();
    const name = folderName.trim();
    if (!name) return;
    const unpinnedPriorities = workspace.folders.filter((folder) => !folder.pinned).map((folder) => folder.priority);
    const parentId = activeFolderId !== 'all' ? activeFolderId : undefined;
    const siblingPriorities = workspace.folders.filter((folder) => folder.parentId === parentId).map((folder) => folder.priority);
    const folder: FolderItem = { id: makeId('folder'), name, parentId, pinned: false, priority: Math.max(-1, ...siblingPriorities, ...unpinnedPriorities) + 1 };
    commitWorkspace({ ...workspace, folders: [...workspace.folders, folder] });
    setActiveFolderId(folder.id);
    setFolderName('');
    setIsFolderComposerOpen(false);
  };

  const createNote = () => {
    const folderId = activeFolderId === 'all' ? folders[0]?.id : activeFolderId;
    if (!folderId) return;
    const now = new Date().toISOString();
    const note: NoteItem = { id: makeId('note'), folderId, title: 'Untitled note', content: '', createdAt: now, updatedAt: now };
    commitWorkspace({ ...workspace, notes: [note, ...workspace.notes] });
    setActiveFolderId(folderId);
    setSelectedNoteId(note.id);
  };

  const updateNote = (id: string, changes: Partial<Pick<NoteItem, 'title' | 'content' | 'size' | 'inContext' | 'tags'>>) => {
    setWorkspace((previous) => {
      const target = previous.notes.find((note) => note.id === id);
      if (!target) return previous;
      const changesContent = changes.title !== undefined || changes.content !== undefined;
      const revision: NoteRevision | null = changesContent
        ? { id: makeId('revision'), noteId: target.id, title: target.title, content: target.content, tags: target.tags ?? [], capturedAt: new Date().toISOString() }
        : null;
      return {
        ...previous,
        notes: previous.notes.map((note) => (note.id === id ? { ...note, ...changes, updatedAt: new Date().toISOString() } : note)),
        revisions: revision ? [...(previous.revisions ?? []), revision].slice(-120) : previous.revisions,
      };
    });
  };

  const deleteNote = (note: NoteItem) => {
    commitWorkspace({
      ...workspace,
      notes: workspace.notes.filter((item) => item.id !== note.id),
      trash: [note, ...(workspace.trash ?? [])],
    });
    if (selectedNoteId === note.id) {
      setSelectedNoteId(visibleNotes.find((item) => item.id !== note.id)?.id ?? '');
    }
  };

  const togglePinFolder = (id: string) => {
    const target = workspace.folders.find((folder) => folder.id === id);
    if (!target) return;
    const nextPinned = !target.pinned;
    const lastPriority = Math.max(-1, ...workspace.folders.filter((folder) => folder.pinned === nextPinned).map((folder) => folder.priority));
    commitWorkspace({
      ...workspace,
      folders: workspace.folders.map((folder) => (folder.id === id ? { ...folder, pinned: nextPinned, priority: lastPriority + 1 } : folder)),
    });
  };

  const moveFolder = (id: string, direction: -1 | 1) => {
    const target = workspace.folders.find((folder) => folder.id === id);
    if (!target) return;
    const group = workspace.folders.filter((folder) => folder.pinned === target.pinned).sort((a, b) => a.priority - b.priority);
    const currentIndex = group.findIndex((folder) => folder.id === id);
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= group.length) return;
    const reordered = [...group];
    [reordered[currentIndex], reordered[nextIndex]] = [reordered[nextIndex], reordered[currentIndex]];
    const priorities = new Map(reordered.map((folder, index) => [folder.id, index]));
    commitWorkspace({
      ...workspace,
      folders: workspace.folders.map((folder) => (priorities.has(folder.id) ? { ...folder, priority: priorities.get(folder.id)! } : folder)),
    });
  };

  const togglePinNote = (note: NoteItem) => {
    commitWorkspace({
      ...workspace,
      notes: workspace.notes.map((item) => (item.id === note.id ? { ...item, pinned: !item.pinned, updatedAt: new Date().toISOString() } : item)),
    });
  };

  const requestToggleNoteLock = (note: NoteItem) => {
    if (note.locked) {
      setSecurityDialog({ mode: 'unlock', noteId: note.id });
      return;
    }
    if (!workspace.security || !sessionPasscode) {
      setPendingLockNoteId(note.id);
      setSecurityDialog({ mode: workspace.security ? 'unlock' : 'setup', noteId: note.id });
      return;
    }
    lockNote(note, sessionPasscode, workspace.security);
  };

  const lockNote = async (note: NoteItem, keyPasscode: string, config: SecurityConfig) => {
    try {
      const encryptedPayload = await encryptNotePayload(note, keyPasscode, base64ToBytes(config.salt));
      commitWorkspace({
        ...workspace,
        notes: workspace.notes.map((item) => (item.id === note.id ? { ...item, title: 'Locked note', content: '', tags: [], encryptedPayload, locked: true, updatedAt: new Date().toISOString() } : item)),
      });
      setUnlockedNoteIds((ids) => ids.filter((id) => id !== note.id));
    } catch {
      setSecurityError('Could not encrypt this note in the current browser.');
    }
  };

  const submitSecurity = async (event: FormEvent) => {
    event.preventDefault();
    if (!securityDialog || passcode.length < 6) {
      setSecurityError('Use at least 6 characters.');
      return;
    }
    setIsSecuring(true);
    setSecurityError('');
    try {
      if (securityDialog.mode === 'setup') {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const verifier = await passcodeVerifier(passcode, salt);
        const config = { salt: bytesToBase64(salt), verifier };
        const note = workspace.notes.find((item) => item.id === securityDialog.noteId);
        if (!note) throw new Error('Missing note');
        const encryptedPayload = await encryptNotePayload(note, passcode, salt);
        commitWorkspace({
          ...workspace,
          security: config,
          notes: workspace.notes.map((item) => (item.id === note.id ? { ...item, title: 'Locked note', content: '', tags: [], encryptedPayload, locked: true, updatedAt: new Date().toISOString() } : item)),
        });
        setSessionPasscode(passcode);
      } else {
        const config = workspace.security;
        if (!config) throw new Error('No passcode configured.');
        const verifier = await passcodeVerifier(passcode, base64ToBytes(config.salt));
        if (verifier !== config.verifier) {
          setSecurityError('Passcode does not match.');
          return;
        }
        setSessionPasscode(passcode);
        setUnlockedNoteIds((ids) => [...new Set([...ids, securityDialog.noteId])]);
        const note = workspace.notes.find((item) => item.id === securityDialog.noteId);
        if (note) {
          if (pendingLockNoteId === note.id && !note.locked) {
            await lockNote(note, passcode, config);
          } else {
            const content = note.encryptedPayload ? await decryptNotePayload(note.encryptedPayload, passcode, base64ToBytes(config.salt)) : null;
            if (content) {
              setWorkspace((previous) => ({
                ...previous,
                notes: previous.notes.map((item) => (item.id === note.id ? { ...item, ...content } : item)),
              }));
            }
          }
          setSelectedNoteId(note.id);
          setActiveFolderId(note.folderId);
        }
      }
      setSecurityDialog(null);
      setPasscode('');
      setPendingLockNoteId(null);
    } catch {
      setSecurityError('Secure storage error.');
    } finally {
      setIsSecuring(false);
    }
  };

  const openDailyJournal = () => {
    const today = dateKey();
    const existing = workspace.notes.find((note) => note.journalDate === today);
    if (existing) {
      selectNote(existing);
      return;
    }
    const journalFolder = workspace.folders.find((folder) => folder.name.toLowerCase() === 'journal') ?? folders[0];
    if (!journalFolder) return;
    const now = new Date().toISOString();
    const note: NoteItem = {
      id: makeId('journal'),
      folderId: journalFolder.id,
      title: `Journal · ${formatDate(now)}`,
      content: `# ${formatDate(now)}\n\nWhat is on your mind today?`,
      tags: ['journal'],
      journalDate: today,
      createdAt: now,
      updatedAt: now,
    };
    commitWorkspace({ ...workspace, notes: [note, ...workspace.notes] });
    selectNote(note);
  };

  const exportNote = (note: NoteItem) => {
    downloadFile(
      `${(note.title || 'untitled-note').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'note'}.md`,
      `# ${note.title || 'Untitled note'}\n\n${note.content}`,
      'text/markdown;charset=utf-8'
    );
  };

  const exportWorkspace = () => {
    downloadFile('inknote-backup.json', JSON.stringify(workspace, null, 2), 'application/json;charset=utf-8');
  };

  const enableGitBackup = () => {
    commitWorkspace({ ...workspace, syncMode: 'git-backup' });
    exportWorkspace();
  };

  const importWorkspace = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(String(reader.result)) as Workspace;
        if (!Array.isArray(imported.folders) || !Array.isArray(imported.notes)) throw new Error('Invalid Inknote backup');
        commitWorkspace({ ...imported, trash: imported.trash ?? [] });
        setActiveFolderId(imported.folders[0]?.id ?? 'all');
        setSelectedNoteId(imported.notes[0]?.id ?? '');
      } catch {
        window.alert('That file is not a valid Inknote backup.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setWorkspace(previous);
    setHistory((items) => items.slice(0, -1));
  };

  // Note checklist toggling
  const toggleChecklistItem = (note: NoteItem, lineIndex: number) => {
    const lines = note.content.split('\n');
    lines[lineIndex] = lines[lineIndex].startsWith('- [x]') ? lines[lineIndex].replace('- [x]', '- [ ]') : lines[lineIndex].replace('- [ ]', '- [x]');
    updateNote(note.id, { content: lines.join('\n') });
  };

  const addTagToNote = (noteId: string) => {
    if (!tagDraftText.trim()) return;
    const cleanTag = tagDraftText.trim().replace(/^#/, '');
    const note = workspace.notes.find((n) => n.id === noteId);
    if (!note) return;
    const currentTags = note.tags ?? [];
    if (!currentTags.includes(cleanTag)) {
      updateNote(noteId, { tags: [...currentTags, cleanTag] });
    }
    setTagDraftText('');
    setTagDraftNoteId(null);
  };

  const removeTagFromNote = (noteId: string, tagToRemove: string) => {
    const note = workspace.notes.find((n) => n.id === noteId);
    if (!note) return;
    updateNote(noteId, { tags: (note.tags ?? []).filter((t) => t !== tagToRemove) });
  };

  const insertMention = (targetNote: NoteItem, sourceNoteId: string) => {
    const editor = noteEditors.current[sourceNoteId];
    if (editor) {
      editor.insertText(`@${targetNote.title} `);
    } else {
      const note = workspace.notes.find((n) => n.id === sourceNoteId);
      if (!note) return;
      const updated = note.content.replace(/@([^@\n]*)$/, `@${targetNote.title}`);
      updateNote(sourceNoteId, { content: updated });
    }
    setMentionQuery('');
  };

  // AI Ask & Context
  const askInknote = (event: FormEvent) => {
    event.preventDefault();
    const question = ask.trim();
    if (!question) return;
    setLastQuestion(question);
    const startedAt = performance.now();
    const scored = contextNotes
      .map((note) => ({ note, score: semanticScore(note, workspace.folders.find((folder) => folder.id === note.folderId)?.name ?? '', question) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ note }) => note);
    setContextMatches(scored);
    const answer = scored.length
      ? `Grounded in ${scored.length} referenced ${scored.length === 1 ? 'note' : 'notes'}: ${scored.map((note) => `“${snippet(note).slice(0, 110)}${snippet(note).length > 110 ? '…' : ''}”`).join(' ')}`
      : contextNotes.length
      ? 'No direct matches found in currently included notes. Try different keywords or include more notes in context.'
      : 'No notes are currently included in AI context.';
    setContextAnswer(answer);
    const byId = new Map(contextNotes.map((note) => [note.id, semanticScore(note, workspace.folders.find((folder) => folder.id === note.folderId)?.name ?? '', question)]));
    setWorkspace((previous) => ({
      ...previous,
      traces: [
        ...(previous.traces ?? []),
        {
          id: makeId('trace'),
          query: question,
          noteIds: scored.map((note) => note.id),
          scores: scored.map((note) => byId.get(note.id) ?? 0),
          latencyMs: Math.round(performance.now() - startedAt),
          answer,
          createdAt: new Date().toISOString(),
        },
      ].slice(-100),
    }));
    setAsk('');
  };

  const saveContextAnswer = () => {
    if (!contextMatches.length) return;
    const now = new Date().toISOString();
    const note: NoteItem = {
      id: makeId('answer'),
      folderId: activeFolderId === 'all' ? contextMatches[0].folderId : activeFolderId,
      title: lastQuestion || 'Saved context answer',
      content: `${contextAnswer}\n\n## Citations\n${contextMatches.map((item, index) => `${index + 1}. @${item.title}`).join('\n')}`,
      tags: ['ai-answer'],
      aiGenerated: true,
      createdAt: now,
      updatedAt: now,
    };
    commitWorkspace({ ...workspace, notes: [note, ...workspace.notes] });
    setActiveFolderId(note.folderId);
    setSelectedNoteId(note.id);
  };

  // Graph backlinks
  const backlinks = useMemo(() => {
    if (!selectedNote) return [];
    return workspace.notes.filter((note) => note.id !== selectedNote.id && note.content.toLowerCase().includes(`@${selectedNote.title}`.toLowerCase()));
  }, [selectedNote, workspace.notes]);

  const selectedRevisions = useMemo(() => {
    if (!selectedNote) return [];
    return [...(workspace.revisions ?? [])].filter((revision) => revision.noteId === selectedNote.id).slice(-15).reverse();
  }, [workspace.revisions, selectedNote]);

  const restoreRevision = (revision: NoteRevision) => {
    updateNote(revision.noteId, { title: revision.title, content: revision.content });
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        setCommandQuery('');
      }
      if (event.key === 'Escape') {
        setIsCommandPaletteOpen(false);
        setIsDrawerOpen(false);
        setActiveMenuNoteId(null);
      }
      if (modifier && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        createNote();
      }
      if (modifier && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        undo();
      }
      if (modifier && event.shiftKey && event.key.toLowerCase() === 'j') {
        event.preventDefault();
        openDailyJournal();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [history, workspace, activeFolderId]);

  const commandItems = [
    { label: 'Create new note', shortcut: '⌘N', action: createNote },
    { label: 'Open today’s journal', shortcut: '⌘⇧J', action: openDailyJournal },
    { label: 'Ask Inknote AI', shortcut: '', action: () => { setIsDrawerOpen(true); setDrawerTab('assistant'); } },
    { label: 'View Knowledge Graph', shortcut: '', action: () => { setIsDrawerOpen(true); setDrawerTab('graph'); } },
    { label: 'Version History', shortcut: '', action: () => { setIsDrawerOpen(true); setDrawerTab('history'); } },
    { label: 'Export backup (.json)', shortcut: '', action: exportWorkspace },
    { label: 'Toggle dark mode', shortcut: '', action: () => setIsDarkMode((prev) => !prev) },
  ];

  const filteredCommands = commandItems.filter((item) => item.label.toLowerCase().includes(commandQuery.toLowerCase()));

  // Reordering
  const reorderFolder = (overId: string) => {
    if (!draggedFolderId || draggedFolderId === overId) return;
    const dragged = workspace.folders.find((folder) => folder.id === draggedFolderId);
    const over = workspace.folders.find((folder) => folder.id === overId);
    if (!dragged || !over || dragged.parentId !== over.parentId) return;
    const siblings = workspace.folders.filter((folder) => folder.parentId === dragged.parentId).sort((a, b) => a.priority - b.priority).filter((folder) => folder.id !== dragged.id);
    siblings.splice(siblings.findIndex((folder) => folder.id === over.id), 0, dragged);
    const priorities = new Map(siblings.map((folder, index) => [folder.id, index]));
    commitWorkspace({ ...workspace, folders: workspace.folders.map((folder) => (priorities.has(folder.id) ? { ...folder, priority: priorities.get(folder.id)! } : folder)) });
  };

  const reorderNote = (overId: string) => {
    if (!draggedNoteId || draggedNoteId === overId) return;
    const dragged = workspace.notes.find((note) => note.id === draggedNoteId);
    const over = workspace.notes.find((note) => note.id === overId);
    if (!dragged || !over || dragged.folderId !== over.folderId) return;
    const siblings = workspace.notes.filter((note) => note.folderId === dragged.folderId).sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0)).filter((note) => note.id !== dragged.id);
    siblings.splice(siblings.findIndex((note) => note.id === over.id), 0, dragged);
    const priorities = new Map(siblings.map((note, index) => [note.id, index]));
    commitWorkspace({ ...workspace, notes: workspace.notes.map((note) => (priorities.has(note.id) ? { ...note, priority: priorities.get(note.id)! } : note)) });
  };

  const mentionSuggestions = useMemo(() => {
    if (!mentionQuery) return [];
    return workspace.notes.filter((note) => note.title.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 5);
  }, [mentionQuery, workspace.notes]);

  return (
    <main className="inknote-shell">
      {/* Sleek Modern Collapsible Sidebar */}
      <aside className={`inknote-sidebar ${isSidebarOpen ? '' : 'is-collapsed'}`}>
        <div className="sidebar-topline">
          <div className="wordmark">
            <span className="wordmark-mark">I</span>
            <span>Inknote</span>
          </div>
          <button className="icon-button" onClick={() => setIsSidebarOpen(false)} aria-label="Collapse sidebar" title="Collapse sidebar">
            <PanelLeft size={16} />
          </button>
        </div>

        {/* Global Navigation Links */}
        <div className="sidebar-nav-group">
          <button className={`nav-item ${activeFolderId === 'all' && !showTasksOnly ? 'is-active' : ''}`} onClick={() => { setActiveFolderId('all'); setShowTasksOnly(false); setTagFilter(null); }}>
            <Archive size={16} />
            <span>All notes</span>
            <b>{workspace.notes.length}</b>
          </button>
          <button className={`nav-item ${showTasksOnly ? 'is-active' : ''}`} onClick={() => { setShowTasksOnly((prev) => !prev); setTagFilter(null); }}>
            <CheckSquare size={16} />
            <span>Actionable tasks</span>
            <b>{workspace.notes.filter((n) => /- \[ \]/.test(n.content)).length}</b>
          </button>
          <button className="nav-item" onClick={openDailyJournal}>
            <CalendarDays size={16} />
            <span>Today’s journal</span>
          </button>
        </div>

        {/* Folders Section */}
        <div className="folder-label-row">
          <span>Folders</span>
          <button className="tiny-action" onClick={() => setIsFolderComposerOpen((prev) => !prev)} aria-label="Add folder" title="New folder">
            <FolderPlus size={15} />
          </button>
        </div>

        {isFolderComposerOpen && (
          <form className="folder-composer" onSubmit={createFolder}>
            <Folder size={14} className="text-muted" />
            <input
              ref={folderInputRef}
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') setIsFolderComposerOpen(false); }}
              placeholder="Folder name..."
            />
            <button type="submit" className="tiny-action" aria-label="Save folder">
              <Plus size={14} />
            </button>
          </form>
        )}

        <nav className="folder-list" aria-label="Folders list">
          {folders.map((folder) => {
            const count = workspace.notes.filter((note) => note.folderId === folder.id).length;
            const isActive = activeFolderId === folder.id && !showTasksOnly;
            return (
              <div
                key={folder.id}
                className={`folder-row ${isActive ? 'is-active' : ''}`}
                draggable
                onDragStart={() => setDraggedFolderId(folder.id)}
                onDragEnd={() => setDraggedFolderId(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => reorderFolder(folder.id)}
                style={{ paddingLeft: `${6 + folder.depth * 14}px` }}
              >
                <button className="folder-select" onClick={() => { setActiveFolderId(folder.id); setShowTasksOnly(false); setTagFilter(null); }}>
                  <Folder size={15} fill={isActive ? 'currentColor' : 'none'} />
                  <span>{folder.name}</span>
                  <em>{count}</em>
                </button>
                <div className="folder-tools">
                  <button onClick={() => togglePinFolder(folder.id)} title={folder.pinned ? 'Unpin' : 'Pin'}>
                    <Pin size={12} fill={folder.pinned ? 'currentColor' : 'none'} />
                  </button>
                  <button onClick={() => moveFolder(folder.id, -1)} title="Move up">
                    <ArrowUp size={12} />
                  </button>
                  <button onClick={() => moveFolder(folder.id, 1)} title="Move down">
                    <ArrowDown size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </nav>

        {/* Sidebar Footer with Theme Toggle */}
        <div className="sidebar-footer">
          <button className="icon-button" onClick={() => setIsDarkMode((prev) => !prev)} title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button className="icon-button" onClick={() => { setIsDrawerOpen(true); setDrawerTab('sync'); }} title="Workspace settings & sync">
            <SlidersHorizontal size={16} />
          </button>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <section className="inknote-workspace">
        {/* Sticky Modern Topbar */}
        <header className="workspace-topbar">
          <div className="topbar-left">
            {!isSidebarOpen && (
              <button className="icon-button" onClick={() => setIsSidebarOpen(true)} aria-label="Open sidebar" title="Open sidebar">
                <PanelLeft size={17} />
              </button>
            )}
            <div className="topbar-breadcrumbs">
              <span className="eyebrow">{activeFolderId === 'all' ? 'Library' : activeFolder?.pinned ? 'Pinned Folder' : 'Folder'}</span>
              <h1>{showTasksOnly ? 'Actionable Tasks' : tagFilter ? `#${tagFilter}` : activeFolderId === 'all' ? 'All Notes' : activeFolder?.name ?? 'Notes'}</h1>
            </div>
          </div>

          {/* Unified Search & Quick Command Palette Bar */}
          <div className="topbar-center">
            <div className="search-bar">
              <Search size={16} className="text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search notes or ask a question..."
                onFocus={() => { if (!query) setIsCommandPaletteOpen(true); }}
              />
              {query ? (
                <button className="tiny-action" onClick={() => setQuery('')}>
                  <X size={14} />
                </button>
              ) : (
                <span className="kbd-shortcut">⌘K</span>
              )}
            </div>

            {/* Quick Search Popover */}
            {query.trim().length > 0 && searchResults.length > 0 && (
              <div className="search-popover">
                {searchResults.map(({ note }) => (
                  <button key={note.id} className="search-popover-item" onClick={() => selectNote(note)}>
                    <FileText size={16} className="text-muted" style={{ marginTop: '2px' }} />
                    <div>
                      <b>{note.title || 'Untitled note'}</b>
                      <small>{workspace.folders.find((f) => f.id === note.folderId)?.name} · {snippet(note).slice(0, 80)}</small>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Topbar Actions */}
          <div className="topbar-right">
            <button
              className="icon-button"
              onClick={undo}
              disabled={!history.length}
              title="Undo (Ctrl+Z)"
              aria-label="Undo"
            >
              <RotateCcw size={16} />
            </button>
            <button className="btn-primary" onClick={createNote}>
              <Plus size={16} />
              <span>New note</span>
            </button>
          </div>
        </header>

        {/* Workspace Content */}
        <div className="workspace-content">
          {/* Tag Filter Reset Bar if active */}
          {tagFilter && (
            <div className="content-filter-row">
              <div className="filter-left">
                <span>Filtering by:</span>
                <span className="tag-pill" style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}>
                  #{tagFilter}
                </span>
              </div>
              <button className="btn-secondary" style={{ height: '28px', fontSize: '11px', padding: '0 8px' }} onClick={() => setTagFilter(null)}>
                Clear filter
              </button>
            </div>
          )}

          {/* Notes Grid */}
          <section className="note-grid" aria-label="Notes">
            {visibleNotes.length > 0 ? (
              visibleNotes.map((note) => {
                const isLocked = note.locked && !unlockedNoteIds.includes(note.id);
                const isPreviewing = previewNoteIds.includes(note.id);
                const isFormatting = formattingNoteId === note.id;
                const folder = workspace.folders.find((f) => f.id === note.folderId);
                const isMenuOpen = activeMenuNoteId === note.id;

                return (
                  <article
                    key={note.id}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => reorderNote(note.id)}
                    className={`note-card note-size-${note.size ?? 'regular'} ${selectedNoteId === note.id ? 'is-selected' : ''}`}
                    onClick={() => {
                      if (!isLocked) setSelectedNoteId(note.id);
                    }}
                  >
                    {/* Clean Minimalist Card Topbar */}
                    <div className="card-topbar">
                      <div className="card-badges">
                        <div
                          className="card-drag-handle"
                          draggable
                          onDragStart={(e) => {
                            e.stopPropagation();
                            setDraggedNoteId(note.id);
                          }}
                          onDragEnd={() => setDraggedNoteId(null)}
                          title="Drag to reorder note"
                        >
                          <GripVertical size={13} />
                        </div>
                        <span className="card-folder-badge">
                          <Folder size={12} />
                          {folder?.name}
                        </span>
                        {note.inContext !== false && (
                          <span className="card-status-dot" title="Included in Ask Inknote context" />
                        )}
                        {note.locked && (
                          <span title="Protected note">
                            <Shield size={12} className="text-muted" />
                          </span>
                        )}
                      </div>

                      {/* Card Actions: Pin & Overflow Menu ONLY */}
                      <div className="card-actions-compact">
                        <button
                          className={`card-btn ${note.pinned ? 'is-pinned' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePinNote(note);
                          }}
                          title={note.pinned ? 'Unpin note' : 'Pin note to top'}
                        >
                          <Pin size={14} fill={note.pinned ? 'currentColor' : 'none'} />
                        </button>
                        <button
                          className="card-btn card-menu-trigger"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuNoteId(isMenuOpen ? null : note.id);
                          }}
                          title="Note options"
                        >
                          <MoreHorizontal size={15} />
                        </button>
                      </div>

                      {/* Dropdown Menu */}
                      {isMenuOpen && (
                        <div className="card-menu-dropdown" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="dropdown-item"
                            onClick={() => {
                              setPreviewNoteIds((ids) => (ids.includes(note.id) ? ids.filter((id) => id !== note.id) : [...ids, note.id]));
                              setActiveMenuNoteId(null);
                            }}
                          >
                            <Eye size={14} />
                            <span>{isPreviewing ? 'Edit content' : 'Preview markdown'}</span>
                          </button>
                          <button
                            className="dropdown-item"
                            onClick={() => {
                              setFormattingNoteId((id) => (id === note.id ? null : note.id));
                              setActiveMenuNoteId(null);
                            }}
                          >
                            <Type size={14} />
                            <span>{isFormatting ? 'Hide formatting bar' : 'Writing tools'}</span>
                          </button>
                          <button
                            className="dropdown-item"
                            onClick={() => {
                              updateNote(note.id, { inContext: note.inContext === false });
                              setActiveMenuNoteId(null);
                            }}
                          >
                            <CircleDot size={14} />
                            <span>{note.inContext !== false ? 'Exclude from AI context' : 'Include in AI context'}</span>
                          </button>
                          <div className="dropdown-divider" />
                          <button
                            className="dropdown-item"
                            onClick={() => {
                              updateNote(note.id, { size: note.size === 'compact' ? 'regular' : 'compact' });
                              setActiveMenuNoteId(null);
                            }}
                          >
                            <Minimize2 size={14} />
                            <span>Compact size</span>
                          </button>
                          <button
                            className="dropdown-item"
                            onClick={() => {
                              updateNote(note.id, { size: note.size === 'expanded' ? 'regular' : 'expanded' });
                              setActiveMenuNoteId(null);
                            }}
                          >
                            <Maximize2 size={14} />
                            <span>Expanded size</span>
                          </button>
                          <div className="dropdown-divider" />
                          <button
                            className="dropdown-item"
                            onClick={() => {
                              requestToggleNoteLock(note);
                              setActiveMenuNoteId(null);
                            }}
                          >
                            <Shield size={14} />
                            <span>{note.locked ? 'Unlock note' : 'Lock with passcode'}</span>
                          </button>
                          <button
                            className="dropdown-item"
                            onClick={() => {
                              exportNote(note);
                              setActiveMenuNoteId(null);
                            }}
                          >
                            <Download size={14} />
                            <span>Export as Markdown</span>
                          </button>
                          <div className="dropdown-divider" />
                          <button
                            className="dropdown-item is-danger"
                            onClick={() => {
                              deleteNote(note);
                              setActiveMenuNoteId(null);
                            }}
                          >
                            <Trash2 size={14} />
                            <span>Delete note</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Card Content or Locked Screen */}
                    {isLocked ? (
                      <div className="card-locked-state">
                        <LockKeyhole size={24} className="text-muted" />
                        <strong>Protected note</strong>
                        <small>Enter your passcode to read or edit.</small>
                        <button
                          className="btn-primary"
                          style={{ height: '30px', fontSize: '11px', marginTop: '6px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSecurityDialog({ mode: 'unlock', noteId: note.id });
                          }}
                        >
                          Unlock
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          className="card-title-field"
                          value={note.title}
                          onFocus={() => setSelectedNoteId(note.id)}
                          onChange={(e) => updateNote(note.id, { title: e.target.value })}
                          placeholder="Untitled note"
                        />

                        {/* Floating Format Capsule Bar */}
                        {isFormatting && (
                          <div className="floating-format-bar" onClick={(e) => e.stopPropagation()}>
                            <button
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => noteEditors.current[note.id]?.applyFormat('heading')}
                              title="Heading"
                            >
                              <Heading1 size={13} />
                            </button>
                            <button
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => noteEditors.current[note.id]?.applyFormat('bullet')}
                              title="Bullet list"
                            >
                              <List size={13} />
                            </button>
                            <button
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => noteEditors.current[note.id]?.applyFormat('checklist')}
                              title="Checklist"
                            >
                              <CheckSquare size={13} />
                            </button>
                            <i />
                            <button
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => noteEditors.current[note.id]?.applyFormat('bold')}
                              title="Bold"
                            >
                              <Bold size={13} />
                            </button>
                            <button
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => noteEditors.current[note.id]?.applyFormat('italic')}
                              title="Italic"
                            >
                              <Italic size={13} />
                            </button>
                            <button
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => noteEditors.current[note.id]?.applyFormat('strikethrough')}
                              title="Strikethrough"
                            >
                              <Strikethrough size={13} />
                            </button>
                            <button
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => noteEditors.current[note.id]?.applyFormat('link')}
                              title="Link"
                            >
                              <Link2 size={13} />
                            </button>
                            <button
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => noteEditors.current[note.id]?.applyFormat('table')}
                              title="Table"
                            >
                              <Table2 size={13} />
                            </button>
                            <i />
                            <button
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => setFormattingNoteId(null)}
                              title="Close formatting bar"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        )}

                        {/* Editor or Markdown View */}
                        <div className="card-editor-area">
                          {isPreviewing ? (
                            <div className="card-markdown-preview">
                              {note.content.split('\n').map((line, lineIndex) =>
                                line.startsWith('- [') ? (
                                  <button
                                    key={`${line}-${lineIndex}`}
                                    className={`checkline ${line.startsWith('- [x]') ? 'is-complete' : ''}`}
                                    onClick={() => toggleChecklistItem(note, lineIndex)}
                                  >
                                    {line.startsWith('- [x]') ? <CheckSquare size={14} /> : <Check size={14} className="opacity-40" />}
                                    <span>{line.slice(6)}</span>
                                  </button>
                                ) : (
                                  <p key={`${line}-${lineIndex}`} className={line.startsWith('#') ? 'headingline' : ''}>
                                    {line}
                                  </p>
                                )
                              )}
                            </div>
                          ) : (
                            <>
                              <RichTextEditor
                                ref={(el) => {
                                  noteEditors.current[note.id] = el;
                                }}
                                content={note.content}
                                noteId={note.id}
                                placeholder="Start writing... Type @ to reference other notes."
                                onFocus={() => setSelectedNoteId(note.id)}
                                onChange={(newContent) => {
                                  setSelectedNoteId(note.id);
                                  updateNote(note.id, { content: newContent });
                                }}
                                onMentionQuery={(query) => {
                                  setMentionQuery(query ?? '');
                                }}
                              />
                              {selectedNoteId === note.id && mentionSuggestions.length > 0 && (
                                <div className="search-popover" style={{ top: 'auto', bottom: '10px' }}>
                                  {mentionSuggestions.map((suggestion) => (
                                    <button
                                      key={suggestion.id}
                                      className="search-popover-item"
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        insertMention(suggestion, note.id);
                                      }}
                                    >
                                      <Link size={13} className="text-muted" />
                                      <b>{suggestion.title}</b>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {/* Card Tags and Footer */}
                        <div className="card-footer">
                          <div className="card-tags-list">
                            {(note.tags ?? []).map((tag) => (
                              <span
                                key={tag}
                                className="tag-pill"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTagFilter(tagFilter === tag ? null : tag);
                                }}
                                title="Filter by tag"
                              >
                                #{tag}
                                <X
                                  size={10}
                                  style={{ marginLeft: '2px', cursor: 'pointer' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeTagFromNote(note.id, tag);
                                  }}
                                />
                              </span>
                            ))}
                            {tagDraftNoteId === note.id ? (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }} onClick={(e) => e.stopPropagation()}>
                                <input
                                  autoFocus
                                  style={{ width: '60px', fontSize: '10px', padding: '1px 4px', border: '1px solid var(--border-subtle)', borderRadius: '4px', background: 'transparent' }}
                                  placeholder="tag"
                                  value={tagDraftText}
                                  onChange={(e) => setTagDraftText(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') addTagToNote(note.id);
                                    if (e.key === 'Escape') setTagDraftNoteId(null);
                                  }}
                                />
                                <button className="tiny-action" style={{ width: '18px', height: '18px' }} onClick={() => addTagToNote(note.id)}>
                                  <Check size={10} />
                                </button>
                              </div>
                            ) : (
                              <button
                                className="tag-pill"
                                style={{ border: '1px dashed var(--border-subtle)', background: 'transparent' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTagDraftNoteId(note.id);
                                  setTagDraftText('');
                                }}
                              >
                                + Tag
                              </button>
                            )}
                          </div>
                          <span className="card-date">{formatDate(note.updatedAt)}</span>
                        </div>
                      </>
                    )}
                  </article>
                );
              })
            ) : (
              <div className="empty-state">
                <FileText size={32} className="text-muted" />
                <strong>No notes in this folder</strong>
                <p>Create your first thought or choose another folder from the sidebar.</p>
                <button className="btn-primary" onClick={createNote}>
                  <Plus size={16} />
                  <span>Create note</span>
                </button>
              </div>
            )}
          </section>
        </div>

        {/* Floating Utility Pill Trigger (Bottom Right) */}
        <div className="floating-dock-pill">
          <button
            className={`dock-pill-btn ${isDrawerOpen && drawerTab === 'assistant' ? 'is-active' : ''}`}
            onClick={() => {
              setIsDrawerOpen(true);
              setDrawerTab('assistant');
            }}
          >
            <Sparkles size={15} />
            <span>Ask Inknote</span>
            <span className="dock-pill-badge">{contextNotes.length}</span>
          </button>
          <div style={{ width: '1px', height: '18px', background: 'var(--border-subtle)' }} />
          <button
            className={`dock-pill-btn ${isDrawerOpen && drawerTab !== 'assistant' ? 'is-active' : ''}`}
            onClick={() => {
              setIsDrawerOpen(true);
              setDrawerTab('graph');
            }}
          >
            <Network size={15} />
            <span>Graph & Tools</span>
          </button>
        </div>

        {/* Dynamic Slide-Over Utility Drawer */}
        {isDrawerOpen && (
          <>
            <div className="utility-slideover-backdrop" onClick={() => setIsDrawerOpen(false)} />
            <aside className="utility-slideover" role="dialog" aria-modal="true" aria-label="Inknote Tools Drawer">
              <div className="slideover-header">
                <div className="slideover-tabs">
                  <button
                    className={`slideover-tab ${drawerTab === 'assistant' ? 'is-active' : ''}`}
                    onClick={() => setDrawerTab('assistant')}
                  >
                    AI Assistant
                  </button>
                  <button
                    className={`slideover-tab ${drawerTab === 'graph' ? 'is-active' : ''}`}
                    onClick={() => setDrawerTab('graph')}
                  >
                    Graph
                  </button>
                  <button
                    className={`slideover-tab ${drawerTab === 'history' ? 'is-active' : ''}`}
                    onClick={() => setDrawerTab('history')}
                  >
                    History
                  </button>
                  <button
                    className={`slideover-tab ${drawerTab === 'sync' ? 'is-active' : ''}`}
                    onClick={() => setDrawerTab('sync')}
                  >
                    Sync
                  </button>
                </div>
                <button className="icon-button" onClick={() => setIsDrawerOpen(false)} aria-label="Close drawer">
                  <X size={16} />
                </button>
              </div>

              <div className="slideover-content">
                {drawerTab === 'assistant' && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                        Contextual AI
                      </span>
                      <span className="dock-pill-badge">{contextNotes.length} in context</span>
                    </div>

                    <form className="ask-box" onSubmit={askInknote}>
                      <input
                        value={ask}
                        onChange={(e) => setAsk(e.target.value)}
                        placeholder="Ask anything about your notes..."
                      />
                      <button type="submit" aria-label="Submit question">
                        <Send size={14} />
                      </button>
                    </form>

                    <div className="ai-answer-card">
                      <p>{contextAnswer}</p>
                      {contextMatches.length > 0 && (
                        <div className="citation-list">
                          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>Citations</span>
                          {contextMatches.map((note, index) => (
                            <button key={note.id} className="citation-item" onClick={() => selectNote(note)}>
                              <b style={{ width: '18px', height: '18px', display: 'grid', placeItems: 'center', borderRadius: '50%', background: 'var(--bg-muted)', fontSize: '10px' }}>
                                {index + 1}
                              </b>
                              <b>{note.title || 'Untitled note'}</b>
                              <small>{workspace.folders.find((f) => f.id === note.folderId)?.name}</small>
                            </button>
                          ))}
                          <button
                            className="btn-primary"
                            style={{ height: '32px', fontSize: '11px', marginTop: '8px', justifyContent: 'center' }}
                            onClick={saveContextAnswer}
                          >
                            <Save size={14} />
                            Save as note
                          </button>
                        </div>
                      )}
                    </div>

                    {(workspace.traces?.length ?? 0) > 0 && (
                      <details style={{ marginTop: '20px', fontSize: '11px', color: 'var(--text-muted)' }}>
                        <summary style={{ cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <TerminalSquare size={13} />
                          Retrieval traces ({workspace.traces?.length})
                        </summary>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                          {[...(workspace.traces ?? [])].slice(-5).reverse().map((trace) => (
                            <div key={trace.id} style={{ padding: '8px', background: 'var(--bg-muted)', borderRadius: '6px' }}>
                              <b style={{ color: 'var(--text-main)' }}>{trace.query}</b>
                              <div style={{ fontSize: '10px', marginTop: '2px' }}>
                                {trace.noteIds.length} notes · {trace.latencyMs}ms latency
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                )}

                {drawerTab === 'graph' && (
                  <div>
                    <h3 style={{ margin: '0 0 6px', fontSize: '14px', fontWeight: 700 }}>Knowledge Map</h3>
                    <p style={{ margin: '0 0 16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      Notes linked via @Title references. Click to jump.
                    </p>
                    <div className="graph-container">
                      {workspace.notes.map((note) => {
                        const linkCount = workspace.notes.filter((item) => item.id !== note.id && item.content.toLowerCase().includes(`@${note.title}`.toLowerCase())).length;
                        return (
                          <div
                            key={note.id}
                            className={`graph-node ${note.id === selectedNote?.id ? 'is-active' : ''}`}
                            onClick={() => selectNote(note)}
                          >
                            <b>{note.title || 'Untitled note'}</b>
                            <small>{linkCount} backlinks</small>
                          </div>
                        );
                      })}
                    </div>
                    {selectedNote && backlinks.length > 0 && (
                      <div style={{ marginTop: '20px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600 }}>Backlinks to “{selectedNote.title}”:</span>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                          {backlinks.map((note) => (
                            <button key={note.id} className="tag-pill" onClick={() => selectNote(note)}>
                              {note.title}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {drawerTab === 'history' && (
                  <div>
                    <h3 style={{ margin: '0 0 6px', fontSize: '14px', fontWeight: 700 }}>Version History</h3>
                    <p style={{ margin: '0 0 16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      Revisions captured locally for {selectedNote ? `“${selectedNote.title}”` : 'selected note'}.
                    </p>
                    {selectedRevisions.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {selectedRevisions.map((rev) => (
                          <div key={rev.id} style={{ padding: '12px', background: 'var(--bg-muted)', borderRadius: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <b style={{ fontSize: '12px' }}>{new Date(rev.capturedAt).toLocaleTimeString()}</b>
                              <button
                                className="btn-secondary"
                                style={{ height: '26px', fontSize: '10px', padding: '0 8px' }}
                                onClick={() => restoreRevision(rev)}
                              >
                                Restore
                              </button>
                            </div>
                            <p style={{ margin: '6px 0 0', fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                              {rev.content.slice(0, 100) || 'Empty note'}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No earlier revisions for this note yet.</p>
                    )}
                  </div>
                )}

                {drawerTab === 'sync' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <h3 style={{ margin: '0 0 6px', fontSize: '14px', fontWeight: 700 }}>Backup & Sync</h3>
                      <p style={{ margin: '0 0 14px', fontSize: '12px', color: 'var(--text-muted)' }}>
                        All your data lives locally in your browser storage.
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <button className="btn-secondary" onClick={exportWorkspace} style={{ justifyContent: 'flex-start', gap: '8px' }}>
                          <Download size={15} />
                          <span>Download backup (.json)</span>
                        </button>
                        <button className="btn-secondary" onClick={() => importInputRef.current?.click()} style={{ justifyContent: 'flex-start', gap: '8px' }}>
                          <Upload size={15} />
                          <span>Import backup (.json)</span>
                        </button>
                        <button className="btn-secondary" onClick={enableGitBackup} style={{ justifyContent: 'flex-start', gap: '8px' }}>
                          <GitBranch size={15} />
                          <span>Enable Git sync backup</span>
                        </button>
                        <input ref={importInputRef} type="file" accept="application/json" onChange={importWorkspace} hidden />
                      </div>
                    </div>

                    <div style={{ padding: '14px', background: 'var(--bg-muted)', borderRadius: '10px', fontSize: '12px' }}>
                      <b>Workspace Statistics</b>
                      <div style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', color: 'var(--text-muted)' }}>
                        <div>Total Notes: {workspace.notes.length}</div>
                        <div>Folders: {workspace.folders.length}</div>
                        <div>Actionable tasks: {workspace.notes.filter((n) => /- \[ \]/.test(n.content)).length}</div>
                        <div>Storage: Local-First</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </aside>
          </>
        )}
      </section>

      {/* Modern Command Palette Modal */}
      {isCommandPaletteOpen && (
        <div className="modal-overlay" onClick={() => setIsCommandPaletteOpen(false)}>
          <div className="modal-card" style={{ width: 'min(100%, 540px)', padding: '12px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
              <Search size={16} className="text-muted" />
              <input
                autoFocus
                value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)}
                placeholder="Type a command or action..."
                style={{ flex: 1, border: 0, outline: 0, background: 'transparent', fontSize: '14px' }}
              />
              <span className="kbd-shortcut">ESC</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '8px', maxHeight: '300px', overflowY: 'auto' }}>
              {filteredCommands.map((command) => (
                <button
                  key={command.label}
                  className="dropdown-item"
                  style={{ padding: '10px 12px' }}
                  onClick={() => {
                    command.action();
                    setIsCommandPaletteOpen(false);
                  }}
                >
                  <span style={{ flex: 1, fontWeight: 500 }}>{command.label}</span>
                  {command.shortcut && <span className="kbd-shortcut">{command.shortcut}</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Security Passcode Dialog */}
      {securityDialog && (
        <div className="modal-overlay">
          <form className="modal-card" onSubmit={submitSecurity}>
            <LockKeyhole size={24} style={{ marginBottom: '12px' }} />
            <h2>{securityDialog.mode === 'setup' ? 'Set Note Passcode' : 'Unlock Note'}</h2>
            <p>
              {securityDialog.mode === 'setup'
                ? 'Your passcode is never saved on servers. A PBKDF2 verifier protects your private note locally.'
                : 'Enter your local passcode to read and edit this note.'}
            </p>
            <input
              type="password"
              autoFocus
              className="modal-input"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Minimum 6 characters"
            />
            {securityError && <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '12px' }}>{securityError}</div>}
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setSecurityDialog(null);
                  setPasscode('');
                  setSecurityError('');
                }}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={isSecuring}>
                {isSecuring ? 'Securing...' : securityDialog.mode === 'setup' ? 'Set & Lock' : 'Unlock'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
