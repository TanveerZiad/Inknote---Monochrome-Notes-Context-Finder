import React, { useRef, memo } from 'react';
import {
  X,
  Send,
  Save,
  TerminalSquare,
  Download,
  Upload,
  GitBranch,
} from 'lucide-react';
import { NoteItem, Workspace, NoteRevision } from '../types/workspace';

interface InknoteUtilityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tab: 'assistant' | 'graph' | 'history' | 'sync';
  onTabChange: (tab: 'assistant' | 'graph' | 'history' | 'sync') => void;
  workspace: Workspace;
  selectedNote?: NoteItem;
  contextNotes: NoteItem[];
  ask: string;
  onChangeAsk: (val: string) => void;
  onSubmitAsk: (e: React.FormEvent) => void;
  contextAnswer: string;
  contextMatches: NoteItem[];
  onSaveContextAnswer: () => void;
  onSelectNote: (note: NoteItem) => void;
  onRestoreRevision: (revision: NoteRevision) => void;
  onExportWorkspace: () => void;
  onImportWorkspaceFile: (file: File) => void;
  onEnableGitBackup: () => void;
}

const InknoteUtilityDrawerComponent: React.FC<InknoteUtilityDrawerProps> = ({
  isOpen,
  onClose,
  tab,
  onTabChange,
  workspace,
  selectedNote,
  contextNotes,
  ask,
  onChangeAsk,
  onSubmitAsk,
  contextAnswer,
  contextMatches,
  onSaveContextAnswer,
  onSelectNote,
  onRestoreRevision,
  onExportWorkspace,
  onImportWorkspaceFile,
  onEnableGitBackup,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const backlinks = selectedNote
    ? workspace.notes.filter(
        (n) =>
          n.id !== selectedNote.id &&
          (n.content || '')
            .toLowerCase()
            .includes(`@${selectedNote.title || ''}`.toLowerCase())
      )
    : [];

  const selectedRevisions = selectedNote
    ? [...(workspace.revisions ?? [])]
        .filter((r) => r.noteId === selectedNote.id)
        .slice(-15)
        .reverse()
    : [];

  return (
    <>
      <div className="utility-slideover-backdrop" onClick={onClose} />
      <aside
        className="utility-slideover"
        role="dialog"
        aria-modal="true"
        aria-label="Inknote Tools Drawer"
      >
        <div className="slideover-header">
          <div className="slideover-tabs">
            <button
              className={`slideover-tab ${tab === 'assistant' ? 'is-active' : ''}`}
              onClick={() => onTabChange('assistant')}
            >
              AI Assistant
            </button>
            <button
              className={`slideover-tab ${tab === 'graph' ? 'is-active' : ''}`}
              onClick={() => onTabChange('graph')}
            >
              Graph
            </button>
            <button
              className={`slideover-tab ${tab === 'history' ? 'is-active' : ''}`}
              onClick={() => onTabChange('history')}
            >
              History
            </button>
            <button
              className={`slideover-tab ${tab === 'sync' ? 'is-active' : ''}`}
              onClick={() => onTabChange('sync')}
            >
              Sync
            </button>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close drawer">
            <X size={16} />
          </button>
        </div>

        <div className="slideover-content">
          {/* 1. AI Assistant Tab */}
          {tab === 'assistant' && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--text-muted)',
                  }}
                >
                  Contextual AI
                </span>
                <span className="dock-pill-badge">{contextNotes.length} in context</span>
              </div>

              <form className="ask-box" onSubmit={onSubmitAsk}>
                <input
                  value={ask}
                  onChange={(e) => onChangeAsk(e.target.value)}
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
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                      }}
                    >
                      Citations
                    </span>
                    {contextMatches.map((note, index) => (
                      <button
                        key={note.id}
                        className="citation-item"
                        onClick={() => onSelectNote(note)}
                      >
                        <b
                          style={{
                            width: '18px',
                            height: '18px',
                            display: 'grid',
                            placeItems: 'center',
                            borderRadius: '50%',
                            background: 'var(--bg-muted)',
                            fontSize: '10px',
                          }}
                        >
                          {index + 1}
                        </b>
                        <b>{note.title || 'Untitled note'}</b>
                        <small>
                          {
                            workspace.folders.find((f) => f.id === note.folderId)
                              ?.name
                          }
                        </small>
                      </button>
                    ))}
                    <button
                      className="btn-primary"
                      style={{
                        height: '32px',
                        fontSize: '11px',
                        marginTop: '8px',
                        justifyContent: 'center',
                      }}
                      onClick={onSaveContextAnswer}
                    >
                      <Save size={14} />
                      Save as note
                    </button>
                  </div>
                )}
              </div>

              {(workspace.traces?.length ?? 0) > 0 && (
                <details
                  style={{
                    marginTop: '20px',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                  }}
                >
                  <summary
                    style={{
                      cursor: 'pointer',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <TerminalSquare size={13} />
                    Retrieval traces ({workspace.traces?.length})
                  </summary>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      marginTop: '8px',
                    }}
                  >
                    {[...(workspace.traces ?? [])]
                      .slice(-5)
                      .reverse()
                      .map((trace) => (
                        <div
                          key={trace.id}
                          style={{
                            padding: '8px',
                            background: 'var(--bg-muted)',
                            borderRadius: '6px',
                          }}
                        >
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

          {/* 2. Knowledge Graph Tab */}
          {tab === 'graph' && (
            <div>
              <h3 style={{ margin: '0 0 6px', fontSize: '14px', fontWeight: 700 }}>
                Knowledge Map
              </h3>
              <p
                style={{
                  margin: '0 0 16px',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                }}
              >
                Notes linked via @Title references. Click to jump.
              </p>
              <div className="graph-container">
                {workspace.notes.map((note) => {
                  const linkCount = workspace.notes.filter(
                    (item) =>
                      item.id !== note.id &&
                      (item.content || '')
                        .toLowerCase()
                        .includes(`@${note.title || ''}`.toLowerCase())
                  ).length;
                  return (
                    <div
                      key={note.id}
                      className={`graph-node ${
                        note.id === selectedNote?.id ? 'is-active' : ''
                      }`}
                      onClick={() => onSelectNote(note)}
                    >
                      <b>{note.title || 'Untitled note'}</b>
                      <small>{linkCount} backlinks</small>
                    </div>
                  );
                })}
              </div>
              {selectedNote && backlinks.length > 0 && (
                <div
                  style={{
                    marginTop: '20px',
                    paddingTop: '14px',
                    borderTop: '1px solid var(--border-subtle)',
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>
                    Backlinks to “{selectedNote.title}”:
                  </span>
                  <div
                    style={{
                      display: 'flex',
                      gap: '6px',
                      flexWrap: 'wrap',
                      marginTop: '8px',
                    }}
                  >
                    {backlinks.map((note) => (
                      <button
                        key={note.id}
                        className="tag-pill"
                        onClick={() => onSelectNote(note)}
                      >
                        {note.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. Version History Tab */}
          {tab === 'history' && (
            <div>
              <h3 style={{ margin: '0 0 6px', fontSize: '14px', fontWeight: 700 }}>
                Version History
              </h3>
              <p
                style={{
                  margin: '0 0 16px',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                }}
              >
                Revisions captured locally for{' '}
                {selectedNote ? `“${selectedNote.title}”` : 'selected note'}.
              </p>
              {selectedRevisions.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {selectedRevisions.map((rev) => (
                    <div
                      key={rev.id}
                      style={{
                        padding: '12px',
                        background: 'var(--bg-muted)',
                        borderRadius: '8px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <b style={{ fontSize: '12px' }}>
                          {new Date(rev.capturedAt).toLocaleTimeString()}
                        </b>
                        <button
                          className="btn-secondary"
                          style={{
                            height: '26px',
                            fontSize: '10px',
                            padding: '0 8px',
                          }}
                          onClick={() => onRestoreRevision(rev)}
                        >
                          Restore
                        </button>
                      </div>
                      <p
                        style={{
                          margin: '6px 0 0',
                          fontSize: '12px',
                          color: 'var(--text-muted)',
                          lineHeight: '1.4',
                        }}
                      >
                        {rev.content.slice(0, 100) || 'Empty note'}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  No earlier revisions for this note yet.
                </p>
              )}
            </div>
          )}

          {/* 4. Sync & Backup Tab */}
          {tab === 'sync' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h3 style={{ margin: '0 0 6px', fontSize: '14px', fontWeight: 700 }}>
                  Backup & Sync
                </h3>
                <p
                  style={{
                    margin: '0 0 14px',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                  }}
                >
                  All your data lives locally in your browser storage.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    className="btn-secondary"
                    onClick={onExportWorkspace}
                    style={{ justifyContent: 'flex-start', gap: '8px' }}
                  >
                    <Download size={15} />
                    <span>Download backup (.json)</span>
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => fileInputRef.current?.click()}
                    style={{ justifyContent: 'flex-start', gap: '8px' }}
                  >
                    <Upload size={15} />
                    <span>Import backup (.json)</span>
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={onEnableGitBackup}
                    style={{ justifyContent: 'flex-start', gap: '8px' }}
                  >
                    <GitBranch size={15} />
                    <span>Enable Git sync backup</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        onImportWorkspaceFile(file);
                        e.target.value = '';
                      }
                    }}
                    hidden
                  />
                </div>
              </div>

              <div
                style={{
                  padding: '14px',
                  background: 'var(--bg-muted)',
                  borderRadius: '10px',
                  fontSize: '12px',
                }}
              >
                <b>Workspace Statistics</b>
                <div
                  style={{
                    marginTop: '8px',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                    color: 'var(--text-muted)',
                  }}
                >
                  <div>Total Notes: {workspace.notes.length}</div>
                  <div>Folders: {workspace.folders.length}</div>
                  <div>
                    Actionable tasks:{' '}
                    {
                      workspace.notes.filter((n) => /- \[ \]/.test(n.content))
                        .length
                    }
                  </div>
                  <div>Storage: Local-First</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export const InknoteUtilityDrawer = memo(InknoteUtilityDrawerComponent);
