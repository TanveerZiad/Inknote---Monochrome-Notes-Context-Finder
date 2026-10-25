import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Sparkles, Network, FileText, Plus, CheckSquare, Lock, Unlock } from 'lucide-react';

// Types
import { NoteItem, NoteRevision } from './types/workspace';

// Custom Hooks
import { useInknoteHistory } from './hooks/useInknoteHistory';
import { useInknoteWorkspace, getInitialWorkspace } from './hooks/useInknoteWorkspace';
import { useInknoteSecurity } from './hooks/useInknoteSecurity';
import { useInknoteShortcuts } from './hooks/useInknoteShortcuts';

// Modular Components
import { InknoteSidebar } from './components/InknoteSidebar';
import { InknoteTopbar } from './components/InknoteTopbar';
import { InknoteCard } from './components/InknoteCard';
import { InknoteUtilityDrawer } from './components/InknoteUtilityDrawer';
import { InknoteCommandPalette, CommandItem } from './components/Modals/InknoteCommandPalette';
import { InknoteSecurityModal } from './components/Modals/InknoteSecurityModal';
import { InknoteLanding } from './components/LandingPage/InknoteLanding';

// Utilities
import { semanticScore } from './utils/searchEngine';

const THEME_KEY = 'inknote-theme';

export default function App() {
  // Theme Management
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return (
      localStorage.getItem(THEME_KEY) === 'dark' ||
      (typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches)
    );
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      localStorage.setItem(THEME_KEY, 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      localStorage.setItem(THEME_KEY, 'light');
    }
  }, [isDarkMode]);

  // Layout & Overlays State
  const [currentView, setCurrentView] = useState<'landing' | 'workspace'>('landing');
  const [isGridVisible, setIsGridVisible] = useState<boolean>(() => {
    return localStorage.getItem('inknote-grid-visible') !== 'false';
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'assistant' | 'graph' | 'history' | 'sync'>('assistant');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  const handleToggleGrid = useCallback(() => {
    setIsGridVisible((prev) => {
      const next = !prev;
      localStorage.setItem('inknote-grid-visible', String(next));
      return next;
    });
  }, []);

  // Search Query
  const [query, setQuery] = useState('');

  // Track expanded card IDs individually
  const [expandedNoteIds, setExpandedNoteIds] = useState<string[]>(() => {
    return getInitialWorkspace()
      .notes.filter((n) => n.size === 'expanded')
      .map((n) => n.id);
  });

  // 1. History Hook (Debounced Snapshot Stack)
  const { pushSnapshot, undo, redo, canUndo } = useInknoteHistory(getInitialWorkspace());

  // 2. Workspace Domain Hook
  const {
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
    vaultStatus,
    isVaultSyncing,
    openVaultFolder,
    rescanVault,
    changeVaultDirectory,
  } = useInknoteWorkspace(pushSnapshot);

  // 3. Security Hook (AES-GCM / PBKDF2 without leaks)
  const {
    unlockedNoteIds,
    unlockedFolderIds,
    unlockedPayloads,
    securityDialog,
    passcode,
    setPasscode,
    securityError,
    isSecuring,
    lockFolder,
    lockAll,
    requestToggleNoteLock,
    submitSecurity,
    closeSecurityDialog,
    openUnlockDialog,
    resetPassword,
    clearPasskeyProtection,
  } = useInknoteSecurity(workspace, setWorkspace, commitWorkspace);

  const isCurrentFolderLocked = useMemo(() => {
    if (!activeFolder || !activeFolder.private) return false;
    return !unlockedFolderIds.includes(activeFolder.id);
  }, [activeFolder, unlockedFolderIds]);

  // Select note handler with security guard
  const handleSelectNote = useCallback(
    (note: NoteItem) => {
      if (note.locked && !unlockedNoteIds.includes(note.id)) {
        openUnlockDialog(note.id);
        return;
      }
      setSelectedNoteId(note.id);
      setActiveFolderId(note.folderId);
      setQuery('');
    },
    [openUnlockDialog, setSelectedNoteId, setActiveFolderId, unlockedNoteIds]
  );

  const handleToggleExpandNote = useCallback(
    (noteId: string) => {
      setExpandedNoteIds((prev) => {
        const isCurrentlyExpanded = prev.includes(noteId);
        const next = isCurrentlyExpanded
          ? prev.filter((id) => id !== noteId)
          : [...prev, noteId];
        updateNote(noteId, { size: isCurrentlyExpanded ? 'compact' : 'expanded' });
        return next;
      });
    },
    [updateNote]
  );

  const handleCreateNewNote = useCallback(() => {
    setCurrentView('workspace');
    createNote();
  }, [createNote]);

  const handleOpenDailyJournal = useCallback(() => {
    setCurrentView('workspace');
    openDailyJournal();
  }, [openDailyJournal]);

  // 4. Keyboard Shortcuts Hook (Input guarded)
  useInknoteShortcuts({
    onToggleCommandPalette: () => setIsCommandPaletteOpen((prev) => !prev),
    onEscape: () => {
      setIsCommandPaletteOpen(false);
      setIsDrawerOpen(false);
      closeSecurityDialog();
    },
    onNewNote: handleCreateNewNote,
    onUndo: () => undo(workspace, setWorkspace),
    onRedo: () => redo(workspace, setWorkspace),
    onOpenDailyJournal: handleOpenDailyJournal,
    onToggleGrid: handleToggleGrid,
  });

  // Search Results Scoring
  const searchResults = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    const lockedFolderIds = new Set(
      workspace.folders
        .filter((f) => f.private && !unlockedFolderIds.includes(f.id))
        .map((f) => f.id)
    );
    return workspace.notes
      .filter((note) => !lockedFolderIds.has(note.folderId))
      .map((note) => ({
        note,
        score: semanticScore(
          note,
          workspace.folders.find((f) => f.id === note.folderId)?.name ?? '',
          normalized
        ),
      }))
      .filter(({ score }) => score > 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          +new Date(b.note.updatedAt) - +new Date(a.note.updatedAt)
      )
      .slice(0, 6);
  }, [query, workspace, unlockedFolderIds]);

  // Command Palette Items
  const commandItems: CommandItem[] = useMemo(
    () => [
      { label: 'Create new note', shortcut: '⌘N', action: handleCreateNewNote },
      { label: 'Open today’s journal', shortcut: '⌘⇧J', action: handleOpenDailyJournal },
      {
        label: isGridVisible ? 'Hide engineering grid' : 'Show engineering grid',
        shortcut: '⌘G',
        action: handleToggleGrid,
      },
      {
        label: currentView === 'landing' ? 'Open Workspace' : 'Return to Landing Page / Home',
        shortcut: '⌘H',
        action: () => setCurrentView((prev) => (prev === 'landing' ? 'workspace' : 'landing')),
      },
      { label: 'Open notes folder in File Explorer', shortcut: '⌘O', action: openVaultFolder },
      { label: 'Rescan notes from folder', shortcut: '⌘R', action: rescanVault },
      {
        label: 'Folder Vault & Sync settings',
        shortcut: '',
        action: () => {
          setIsDrawerOpen(true);
          setDrawerTab('sync');
        },
      },
      {
        label: 'Ask Inknote AI',
        shortcut: '',
        action: () => {
          setIsDrawerOpen(true);
          setDrawerTab('assistant');
        },
      },
      {
        label: 'View Knowledge Graph',
        shortcut: '',
        action: () => {
          setIsDrawerOpen(true);
          setDrawerTab('graph');
        },
      },
      {
        label: 'Version History',
        shortcut: '',
        action: () => {
          setIsDrawerOpen(true);
          setDrawerTab('history');
        },
      },
      { label: 'Export backup (.json)', shortcut: '', action: exportWorkspace },
      {
        label: 'Toggle dark mode',
        shortcut: '',
        action: () => setIsDarkMode((prev) => !prev),
      },
    ],
    [handleCreateNewNote, handleOpenDailyJournal, currentView, exportWorkspace, openVaultFolder, rescanVault]
  );

  const handleRestoreRevision = useCallback(
    (revision: NoteRevision) => {
      updateNote(revision.noteId, {
        title: revision.title,
        content: revision.content,
      });
    },
    [updateNote]
  );

  if (currentView === 'landing') {
    return (
      <div className="view-enter-transition">
        <InknoteLanding
          onNewNote={handleCreateNewNote}
          onOpenWorkspace={() => setCurrentView('workspace')}
          isDarkMode={isDarkMode}
          onToggleDarkMode={() => setIsDarkMode((prev) => !prev)}
          notesCount={workspace.notes.length}
          foldersCount={workspace.folders.length}
        />
        <InknoteCommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          commands={commandItems}
        />
      </div>
    );
  }

  return (
    <main className="inknote-shell view-enter-transition">
      {/* 1. Collapsible Sidebar */}
      <InknoteSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        activeFolderId={activeFolderId}
        onSelectFolder={(id) => {
          setActiveFolderId(id);
          setShowTasksOnly(false);
          setTagFilter(null);
        }}
        folders={folders}
        allNotes={workspace.notes}
        showTasksOnly={showTasksOnly}
        onToggleTasksOnly={() => {
          setShowTasksOnly((prev) => !prev);
          setTagFilter(null);
        }}
        onOpenDailyJournal={openDailyJournal}
        onCreateFolder={createFolder}
        onTogglePinFolder={togglePinFolder}
        onMoveFolder={moveFolder}
        onDragStartFolder={setDraggedFolderId}
        onDragEndFolder={() => setDraggedFolderId(null)}
        onDropFolder={reorderFolder}
        onUpdateFolder={updateFolder}
        onLockFolder={lockFolder}
        onUnlockFolder={(fid) => openUnlockDialog(undefined, fid, fid === 'journal')}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode((prev) => !prev)}
        onOpenSyncDrawer={() => {
          setIsDrawerOpen(true);
          setDrawerTab('sync');
        }}
        onOpenVaultFolder={openVaultFolder}
        onDeleteFolder={deleteFolder}
        onGoToLanding={() => setCurrentView('landing')}
      />

      {/* 2. Main Workspace */}
      <section className={`inknote-workspace ${isGridVisible ? '' : 'no-grid'}`}>
        {/* Sticky Topbar */}
        <InknoteTopbar
          isSidebarOpen={isSidebarOpen}
          onOpenSidebar={() => setIsSidebarOpen(true)}
          activeFolderId={activeFolderId}
          activeFolder={activeFolder}
          showTasksOnly={showTasksOnly}
          tagFilter={tagFilter}
          query={query}
          onChangeQuery={setQuery}
          onClearQuery={() => setQuery('')}
          searchResults={searchResults}
          onSelectSearchResult={handleSelectNote}
          allFolders={workspace.folders}
          onToggleCommandPalette={() => setIsCommandPaletteOpen(true)}
          canUndo={canUndo}
          onUndo={() => undo(workspace, setWorkspace)}
          onCreateNote={createNote}
          vaultStatus={vaultStatus}
          isVaultSyncing={isVaultSyncing}
          onOpenVaultFolder={openVaultFolder}
          onOpenSyncDrawer={() => {
            setIsDrawerOpen(true);
            setDrawerTab('sync');
          }}
          isFolderLocked={isCurrentFolderLocked}
          onLockFolder={() => activeFolder && lockFolder(activeFolder.id)}
          onUnlockFolder={() =>
            activeFolder && openUnlockDialog(undefined, activeFolder.id, activeFolder.id === 'journal')
          }
          onGoToLanding={() => setCurrentView('landing')}
          showGrid={isGridVisible}
          onToggleGrid={handleToggleGrid}
        />

        {/* Workspace Content */}
        <div className="workspace-content">
          {/* Active Tag Filter Reset Banner */}
          {tagFilter && (
            <div className="content-filter-row">
              <div className="filter-left">
                <span>Filtering by:</span>
                <span
                  className="tag-pill"
                  style={{
                    background: 'var(--accent)',
                    color: 'var(--accent-contrast)',
                  }}
                >
                  #{tagFilter}
                </span>
              </div>
              <button
                className="btn-secondary"
                style={{ height: '28px', fontSize: '11px', padding: '0 8px' }}
                onClick={() => setTagFilter(null)}
              >
                Clear filter
              </button>
            </div>
          )}

          {/* Notes Grid */}
          <section className="note-grid" aria-label="Notes">
            {isCurrentFolderLocked ? (
              <div className="locked-folder-screen">
                <div className="locked-shield-circle">
                  <Lock size={32} />
                </div>
                <h3>{activeFolder?.name || 'Folder'} is Locked</h3>
                <p>
                  This space is protected with passkey encryption. Notes and previews are safely hidden.
                </p>
                <button
                  className="btn-primary"
                  onClick={() =>
                    openUnlockDialog(undefined, activeFolder?.id, activeFolder?.id === 'journal')
                  }
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '9px 20px',
                    fontSize: '13px',
                    borderRadius: '6px',
                  }}
                >
                  <Unlock size={15} />
                  <span>Unlock {activeFolder?.name || 'Folder'}</span>
                </button>
              </div>
            ) : visibleNotes.length > 0 ? (
              visibleNotes.map((note) => {
                const isUnlocked = unlockedNoteIds.includes(note.id);
                return (
                  <InknoteCard
                    key={note.id}
                    note={note}
                    folder={workspace.folders.find((f) => f.id === note.folderId)}
                    isSelected={selectedNoteId === note.id}
                    isUnlocked={isUnlocked}
                    unlockedPayload={unlockedPayloads[note.id]}
                    allNotes={workspace.notes}
                    isExpanded={expandedNoteIds.includes(note.id)}
                    onToggleExpand={handleToggleExpandNote}
                    onSelect={setSelectedNoteId}
                    onUpdate={updateNote}
                    onDelete={deleteNote}
                    onTogglePin={togglePinNote}
                    onRequestToggleLock={requestToggleNoteLock}
                    onOpenUnlockDialog={openUnlockDialog}
                    onExport={exportNote}
                    onDragStart={setDraggedNoteId}
                    onDragEnd={() => setDraggedNoteId(null)}
                    onDropOver={reorderNote}
                    tagFilter={tagFilter}
                    onToggleTagFilter={(tag) =>
                      setTagFilter((prev) => (prev === tag ? null : tag))
                    }
                  />
                );
              })
            ) : showTasksOnly ? (
              <div className="empty-state">
                <CheckSquare size={32} className="text-emerald-500" />
                <strong>All tasks completed!</strong>
                <p>You have finished all actionable checklist items. Create a new task list or switch folders.</p>
                <button className="btn-primary" onClick={() => createNote()}>
                  <Plus size={16} />
                  <span>Create task note</span>
                </button>
              </div>
            ) : (
              <div className="empty-state">
                <FileText size={32} className="text-muted" />
                <strong>No notes in this folder</strong>
                <p>Create your first thought or choose another folder from the sidebar.</p>
                <button className="btn-primary" onClick={() => createNote()}>
                  <Plus size={16} />
                  <span>Create note</span>
                </button>
              </div>
            )}
          </section>
        </div>

        {/* Floating Utility Pill Trigger */}
        <div className="floating-dock-pill">
          <button
            className={`dock-pill-btn ${isDrawerOpen && drawerTab === 'assistant' ? 'is-active' : ''
              }`}
            onClick={() => {
              setIsDrawerOpen(true);
              setDrawerTab('assistant');
            }}
          >
            <Sparkles size={15} />
            <span>Ask Inknote</span>
            <span className="dock-pill-badge">{contextNotes.length}</span>
          </button>
          <div
            style={{
              width: '1px',
              height: '18px',
              background: 'var(--border-subtle)',
            }}
          />
          <button
            className={`dock-pill-btn ${isDrawerOpen && drawerTab !== 'assistant' ? 'is-active' : ''
              }`}
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
        <InknoteUtilityDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          tab={drawerTab}
          onTabChange={setDrawerTab}
          workspace={workspace}
          selectedNote={selectedNote}
          contextNotes={contextNotes}
          ask={ask}
          onChangeAsk={setAsk}
          onSubmitAsk={askInknote}
          contextAnswer={contextAnswer}
          contextMatches={contextMatches}
          onSaveContextAnswer={saveContextAnswer}
          onSelectNote={handleSelectNote}
          onRestoreRevision={handleRestoreRevision}
          onExportWorkspace={exportWorkspace}
          onImportWorkspaceFile={importWorkspaceFile}
          onEnableGitBackup={() => {
            commitWorkspace({ ...workspace, syncMode: 'git-backup' });
            exportWorkspace();
          }}
          vaultStatus={vaultStatus}
          isVaultSyncing={isVaultSyncing}
          onOpenVaultFolder={openVaultFolder}
          onRescanVault={rescanVault}
          onChangeVaultDirectory={changeVaultDirectory}
        />
      </section>

      {/* Command Palette Modal */}
      <InknoteCommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        commands={commandItems}
      />

      {/* Security Lock/Unlock Passcode Modal */}
      {securityDialog && (
        <InknoteSecurityModal
          isOpen={true}
          mode={securityDialog.mode}
          folderInfo={securityDialog}
          passcode={passcode}
          onChangePasscode={setPasscode}
          onSubmit={submitSecurity}
          onClose={closeSecurityDialog}
          error={securityError}
          isSecuring={isSecuring}
          onResetPassword={resetPassword}
          onClearProtection={clearPasskeyProtection}
        />
      )}
    </main>
  );
}
