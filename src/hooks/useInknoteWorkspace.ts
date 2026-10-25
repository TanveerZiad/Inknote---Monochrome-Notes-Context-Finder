import { useState, useMemo, useCallback, FormEvent, ChangeEvent, useEffect, useRef } from 'react';
import { Workspace, FolderItem, NoteItem, NoteRevision } from '../types/workspace';
import { makeId, dateKey, formatDate, downloadFile, semanticScore, snippet } from '../utils/searchEngine';
import {
  checkVaultStatus,
  loadVaultWorkspace,
  saveVaultNote,
  deleteVaultNote,
  deleteVaultFolder,
  saveVaultWorkspace,
  openVaultInExplorer,
  setVaultDirectory,
  VaultStatus,
} from '../lib/vaultBackend';

const STORAGE_KEY = 'inknote-workspace-v1';

export const seedWorkspace: Workspace = {
  folders: [
    { id: 'inbox', name: 'Inbox', pinned: true, priority: 0, system: true },
    { id: 'projects', name: 'Projects', pinned: false, priority: 1 },
    { id: 'inknote', name: 'Inknote', parentId: 'projects', pinned: false, priority: 0 },
    { id: 'journal', name: 'Journal', pinned: false, priority: 2 },
    { id: 'references', name: 'References', pinned: false, priority: 3 },
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

  // Local Folder Vault State
  const [vaultStatus, setVaultStatus] = useState<VaultStatus>({
    connected: false,
    vaultPath: '',
    notesCount: 0,
    foldersCount: 0,
    storageType: 'browser-fallback',
  });
  const [isVaultSyncing, setIsVaultSyncing] = useState(false);
  const latestWorkspaceRef = useRef<Workspace>(workspace);
  latestWorkspaceRef.current = workspace;
  const saveTimersRef = useRef<Map<string, any>>(new Map());

  // Mount effect to check vault status and load from local folder if present
  useEffect(() => {
    let isMounted = true;
    async function initVault() {
      setIsVaultSyncing(true);
      const status = await checkVaultStatus();
      if (!isMounted) return;
      setVaultStatus(status);

      if (status.connected) {
        const vaultWs = await loadVaultWorkspace();
        if (!isMounted) return;
        if (vaultWs && Array.isArray(vaultWs.notes) && vaultWs.notes.length > 0) {
          setWorkspace(vaultWs);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(vaultWs));
          } catch {}
          setVaultStatus((prev) => ({
            ...prev,
            notesCount: vaultWs.notes.length,
            foldersCount: vaultWs.folders.length,
            lastSyncedAt: new Date().toLocaleTimeString(),
          }));
        } else if (workspace.notes.length > 0) {
          await saveVaultWorkspace(workspace);
          for (const note of workspace.notes) {
            await saveVaultNote(note, workspace.folders);
          }
          setVaultStatus((prev) => ({
            ...prev,
            notesCount: workspace.notes.length,
            foldersCount: workspace.folders.length,
            lastSyncedAt: new Date().toLocaleTimeString(),
          }));
        }
      }
      setIsVaultSyncing(false);
    }
    initVault();
    return () => {
      isMounted = false;
    };
  }, []);

  // Commit wrapper that synchronizes history snapshot and local vault backend
  const commitWorkspace = useCallback(
    (next: Workspace) => {
      pushSnapshot(workspace, true);
      setWorkspace(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (err) {
        console.error('Failed to save to localStorage:', err);
      }
      if (vaultStatus.connected) {
        saveVaultWorkspace(next);
      }
    },
    [pushSnapshot, workspace, vaultStatus.connected]
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

  // Sync session unlocked private folders
  const [unlockedFolderIds, setUnlockedFolderIds] = useState<string[]>(() => {
    try {
      const saved = sessionStorage.getItem('inknote-unlocked-folders');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const handleSecChange = () => {
      try {
        const saved = sessionStorage.getItem('inknote-unlocked-folders');
        setUnlockedFolderIds(saved ? JSON.parse(saved) : []);
      } catch {
        setUnlockedFolderIds([]);
      }
    };
    window.addEventListener('inknote-security-changed', handleSecChange);
    return () => window.removeEventListener('inknote-security-changed', handleSecChange);
  }, []);

  const activeFolder = useMemo(
    () => workspace.folders.find((f) => f.id === activeFolderId),
    [workspace.folders, activeFolderId]
  );

  // Filtered & sorted visible notes
  const visibleNotes = useMemo(() => {
    // Locked private folders: notes must be completely hidden
    const lockedPrivateFolderIds = new Set(
      workspace.folders
        .filter((f) => f.private && !unlockedFolderIds.includes(f.id))
        .map((f) => f.id)
    );

    // If viewing a locked private folder, hide all notes so no titles/previews leak
    if (lockedPrivateFolderIds.has(activeFolderId)) {
      return [];
    }

    let list =
      activeFolderId === 'all'
        ? workspace.notes.filter((note) => !lockedPrivateFolderIds.has(note.folderId))
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
  }, [activeFolderId, workspace.notes, workspace.folders, unlockedFolderIds, showTasksOnly, tagFilter]);

  const selectedNote = useMemo(() => {
    return (
      workspace.notes.find((note) => note.id === selectedNoteId) ??
      visibleNotes[0] ??
      workspace.notes[0]
    );
  }, [workspace.notes, selectedNoteId, visibleNotes]);

  // Context notes for AI (exclude locked and notes in locked private folders)
  const contextNotes = useMemo(() => {
    const lockedPrivateFolderIds = new Set(
      workspace.folders
        .filter((f) => f.private && !unlockedFolderIds.includes(f.id))
        .map((f) => f.id)
    );
    return workspace.notes.filter(
      (note) =>
        note.inContext !== false &&
        !note.locked &&
        !lockedPrivateFolderIds.has(note.folderId)
    );
  }, [workspace.notes, workspace.folders, unlockedFolderIds]);

  // Helper: check if checkParentId is an ancestor of folderId
  const isDescendant = useCallback(
    (parentCandidateId: string, folderId: string): boolean => {
      let cur = workspace.folders.find((f) => f.id === folderId);
      while (cur && cur.parentId) {
        if (cur.parentId === parentCandidateId) return true;
        cur = workspace.folders.find((f) => f.id === cur!.parentId);
      }
      return false;
    },
    [workspace.folders]
  );

  const getFolderDepth = useCallback(
    (folderId: string | undefined): number => {
      let d = 0;
      let cur = workspace.folders.find((f) => f.id === folderId);
      while (cur && cur.parentId) {
        d++;
        cur = workspace.folders.find((f) => f.id === cur!.parentId);
      }
      return d;
    },
    [workspace.folders]
  );

  const getSubtreeHeight = useCallback(
    (folderId: string): number => {
      const children = workspace.folders.filter((f) => f.parentId === folderId);
      if (children.length === 0) return 0;
      return 1 + Math.max(...children.map((c) => getSubtreeHeight(c.id)));
    },
    [workspace.folders]
  );

  // Folder Operations
  const createFolder = useCallback(
    (name: string, targetParentId?: string | null) => {
      const trimmed = name.trim();
      if (!trimmed) return;

      // When targetParentId is explicitly provided, use it; otherwise, use activeFolderId if valid, else root (undefined)
      let parentId: string | undefined = undefined;
      if (targetParentId !== undefined) {
        parentId = targetParentId || undefined;
      } else if (activeFolderId && activeFolderId !== 'all' && workspace.folders.some((f) => f.id === activeFolderId)) {
        parentId = activeFolderId;
      }

      if (parentId) {
        const parentDepth = getFolderDepth(parentId);
        if (parentDepth >= 6) {
          alert('Maximum folder nesting depth (6) reached.');
          return;
        }
      }

      const siblingPriorities = workspace.folders
        .filter((f) => f.parentId === parentId)
        .map((f) => f.priority);
      const siblingOrders = workspace.folders
        .filter((f) => f.parentId === parentId)
        .map((f) => f.order ?? f.priority);

      const folder: FolderItem = {
        id: makeId('folder'),
        name: trimmed,
        parentId,
        depth: parentId ? getFolderDepth(parentId) + 1 : 0,
        pinned: false,
        priority: Math.max(-1, ...siblingPriorities) + 1,
        order: Math.max(-1, ...siblingOrders) + 1,
      };
      commitWorkspace({ ...workspace, folders: [...workspace.folders, folder] });
      setActiveFolderId(folder.id);
    },
    [activeFolderId, commitWorkspace, getFolderDepth, workspace]
  );

  const updateFolder = useCallback(
    (id: string, updates: Partial<FolderItem>) => {
      commitWorkspace({
        ...workspace,
        folders: workspace.folders.map((f) => (f.id === id ? { ...f, ...updates } : f)),
      });
    },
    [commitWorkspace, workspace]
  );

  const renameFolder = useCallback(
    (id: string, newName: string) => {
      const trimmed = newName.trim();
      if (!trimmed) return;
      updateFolder(id, { name: trimmed });
    },
    [updateFolder]
  );

  const moveFolderToParent = useCallback(
    (folderId: string, newParentId: string | undefined) => {
      if (folderId === 'inbox') {
        alert('The Inbox folder cannot be moved.');
        return;
      }
      if (folderId === newParentId) return;
      if (newParentId && isDescendant(folderId, newParentId)) {
        alert('Cannot move a folder into its own subfolder.');
        return;
      }
      const parentDepth = getFolderDepth(newParentId);
      const subtreeHeight = getSubtreeHeight(folderId);
      if (newParentId && parentDepth + 1 + subtreeHeight > 6) {
        alert('Cannot move folder: nesting would exceed maximum depth of 6.');
        return;
      }

      const siblingOrders = workspace.folders
        .filter((f) => f.parentId === newParentId)
        .map((f) => f.order ?? f.priority);

      commitWorkspace({
        ...workspace,
        folders: workspace.folders.map((f) =>
          f.id === folderId
            ? { ...f, parentId: newParentId, order: Math.max(-1, ...siblingOrders) + 1 }
            : f
        ),
      });
    },
    [commitWorkspace, getFolderDepth, getSubtreeHeight, isDescendant, workspace]
  );

  useEffect(() => {
    const handleFolderUpdate = (e: any) => {
      if (e.detail?.id && e.detail?.updates) {
        updateFolder(e.detail.id, e.detail.updates);
      }
    };
    const handleMoveParent = (e: any) => {
      if (e.detail?.folderId !== undefined) {
        moveFolderToParent(e.detail.folderId, e.detail.newParentId);
      }
    };
    window.addEventListener('inknote-update-folder', handleFolderUpdate);
    window.addEventListener('inknote-move-folder-parent', handleMoveParent);
    return () => {
      window.removeEventListener('inknote-update-folder', handleFolderUpdate);
      window.removeEventListener('inknote-move-folder-parent', handleMoveParent);
    };
  }, [updateFolder, moveFolderToParent]);

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
        .filter((f) => f.pinned === target.pinned && f.parentId === target.parentId)
        .sort((a, b) => (a.order ?? a.priority) - (b.order ?? b.priority));
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
          priorities.has(f.id)
            ? { ...f, priority: priorities.get(f.id)!, order: priorities.get(f.id)! }
            : f
        ),
      });
    },
    [commitWorkspace, workspace]
  );

  const reorderFolder = useCallback(
    (overId: string) => {
      // 1) Note dropped on a folder
      if (draggedNoteId) {
        const note = workspace.notes.find((n) => n.id === draggedNoteId);
        if (note && note.folderId !== overId) {
          commitWorkspace({
            ...workspace,
            notes: workspace.notes.map((n) =>
              n.id === draggedNoteId
                ? { ...n, folderId: overId, updatedAt: new Date().toISOString() }
                : n
            ),
          });
        }
        setDraggedNoteId(null);
        return;
      }

      // 2) Folder dropped on a folder or root
      if (!draggedFolderId || draggedFolderId === overId) {
        setDraggedFolderId(null);
        return;
      }
      if (draggedFolderId === 'inbox') {
        alert('The Inbox folder cannot be moved.');
        setDraggedFolderId(null);
        return;
      }

      if (overId === 'root') {
        moveFolderToParent(draggedFolderId, undefined);
        setDraggedFolderId(null);
        return;
      }

      const dragged = workspace.folders.find((f) => f.id === draggedFolderId);
      const over = workspace.folders.find((f) => f.id === overId);
      if (!dragged || !over) {
        setDraggedFolderId(null);
        return;
      }

      // Prevent dropping into itself or its descendants
      if (isDescendant(draggedFolderId, overId)) {
        alert('Cannot drop a folder into its own descendants.');
        setDraggedFolderId(null);
        return;
      }

      // Check max depth 6
      const parentDepth = getFolderDepth(overId);
      const subtreeHeight = getSubtreeHeight(draggedFolderId);
      if (parentDepth + 1 + subtreeHeight > 6) {
        alert('Cannot nest folder: maximum depth of 6 reached.');
        setDraggedFolderId(null);
        return;
      }

      const siblingOrders = workspace.folders
        .filter((f) => f.parentId === overId)
        .map((f) => f.order ?? f.priority);

      commitWorkspace({
        ...workspace,
        folders: workspace.folders.map((f) =>
          f.id === draggedFolderId
            ? { ...f, parentId: overId, order: Math.max(-1, ...siblingOrders) + 1 }
            : f
        ),
      });
      setDraggedFolderId(null);
    },
    [
      commitWorkspace,
      draggedFolderId,
      draggedNoteId,
      getFolderDepth,
      getSubtreeHeight,
      isDescendant,
      workspace,
    ]
  );

  const deleteFolder = useCallback(
    (id: string) => {
      const targetFolder = workspace.folders.find((f) => f.id === id);
      if (!targetFolder) return;

      if (targetFolder.id === 'inbox' || targetFolder.system) {
        alert('The Inbox folder is protected and cannot be deleted.');
        return;
      }

      if (workspace.folders.length <= 1) {
        alert('You must have at least one folder in your workspace.');
        return;
      }

      const allSubFolderIds = new Set<string>([id]);
      let added = true;
      while (added) {
        added = false;
        for (const f of workspace.folders) {
          if (f.parentId && allSubFolderIds.has(f.parentId) && !allSubFolderIds.has(f.id)) {
            allSubFolderIds.add(f.id);
            added = true;
          }
        }
      }

      const notesToTrash = workspace.notes.filter((n) => allSubFolderIds.has(n.folderId));
      const remainingNotes = workspace.notes.filter((n) => !allSubFolderIds.has(n.folderId));
      const remainingFolders = workspace.folders.filter((f) => !allSubFolderIds.has(f.id));

      if (allSubFolderIds.has(activeFolderId)) {
        setActiveFolderId(remainingFolders[0]?.id || 'inbox');
      }

      const nextWorkspace: Workspace = {
        ...workspace,
        folders: remainingFolders,
        notes: remainingNotes,
        trash: [...notesToTrash, ...(workspace.trash ?? [])],
      };

      commitWorkspace(nextWorkspace);

      if (vaultStatus.connected) {
        deleteVaultFolder(id, workspace.folders);
      }
    },
    [activeFolderId, commitWorkspace, vaultStatus.connected, workspace]
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
      if (vaultStatus.connected) {
        saveVaultNote(note, workspace.folders);
      }
    },
    [activeFolderId, commitWorkspace, folders, showTasksOnly, vaultStatus.connected, workspace]
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

        // Debounce disk file write (300ms) so all changes stay intact in real files
        if (vaultStatus.connected && target) {
          const oldTimer = saveTimersRef.current.get(id);
          if (oldTimer) clearTimeout(oldTimer);
          const oldTitle = target.title;
          const oldFolderId = target.folderId;
          const timer = setTimeout(() => {
            const currentNote = latestWorkspaceRef.current.notes.find((n) => n.id === id);
            if (currentNote) {
              saveVaultNote(currentNote, latestWorkspaceRef.current.folders, oldTitle, oldFolderId);
            }
            saveTimersRef.current.delete(id);
          }, 300);
          saveTimersRef.current.set(id, timer);
        }

        return next;
      });
    },
    [pushSnapshot, vaultStatus.connected]
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
      if (vaultStatus.connected) {
        const oldTimer = saveTimersRef.current.get(note.id);
        if (oldTimer) clearTimeout(oldTimer);
        deleteVaultNote(note.id, note.folderId, note.title, workspace.folders);
      }
    },
    [commitWorkspace, selectedNoteId, vaultStatus.connected, visibleNotes, workspace]
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

  const openDailyJournal = useCallback(
    (forceBypassLock = false) => {
      const currentWs = latestWorkspaceRef.current;
      const journalFolder =
        currentWs.folders.find((f) => f.name.toLowerCase() === 'journal') ?? folders[0];
      if (!journalFolder) return;

      const sessionUnlocked = (() => {
        try {
          const saved = sessionStorage.getItem('inknote-unlocked-folders');
          return saved ? JSON.parse(saved) : [];
        } catch {
          return [];
        }
      })();

      // If journal folder is private and locked, switch to it and trigger unlock
      const isLocked =
        !forceBypassLock &&
        journalFolder.private &&
        !unlockedFolderIds.includes(journalFolder.id) &&
        !sessionUnlocked.includes(journalFolder.id);

      if (isLocked) {
        setActiveFolderId(journalFolder.id);
        window.dispatchEvent(
          new CustomEvent('inknote-request-unlock', {
            detail: { folderId: journalFolder.id, thenOpenJournal: true },
          })
        );
        return;
      }

      const today = dateKey();
      const existing = currentWs.notes.find((n) => n.journalDate === today);
      if (existing) {
        setSelectedNoteId(existing.id);
        setActiveFolderId(existing.folderId);
        return;
      }
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
      commitWorkspace({ ...currentWs, notes: [note, ...currentWs.notes] });
      setActiveFolderId(journalFolder.id);
      setSelectedNoteId(note.id);
    },
    [commitWorkspace, folders, unlockedFolderIds]
  );

  // Handle auto-open of today's journal note after successful unlock
  useEffect(() => {
    const handleJournalUnlocked = () => {
      openDailyJournal(true);
    };
    window.addEventListener('inknote-journal-unlocked', handleJournalUnlocked);
    return () => window.removeEventListener('inknote-journal-unlocked', handleJournalUnlocked);
  }, [openDailyJournal]);

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
    const lockedPrivateFolderIds = new Set(
      workspace.folders
        .filter((f) => f.private && !unlockedFolderIds.includes(f.id))
        .map((f) => f.id)
    );
    // Exclude notes in locked private folders from backup exports
    const sanitizedNotes = workspace.notes.filter(
      (n) => !lockedPrivateFolderIds.has(n.folderId)
    );
    downloadFile(
      'inknote-backup.json',
      JSON.stringify({ ...workspace, notes: sanitizedNotes }, null, 2),
      'application/json;charset=utf-8'
    );
  }, [workspace, unlockedFolderIds]);

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
    updateFolder,
    renameFolder,
    moveFolderToParent,
    togglePinFolder,
    moveFolder,
    reorderFolder,
    deleteFolder,
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
    // Local Vault Support
    vaultStatus,
    isVaultSyncing,
    openVaultFolder: async () => {
      return await openVaultInExplorer(vaultStatus.vaultPath);
    },
    rescanVault: async () => {
      setIsVaultSyncing(true);
      const vaultWs = await loadVaultWorkspace();
      if (vaultWs && Array.isArray(vaultWs.notes)) {
        setWorkspace(vaultWs);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(vaultWs));
        } catch {}
        setVaultStatus((prev) => ({
          ...prev,
          notesCount: vaultWs.notes.length,
          foldersCount: vaultWs.folders.length,
          lastSyncedAt: new Date().toLocaleTimeString(),
        }));
      }
      setIsVaultSyncing(false);
    },
    changeVaultDirectory: async (newPath: string) => {
      setIsVaultSyncing(true);
      const res = await setVaultDirectory(newPath);
      if (res.ok && res.vaultPath) {
        setVaultStatus((prev) => ({
          ...prev,
          vaultPath: res.vaultPath!,
        }));
        const vaultWs = await loadVaultWorkspace();
        if (vaultWs && Array.isArray(vaultWs.notes)) {
          setWorkspace(vaultWs);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(vaultWs));
          } catch {}
        }
      }
      setIsVaultSyncing(false);
    },
  };
}
