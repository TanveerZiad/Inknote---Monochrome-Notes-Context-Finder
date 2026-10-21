import React, { memo } from 'react';
import { LockKeyhole } from 'lucide-react';

interface InknoteSecurityModalProps {
  isOpen: boolean;
  mode: 'setup' | 'unlock';
  passcode: string;
  onChangePasscode: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  error?: string;
  isSecuring: boolean;
}

const InknoteSecurityModalComponent: React.FC<InknoteSecurityModalProps> = ({
  isOpen,
  mode,
  passcode,
  onChangePasscode,
  onSubmit,
  onClose,
  error,
  isSecuring,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <form className="modal-card" onSubmit={onSubmit}>
        <LockKeyhole size={24} style={{ marginBottom: '12px' }} />
        <h2>{mode === 'setup' ? 'Set Note Passcode' : 'Unlock Note'}</h2>
        <p>
          {mode === 'setup'
            ? 'Your passcode is never saved on servers. A PBKDF2 verifier protects your private note locally.'
            : 'Enter your local passcode to read and edit this note.'}
        </p>
        <input
          type="password"
          autoFocus
          className="modal-input"
          value={passcode}
          onChange={(e) => onChangePasscode(e.target.value)}
          placeholder="Minimum 6 characters"
        />
        {error && (
          <div style={{ color: '#ef4444', fontSize: '12px', marginBottom: '12px' }}>
            {error}
          </div>
        )}
        <div className="modal-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={isSecuring}>
            {isSecuring ? 'Securing...' : mode === 'setup' ? 'Set & Lock' : 'Unlock'}
          </button>
        </div>
      </form>
    </div>
  );
};

export const InknoteSecurityModal = memo(InknoteSecurityModalComponent);
