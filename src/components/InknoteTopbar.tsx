import React, { memo } from 'react';
import { PanelLeft, Search, X, RotateCcw, Plus, FileText } from 'lucide-react';
import { NoteItem, FolderItem } from '../types/workspace';
import { snippet } from '../utils/searchEngine';

interface InknoteTopbarProps {
  isSidebarOpen: boolean;
  onOpenSidebar: () => void;
  activeFolderId: string;
  activeFolder?: FolderItem;
  showTasksOnly: boolean;
  tagFilter: string | null;
  query: string;
  onChangeQuery: (val: string) => void;
  onClearQuery: () => void;
  searchResults: Array<{ note: NoteItem }>;
  onSelectSearchResult: (note: NoteItem) => void;
  allFolders: FolderItem[];
  onToggleCommandPalette: () => void;
  canUndo: boolean;
  onUndo: () => void;
  onCreateNote: () => void;
}

const InknoteTopbarComponent: React.FC<InknoteTopbarProps> = ({
  isSidebarOpen,
  onOpenSidebar,
  activeFolderId,
  activeFolder,
  showTasksOnly,
  tagFilter,
  query,
  onChangeQuery,
  onClearQuery,
  searchResults,
  onSelectSearchResult,
  allFolders,
  onToggleCommandPalette,
  canUndo,
  onUndo,
  onCreateNote,
}) => {
  const getFolderName = (folderId: string) =>
    allFolders.find((f) => f.id === folderId)?.name || 'Inbox';

  const headingText = showTasksOnly
    ? 'Actionable Tasks'
    : tagFilter
    ? `#${tagFilter}`
    : activeFolderId === 'all'
    ? 'All Notes'
    : activeFolder?.name ?? 'Notes';

  const eyebrowText =
    activeFolderId === 'all'
      ? 'Library'
      : activeFolder?.pinned
      ? 'Pinned Folder'
      : 'Folder';

  return (
    <header className="workspace-topbar">
      <div className="topbar-left">
        {!isSidebarOpen && (
          <button
            className="icon-button"
            onClick={onOpenSidebar}
            aria-label="Open sidebar"
            title="Open sidebar"
          >
            <PanelLeft size={17} />
          </button>
        )}
        <div className="topbar-breadcrumbs">
          <span className="eyebrow">{eyebrowText}</span>
          <h1>{headingText}</h1>
        </div>
      </div>

      {/* Unified Search Bar */}
      <div className="topbar-center">
        <div className="search-bar">
          <Search size={16} className="text-muted" />
          <input
            value={query}
            onChange={(e) => onChangeQuery(e.target.value)}
            placeholder="Search notes or ask a question..."
          />
          {query ? (
            <button className="tiny-action" onClick={onClearQuery}>
              <X size={14} />
            </button>
          ) : (
            <span
              className="kbd-shortcut"
              onClick={onToggleCommandPalette}
              style={{ cursor: 'pointer' }}
              title="Open Command Palette"
            >
              ⌘K
            </span>
          )}
        </div>

        {/* Search Results Popover */}
        {query.trim().length > 0 && searchResults.length > 0 && (
          <div className="search-popover">
            {searchResults.map(({ note }) => (
              <button
                key={note.id}
                className="search-popover-item"
                onClick={() => onSelectSearchResult(note)}
              >
                <FileText
                  size={16}
                  className="text-muted"
                  style={{ marginTop: '2px', flexShrink: 0 }}
                />
                <div style={{ textAlign: 'left', minWidth: 0 }}>
                  <b className="truncate" style={{ display: 'block' }}>
                    {note.title || 'Untitled note'}
                  </b>
                  <small className="truncate" style={{ display: 'block' }}>
                    {getFolderName(note.folderId)} · {snippet(note).slice(0, 80)}
                  </small>
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
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
        >
          <RotateCcw size={16} />
        </button>
        <button className="btn-primary" onClick={onCreateNote}>
          <Plus size={16} />
          <span>New note</span>
        </button>
      </div>
    </header>
  );
};

export const InknoteTopbar = memo(InknoteTopbarComponent);
