import React, { useState, useRef, memo, useCallback, useEffect } from 'react';
import {
  Folder,
  Pin,
  MoreHorizontal,
  Eye,
  Type,
  CircleDot,
  Minimize2,
  Maximize2,
  Shield,
  Download,
  Trash2,
  LockKeyhole,
  Heading1,
  List,
  CheckSquare,
  Check,
  Bold,
  Italic,
  Strikethrough,
  Link2,
  Table2,
  X,
  Link,
  GripVertical,
} from 'lucide-react';
import { NoteItem, FolderItem } from '../types/workspace';
import { RichTextEditor, RichTextEditorHandle } from './RichTextEditor';
import { formatDate } from '../utils/searchEngine';

interface InknoteCardProps {
  note: NoteItem;
  folder?: FolderItem;
  isSelected: boolean;
  isUnlocked: boolean;
  unlockedPayload?: Pick<NoteItem, 'title' | 'content' | 'tags'>;
  allNotes: NoteItem[];
  isExpanded?: boolean;
  onToggleExpand?: (id: string) => void;
  onSelect: (id: string) => void;
  onUpdate: (
    id: string,
    changes: Partial<Pick<NoteItem, 'title' | 'content' | 'size' | 'inContext' | 'tags'>>
  ) => void;
  onDelete: (note: NoteItem) => void;
  onTogglePin: (note: NoteItem) => void;
  onRequestToggleLock: (note: NoteItem) => void;
  onOpenUnlockDialog: (noteId: string) => void;
  onExport: (note: NoteItem) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDropOver: (overId: string) => void;
  tagFilter: string | null;
  onToggleTagFilter: (tag: string) => void;
}

