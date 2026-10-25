import React, { useState, useRef, useEffect, memo, useMemo, useCallback } from 'react';
import {
  PanelLeft,
  Archive,
  CheckSquare,
  CalendarDays,
  FolderPlus,
  Folder,
  Plus,
  Pin,
  ArrowUp,
  ArrowDown,
  Sun,
  Moon,
  SlidersHorizontal,
  FolderOpen,
  Trash2,
  ChevronRight,
  MoreHorizontal,
  Palette,
  Edit2,
  CornerDownRight,
  Check,
  X,
  Lock,
  Unlock,
  Key,
  Home,
} from 'lucide-react';
import { FolderItem, NoteItem } from '../types/workspace';
import { InknoteDeleteFolderModal } from './Modals/InknoteDeleteFolderModal';

export const FOLDER_COLORS = [
  { id: 'slate', name: 'Slate', value: '#94a3b8' },
  { id: 'rose', name: 'Rose', value: '#f87171' },
  { id: 'amber', name: 'Amber', value: '#fbbf24' },
  { id: 'emerald', name: 'Emerald', value: '#34d399' },
  { id: 'cyan', name: 'Cyan', value: '#22d3ee' },
  { id: 'indigo', name: 'Indigo', value: '#818cf8' },
  { id: 'purple', name: 'Purple', value: '#c084fc' },
  { id: 'bronze', name: 'Bronze', value: '#a8a29e' },
];

interface InknoteSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeFolderId: string;
  onSelectFolder: (id: string) => void;
  folders: Array<FolderItem & { depth: number }>;
  allNotes: NoteItem[];
  showTasksOnly: boolean;
  onToggleTasksOnly: () => void;
  onOpenDailyJournal: () => void;
  onCreateFolder: (name: string, parentId?: string | null) => void;
  onTogglePinFolder: (id: string) => void;
  onMoveFolder: (id: string, direction: -1 | 1) => void;
  onDragStartFolder: (id: string) => void;
  onDragEndFolder: () => void;
  onDropFolder: (id: string) => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenSyncDrawer: () => void;
  onOpenVaultFolder?: () => void;
  onDeleteFolder?: (id: string) => void;
  onRenameFolder?: (id: string, name: string) => void;
  onUpdateFolder?: (id: string, updates: Partial<FolderItem>) => void;
  onMoveFolderToParent?: (folderId: string, parentId?: string) => void;
  onLockFolder?: (folderId: string) => void;
  onUnlockFolder?: (folderId: string) => void;
  onGoToLanding?: () => void;
}

