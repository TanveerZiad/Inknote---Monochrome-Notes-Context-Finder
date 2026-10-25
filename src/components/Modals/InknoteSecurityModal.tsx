import React, { memo, useState, useEffect } from 'react';
import { Lock, Key, Copy, Check, ShieldOff, Eye, EyeOff, ChevronDown, Sparkles } from 'lucide-react';
import { generateRecoveryKey } from '../../utils/cryptoSecurity';
import {
  MASTER_RECOVERY_KEYS,
  normalizeRecoveryKey,
  isMasterRecoveryKey,
  isRecoveryKeyFormat,
} from '../../utils/recoveryManager';

interface InknoteSecurityModalProps {
  isOpen: boolean;
  mode: 'setup' | 'unlock' | 'reset';
  folderInfo?: {
    folderId?: string;
    thenOpenJournal?: boolean;
    noteId?: string;
  } | null;
  passcode: string;
  onChangePasscode: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  error?: string;
  isSecuring: boolean;
  onResetPassword?: (newPasscode: string, recoveryKey?: string) => Promise<boolean | void>;
  onClearProtection?: () => Promise<void>;
}

const InknoteSecurityModalComponent: React.FC<InknoteSecurityModalProps> = ({
  isOpen,
  mode,
  folderInfo,
  passcode,
  onChangePasscode,
  onSubmit,
  onClose,
  error,
  isSecuring,
  onResetPassword,
  onClearProtection,
}) => {
  const [setupRecoveryKey, setSetupRecoveryKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [showQuickPick, setShowQuickPick] = useState(false);

  // Dedicated Reset Password State
  const [isResetView, setIsResetView] = useState(mode === 'reset');
  const [resetRecKey, setResetRecKey] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [localResetError, setLocalResetError] = useState('');
  const [resetSuccessMessage, setResetSuccessMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (mode === 'setup') {
        const generated = generateRecoveryKey();
        setSetupRecoveryKey(generated);
        try {
          sessionStorage.setItem('inknote-temp-recovery-key', generated);
        } catch { }
      }
      setIsResetView(mode === 'reset');
      setLocalResetError('');
      setResetSuccessMessage('');
      setResetRecKey('');
      setNewPass('');
      setConfirmPass('');
      setShowQuickPick(false);
    }
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const isJournal = folderInfo?.folderId === 'journal' || Boolean(folderInfo?.thenOpenJournal);

  // Real-time detection if input in unlock tab is a recovery key
  const isDetectedRecoveryInUnlock =
    isRecoveryKeyFormat(passcode) || isMasterRecoveryKey(passcode);

  const handlePerformReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalResetError('');
    setResetSuccessMessage('');

    const normalizedKey = normalizeRecoveryKey(resetRecKey);
    if (!normalizedKey) {
      setLocalResetError('Please enter one of your 40 recovery keys from the recovery-keys/ folder.');
      return;
    }
    if (newPass.length < 6) {
      setLocalResetError('New passkey must be at least 6 characters.');
      return;
    }
    if (newPass !== confirmPass) {
      setLocalResetError('Passkeys do not match.');
      return;
    }

    if (onResetPassword) {
      const success = await onResetPassword(newPass, normalizedKey);
      if (success) {
        setResetSuccessMessage('Passkey successfully reset! Opening journal...');
      }
    }
  };

  const handlePerformClear = async () => {
    if (
      window.confirm(
        'Remove passkey protection completely from this folder? Your notes will remain intact and will open immediately.'
      )
    ) {
      if (onClearProtection) {
        await onClearProtection();
      }
    }
  };

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        backgroundColor: 'rgba(9, 9, 11, 0.85)',
        transition: 'opacity 200ms ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        zIndex: 9999,
      }}
    >
      <div
        className="modal-card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: '380px',
          width: '100%',
          padding: '24px 22px',
          background: 'var(--bg-card, #18181b)',
          border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
          borderRadius: '14px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85)',
          transition: 'all 200ms ease',
        }}
      >
        {/* Top Segmented Mode Tabs (Visible when not in initial setup mode) */}
        {mode !== 'setup' && (
          <div
            style={{
              display: 'flex',
              width: '100%',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              padding: '3px',
              marginBottom: '18px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setIsResetView(false);
                setLocalResetError('');
              }}
              style={{
                flex: 1,
                padding: '7px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: !isResetView ? 600 : 400,
                background: !isResetView ? 'rgba(255, 255, 255, 0.14)' : 'transparent',
                color: !isResetView ? '#ffffff' : 'var(--text-muted, #a1a1aa)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 150ms ease',
              }}
            >
              <Lock size={13} />
              <span>Unlock</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsResetView(true);
                setLocalResetError('');
              }}
              style={{
                flex: 1,
                padding: '7px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: isResetView ? 600 : 400,
                background: isResetView ? 'rgba(255, 255, 255, 0.14)' : 'transparent',
                color: isResetView ? '#ffffff' : 'var(--text-muted, #a1a1aa)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 150ms ease',
              }}
            >
              <Key size={13} />
              <span>Reset Passkey</span>
            </button>
          </div>
        )}

        {/* 1. RESET PASSWORD VIEW */}
        {isResetView ? (
          <form
            onSubmit={handlePerformReset}
            style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '12px',
                color: 'var(--text-main, #f4f4f5)',
              }}
            >
              <Key size={20} strokeWidth={1.5} />
            </div>

            <h2
              style={{
                fontSize: '15px',
                fontWeight: 600,
                margin: '0 0 4px 0',
                textAlign: 'center',
                color: 'var(--text-main, #f4f4f5)',
              }}
            >
              Reset Folder Passkey
            </h2>

            <p
              style={{
                fontSize: '12px',
                color: 'var(--text-muted, #71717a)',
                margin: '0 0 16px 0',
                textAlign: 'center',
                lineHeight: 1.4,
              }}
            >
              Use any of your 40 recovery keys to set a new password for your journal.
            </p>

            {/* Recovery Key Input with Quick Picker */}
            <div style={{ width: '100%', marginBottom: '12px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '4px',
                }}
              >
                <label
                  style={{
                    fontSize: '11px',
                    fontWeight: 500,
                    color: 'var(--text-muted, #a1a1aa)',
                  }}
                >
                  Emergency Recovery Key
                </label>
                <button
                  type="button"
                  onClick={() => setShowQuickPick((v) => !v)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#60a5fa',
                    fontSize: '11px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                    padding: 0,
                  }}
                >
                  <Sparkles size={11} />
                  <span>{showQuickPick ? 'Hide keys' : 'Quick select key'}</span>
                  <ChevronDown
                    size={11}
                    style={{
                      transform: showQuickPick ? 'rotate(180deg)' : 'none',
                      transition: 'transform 150ms ease',
                    }}
                  />
                </button>
              </div>

              {/* Quick Pick Dropdown */}
              {showQuickPick && (
                <div
                  style={{
                    marginBottom: '8px',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '6px',
                    maxHeight: '130px',
                    overflowY: 'auto',
                    padding: '4px',
                  }}
                >
                  {MASTER_RECOVERY_KEYS.map((k, idx) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        setResetRecKey(k);
                        setShowQuickPick(false);
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '5px 8px',
                        background: resetRecKey === k ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                        border: 'none',
                        borderRadius: '4px',
                        color: resetRecKey === k ? '#ffffff' : '#d4d4d8',
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>{String(idx + 1).padStart(2, '0')}. {k}</span>
                      {resetRecKey === k && <Check size={12} color="#22c55e" />}
                    </button>
                  ))}
                </div>
              )}

              <input
                type="text"
                autoFocus
                className="modal-input"
                value={resetRecKey}
                onChange={(e) => setResetRecKey(e.target.value)}
                placeholder="REC-XXXXXX-XXXXXX-XXXXXX-XXXXXX"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  fontSize: '12px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: isMasterRecoveryKey(resetRecKey)
                    ? '1px solid #22c55e'
                    : '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '6px',
                  color: 'var(--text-main, #f4f4f5)',
                  outline: 'none',
                  fontFamily: 'monospace',
                }}
              />
              {isMasterRecoveryKey(resetRecKey) && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: '#22c55e',
                    fontSize: '10px',
                    marginTop: '3px',
                  }}
                >
                  <Check size={11} />
                  <span>Valid vault recovery key detected</span>
                </div>
              )}
            </div>

            {/* New Passkey Input */}
            <div style={{ width: '100%', marginBottom: '10px' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '4px',
                }}
              >
                <label
                  style={{
                    fontSize: '11px',
                    fontWeight: 500,
                    color: 'var(--text-muted, #a1a1aa)',
                  }}
                >
                  New Passkey (min 6 characters)
                </label>
                <button
                  type="button"
                  onClick={() => setShowNewPass((v) => !v)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted, #a1a1aa)',
                    fontSize: '10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                    padding: 0,
                  }}
                >
                  {showNewPass ? <EyeOff size={11} /> : <Eye size={11} />}
                  <span>{showNewPass ? 'Hide' : 'Show'}</span>
                </button>
              </div>
              <input
                type={showNewPass ? 'text' : 'password'}
                className="modal-input"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="Enter new passkey"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  fontSize: '12px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '6px',
                  color: 'var(--text-main, #f4f4f5)',
                  outline: 'none',
                }}
              />
            </div>

            {/* Confirm Passkey Input */}
            <div style={{ width: '100%', marginBottom: '14px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '11px',
                  fontWeight: 500,
                  color: 'var(--text-muted, #a1a1aa)',
                  marginBottom: '4px',
                }}
              >
                Confirm New Passkey
              </label>
              <input
                type={showNewPass ? 'text' : 'password'}
                className="modal-input"
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                placeholder="Re-enter new passkey"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  fontSize: '12px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border:
                    confirmPass && confirmPass === newPass
                      ? '1px solid #22c55e'
                      : '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '6px',
                  color: 'var(--text-main, #f4f4f5)',
                  outline: 'none',
                }}
              />
              {confirmPass && confirmPass === newPass && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: '#22c55e',
                    fontSize: '10px',
                    marginTop: '3px',
                  }}
                >
                  <Check size={11} />
                  <span>Passkeys match</span>
                </div>
              )}
            </div>

            {resetSuccessMessage && (
              <div
                style={{
                  color: '#22c55e',
                  fontSize: '12px',
                  marginBottom: '12px',
                  textAlign: 'center',
                  fontWeight: 500,
                }}
              >
                {resetSuccessMessage}
              </div>
            )}

            {(localResetError || error) && (
              <div
                style={{
                  color: '#ef4444',
                  fontSize: '12px',
                  marginBottom: '12px',
                  textAlign: 'center',
                  lineHeight: 1.4,
                  background: 'rgba(239, 68, 68, 0.1)',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  width: '100%',
                }}
              >
                {localResetError || error}
              </div>
            )}

            <div className="modal-actions" style={{ width: '100%', display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  if (mode === 'reset') {
                    onClose();
                  } else {
                    setIsResetView(false);
                  }
                }}
                style={{ flex: 1, padding: '9px', borderRadius: '6px', fontSize: '12px' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={isSecuring}
                style={{ flex: 1.5, padding: '9px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}
              >
                {isSecuring ? 'Securing...' : 'Set & Open Journal'}
              </button>
            </div>

            {/* Emergency Clear Lock */}
            {onClearProtection && (
              <button
                type="button"
                onClick={handlePerformClear}
                style={{
                  marginTop: '16px',
                  background: 'transparent',
                  border: 'none',
                  color: '#ef4444',
                  fontSize: '11px',
                  cursor: 'pointer',
                  opacity: 0.85,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  textDecoration: 'underline',
                  textUnderlineOffset: '3px',
                }}
              >
                <ShieldOff size={12} />
                <span>Emergency: remove lock protection completely</span>
              </button>
            )}
          </form>
        ) : (
          /* 2. STANDARD SETUP / UNLOCK VIEW */
          <form
            onSubmit={onSubmit}
            style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '12px',
                color: 'var(--text-main, #f4f4f5)',
              }}
            >
              <Lock size={20} strokeWidth={1.5} />
            </div>

            <h2
              style={{
                fontSize: '15px',
                fontWeight: 600,
                margin: '0 0 4px 0',
                textAlign: 'center',
                color: 'var(--text-main, #f4f4f5)',
              }}
            >
              {mode === 'setup'
                ? isJournal
                  ? 'Protect Today’s Journal'
                  : 'Protect Folder with Passkey'
                : isJournal
                  ? 'Today’s Journal is Private'
                  : 'This Space is Private'}
            </h2>

            <p
              style={{
                fontSize: '12px',
                color: 'var(--text-muted, #71717a)',
                margin: '0 0 16px 0',
                textAlign: 'center',
                lineHeight: 1.4,
              }}
            >
              {mode === 'setup'
                ? 'Zero-knowledge client-side encryption. Stored safely in your local vault.'
                : 'Enter your passkey or paste any of your 40 recovery keys to open.'}
            </p>

            <div style={{ width: '100%', marginBottom: '12px' }}>
              <input
                type={isDetectedRecoveryInUnlock ? 'text' : 'password'}
                autoFocus
                className="modal-input"
                value={passcode}
                onChange={(e) => onChangePasscode(e.target.value)}
                placeholder="Enter passkey or recovery key..."
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: '13px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: isDetectedRecoveryInUnlock
                    ? '1px solid #22c55e'
                    : '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '6px',
                  color: 'var(--text-main, #f4f4f5)',
                  outline: 'none',
                  textAlign: isDetectedRecoveryInUnlock ? 'left' : 'center',
                  fontFamily: isDetectedRecoveryInUnlock ? 'monospace' : 'inherit',
                  letterSpacing: isDetectedRecoveryInUnlock ? 'normal' : '0.12em',
                  transition: 'border-color 150ms ease',
                }}
              />

              {isDetectedRecoveryInUnlock && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: '#22c55e',
                    fontSize: '11px',
                    marginTop: '4px',
                  }}
                >
                  <Check size={12} />
                  <span>Recovery key recognized</span>
                </div>
              )}
            </div>

            {mode === 'setup' && setupRecoveryKey && (
              <div
                style={{
                  width: '100%',
                  margin: '0 0 14px 0',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '6px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'var(--text-muted, #a1a1aa)',
                    }}
                  >
                    Recovery Key
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(setupRecoveryKey);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      background: 'transparent',
                      border: 0,
                      color: copied ? '#22c55e' : 'var(--text-muted, #a1a1aa)',
                      fontSize: '11px',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    color: '#e4e4e7',
                    wordBreak: 'break-all',
                    background: 'rgba(0, 0, 0, 0.3)',
                    padding: '6px 8px',
                    borderRadius: '4px',
                  }}
                >
                  {setupRecoveryKey}
                </div>
              </div>
            )}

            {error && (
              <div
                style={{
                  color: '#ef4444',
                  fontSize: '12px',
                  marginBottom: '12px',
                  textAlign: 'center',
                  background: 'rgba(239, 68, 68, 0.1)',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  width: '100%',
                }}
              >
                {error}
              </div>
            )}

            <div className="modal-actions" style={{ width: '100%', display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={onClose}
                style={{ flex: 1, padding: '9px', borderRadius: '6px', fontSize: '12px' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={isSecuring}
                style={{ flex: 1, padding: '9px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}
              >
                {isSecuring ? 'Securing...' : mode === 'setup' ? 'Protect' : 'Unlock'}
              </button>
            </div>

            {mode === 'unlock' && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '16px',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setIsResetView(true);
                    setLocalResetError('');
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#60a5fa',
                    fontSize: '11px',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    textUnderlineOffset: '3px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Key size={11} />
                  <span>Forgot passkey? Reset password with recovery key</span>
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
};

export const InknoteSecurityModal = memo(InknoteSecurityModalComponent);
