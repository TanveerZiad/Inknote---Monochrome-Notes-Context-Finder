import { useState, useMemo, useCallback, FormEvent, ChangeEvent } from 'react';
import { Workspace, FolderItem, NoteItem, NoteRevision } from '../types/workspace';
import { makeId, dateKey, formatDate, downloadFile, semanticScore, snippet } from '../utils/searchEngine';

const STORAGE_KEY = 'inknote-workspace-v1';

export const seedWorkspace: Workspace = {
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
      content:
        'Inknote keeps the important things close. Make a folder, write a note, and let the rest stay out of the way.\n\n- [x] Streamline workspace\n- [ ] Write down great ideas\n- [ ] Link thoughts with @references',
      tags: ['welcome'],
      pinned: true,
      createdAt: '2026-10-20T08:00:00.000Z',
      updatedAt: '2026-10-20T08:00:00.000Z',
    },
    {
      id: 'ideas',
      folderId: 'inbox',
      title: 'Ideas worth returning to',
      content:
        '- [ ] Shape the search experience\n- [ ] Add contextual retrieval\n\nA simple note system should feel like paper: immediate, tactile, and easy to revisit. Search surfaces the right thought before it disappears.',
      tags: ['ideas'],
      createdAt: '2026-10-19T10:30:00.000Z',
      updatedAt: '2026-10-19T10:30:00.000Z',
    },
    {
      id: 'project-brief',
      folderId: 'inknote',
      title: 'Inknote direction',
      content:
        'A black-and-white note space with folders, priorities, pins, keyword search, and context-aware retrieval. Keep interactions calm, fluid, and dynamic.\n\nUse @A quieter place to think to connect a note.',
      tags: ['product', 'inknote'],
      createdAt: '2026-10-18T09:00:00.000Z',
      updatedAt: '2026-10-20T07:15:00.000Z',
    },
  ],
};

export function getInitialWorkspace(): Workspace {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Workspace;
      if (Array.isArray(parsed.folders) && Array.isArray(parsed.notes)) return parsed;
    }
  } catch {
    // Fallback on corrupt storage
  }
  return seedWorkspace;
}

