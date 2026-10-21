import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  BookOpen,
  CalendarDays,
  Download,
  Eye,
  FileText,
  Folder,
  FolderPlus,
  Hash,
  MessageCircle,
  MoreHorizontal,
  PanelLeft,
  Pin,
  Plus,
  RotateCcw,
  Search,
  Send,
  Shield,
  Tag,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

type FolderItem = { id: string; name: string; pinned: boolean; priority: number };
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
};
type Workspace = { folders: FolderItem[]; notes: NoteItem[]; trash?: NoteItem[] };

const STORAGE_KEY = 'inknote-workspace-v1';

const seedWorkspace: Workspace = {
  folders: [
    { id: 'inbox', name: 'Inbox', pinned: true, priority: 0 },
    { id: 'projects', name: 'Projects', pinned: true, priority: 1 },
    { id: 'journal', name: 'Journal', pinned: false, priority: 0 },
    { id: 'references', name: 'References', pinned: false, priority: 1 },
  ],
  notes: [
    { id: 'welcome', folderId: 'inbox', title: 'A quieter place to think', content: 'Inknote keeps the important things close. Make a folder, write a note, and let the rest stay out of the way.', tags: ['welcome'], pinned: true, createdAt: '2026-10-20T08:00:00.000Z', updatedAt: '2026-10-20T08:00:00.000Z' },
    { id: 'ideas', folderId: 'inbox', title: 'Ideas worth returning to', content: '- [ ] Shape the search experience\n- [ ] Add contextual retrieval\n\nA simple note system should feel like paper: immediate, tactile, and easy to revisit. Search should surface the right thought before it disappears.', tags: ['ideas'], createdAt: '2026-10-19T10:30:00.000Z', updatedAt: '2026-10-19T10:30:00.000Z' },
    { id: 'project-brief', folderId: 'projects', title: 'Inknote direction', content: 'A black-and-white note space with folders, priorities, pins, keyword search, and context-aware retrieval. Keep interactions calm and liquid.\n\nUse @A quieter place to think to connect a note.', tags: ['product', 'inknote'], createdAt: '2026-10-18T09:00:00.000Z', updatedAt: '2026-10-20T07:15:00.000Z' },
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
    // A malformed local workspace should never prevent the app from opening.
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

function scoreNote(note: NoteItem, folderName: string, query: string) {
  const terms = query.toLowerCase().match(/[a-z0-9]{2,}/g) ?? [];
  if (!terms.length) return 0;
  const title = note.title.toLowerCase();
  const content = note.content.toLowerCase();
  const folder = folderName.toLowerCase();
  const tags = (note.tags ?? []).join(' ').toLowerCase();
  return terms.reduce((score, term) => score + (title.includes(term) ? 5 : 0) + (folder.includes(term) ? 3 : 0) + (tags.includes(term) ? 2 : 0) + (content.includes(term) ? 1 : 0), 0);
}

function downloadFile(fileName: string, content: string, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function dateKey(date = new Date()) { return date.toISOString().slice(0, 10); }

export default function App() {
  const [workspace, setWorkspace] = useState<Workspace>(getInitialWorkspace);
  const [activeFolderId, setActiveFolderId] = useState('inbox');
  const [selectedNoteId, setSelectedNoteId] = useState('welcome');
  const [query, setQuery] = useState('');
  const [ask, setAsk] = useState('');
  const [contextMatches, setContextMatches] = useState<NoteItem[]>([]);
  const [contextAnswer, setContextAnswer] = useState('Ask about a topic, plan, or detail. I’ll search the notes you already have.');
  const [isFolderComposerOpen, setIsFolderComposerOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [history, setHistory] = useState<Workspace[]>([]);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace)); }, [workspace]);
  useEffect(() => { if (isFolderComposerOpen) folderInputRef.current?.focus(); }, [isFolderComposerOpen]);

  const commitWorkspace = (next: Workspace) => {
    setHistory((previous) => [...previous.slice(-29), workspace]);
    setWorkspace(next);
  };

  const folders = useMemo(() => [...workspace.folders].sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.priority - b.priority), [workspace.folders]);
  const activeFolder = workspace.folders.find((folder) => folder.id === activeFolderId);
  const visibleNotes = useMemo(() => {
    const notes = activeFolderId === 'all' ? workspace.notes : workspace.notes.filter((note) => note.folderId === activeFolderId);
    return [...notes].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || +new Date(b.updatedAt) - +new Date(a.updatedAt));
  }, [activeFolderId, workspace.notes]);
  const selectedNote = visibleNotes.find((note) => note.id === selectedNoteId) ?? visibleNotes[0];
  const searchResults = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return workspace.notes.map((note) => ({ note, score: scoreNote(note, workspace.folders.find((folder) => folder.id === note.folderId)?.name ?? '', normalized) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || +new Date(b.note.updatedAt) - +new Date(a.note.updatedAt)).slice(0, 6);
  }, [query, workspace]);

  const selectNote = (note: NoteItem) => { setSelectedNoteId(note.id); setActiveFolderId(note.folderId); setIsUnlocked(false); setQuery(''); };
  const createFolder = (event: FormEvent) => {
    event.preventDefault();
    const name = folderName.trim();
    if (!name) return;
    const unpinnedPriorities = workspace.folders.filter((folder) => !folder.pinned).map((folder) => folder.priority);
    const folder: FolderItem = { id: makeId('folder'), name, pinned: false, priority: Math.max(-1, ...unpinnedPriorities) + 1 };
    commitWorkspace({ ...workspace, folders: [...workspace.folders, folder] });
    setActiveFolderId(folder.id); setFolderName(''); setIsFolderComposerOpen(false);
  };
  const createNote = () => {
    const folderId = activeFolderId === 'all' ? folders[0]?.id : activeFolderId;
    if (!folderId) return;
    const now = new Date().toISOString();
    const note: NoteItem = { id: makeId('note'), folderId, title: 'Untitled note', content: '', createdAt: now, updatedAt: now };
    commitWorkspace({ ...workspace, notes: [note, ...workspace.notes] });
    setActiveFolderId(folderId); setSelectedNoteId(note.id);
  };
  const updateSelectedNote = (changes: Partial<Pick<NoteItem, 'title' | 'content'>>) => {
    if (!selectedNote) return;
    setWorkspace((previous) => ({ ...previous, notes: previous.notes.map((note) => note.id === selectedNote.id ? { ...note, ...changes, updatedAt: new Date().toISOString() } : note) }));
  };
  const deleteSelectedNote = () => {
    if (!selectedNote) return;
    commitWorkspace({ ...workspace, notes: workspace.notes.filter((note) => note.id !== selectedNote.id), trash: [selectedNote, ...(workspace.trash ?? [])] });
    setSelectedNoteId(visibleNotes.find((note) => note.id !== selectedNote.id)?.id ?? '');
  };
  const togglePin = (id: string) => {
    const target = workspace.folders.find((folder) => folder.id === id);
    if (!target) return;
      const nextPinned = !target.pinned;
      const lastPriority = Math.max(-1, ...workspace.folders.filter((folder) => folder.pinned === nextPinned).map((folder) => folder.priority));
    commitWorkspace({ ...workspace, folders: workspace.folders.map((folder) => folder.id === id ? { ...folder, pinned: nextPinned, priority: lastPriority + 1 } : folder) });
  };
  const moveFolder = (id: string, direction: -1 | 1) => {
      const target = workspace.folders.find((folder) => folder.id === id);
      if (!target) return;
      const group = workspace.folders.filter((folder) => folder.pinned === target.pinned).sort((a, b) => a.priority - b.priority);
      const currentIndex = group.findIndex((folder) => folder.id === id);
      const nextIndex = currentIndex + direction;
      if (nextIndex < 0 || nextIndex >= group.length) return;
      const reordered = [...group]; [reordered[currentIndex], reordered[nextIndex]] = [reordered[nextIndex], reordered[currentIndex]];
      const priorities = new Map(reordered.map((folder, index) => [folder.id, index]));
      commitWorkspace({ ...workspace, folders: workspace.folders.map((folder) => priorities.has(folder.id) ? { ...folder, priority: priorities.get(folder.id)! } : folder) });
  };
  const askInknote = (event: FormEvent) => {
    event.preventDefault();
    const question = ask.trim();
    if (!question) return;
    const matches = workspace.notes.map((note) => ({ note, score: scoreNote(note, workspace.folders.find((folder) => folder.id === note.folderId)?.name ?? '', question) }))
      .filter(({ score }) => score > 0).sort((a, b) => b.score - a.score).slice(0, 3).map(({ note }) => note);
    setContextMatches(matches);
    setContextAnswer(matches.length ? `I found ${matches.length} ${matches.length === 1 ? 'note' : 'notes'} with relevant context. Start with the strongest match below.` : 'I could not connect that to a note yet. Try a distinctive word, folder name, or phrase from the note.');
    setAsk('');
  };
  const toggleNotePin = () => {
    if (!selectedNote) return;
    commitWorkspace({ ...workspace, notes: workspace.notes.map((note) => note.id === selectedNote.id ? { ...note, pinned: !note.pinned, updatedAt: new Date().toISOString() } : note) });
  };
  const toggleNoteLock = () => {
    if (!selectedNote) return;
    if (selectedNote.locked) { setIsUnlocked(true); return; }
    commitWorkspace({ ...workspace, notes: workspace.notes.map((note) => note.id === selectedNote.id ? { ...note, locked: true, updatedAt: new Date().toISOString() } : note) });
    setIsUnlocked(false);
  };
  const addTag = () => {
    if (!selectedNote || !tagDraft.trim()) return;
    const tag = tagDraft.trim().replace(/^#/, '');
    if ((selectedNote.tags ?? []).includes(tag)) { setTagDraft(''); return; }
    commitWorkspace({ ...workspace, notes: workspace.notes.map((note) => note.id === selectedNote.id ? { ...note, tags: [...(note.tags ?? []), tag], updatedAt: new Date().toISOString() } : note) });
    setTagDraft('');
  };
  const removeTag = (tag: string) => {
    if (!selectedNote) return;
    commitWorkspace({ ...workspace, notes: workspace.notes.map((note) => note.id === selectedNote.id ? { ...note, tags: (note.tags ?? []).filter((item) => item !== tag) } : note) });
  };
  const openDailyJournal = () => {
    const today = dateKey();
    const existing = workspace.notes.find((note) => note.journalDate === today);
    if (existing) { selectNote(existing); return; }
    const journalFolder = workspace.folders.find((folder) => folder.name.toLowerCase() === 'journal') ?? folders[0];
    if (!journalFolder) return;
    const now = new Date().toISOString();
    const note: NoteItem = { id: makeId('journal'), folderId: journalFolder.id, title: `Journal · ${formatDate(now)}`, content: `# ${formatDate(now)}\n\nWhat is on your mind today?`, tags: ['journal'], journalDate: today, createdAt: now, updatedAt: now };
    commitWorkspace({ ...workspace, notes: [note, ...workspace.notes] });
    selectNote(note);
  };
  const exportSelectedNote = () => {
    if (!selectedNote) return;
    downloadFile(`${(selectedNote.title || 'untitled-note').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'note'}.md`, `# ${selectedNote.title || 'Untitled note'}\n\n${selectedNote.content}`,'text/markdown;charset=utf-8');
  };
  const exportWorkspace = () => downloadFile('inknote-backup.json', JSON.stringify(workspace, null, 2), 'application/json;charset=utf-8');
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
      } catch { window.alert('That file is not a valid Inknote backup.'); }
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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === 'k') { event.preventDefault(); document.querySelector<HTMLInputElement>('[aria-label="Search every note"]')?.focus(); }
      if (modifier && event.key.toLowerCase() === 'n') { event.preventDefault(); createNote(); }
      if (modifier && event.key.toLowerCase() === 'z') { event.preventDefault(); undo(); }
      if (modifier && event.shiftKey && event.key.toLowerCase() === 'j') { event.preventDefault(); openDailyJournal(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [history, workspace, activeFolderId, selectedNoteId]);

  return (
    <main className="inknote-shell">
      <aside className={`inknote-sidebar ${isSidebarOpen ? '' : 'is-collapsed'}`}>
        <div className="sidebar-topline">
          <div className="wordmark" aria-label="Inknote"><span className="wordmark-mark">I</span><span>Inknote</span></div>
          <button className="icon-button sidebar-collapse" onClick={() => setIsSidebarOpen(false)} aria-label="Hide sidebar"><PanelLeft size={17} /></button>
        </div>
        <button className="library-button" onClick={() => setActiveFolderId('all')}><Archive size={16} /><span>All notes</span><b>{workspace.notes.length}</b></button>
        <div className="folder-label-row"><span>Folders</span><button className="tiny-action" onClick={() => setIsFolderComposerOpen((open) => !open)} aria-label="Create folder"><FolderPlus size={16} /></button></div>
        {isFolderComposerOpen && <form className="folder-composer" onSubmit={createFolder}>
          <Folder size={15} /><input ref={folderInputRef} value={folderName} onChange={(event) => setFolderName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') setIsFolderComposerOpen(false); }} placeholder="Folder name" aria-label="New folder name" />
          <button type="submit" aria-label="Save folder"><Plus size={15} /></button>
        </form>}
        <nav className="folder-list" aria-label="Folders">
          {folders.map((folder) => {
            const count = workspace.notes.filter((note) => note.folderId === folder.id).length;
            const isActive = activeFolderId === folder.id;
            return <div className={`folder-row ${isActive ? 'is-active' : ''}`} key={folder.id}>
              <button className="folder-select" onClick={() => setActiveFolderId(folder.id)}><Folder size={16} fill={isActive ? 'currentColor' : 'none'} /><span>{folder.name}</span><em>{count}</em></button>
              <div className="folder-tools" aria-label={`${folder.name} options`}>
                <button onClick={() => togglePin(folder.id)} aria-label={folder.pinned ? `Unpin ${folder.name}` : `Pin ${folder.name}`} className={folder.pinned ? 'is-pinned' : ''}><Pin size={13} fill={folder.pinned ? 'currentColor' : 'none'} /></button>
                <button onClick={() => moveFolder(folder.id, -1)} aria-label={`Move ${folder.name} up`}><ArrowUp size={13} /></button>
                <button onClick={() => moveFolder(folder.id, 1)} aria-label={`Move ${folder.name} down`}><ArrowDown size={13} /></button>
              </div>
            </div>;
          })}
        </nav>
        <div className="sidebar-footnote"><Pin size={13} /><span>Pin folders and use arrows to set their priority.</span></div>
      </aside>

      <section className="inknote-workspace">
        {!isSidebarOpen && <button className="icon-button sidebar-reopen" onClick={() => setIsSidebarOpen(true)} aria-label="Show sidebar"><PanelLeft size={18} /></button>}
        <header className="workspace-header">
          <div><p className="eyebrow">{activeFolderId === 'all' ? 'Your library' : activeFolder?.pinned ? 'Pinned folder' : 'Folder'}</p><h1>{activeFolderId === 'all' ? 'All notes' : activeFolder?.name ?? 'Notes'}</h1></div>
          <div className="header-actions">
            <div className="search-field"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search every note" aria-label="Search every note" />{query && <button onClick={() => setQuery('')} aria-label="Clear search"><X size={15} /></button>}
              {searchResults.length > 0 && <div className="search-popover"><p>Notes matching “{query}”</p>{searchResults.map(({ note }) => <button key={note.id} onClick={() => selectNote(note)}><FileText size={15} /><span><b>{note.title || 'Untitled note'}</b><small>{workspace.folders.find((folder) => folder.id === note.folderId)?.name} · {snippet(note)}</small></span></button>)}</div>}
            </div>
            <button className="header-icon" onClick={openDailyJournal} title="Today’s journal (Ctrl/Cmd Shift J)" aria-label="Open today’s journal"><CalendarDays size={17} /></button>
            <button className="header-icon" onClick={undo} disabled={!history.length} title="Undo (Ctrl/Cmd Z)" aria-label="Undo"><RotateCcw size={16} /></button>
            <button className="new-note-button" onClick={createNote}><Plus size={17} /> New note</button>
          </div>
        </header>
        <div className="folder-intro"><div className="folder-tab"><Folder size={21} fill="currentColor" /><span>{visibleNotes.length} {visibleNotes.length === 1 ? 'note' : 'notes'}</span></div><p>{activeFolderId === 'all' ? 'A single, quiet view of everything you have written.' : 'Open a note, write freely, and keep this space focused.'}</p></div>
        <div className="workspace-body">
          <section className="note-area" aria-label="Notes">
            <div className="note-section-heading"><span>Notes</span><button onClick={createNote}><Plus size={15} /> Add page</button></div>
            {visibleNotes.length ? <div className="note-grid">{visibleNotes.map((note, index) => <button key={note.id} onClick={() => setSelectedNoteId(note.id)} className={`paper-note paper-note-${index % 3} ${selectedNote?.id === note.id ? 'is-selected' : ''}`}>
              <span className="paper-pin" aria-hidden="true" /><span className="paper-note-top"><span>{note.pinned ? 'PIN' : String(index + 1).padStart(2, '0')}</span><span>{note.locked ? 'LOCKED' : formatDate(note.updatedAt)}</span></span><strong>{note.locked ? 'Locked note' : note.title || 'Untitled note'}</strong><small>{note.locked ? 'Open it from the writing desk.' : snippet(note)}</small><span className="paper-note-bottom"><Hash size={13} /> {workspace.folders.find((folder) => folder.id === note.folderId)?.name}</span>
            </button>)}</div> : <button className="empty-folder" onClick={createNote}><span className="paper-pin" /><FileText size={24} /><strong>Make the first note here</strong><small>This folder is ready for a thought.</small><span><Plus size={14} /> Create note</span></button>}
          </section>
          <aside className="right-rail">
            <section className="editor-card" aria-label="Note editor"><div className="editor-card-head"><span><BookOpen size={16} /> Writing desk</span>{selectedNote && <div className="editor-actions"><button className={`icon-button ${selectedNote.pinned ? 'is-pressed' : ''}`} onClick={toggleNotePin} title="Pin note" aria-label="Pin note"><Pin size={14} fill={selectedNote.pinned ? 'currentColor' : 'none'} /></button><button className="icon-button" onClick={toggleNoteLock} title="Lock note" aria-label="Lock note"><Shield size={14} /></button><button className="icon-button" onClick={() => setIsPreviewing((open) => !open)} title="Toggle Markdown preview" aria-label="Toggle Markdown preview"><Eye size={15} /></button><button className="icon-button" onClick={exportSelectedNote} title="Export note" aria-label="Export note"><Download size={15} /></button><button className="icon-button danger-button" onClick={deleteSelectedNote} aria-label="Delete note"><Trash2 size={15} /></button></div>}</div>
              {selectedNote ? selectedNote.locked && !isUnlocked ? <div className="locked-note"><Shield size={22} /><strong>This note is locked.</strong><small>Unlock it locally to view and edit it.</small><button onClick={() => setIsUnlocked(true)}>Unlock note</button></div> : <><input className="note-title-input" value={selectedNote.title} onChange={(event) => updateSelectedNote({ title: event.target.value })} placeholder="Untitled note" aria-label="Note title" /><p className="editor-meta">Last touched {formatDate(selectedNote.updatedAt)} · stored locally</p><div className="tag-row"><Tag size={13} />{(selectedNote.tags ?? []).map((tag) => <button key={tag} onClick={() => removeTag(tag)}>#{tag} ×</button>)}<input value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addTag(); } }} placeholder="add tag" aria-label="Add tag" /></div>{isPreviewing ? <article className="markdown-preview">{selectedNote.content.split('\n').map((line, index) => <p key={`${line}-${index}`} className={line.startsWith('- [') ? 'checkline' : line.startsWith('#') ? 'headingline' : ''}>{line.startsWith('- [ ]') ? '□ ' + line.slice(6) : line.startsWith('- [x]') ? '☑ ' + line.slice(6) : line}</p>)}</article> : <textarea value={selectedNote.content} onChange={(event) => updateSelectedNote({ content: event.target.value })} placeholder="Begin writing… Use Markdown, - [ ] checklists, and @Note titles." aria-label="Note content" />}</> : <div className="no-note-selected"><FileText size={22} /><span>Select a note to write.</span></div>}
            </section>
            <section className="context-card" aria-label="Context finder"><div className="context-head"><span><MessageCircle size={16} /> Ask Inknote</span><span className="local-badge">local context</span></div><p className="context-answer">{contextAnswer}</p>
              {contextMatches.length > 0 && <div className="context-results">{contextMatches.map((note) => <button key={note.id} onClick={() => selectNote(note)}><FileText size={14} /><span>{note.title || 'Untitled note'}<small>{workspace.folders.find((folder) => folder.id === note.folderId)?.name}</small></span></button>)}</div>}
              <form className="ask-form" onSubmit={askInknote}><input value={ask} onChange={(event) => setAsk(event.target.value)} placeholder="Ask about your notes" aria-label="Ask about your notes" /><button type="submit" aria-label="Find context"><Send size={15} /></button></form>
            </section>
            <section className="workspace-tools" aria-label="Workspace tools"><span><MoreHorizontal size={16} /> Workspace</span><button onClick={exportWorkspace}><Download size={14} /> Export backup</button><button onClick={() => importInputRef.current?.click()}><Upload size={14} /> Import backup</button><input ref={importInputRef} type="file" accept="application/json" onChange={importWorkspace} hidden /></section>
          </aside>
        </div>
      </section>
    </main>
  );
}
