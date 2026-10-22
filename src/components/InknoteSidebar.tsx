import React, { useState, useRef, useEffect, memo } from 'react';
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
} from 'lucide-react';
import { FolderItem, NoteItem } from '../types/workspace';
import { InknoteDeleteFolderModal } from './Modals/InknoteDeleteFolderModal';

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
  onCreateFolder: (name: string) => void;
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
}) => {
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderToDelete, setFolderToDelete] = useState<FolderItem | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isComposerOpen) {
      inputRef.current?.focus();
    }
  }, [isComposerOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) return;
    onCreateFolder(folderName);
    setFolderName('');
    setIsComposerOpen(false);
  };

  const actionableCount = allNotes.filter((n) => /^\s*[-*+]\s*\[ \]/m.test(n.content)).length;

  return (
    <aside className={`inknote-sidebar ${isOpen ? '' : 'is-collapsed'}`}>
      {/* Topline Logo & Collapse */}
      <div className="sidebar-topline">
        <div className="wordmark">
          <span className="wordmark-mark">I</span>
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
        <button
          className={`nav-item ${
            activeFolderId === 'all' && !showTasksOnly ? 'is-active' : ''
          }`}
          onClick={() => onSelectFolder('all')}
        >
          <Archive size={16} />
          <span>All notes</span>
          <b>{allNotes.length}</b>
        </button>
        <button
          className={`nav-item ${showTasksOnly ? 'is-active' : ''}`}
          onClick={onToggleTasksOnly}
        >
          <CheckSquare size={16} />
          <span>Actionable tasks</span>
          <b>{actionableCount}</b>
        </button>
        <button className="nav-item" onClick={onOpenDailyJournal}>
          <CalendarDays size={16} />
          <span>Today’s journal</span>
        </button>
      </div>

      {/* Folders Section Header */}
      <div className="folder-label-row">
        <span>Folders</span>
        <button
          className="tiny-action"
          onClick={() => setIsComposerOpen((prev) => !prev)}
          aria-label="Add folder"
          title="New folder"
        >
          <FolderPlus size={15} />
        </button>
      </div>

      {/* New Folder Composer */}
      {isComposerOpen && (
        <form className="folder-composer" onSubmit={handleSubmit}>
          <Folder size={14} className="text-muted" />
          <input
            ref={inputRef}
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setIsComposerOpen(false);
            }}
            placeholder="Folder name..."
          />
          <button type="submit" className="tiny-action" aria-label="Save folder">
            <Plus size={14} />
          </button>
        </form>
      )}

      {/* Folders List */}
      <nav className="folder-list" aria-label="Folders list">
        {folders.map((folder) => {
          const count = allNotes.filter((note) => note.folderId === folder.id).length;
          const isActive = activeFolderId === folder.id && !showTasksOnly;
          return (
            <div
              key={folder.id}
              className={`folder-row ${isActive ? 'is-active' : ''}`}
              draggable
              onDragStart={() => onDragStartFolder(folder.id)}
              onDragEnd={onDragEndFolder}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDropFolder(folder.id)}
              style={{ paddingLeft: `${6 + (folder.depth ?? 0) * 14}px` }}
            >
              <button
                className="folder-select"
                onClick={() => onSelectFolder(folder.id)}
              >
                <Folder size={15} fill={isActive ? 'currentColor' : 'none'} />
                <span>{folder.name}</span>
                <em>{count}</em>
              </button>
              <div className="folder-tools">
                <button
                  onClick={() => onTogglePinFolder(folder.id)}
                  title={folder.pinned ? 'Unpin' : 'Pin'}
                >
                  <Pin size={12} fill={folder.pinned ? 'currentColor' : 'none'} />
                </button>
                <button
                  onClick={() => onMoveFolder(folder.id, -1)}
                  title="Move up"
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  onClick={() => onMoveFolder(folder.id, 1)}
                  title="Move down"
                >
                  <ArrowDown size={12} />
                </button>
                {onDeleteFolder && (
                  <button
                    className="danger-hover"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFolderToDelete(folder);
                    }}
                    title="Delete folder"
                    aria-label={`Delete folder ${folder.name}`}
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
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

      {/* Delete Folder Confirmation Modal */}
      <InknoteDeleteFolderModal
        isOpen={Boolean(folderToDelete)}
        folder={folderToDelete}
        notesCount={
          folderToDelete
            ? allNotes.filter((n) => n.folderId === folderToDelete.id).length
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
    </aside>
  );
};

export const InknoteSidebar = memo(InknoteSidebarComponent);