export function useInknoteWorkspace(
  pushSnapshot: (state: Workspace, immediate?: boolean) => void
) {
  const [workspace, setWorkspace] = useState<Workspace>(getInitialWorkspace);
  const [activeFolderId, setActiveFolderId] = useState('inbox');
  const [selectedNoteId, setSelectedNoteId] = useState('welcome');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [showTasksOnly, setShowTasksOnly] = useState(false);

  // AI Assistant State
  const [ask, setAsk] = useState('');
  const [lastQuestion, setLastQuestion] = useState('');
  const [contextMatches, setContextMatches] = useState<NoteItem[]>([]);
  const [contextAnswer, setContextAnswer] = useState(
    'Ask about a topic, plan, or detail. Inknote searches across the notes you have included in context.'
  );

  // Drag state
  const [draggedFolderId, setDraggedFolderId] = useState<string | null>(null);
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);

  // Commit wrapper that synchronizes history snapshot
  const commitWorkspace = useCallback(
    (next: Workspace) => {
      pushSnapshot(workspace, true);
      setWorkspace(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (err) {
        console.error('Failed to save to localStorage:', err);
      }
    },
    [pushSnapshot, workspace]
  );

  // Hierarchical folders
  const folders = useMemo(() => {
    const sort = (items: FolderItem[]) =>
      [...items].sort(
        (a, b) => Number(b.pinned) - Number(a.pinned) || a.priority - b.priority
      );
    const walk = (
      parentId: string | undefined,
      depth = 0
    ): Array<FolderItem & { depth: number }> =>
      sort(workspace.folders.filter((folder) => folder.parentId === parentId)).flatMap(
        (folder) => [{ ...folder, depth }, ...walk(folder.id, depth + 1)]
      );
    return walk(undefined);
  }, [workspace.folders]);

  const activeFolder = useMemo(
    () => workspace.folders.find((f) => f.id === activeFolderId),
    [workspace.folders, activeFolderId]
  );

  // Filtered & sorted visible notes
  const visibleNotes = useMemo(() => {
    let list =
      activeFolderId === 'all'
        ? workspace.notes
        : workspace.notes.filter((note) => note.folderId === activeFolderId);

    if (showTasksOnly) {
      // Smart Auto-Graduation: only display notes with at least one unfinished task
      list = list.filter((note) => /^\s*[-*+]\s*\[ \]/m.test(note.content));
    }
    if (tagFilter) {
      list = list.filter((note) => (note.tags ?? []).includes(tagFilter));
    }

    return [...list].sort(
      (a, b) =>
        Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) ||
        (a.priority ?? 0) - (b.priority ?? 0) ||
        +new Date(b.updatedAt) - +new Date(a.updatedAt)
    );
  }, [activeFolderId, workspace.notes, showTasksOnly, tagFilter]);

  const selectedNote = useMemo(() => {
    return (
      workspace.notes.find((note) => note.id === selectedNoteId) ??
      visibleNotes[0] ??
      workspace.notes[0]
    );
  }, [workspace.notes, selectedNoteId, visibleNotes]);

  // Context notes for AI
  const contextNotes = useMemo(
    () => workspace.notes.filter((note) => note.inContext !== false && !note.locked),
    [workspace.notes]
  );

  // Folder Operations
  const createFolder = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const unpinnedPriorities = workspace.folders
        .filter((f) => !f.pinned)
        .map((f) => f.priority);
      const parentId = activeFolderId !== 'all' ? activeFolderId : undefined;
      const siblingPriorities = workspace.folders
        .filter((f) => f.parentId === parentId)
        .map((f) => f.priority);
      const folder: FolderItem = {
        id: makeId('folder'),
        name: trimmed,
        parentId,
        pinned: false,
        priority: Math.max(-1, ...siblingPriorities, ...unpinnedPriorities) + 1,
      };
      commitWorkspace({ ...workspace, folders: [...workspace.folders, folder] });
      setActiveFolderId(folder.id);
    },
    [activeFolderId, commitWorkspace, workspace]
  );

  const togglePinFolder = useCallback(
    (id: string) => {
      const target = workspace.folders.find((f) => f.id === id);
      if (!target) return;
      const nextPinned = !target.pinned;
      const lastPriority = Math.max(
        -1,
        ...workspace.folders
          .filter((f) => f.pinned === nextPinned)
          .map((f) => f.priority)
      );
      commitWorkspace({
        ...workspace,
        folders: workspace.folders.map((f) =>
          f.id === id ? { ...f, pinned: nextPinned, priority: lastPriority + 1 } : f
        ),
      });
    },
    [commitWorkspace, workspace]
  );

  const moveFolder = useCallback(
    (id: string, direction: -1 | 1) => {
      const target = workspace.folders.find((f) => f.id === id);
      if (!target) return;
      const group = workspace.folders
        .filter((f) => f.pinned === target.pinned)
        .sort((a, b) => a.priority - b.priority);
      const currentIndex = group.findIndex((f) => f.id === id);
      const nextIndex = currentIndex + direction;
      if (nextIndex < 0 || nextIndex >= group.length) return;
      const reordered = [...group];
      [reordered[currentIndex], reordered[nextIndex]] = [
        reordered[nextIndex],
        reordered[currentIndex],
      ];
      const priorities = new Map(reordered.map((f, index) => [f.id, index]));
      commitWorkspace({
        ...workspace,
        folders: workspace.folders.map((f) =>
          priorities.has(f.id) ? { ...f, priority: priorities.get(f.id)! } : f
        ),
      });
    },
    [commitWorkspace, workspace]
  );

  const reorderFolder = useCallback(
    (overId: string) => {
      if (!draggedFolderId || draggedFolderId === overId) return;
      const dragged = workspace.folders.find((f) => f.id === draggedFolderId);
      const over = workspace.folders.find((f) => f.id === overId);
      if (!dragged || !over || dragged.parentId !== over.parentId) return;
      const siblings = workspace.folders
        .filter((f) => f.parentId === dragged.parentId)
        .sort((a, b) => a.priority - b.priority)
        .filter((f) => f.id !== dragged.id);
      siblings.splice(
        siblings.findIndex((f) => f.id === over.id),
        0,
        dragged
      );
      const priorities = new Map(siblings.map((f, index) => [f.id, index]));
      commitWorkspace({
        ...workspace,
        folders: workspace.folders.map((f) =>
          priorities.has(f.id) ? { ...f, priority: priorities.get(f.id)! } : f
        ),
      });
    },
    [commitWorkspace, draggedFolderId, workspace]
  );

  // Note Operations
  const createNote = useCallback(
    (customTemplate?: { title?: string; content?: string; tags?: string[] }) => {
      const folderId =
        activeFolderId === 'all' ? folders[0]?.id || 'inbox' : activeFolderId;
      if (!folderId) return;
      const now = new Date().toISOString();

      const isTaskFocus = showTasksOnly;
      const defaultTitle =
        customTemplate?.title ?? (isTaskFocus ? 'Actionable tasks' : 'Untitled note');
      const defaultContent =
        customTemplate?.content ??
        (isTaskFocus ? '- [ ] Task 1\n- [ ] Task 2\n- [ ] ' : '');
      const defaultTags =
        customTemplate?.tags ?? (isTaskFocus ? ['tasks'] : []);

      const note: NoteItem = {
        id: makeId('note'),
        folderId,
        title: defaultTitle,
        content: defaultContent,
        tags: defaultTags,
        createdAt: now,
        updatedAt: now,
        priority: 0,
      };
      commitWorkspace({ ...workspace, notes: [note, ...workspace.notes] });
      setActiveFolderId(folderId);
      setSelectedNoteId(note.id);
    },
    [activeFolderId, commitWorkspace, folders, showTasksOnly, workspace]
  );

  const updateNote = useCallback(
    (
      id: string,
      changes: Partial<
        Pick<NoteItem, 'title' | 'content' | 'size' | 'inContext' | 'tags' | 'priority'>
      >
    ) => {
      setWorkspace((previous) => {
        const target = previous.notes.find((n) => n.id === id);
        if (!target) return previous;
        const changesContent =
          changes.title !== undefined || changes.content !== undefined;
        const revision: NoteRevision | null = changesContent
          ? {
              id: makeId('revision'),
              noteId: target.id,
              title: target.title,
              content: target.content,
              tags: target.tags ?? [],
              capturedAt: new Date().toISOString(),
            }
          : null;

        const next: Workspace = {
          ...previous,
          notes: previous.notes.map((n) =>
            n.id === id ? { ...n, ...changes, updatedAt: new Date().toISOString() } : n
          ),
          revisions: revision
            ? [...(previous.revisions ?? []), revision].slice(-120)
            : previous.revisions,
        };
        // Debounce storage push for text edits
        pushSnapshot(next, false);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    [pushSnapshot]
  );

  const deleteNote = useCallback(
    (note: NoteItem) => {
      commitWorkspace({
        ...workspace,
        notes: workspace.notes.filter((item) => item.id !== note.id),
        trash: [note, ...(workspace.trash ?? [])],
      });
      if (selectedNoteId === note.id) {
        setSelectedNoteId(visibleNotes.find((item) => item.id !== note.id)?.id ?? '');
      }
    },
    [commitWorkspace, selectedNoteId, visibleNotes, workspace]
  );

  const togglePinNote = useCallback(
    (note: NoteItem) => {
      commitWorkspace({
        ...workspace,
        notes: workspace.notes.map((item) =>
          item.id === note.id
            ? { ...item, pinned: !item.pinned, updatedAt: new Date().toISOString() }
            : item
        ),
      });
    },
    [commitWorkspace, workspace]
  );

  const reorderNote = useCallback(
    (overId: string) => {
      if (!draggedNoteId || draggedNoteId === overId) return;
      const dragged = workspace.notes.find((n) => n.id === draggedNoteId);
      const over = workspace.notes.find((n) => n.id === overId);
      if (!dragged || !over) return;

      const targetFolderId = over.folderId;
      const siblings = workspace.notes
        .filter((n) => n.folderId === targetFolderId)
        .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
        .filter((n) => n.id !== dragged.id);

      const overIndex = siblings.findIndex((n) => n.id === over.id);
      siblings.splice(overIndex >= 0 ? overIndex : 0, 0, {
        ...dragged,
        folderId: targetFolderId,
      });

      const priorities = new Map(siblings.map((n, index) => [n.id, index]));
      commitWorkspace({
        ...workspace,
        notes: workspace.notes.map((n) => {
          if (n.id === dragged.id) {
            return {
              ...n,
              folderId: targetFolderId,
              priority: priorities.get(n.id) ?? 0,
            };
          }
          return priorities.has(n.id)
            ? { ...n, priority: priorities.get(n.id)! }
            : n;
        }),
      });
    },
    [commitWorkspace, draggedNoteId, workspace]
  );

  const openDailyJournal = useCallback(() => {
    const today = dateKey();
    const existing = workspace.notes.find((n) => n.journalDate === today);
    if (existing) {
      setSelectedNoteId(existing.id);
      setActiveFolderId(existing.folderId);
      return;
    }
    const journalFolder =
      workspace.folders.find((f) => f.name.toLowerCase() === 'journal') ?? folders[0];
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
    setActiveFolderId(journalFolder.id);
    setSelectedNoteId(note.id);
  }, [commitWorkspace, folders, workspace]);

  const exportNote = useCallback((note: NoteItem) => {
    downloadFile(
      `${(note.title || 'untitled-note')
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-|-$/g, '') || 'note'}.md`,
      `# ${note.title || 'Untitled note'}\n\n${note.content}`,
      'text/markdown;charset=utf-8'
    );
  }, []);

  const exportWorkspace = useCallback(() => {
    downloadFile(
      'inknote-backup.json',
      JSON.stringify(workspace, null, 2),
      'application/json;charset=utf-8'
    );
  }, [workspace]);

  const importWorkspaceFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const imported = JSON.parse(String(reader.result)) as Workspace;
          if (!Array.isArray(imported.folders) || !Array.isArray(imported.notes)) {
            throw new Error('Invalid Inknote backup');
          }
          commitWorkspace({ ...imported, trash: imported.trash ?? [] });
          setActiveFolderId(imported.folders[0]?.id ?? 'all');
          setSelectedNoteId(imported.notes[0]?.id ?? '');
        } catch {
          window.alert('That file is not a valid Inknote backup.');
        }
      };
      reader.readAsText(file);
    },
    [commitWorkspace]
  );

  // AI Assistant Ask & Context
  const askInknote = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      const question = ask.trim();
      if (!question) return;
      setLastQuestion(question);
      const startedAt = performance.now();

      const scored = contextNotes
        .map((note) => ({
          note,
          score: semanticScore(
            note,
            workspace.folders.find((f) => f.id === note.folderId)?.name ?? '',
            question
          ),
        }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(({ note }) => note);

      setContextMatches(scored);

      const answer = scored.length
        ? `Grounded in ${scored.length} referenced ${
            scored.length === 1 ? 'note' : 'notes'
          }: ${scored
            .map(
              (note) =>
                `“${snippet(note).slice(0, 110)}${
                  snippet(note).length > 110 ? '…' : ''
                }”`
            )
            .join(' ')}`
        : contextNotes.length
        ? 'No direct matches found in currently included notes. Try different keywords or include more notes in context.'
        : 'No notes are currently included in AI context.';

      setContextAnswer(answer);

      const byId = new Map(
        contextNotes.map((note) => [
          note.id,
          semanticScore(
            note,
            workspace.folders.find((f) => f.id === note.folderId)?.name ?? '',
            question
          ),
        ])
      );

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
    },
    [ask, contextNotes, workspace.folders]
  );

  const saveContextAnswer = useCallback(() => {
    if (!contextMatches.length) return;
    const now = new Date().toISOString();
    const folderId =
      activeFolderId === 'all'
        ? contextMatches[0]?.folderId || folders[0]?.id || 'inbox'
        : activeFolderId;
    const note: NoteItem = {
      id: makeId('answer'),
      folderId,
      title: lastQuestion || 'Saved context answer',
      content: `${contextAnswer}\n\n## Citations\n${contextMatches
        .map((item, index) => `${index + 1}. @${item.title}`)
        .join('\n')}`,
      tags: ['ai-answer'],
      aiGenerated: true,
      createdAt: now,
      updatedAt: now,
    };
    commitWorkspace({ ...workspace, notes: [note, ...workspace.notes] });
    setActiveFolderId(note.folderId);
    setSelectedNoteId(note.id);
  }, [
    activeFolderId,
    commitWorkspace,
    contextAnswer,
    contextMatches,
    folders,
    lastQuestion,
    workspace,
  ]);

  return {
    workspace,
    setWorkspace,
    commitWorkspace,
    activeFolderId,
    setActiveFolderId,
    selectedNoteId,
    setSelectedNoteId,
    tagFilter,
    setTagFilter,
    showTasksOnly,
    setShowTasksOnly,
    folders,
    activeFolder,
    visibleNotes,
    selectedNote,
    contextNotes,
    draggedFolderId,
    setDraggedFolderId,
    draggedNoteId,
    setDraggedNoteId,
    createFolder,
    togglePinFolder,
    moveFolder,
    reorderFolder,
    createNote,
    updateNote,
    deleteNote,
    togglePinNote,
    reorderNote,
    openDailyJournal,
    exportNote,
    exportWorkspace,
    importWorkspaceFile,
    ask,
    setAsk,
    lastQuestion,
    contextMatches,
    contextAnswer,
    askInknote,
    saveContextAnswer,
  };
}