const InknoteSidebarComponent: React.FC<InknoteSidebarProps> = ({
  isOpen,
  onClose,
  activeFolderId,
  onSelectFolder,
  folders,
  allNotes,
  showTasksOnly,
  onToggleTasksOnly,
  onOpenDailyJournal,
  onCreateFolder,
  onTogglePinFolder,
  onMoveFolder,
  onDragStartFolder,
  onDragEndFolder,
  onDropFolder,
  isDarkMode,
  onToggleDarkMode,
  onOpenSyncDrawer,
  onOpenVaultFolder,
  onDeleteFolder,
  onRenameFolder,
  onUpdateFolder,
  onMoveFolderToParent,
  onLockFolder,
  onUnlockFolder,
  onGoToLanding,
}) => {
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [composerParentId, setComposerParentId] = useState<string | null>(null);
  const [folderName, setFolderName] = useState('');
  const [folderToDelete, setFolderToDelete] = useState<FolderItem | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Folder context menu & editing states
  const [menuFolderId, setMenuFolderId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showColorPickerFor, setShowColorPickerFor] = useState<string | null>(null);
  const [showMovePickerFor, setShowMovePickerFor] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Persist expand/collapse state per folder in localStorage
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('inknote-folder-collapsed');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const toggleExpand = useCallback((folderId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCollapsedFolders((prev) => {
      const next = { ...prev, [folderId]: !prev[folderId] };
      try {
        localStorage.setItem('inknote-folder-collapsed', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  // Close menus on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuFolderId(null);
        setMenuPosition(null);
        setShowColorPickerFor(null);
        setShowMovePickerFor(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    if (isComposerOpen) {
      inputRef.current?.focus();
    }
  }, [isComposerOpen]);

  useEffect(() => {
    if (renamingFolderId) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renamingFolderId]);

  // Session-unlocked folder tracking
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

  // Set of folders currently private and locked
  const lockedFolderIdSet = useMemo(() => {
    const set = new Set<string>();
    for (const f of folders) {
      if (f.private && !unlockedFolderIds.includes(f.id)) {
        set.add(f.id);
      }
    }
    return set;
  }, [folders, unlockedFolderIds]);

  // Roll-up note counts: a parent folder shows its own notes plus all descendants (excluding locked private notes)
  const rollupCounts = useMemo(() => {
    const map = new Map<string, number>();
    const getDescendantIds = (fid: string): string[] => {
      const children = folders.filter((f) => f.parentId === fid);
      return [fid, ...children.flatMap((c) => getDescendantIds(c.id))];
    };

    for (const f of folders) {
      const allSubIds = new Set(getDescendantIds(f.id));
      const total = allNotes.filter(
        (n) => allSubIds.has(n.folderId) && !lockedFolderIdSet.has(n.folderId)
      ).length;
      map.set(f.id, total);
    }
    return map;
  }, [folders, allNotes, lockedFolderIdSet]);

  // Children mapping for nested tree
  const childrenMap = useMemo(() => {
    const map = new Map<string | undefined, FolderItem[]>();
    for (const f of folders) {
      const list = map.get(f.parentId) ?? [];
      list.push(f);
      map.set(f.parentId, list);
    }
    return map;
  }, [folders]);

  // Helper dispatchers for folder update / move
  const triggerFolderUpdate = useCallback(
    (id: string, updates: Partial<FolderItem>) => {
      if (onUpdateFolder) {
        onUpdateFolder(id, updates);
      } else {
        window.dispatchEvent(new CustomEvent('inknote-update-folder', { detail: { id, updates } }));
      }
    },
    [onUpdateFolder]
  );

  const triggerFolderMove = useCallback(
    (folderId: string, newParentId: string | undefined) => {
      if (onMoveFolderToParent) {
        onMoveFolderToParent(folderId, newParentId);
      } else {
        window.dispatchEvent(
          new CustomEvent('inknote-move-folder-parent', { detail: { folderId, newParentId } })
        );
      }
    },
    [onMoveFolderToParent]
  );

  // New folder submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = folderName.trim();
    if (!trimmed) return;
    onCreateFolder(trimmed, composerParentId);
    setFolderName('');
    setIsComposerOpen(false);
  };

  // Open composer with explicit parent (null for root, string for subfolder)
  const handleOpenComposer = (targetParentId?: string | null) => {
    if (targetParentId !== undefined) {
      setComposerParentId(targetParentId);
    } else {
      // Requirement 1: The "+" button creates a ROOT folder when none is selected, otherwise a subfolder of selected
      const current = folders.find((f) => f.id === activeFolderId);
      if (current && (current.depth ?? 0) < 6) {
        setComposerParentId(current.id);
      } else {
        setComposerParentId(null);
      }
    }
    setIsComposerOpen(true);
  };

  // Check if checkParentId is an ancestor of folderId
  const isDescendant = useCallback(
    (parentCandidateId: string, folderId: string): boolean => {
      let cur = folders.find((f) => f.id === folderId);
      while (cur && cur.parentId) {
        if (cur.parentId === parentCandidateId) return true;
        cur = folders.find((f) => f.id === cur!.parentId);
      }
      return false;
    },
    [folders]
  );

  const actionableCount = allNotes.filter(
    (n) => !lockedFolderIdSet.has(n.folderId) && /^\s*[-*+]\s*\[ \]/m.test(n.content)
  ).length;

  const [showJournalSetupPrompt, setShowJournalSetupPrompt] = useState(false);

  const handleJournalAction = useCallback(() => {
    const journalFolder = folders.find(
      (f) => f.id === 'journal' || f.name.toLowerCase() === 'journal'
    );
    const setupPrompted = localStorage.getItem('inknote-journal-setup-prompted');

    if (journalFolder && !journalFolder.private && !setupPrompted) {
      setShowJournalSetupPrompt(true);
      return;
    }

    onOpenDailyJournal();
  }, [folders, onOpenDailyJournal]);

  // Render a folder row and recursively render its subfolders
  const renderFolderNode = (folder: FolderItem & { depth: number }) => {
    const children = childrenMap.get(folder.id) || [];
    const hasChildren = children.length > 0;
    const isCollapsed = Boolean(collapsedFolders[folder.id]);
    const isExpanded = hasChildren && !isCollapsed;
    const isActive = activeFolderId === folder.id && !showTasksOnly;
    const count = rollupCounts.get(folder.id) ?? 0;
    const ownNotesCount = allNotes.filter((n) => n.folderId === folder.id).length;
    const isInbox = folder.id === 'inbox' || Boolean(folder.system);
    const isRenaming = renamingFolderId === folder.id;
    const isDragTarget = dragOverFolderId === folder.id;

    return (
      <div key={folder.id} className="folder-tree-node">
        <div
          className={`folder-row ${isActive ? 'is-active' : ''} ${isDragTarget ? 'is-drag-over' : ''}`}
          draggable={!isInbox && !isRenaming}
          onDragStart={() => onDragStartFolder(folder.id)}
          onDragEnd={() => {
            onDragEndFolder();
            setDragOverFolderId(null);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverFolderId(folder.id);
          }}
          onDragLeave={() => {
            setDragOverFolderId((prev) => (prev === folder.id ? null : prev));
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOverFolderId(null);
            onDropFolder(folder.id);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenuFolderId(folder.id);
            setMenuPosition({ x: e.clientX, y: e.clientY });
            setShowColorPickerFor(null);
            setShowMovePickerFor(null);
          }}
          style={{
            paddingLeft: `${4 + (folder.depth ?? 0) * 12}px`,
            position: 'relative',
          }}
        >
          {/* Chevron expand/collapse toggle */}
          {hasChildren ? (
            <button
              type="button"
              className="folder-chevron-btn"
              onClick={(e) => toggleExpand(folder.id, e)}
              title={isExpanded ? 'Collapse' : 'Expand'}
              aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '2px',
                marginRight: '2px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted, #71717a)',
              }}
            >
              <ChevronRight
                size={13}
                style={{
                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 180ms ease',
                }}
              />
            </button>
          ) : (
            <span style={{ width: 17, display: 'inline-block' }} />
          )}

          {/* Folder Select / Title */}
          {isRenaming ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (renameValue.trim()) {
                  if (onRenameFolder) onRenameFolder(folder.id, renameValue.trim());
                  else triggerFolderUpdate(folder.id, { name: renameValue.trim() });
                }
                setRenamingFolderId(null);
              }}
              style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <input
                ref={renameInputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setRenamingFolderId(null);
                }}
                onBlur={() => {
                  if (renameValue.trim()) {
                    triggerFolderUpdate(folder.id, { name: renameValue.trim() });
                  }
                  setRenamingFolderId(null);
                }}
                className="folder-rename-input"
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid var(--border-focus, #3b82f6)',
                  borderRadius: '3px',
                  padding: '2px 6px',
                  fontSize: '12px',
                  color: 'var(--text-main, #f4f4f5)',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                className="tiny-action"
                style={{ background: 'transparent', border: 0, color: '#22c55e', cursor: 'pointer' }}
              >
                <Check size={12} />
              </button>
            </form>
          ) : (
            <button
              type="button"
              className="folder-select"
              onClick={() => onSelectFolder(folder.id)}
              style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {/* Folder Icon with optional custom color tint or dot */}
              <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                <Folder
                  size={15}
                  style={{ color: folder.color || 'inherit' }}
                  fill={isActive ? (folder.color || 'currentColor') : 'none'}
                />
                {folder.color && (
                  <span
                    className="folder-tint-dot"
                    style={{
                      position: 'absolute',
                      right: -2,
                      bottom: -2,
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      backgroundColor: folder.color,
                      boxShadow: '0 0 2px rgba(0,0,0,0.5)',
                    }}
                  />
                )}
              </div>
              <span className="truncate">{folder.name}</span>
              {lockedFolderIdSet.has(folder.id) ? (
                <span
                  style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center' }}
                  title="Private locked folder"
                >
                  <Lock size={12} style={{ color: 'var(--text-muted, #71717a)' }} />
                </span>
              ) : folder.private ? (
                <span
                  style={{
                    marginLeft: 'auto',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                  title="Private folder (Unlocked). Click to lock now."
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onLockFolder) {
                      onLockFolder(folder.id);
                    } else {
                      window.dispatchEvent(
                        new CustomEvent('inknote-lock-folder', { detail: { folderId: folder.id } })
                      );
                    }
                  }}
                >
                  <Unlock size={11} style={{ color: 'var(--accent, #f59e0b)', cursor: 'pointer' }} />
                  <em title={hasChildren ? `${count} notes (including subfolders)` : `${count} notes`}>
                    {count}
                  </em>
                </span>
              ) : (
                <em title={hasChildren ? `${count} notes (including subfolders)` : `${count} notes`}>
                  {count}
                </em>
              )}
            </button>
          )}

          {/* Folder Tools: Pin, Reorder, and "..." Menu */}
          <div className="folder-tools">
            <button
              onClick={() => onTogglePinFolder(folder.id)}
              title={folder.pinned ? 'Unpin' : 'Pin'}
            >
              <Pin size={12} fill={folder.pinned ? 'currentColor' : 'none'} />
            </button>
            <button onClick={() => onMoveFolder(folder.id, -1)} title="Move up">
              <ArrowUp size={12} />
            </button>
            <button onClick={() => onMoveFolder(folder.id, 1)} title="Move down">
              <ArrowDown size={12} />
            </button>

            {/* "..." More menu button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (menuFolderId === folder.id) {
                  setMenuFolderId(null);
                } else {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setMenuFolderId(folder.id);
                  setMenuPosition({ x: rect.right, y: rect.bottom + 4 });
                  setShowColorPickerFor(null);
                  setShowMovePickerFor(null);
                }
              }}
              title="Folder options"
              aria-label="Folder options"
            >
              <MoreHorizontal size={13} />
            </button>
          </div>
        </div>

        {/* Subfolders list with vertical indent guide line and 180ms ease animation */}
        {hasChildren && (
          <div
            className="folder-children-container"
            style={{
              maxHeight: isExpanded ? '2000px' : '0px',
              overflow: 'hidden',
              transition: 'max-height 180ms ease, opacity 180ms ease',
              opacity: isExpanded ? 1 : 0,
              marginLeft: `${12 + (folder.depth ?? 0) * 12}px`,
              borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
              paddingLeft: '2px',
            }}
          >
            {children.map((child) =>
              renderFolderNode({ ...child, depth: (folder.depth ?? 0) + 1 })
            )}
          </div>
        )}

        {/* Empty state hint: "Drop a note here" when empty and expanded/active */}
        {isExpanded && ownNotesCount === 0 && children.length === 0 && (
          <div
            className="folder-empty-hint"
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDropFolder(folder.id);
            }}
            style={{
              padding: '4px 8px',
              margin: `2px 4px 4px ${24 + (folder.depth ?? 0) * 12}px`,
              fontSize: '11px',
              color: 'var(--text-muted, #71717a)',
              fontStyle: 'italic',
              borderRadius: '4px',
              border: '1px dashed rgba(255, 255, 255, 0.12)',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              pointerEvents: 'auto',
            }}
          >
            Drop a note here
          </div>
        )}
      </div>
    );
  };

  const rootFolders = childrenMap.get(undefined) || [];

  const targetMenuFolder = folders.find((f) => f.id === menuFolderId);

  return (
    <aside className={`inknote-sidebar ${isOpen ? '' : 'is-collapsed'}`}>
      {/* Topline Logo & Collapse */}
      <div className="sidebar-topline">
        <div
          className="wordmark"
          onClick={onGoToLanding}
          role={onGoToLanding ? 'button' : undefined}
          tabIndex={onGoToLanding ? 0 : undefined}
          style={{ cursor: onGoToLanding ? 'pointer' : 'default' }}
          title={onGoToLanding ? 'Return to Landing Page' : undefined}
        >
          <img
            src="/inknote-icon.png"
            alt="Inknote logo"
            className="wordmark-logo"
            width={28}
            height={28}
          />
          <span>Inknote</span>
        </div>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
        >
          <PanelLeft size={16} />
        </button>
      </div>

      {/* Global Navigation Links */}
      <div className="sidebar-nav-group">
        {onGoToLanding && (
          <button
            className="nav-item"
            onClick={onGoToLanding}
            title="Overview & Landing Page"
          >
            <Home size={16} />
            <span>Home / Landing</span>
          </button>
        )}
        <button
          className={`nav-item ${
            activeFolderId === 'all' && !showTasksOnly ? 'is-active' : ''
          }`}
          onClick={() => onSelectFolder('all')}
        >
          <Archive size={16} />
          <span>All notes</span>
          <b>{allNotes.filter((n) => !lockedFolderIdSet.has(n.folderId)).length}</b>
        </button>
        <button
          className={`nav-item ${showTasksOnly ? 'is-active' : ''}`}
          onClick={onToggleTasksOnly}
        >
          <CheckSquare size={16} />
          <span>Actionable tasks</span>
          <b>{actionableCount}</b>
        </button>
        <button className="nav-item" onClick={handleJournalAction}>
          <CalendarDays size={16} />
          <span>Today’s journal</span>
        </button>
      </div>

      {/* Folders Section Header */}
      <div className="folder-label-row">
        <span>Folders</span>
        <button
          className="tiny-action"
          onClick={() => handleOpenComposer()}
          aria-label="Add folder"
          title={
            activeFolderId && activeFolderId !== 'all'
              ? `New subfolder under "${folders.find((f) => f.id === activeFolderId)?.name || 'active'}"`
              : 'New root folder'
          }
        >
          <FolderPlus size={15} />
        </button>
      </div>

      {/* New Folder Composer */}
      {isComposerOpen && (
        <form className="folder-composer" onSubmit={handleSubmit} style={{ position: 'relative' }}>
          <Folder size={14} className="text-muted" />
          <input
            ref={inputRef}
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setIsComposerOpen(false);
            }}
            placeholder={
              composerParentId
                ? `Subfolder of "${folders.find((f) => f.id === composerParentId)?.name || 'parent'}"...`
                : 'Root folder name...'
            }
          />
          {composerParentId && (
            <button
              type="button"
              className="tiny-action"
              onClick={() => setComposerParentId(null)}
              title="Switch to Root folder"
              style={{ fontSize: '10px', color: 'var(--text-muted)' }}
            >
              Root
            </button>
          )}
          <button type="submit" className="tiny-action" aria-label="Save folder">
            <Plus size={14} />
          </button>
        </form>
      )}

      {/* Folders Hierarchical Tree */}
      <nav
        className="folder-list"
        aria-label="Folders list"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          // Dropping into blank area of folder list moves folder to root
          if ((e.target as HTMLElement).classList.contains('folder-list')) {
            onDropFolder('root');
          }
        }}
      >
        {rootFolders.map((folder) => renderFolderNode({ ...folder, depth: 0 }))}
      </nav>

      {/* Sidebar Footer */}
      <div className="sidebar-footer">
        {onOpenVaultFolder && (
          <button
            className="icon-button"
            onClick={onOpenVaultFolder}
            title="Open notes folder in File Explorer"
            aria-label="Open notes folder in File Explorer"
          >
            <FolderOpen size={16} />
          </button>
        )}
        <button
          className="icon-button"
          onClick={onToggleDarkMode}
          title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button
          className="icon-button"
          onClick={onOpenSyncDrawer}
          title="Workspace settings & sync"
        >
          <SlidersHorizontal size={16} />
        </button>
      </div>

      {/* Folder Context Menu / "..." Dropdown Menu */}
      {targetMenuFolder && menuPosition && (
        <div
          ref={menuRef}
          className="folder-context-dropdown"
          style={{
            position: 'fixed',
            left: Math.min(menuPosition.x, window.innerWidth - 200),
            top: Math.min(menuPosition.y, window.innerHeight - 280),
            zIndex: 9999,
            minWidth: 180,
            background: 'var(--bg-card, #18181b)',
            border: '1px solid var(--border-subtle, rgba(255,255,255,0.12))',
            borderRadius: '6px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            padding: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          {/* Header title */}
          <div
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--text-muted, #a1a1aa)',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              marginBottom: '2px',
            }}
          >
            {targetMenuFolder.name}
          </div>

          {/* 1. New subfolder */}
          <button
            type="button"
            className="dropdown-item"
            disabled={(targetMenuFolder.depth ?? 0) >= 6}
            onClick={() => {
              setMenuFolderId(null);
              handleOpenComposer(targetMenuFolder.id);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 8px',
              fontSize: '12px',
              background: 'transparent',
              border: 0,
              color: 'var(--text-main, #f4f4f5)',
              cursor: (targetMenuFolder.depth ?? 0) >= 6 ? 'not-allowed' : 'pointer',
              borderRadius: '4px',
              textAlign: 'left',
              opacity: (targetMenuFolder.depth ?? 0) >= 6 ? 0.4 : 1,
            }}
          >
            <FolderPlus size={14} />
            <span>New subfolder</span>
            {(targetMenuFolder.depth ?? 0) >= 6 && (
              <small style={{ marginLeft: 'auto', fontSize: '9px', opacity: 0.6 }}>Max depth 6</small>
            )}
          </button>

          {/* 2. Rename */}
          <button
            type="button"
            className="dropdown-item"
            onClick={() => {
              setMenuFolderId(null);
              setRenamingFolderId(targetMenuFolder.id);
              setRenameValue(targetMenuFolder.name);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 8px',
              fontSize: '12px',
              background: 'transparent',
              border: 0,
              color: 'var(--text-main, #f4f4f5)',
              cursor: 'pointer',
              borderRadius: '4px',
              textAlign: 'left',
            }}
          >
            <Edit2 size={14} />
            <span>Rename</span>
          </button>

          {/* 3. Color / Icon */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="dropdown-item"
              onClick={() => {
                setShowColorPickerFor((prev) => (prev ? null : targetMenuFolder.id));
                setShowMovePickerFor(null);
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                fontSize: '12px',
                background: 'transparent',
                border: 0,
                color: 'var(--text-main, #f4f4f5)',
                cursor: 'pointer',
                borderRadius: '4px',
                textAlign: 'left',
              }}
            >
              <Palette size={14} />
              <span>Color / Tint</span>
              <ChevronRight size={12} style={{ marginLeft: 'auto' }} />
            </button>

            {showColorPickerFor === targetMenuFolder.id && (
              <div
                style={{
                  padding: '6px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '6px',
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: '4px',
                  margin: '4px 0',
                }}
              >
                {FOLDER_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    title={c.name}
                    onClick={() => {
                      triggerFolderUpdate(targetMenuFolder.id, { color: c.value });
                      setMenuFolderId(null);
                    }}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      backgroundColor: c.value,
                      border:
                        targetMenuFolder.color === c.value
                          ? '2px solid #ffffff'
                          : '1px solid rgba(255,255,255,0.2)',
                      cursor: 'pointer',
                    }}
                  />
                ))}
                <button
                  type="button"
                  title="Remove color tint"
                  onClick={() => {
                    triggerFolderUpdate(targetMenuFolder.id, { color: undefined });
                    setMenuFolderId(null);
                  }}
                  style={{
                    gridColumn: 'span 4',
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '3px',
                    color: 'var(--text-muted, #71717a)',
                    fontSize: '10px',
                    padding: '2px 4px',
                    cursor: 'pointer',
                    marginTop: 2,
                  }}
                >
                  Clear color
                </button>
              </div>
            )}
          </div>

          {/* 4. Move to… */}
          {targetMenuFolder.id !== 'inbox' && !targetMenuFolder.system && (
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="dropdown-item"
                onClick={() => {
                  setShowMovePickerFor((prev) => (prev ? null : targetMenuFolder.id));
                  setShowColorPickerFor(null);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  fontSize: '12px',
                  background: 'transparent',
                  border: 0,
                  color: 'var(--text-main, #f4f4f5)',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  textAlign: 'left',
                }}
              >
                <CornerDownRight size={14} />
                <span>Move to…</span>
                <ChevronRight size={12} style={{ marginLeft: 'auto' }} />
              </button>

              {showMovePickerFor === targetMenuFolder.id && (
                <div
                  style={{
                    maxHeight: '160px',
                    overflowY: 'auto',
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: '4px',
                    padding: '4px',
                    margin: '4px 0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  {/* Root level option */}
                  {targetMenuFolder.parentId && (
                    <button
                      type="button"
                      onClick={() => {
                        triggerFolderMove(targetMenuFolder.id, undefined);
                        setMenuFolderId(null);
                      }}
                      style={{
                        padding: '4px 6px',
                        fontSize: '11px',
                        color: 'var(--text-main, #f4f4f5)',
                        background: 'transparent',
                        border: 0,
                        textAlign: 'left',
                        cursor: 'pointer',
                        borderRadius: '3px',
                      }}
                    >
                      / (Root level)
                    </button>
                  )}
                  {folders
                    .filter(
                      (f) =>
                        f.id !== targetMenuFolder.id &&
                        f.id !== targetMenuFolder.parentId &&
                        !isDescendant(targetMenuFolder.id, f.id) &&
                        (f.depth ?? 0) < 6
                    )
                    .map((dest) => (
                      <button
                        key={dest.id}
                        type="button"
                        onClick={() => {
                          triggerFolderMove(targetMenuFolder.id, dest.id);
                          setMenuFolderId(null);
                        }}
                        style={{
                          padding: '4px 6px',
                          fontSize: '11px',
                          color: 'var(--text-main, #f4f4f5)',
                          background: 'transparent',
                          border: 0,
                          textAlign: 'left',
                          cursor: 'pointer',
                          borderRadius: '3px',
                          paddingLeft: `${6 + (dest.depth ?? 0) * 8}px`,
                        }}
                        className="truncate"
                      >
                        {dest.name}
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* 5. Passkey Protection & Lock / Unlock */}
          {targetMenuFolder.private ? (
            <>
              {lockedFolderIdSet.has(targetMenuFolder.id) ? (
                <button
                  type="button"
                  className="dropdown-item"
                  onClick={() => {
                    setMenuFolderId(null);
                    if (onUnlockFolder) {
                      onUnlockFolder(targetMenuFolder.id);
                    } else {
                      window.dispatchEvent(
                        new CustomEvent('inknote-request-unlock', {
                          detail: {
                            folderId: targetMenuFolder.id,
                            thenOpenJournal: targetMenuFolder.id === 'journal',
                          },
                        })
                      );
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    fontSize: '12px',
                    background: 'transparent',
                    border: 0,
                    color: 'var(--text-main, #f4f4f5)',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    textAlign: 'left',
                  }}
                >
                  <Unlock size={14} />
                  <span>Unlock folder</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="dropdown-item"
                  onClick={() => {
                    setMenuFolderId(null);
                    if (onLockFolder) {
                      onLockFolder(targetMenuFolder.id);
                    } else {
                      window.dispatchEvent(
                        new CustomEvent('inknote-lock-folder', {
                          detail: { folderId: targetMenuFolder.id },
                        })
                      );
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    fontSize: '12px',
                    background: 'transparent',
                    border: 0,
                    color: 'var(--text-main, #f4f4f5)',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    textAlign: 'left',
                  }}
                >
                  <Lock size={14} />
                  <span>Lock folder now</span>
                </button>
              )}
              <button
                type="button"
                className="dropdown-item"
                onClick={() => {
                  setMenuFolderId(null);
                  triggerFolderUpdate(targetMenuFolder.id, { private: false });
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  fontSize: '12px',
                  background: 'transparent',
                  border: 0,
                  color: 'var(--text-muted, #a1a1aa)',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  textAlign: 'left',
                }}
              >
                <Unlock size={14} />
                <span>Remove passkey protection</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              className="dropdown-item"
              onClick={() => {
                setMenuFolderId(null);
                window.dispatchEvent(
                  new CustomEvent('inknote-request-unlock', {
                    detail: { folderId: targetMenuFolder.id, isProtectAction: true },
                  })
                );
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                fontSize: '12px',
                background: 'transparent',
                border: 0,
                color: 'var(--text-main, #f4f4f5)',
                cursor: 'pointer',
                borderRadius: '4px',
                textAlign: 'left',
              }}
            >
              <Lock size={14} />
              <span>Protect with passkey</span>
            </button>
          )}

          {/* Reset passkey feature */}
          <button
            type="button"
            className="dropdown-item"
            onClick={() => {
              setMenuFolderId(null);
              window.dispatchEvent(
                new CustomEvent('inknote-request-reset-password', {
                  detail: { folderId: targetMenuFolder.id, thenOpenJournal: targetMenuFolder.id === 'journal' },
                })
              );
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 8px',
              fontSize: '12px',
              background: 'transparent',
              border: 0,
              color: 'var(--text-main, #f4f4f5)',
              cursor: 'pointer',
              borderRadius: '4px',
              textAlign: 'left',
            }}
          >
            <Key size={14} />
            <span>Reset passkey</span>
          </button>

          {/* 6. Delete (Ordinary folders can be deleted; Inbox is protected) */}
          {targetMenuFolder.id !== 'inbox' && !targetMenuFolder.system && onDeleteFolder && (
            <>
              <div
                style={{
                  height: '1px',
                  background: 'rgba(255,255,255,0.06)',
                  margin: '2px 0',
                }}
              />
              <button
                type="button"
                className="dropdown-item is-danger"
                onClick={() => {
                  setMenuFolderId(null);
                  setFolderToDelete(targetMenuFolder);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  fontSize: '12px',
                  background: 'transparent',
                  border: 0,
                  color: '#ef4444',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  textAlign: 'left',
                }}
              >
                <Trash2 size={14} />
                <span>Delete folder</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Delete Folder Confirmation Modal */}
      <InknoteDeleteFolderModal
        isOpen={Boolean(folderToDelete)}
        folder={folderToDelete}
        notesCount={
          folderToDelete
            ? rollupCounts.get(folderToDelete.id) ?? 0
            : 0
        }
        onConfirm={() => {
          if (folderToDelete && onDeleteFolder) {
            onDeleteFolder(folderToDelete.id);
            setFolderToDelete(null);
          }
        }}
        onClose={() => setFolderToDelete(null)}
      />

      {/* One-time Journal Setup Prompt Modal */}
      {showJournalSetupPrompt && (
        <div
          className="modal-overlay"
          style={{
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            backgroundColor: 'rgba(9, 9, 11, 0.82)',
            transition: 'opacity 200ms ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            className="modal-card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              maxWidth: '340px',
              width: '90%',
              padding: '28px 24px',
              background: 'var(--bg-card, #18181b)',
              border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
              borderRadius: '10px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.65)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '14px',
                color: 'var(--text-main, #f4f4f5)',
              }}
            >
              <Lock size={20} strokeWidth={1.5} />
            </div>

            <h2
              style={{
                fontSize: '15px',
                fontWeight: 500,
                margin: '0 0 6px 0',
                color: 'var(--text-main, #f4f4f5)',
              }}
            >
              Protect your journal with your passkey?
            </h2>

            <p
              style={{
                fontSize: '12px',
                color: 'var(--text-muted, #71717a)',
                margin: '0 0 20px 0',
                lineHeight: 1.45,
              }}
            >
              Keep your daily thoughts private and encrypted. Only you can unlock them with your
              passkey.
            </p>

            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  try {
                    localStorage.setItem('inknote-journal-setup-prompted', 'skipped');
                  } catch {}
                  setShowJournalSetupPrompt(false);
                  onOpenDailyJournal();
                }}
                style={{ flex: 1, padding: '8px', borderRadius: '6px', fontSize: '12px' }}
              >
                Not now
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  try {
                    localStorage.setItem('inknote-journal-setup-prompted', 'true');
                  } catch {}
                  setShowJournalSetupPrompt(false);
                  const journalFolder = folders.find(
                    (f) => f.id === 'journal' || f.name.toLowerCase() === 'journal'
                  );
                  if (journalFolder) {
                    triggerFolderUpdate(journalFolder.id, { private: true });
                  }
                  window.dispatchEvent(
                    new CustomEvent('inknote-request-unlock', {
                      detail: {
                        folderId: journalFolder?.id || 'journal',
                        thenOpenJournal: true,
                        isProtectAction: true,
                      },
                    })
                  );
                }}
                style={{ flex: 1, padding: '8px', borderRadius: '6px', fontSize: '12px' }}
              >
                Protect Journal
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

export const InknoteSidebar = memo(InknoteSidebarComponent);

