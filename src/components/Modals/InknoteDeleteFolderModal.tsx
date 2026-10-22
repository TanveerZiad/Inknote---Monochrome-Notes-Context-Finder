import React, { memo } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { FolderItem } from '../../types/workspace';

interface InknoteDeleteFolderModalProps {
  isOpen: boolean;
  folder: FolderItem | null;
  notesCount: number;
  onConfirm: () => void;
  onClose: () => void;
}

const InknoteDeleteFolderModalComponent: React.FC<InknoteDeleteFolderModalProps> = ({
  isOpen,
  folder,
  notesCount,
  onConfirm,
  onClose,
}) => {
  if (!isOpen || !folder) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ width: 'min(100%, 420px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.1)',
              display: 'grid',
              placeItems: 'center',
              color: '#ef4444',
            }}
          >
            <Trash2 size={20} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Delete folder?</h2>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{folder.name}</span>
          </div>
        </div>

        <p style={{ margin: '10px 0 16px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
          {notesCount > 0 ? (
            <>
              This folder contains <b>{notesCount} note{notesCount > 1 ? 's' : ''}</b>. Deleting this folder will remove it from your disk and move all contained notes to your workspace Trash.
            </>
          ) : (
            'This will delete the folder from your workspace and disk. This folder contains no notes.'
          )}
        </p>

        <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            autoFocus
          >
            Delete folder
          </button>
        </div>
      </div>
    </div>
  );
};

export const InknoteDeleteFolderModal = memo(InknoteDeleteFolderModalComponent);