const InknoteCardComponent: React.FC<InknoteCardProps> = ({
  note,
  folder,
  isSelected,
  isUnlocked,
  unlockedPayload,
  allNotes,
  isExpanded,
  onToggleExpand,
  onSelect,
  onUpdate,
  onDelete,
  onTogglePin,
  onRequestToggleLock,
  onOpenUnlockDialog,
  onExport,
  onDragStart,
  onDragEnd,
  onDropOver,
  tagFilter,
  onToggleTagFilter,
}) => {
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isFormatting, setIsFormatting] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [tagDraftText, setTagDraftText] = useState('');
  const [isDraftingTag, setIsDraftingTag] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');

  // Scoped to this specific card instance
  const [localExpanded, setLocalExpanded] = useState<boolean>(() => note.size === 'expanded');
  const cardIsExpanded = isExpanded !== undefined ? isExpanded : localExpanded;

  useEffect(() => {
    setLocalExpanded(note.size === 'expanded');
  }, [note.size]);

  const toggleCardSize = useCallback(() => {
    if (onToggleExpand) {
      onToggleExpand(note.id);
    } else {
      setLocalExpanded((prev) => {
        const next = !prev;
        onUpdate(note.id, { size: next ? 'expanded' : 'compact' });
        return next;
      });
    }
    setIsMenuOpen(false);
  }, [note.id, onToggleExpand, onUpdate]);

  const editorRef = useRef<RichTextEditorHandle | null>(null);

  const isLocked = note.locked && !isUnlocked;
  const currentTitle = isUnlocked && unlockedPayload ? unlockedPayload.title : note.title;
  const currentContent = isUnlocked && unlockedPayload ? unlockedPayload.content : note.content;
  const currentTags = isUnlocked && unlockedPayload ? unlockedPayload.tags : note.tags ?? [];

  const handleToggleChecklist = useCallback(
    (lineIndex: number) => {
      const lines = currentContent.split('\n');
      if (lines[lineIndex].startsWith('- [x]')) {
        lines[lineIndex] = lines[lineIndex].replace('- [x]', '- [ ]');
      } else if (lines[lineIndex].startsWith('- [ ]')) {
        lines[lineIndex] = lines[lineIndex].replace('- [ ]', '- [x]');
      }
      onUpdate(note.id, { content: lines.join('\n') });
    },
    [currentContent, note.id, onUpdate]
  );

  const handleAddTag = useCallback(() => {
    if (!tagDraftText.trim()) return;
    const cleanTag = tagDraftText.trim().replace(/^#/, '');
    if (!currentTags.includes(cleanTag)) {
      onUpdate(note.id, { tags: [...currentTags, cleanTag] });
    }
    setTagDraftText('');
    setIsDraftingTag(false);
  }, [currentTags, note.id, onUpdate, tagDraftText]);

  const handleRemoveTag = useCallback(
    (tagToRemove: string) => {
      onUpdate(note.id, { tags: currentTags.filter((t) => t !== tagToRemove) });
    },
    [currentTags, note.id, onUpdate]
  );

  const handleInsertMention = useCallback(
    (targetNote: NoteItem) => {
      if (editorRef.current) {
        editorRef.current.insertText(`@${targetNote.title} `);
      } else {
        const updated = currentContent.replace(/@([^@\n]*)$/, `@${targetNote.title}`);
        onUpdate(note.id, { content: updated });
      }
      setMentionQuery('');
    },
    [currentContent, note.id, onUpdate]
  );

  const mentionSuggestions = mentionQuery
    ? allNotes
        .filter(
          (n) =>
            n.id !== note.id &&
            (n.title || '').toLowerCase().includes(mentionQuery.toLowerCase())
        )
        .slice(0, 5)
    : [];

  return (
    <article
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => onDropOver(note.id)}
      className={`note-card ${cardIsExpanded ? 'note-size-expanded' : 'note-size-compact'} ${
        isSelected ? 'is-selected' : ''
      }`}
      onClick={() => {
        if (!isLocked) onSelect(note.id);
      }}
    >
      {/* Card Topbar */}
      <div className="card-topbar">
        <div className="card-badges">
          <div
            className="card-drag-handle"
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              onDragStart(note.id);
            }}
            onDragEnd={onDragEnd}
            title="Drag to reorder note"
          >
            <GripVertical size={13} />
          </div>
          <span className="card-folder-badge">
            <Folder size={12} />
            {folder?.name}
          </span>
          {note.inContext !== false && (
            <span
              className="card-status-dot"
              title="Included in Ask Inknote context"
            />
          )}
          {note.locked && (
            <span title="Protected note">
              <Shield size={12} className="text-muted" />
            </span>
          )}
        </div>

        {/* Card Actions: Pin -> Expand/Compact -> More Options */}
        <div className="card-actions-compact">
          <button
            className={`card-btn ${note.pinned ? 'is-pinned' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin(note);
            }}
            title={note.pinned ? 'Unpin note' : 'Pin note to top'}
          >
            <Pin size={14} fill={note.pinned ? 'currentColor' : 'none'} />
          </button>
          <button
            className="card-btn"
            onClick={(e) => {
              e.stopPropagation();
              toggleCardSize();
            }}
            title={cardIsExpanded ? 'Compact size' : 'Expanded size'}
            aria-label={cardIsExpanded ? 'Compact size' : 'Expanded size'}
          >
            {cardIsExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button
            className="card-btn card-menu-trigger"
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen((prev) => !prev);
            }}
            title="Note options"
          >
            <MoreHorizontal size={15} />
          </button>
        </div>

        {/* Card Options Dropdown */}
        {isMenuOpen && (
          <div
            className="card-menu-dropdown"
            onClick={(e) => e.stopPropagation()}
            onMouseLeave={() => setIsMenuOpen(false)}
          >
            <button
              className="dropdown-item"
              onClick={() => {
                setIsPreviewing((prev) => !prev);
                setIsMenuOpen(false);
              }}
            >
              <Eye size={14} />
              <span>{isPreviewing ? 'Edit content' : 'Preview markdown'}</span>
            </button>
            <button
              className="dropdown-item"
              onClick={() => {
                setIsFormatting((prev) => !prev);
                setIsMenuOpen(false);
              }}
            >
              <Type size={14} />
              <span>{isFormatting ? 'Hide formatting bar' : 'Writing tools'}</span>
            </button>
            <button
              className="dropdown-item"
              onClick={() => {
                onUpdate(note.id, { inContext: note.inContext === false });
                setIsMenuOpen(false);
              }}
            >
              <CircleDot size={14} />
              <span>
                {note.inContext !== false
                  ? 'Exclude from AI context'
                  : 'Include in AI context'}
              </span>
            </button>
            <div className="dropdown-divider" />
            <button
              className="dropdown-item"
              onClick={() => {
                onRequestToggleLock(note);
                setIsMenuOpen(false);
              }}
            >
              <Shield size={14} />
              <span>{note.locked ? 'Unlock note' : 'Lock with passcode'}</span>
            </button>
            <button
              className="dropdown-item"
              onClick={() => {
                onExport(note);
                setIsMenuOpen(false);
              }}
            >
              <Download size={14} />
              <span>Export as Markdown</span>
            </button>
            <div className="dropdown-divider" />
            <button
              className="dropdown-item is-danger"
              onClick={() => {
                onDelete(note);
                setIsMenuOpen(false);
              }}
            >
              <Trash2 size={14} />
              <span>Delete note</span>
            </button>
          </div>
        )}
      </div>

      {/* Card Body or Locked State */}
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
              onOpenUnlockDialog(note.id);
            }}
          >
            Unlock
          </button>
        </div>
      ) : (
        <>
          <input
            className="card-title-field"
            value={currentTitle}
            onFocus={() => onSelect(note.id)}
            onChange={(e) => onUpdate(note.id, { title: e.target.value })}
            placeholder="Untitled note"
          />

          {/* Floating Formatting Bar */}
          {isFormatting && (
            <div
              className="floating-format-bar"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editorRef.current?.applyFormat('heading')}
                title="Heading"
              >
                <Heading1 size={13} />
              </button>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editorRef.current?.applyFormat('bullet')}
                title="Bullet list"
              >
                <List size={13} />
              </button>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editorRef.current?.applyFormat('checklist')}
                title="Checklist"
              >
                <CheckSquare size={13} />
              </button>
              <i />
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editorRef.current?.applyFormat('bold')}
                title="Bold"
              >
                <Bold size={13} />
              </button>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editorRef.current?.applyFormat('italic')}
                title="Italic"
              >
                <Italic size={13} />
              </button>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editorRef.current?.applyFormat('strikethrough')}
                title="Strikethrough"
              >
                <Strikethrough size={13} />
              </button>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editorRef.current?.applyFormat('link')}
                title="Link"
              >
                <Link2 size={13} />
              </button>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => editorRef.current?.applyFormat('table')}
                title="Table"
              >
                <Table2 size={13} />
              </button>
              <i />
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setIsFormatting(false)}
                title="Close formatting bar"
              >
                <X size={13} />
              </button>
            </div>
          )}

          {/* Editor or Markdown View with hidden scrollbar */}
          <div className="card-editor-area no-scrollbar">
            {isPreviewing ? (
              <div className="card-markdown-preview no-scrollbar">
                {currentContent.split('\n').map((line, lineIndex) =>
                  line.startsWith('- [') ? (
                    <button
                      key={`${line}-${lineIndex}`}
                      className={`checkline ${
                        line.startsWith('- [x]') ? 'is-complete' : ''
                      }`}
                      onClick={() => handleToggleChecklist(lineIndex)}
                    >
                      {line.startsWith('- [x]') ? (
                        <CheckSquare size={14} />
                      ) : (
                        <Check size={14} className="opacity-40" />
                      )}
                      <span>{line.slice(6)}</span>
                    </button>
                  ) : (
                    <p
                      key={`${line}-${lineIndex}`}
                      className={line.startsWith('#') ? 'headingline' : ''}
                    >
                      {line}
                    </p>
                  )
                )}
              </div>
            ) : (
              <>
                <RichTextEditor
                  ref={editorRef}
                  content={currentContent}
                  noteId={note.id}
                  placeholder="Start writing... Type @ to reference other notes."
                  onFocus={() => onSelect(note.id)}
                  onChange={(newContent) => {
                    onSelect(note.id);
                    onUpdate(note.id, { content: newContent });
                  }}
                  onMentionQuery={setMentionQuery}
                />
                {isSelected && mentionSuggestions.length > 0 && (
                  <div
                    className="search-popover"
                    style={{ top: 'auto', bottom: '10px' }}
                  >
                    {mentionSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.id}
                        className="search-popover-item"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleInsertMention(suggestion);
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
              {currentTags.map((tag) => (
                <span
                  key={tag}
                  className="tag-pill"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleTagFilter(tag);
                  }}
                  title="Filter by tag"
                >
                  #{tag}
                  <X
                    size={10}
                    style={{ marginLeft: '2px', cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveTag(tag);
                    }}
                  />
                </span>
              ))}
              {isDraftingTag ? (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    autoFocus
                    style={{
                      width: '60px',
                      fontSize: '10px',
                      padding: '1px 4px',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '4px',
                      background: 'transparent',
                    }}
                    placeholder="tag"
                    value={tagDraftText}
                    onChange={(e) => setTagDraftText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddTag();
                      if (e.key === 'Escape') setIsDraftingTag(false);
                    }}
                  />
                  <button
                    className="tiny-action"
                    style={{ width: '18px', height: '18px' }}
                    onClick={handleAddTag}
                  >
                    <Check size={10} />
                  </button>
                </div>
              ) : (
                <button
                  className="tag-pill"
                  style={{
                    border: '1px dashed var(--border-subtle)',
                    background: 'transparent',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDraftingTag(true);
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
};

export const InknoteCard = memo(InknoteCardComponent);
