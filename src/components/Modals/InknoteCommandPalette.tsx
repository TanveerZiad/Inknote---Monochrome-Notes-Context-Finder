import React, { useState, useEffect, memo } from 'react';
import { Search } from 'lucide-react';

export interface CommandItem {
  label: string;
  shortcut?: string;
  action: () => void;
}

interface InknoteCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: CommandItem[];
}

const InknoteCommandPaletteComponent: React.FC<InknoteCommandPaletteProps> = ({
  isOpen,
  onClose,
  commands,
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (isOpen) setQuery('');
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = commands.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card"
        style={{ width: 'min(100%, 540px)', padding: '12px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 12px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <Search size={16} className="text-muted" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or action..."
            style={{
              flex: 1,
              border: 0,
              outline: 0,
              background: 'transparent',
              fontSize: '14px',
            }}
          />
          <span className="kbd-shortcut">ESC</span>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
            marginTop: '8px',
            maxHeight: '300px',
            overflowY: 'auto',
          }}
        >
          {filtered.length > 0 ? (
            filtered.map((command) => (
              <button
                key={command.label}
                className="dropdown-item"
                style={{ padding: '10px 12px' }}
                onClick={() => {
                  command.action();
                  onClose();
                }}
              >
                <span style={{ flex: 1, fontWeight: 500 }}>{command.label}</span>
                {command.shortcut && (
                  <span className="kbd-shortcut">{command.shortcut}</span>
                )}
              </button>
            ))
          ) : (
            <div
              style={{
                padding: '16px',
                textAlign: 'center',
                fontSize: '12px',
                color: 'var(--text-muted)',
              }}
            >
              No matching commands.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const InknoteCommandPalette = memo(InknoteCommandPaletteComponent);
