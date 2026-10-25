import React, { memo, useState, useEffect, useRef } from 'react';
import {
  PanelLeft,
  Search,
  X,
  RotateCcw,
  Plus,
  FileText,
  Folder,
  RefreshCw,
  Download,
  Lock,
  Unlock,
  Home,
  Grid,
} from 'lucide-react';
import { NoteItem, FolderItem } from '../types/workspace';
import { snippet } from '../utils/searchEngine';
import { VaultStatus } from '../lib/vaultBackend';
import { exportNote, FORMATS } from '../exporters';
import { sendNativeAppNotification } from '../utils';

interface InknoteTopbarProps {
  isSidebarOpen: boolean;
  onOpenSidebar: () => void;
  activeFolderId: string;
  activeFolder?: FolderItem;
  activeNote?: NoteItem;
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
  vaultStatus?: VaultStatus;
  isVaultSyncing?: boolean;
  onOpenVaultFolder?: () => void;
  onOpenSyncDrawer?: () => void;
  isFolderLocked?: boolean;
  onLockFolder?: () => void;
  onUnlockFolder?: () => void;
  onGoToLanding?: () => void;
  showGrid?: boolean;
  onToggleGrid?: () => void;
}

const InknoteTopbarComponent: React.FC<InknoteTopbarProps> = ({
  isSidebarOpen,
  onOpenSidebar,
  activeFolderId,
  activeFolder,
  activeNote,
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
  vaultStatus,
  isVaultSyncing,
  onOpenVaultFolder,
  onOpenSyncDrawer,
  isFolderLocked,
  onLockFolder,
  onUnlockFolder,
  onGoToLanding,
  showGrid,
  onToggleGrid,
}) => {
  const [isExportOpen, setIsExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setIsExportOpen(false);
      }
    };
    if (isExportOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExportOpen]);
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1>{headingText}</h1>
            {activeFolder?.private && (
              isFolderLocked ? (
                <button
                  type="button"
                  className="folder-lock-status-btn is-locked"
                  onClick={onUnlockFolder}
                  title="Folder is locked with passkey. Click to unlock."
                >
                  <Lock size={12} />
                  <span>Locked</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="folder-lock-status-btn is-unlocked"
                  onClick={onLockFolder}
                  title="Folder is unlocked for this session. Click to lock now."
                >
                  <Lock size={12} />
                  <span>Lock folder</span>
                </button>
              )
            )}
          </div>
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
        {/* Local Folder / Vault Indicator & Reveal in Explorer */}
        <button
          className="vault-pill-btn"
          onClick={onOpenVaultFolder}
          title={
            vaultStatus?.connected
              ? `Local Notes Folder: ${vaultStatus.vaultPath}\nClick to view files in File Explorer`
              : 'Connecting to local folder...'
          }
          aria-label="Open local notes folder in Explorer"
        >
          <Folder size={14} className="text-muted" />
          <span className="vault-pill-label">
            {vaultStatus?.vaultPath ? vaultStatus.vaultPath.split(/[/\\]/).pop() : 'inknote-vault'}
          </span>
          <span
            className={`vault-status-dot ${
              isVaultSyncing ? 'is-syncing' : vaultStatus?.connected ? 'is-online' : 'is-offline'
            }`}
          />
        </button>

        {activeNote && (
          <div className="relative" ref={exportRef}>
            <button
              className="icon-button"
              onClick={() => setIsExportOpen(!isExportOpen)}
              title="Export note as…"
              aria-label="Export note as…"
            >
              <Download size={16} />
            </button>
            {isExportOpen && (
              <div
                className="absolute right-0 top-full mt-1 w-44 py-1 rounded shadow-lg border z-50 flex flex-col text-xs bg-slate-900 border-slate-700 text-slate-200"
              >
                <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700">
                  Export As…
                </div>
                {Object.entries(FORMATS).map(([fmtId, fmt]) => (
                  <button
                    key={fmtId}
                    type="button"
                    onClick={async () => {
                      setIsExportOpen(false);
                      try {
                        await exportNote(
                          {
                            title: activeNote.title,
                            content: activeNote.content,
                            locked: activeNote.locked,
                          },
                          fmtId as any
                        );
                        await sendNativeAppNotification(
                          'Export Successful',
                          `Exported "${activeNote.title || 'Untitled'}" as ${fmt.label}`
                        );
                      } catch (err: any) {
                        alert(err?.message || 'Export failed');
                      }
                    }}
                    className="w-full text-left px-2.5 py-1 hover:bg-blue-500/10 hover:text-blue-500 transition-colors"
                  >
                    {fmt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {onGoToLanding && (
          <button
            className="icon-button"
            onClick={onGoToLanding}
            title="Landing Page & Overview"
            aria-label="Landing Page & Overview"
          >
            <Home size={16} />
          </button>
        )}
        {onToggleGrid && (
          <button
            className={`icon-button ${showGrid ? 'text-blue-500' : 'opacity-60'}`}
            onClick={onToggleGrid}
            title={showGrid ? 'Hide engineering grid (⌘G)' : 'Show engineering grid (⌘G)'}
            aria-label="Toggle grid"
          >
            <Grid size={16} />
          </button>
        )}
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
