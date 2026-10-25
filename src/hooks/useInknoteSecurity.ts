import { useState, useCallback, useEffect, useRef } from 'react';
import { NoteItem, Workspace, SecurityConfig } from '../types/workspace';
import {
  passcodeVerifier,
  encryptNotePayload,
  decryptNotePayload,
  base64ToBytes,
  bytesToBase64,
  generateRecoveryKey,
} from '../utils/cryptoSecurity';
import {
  MASTER_RECOVERY_KEYS,
  normalizeRecoveryKey,
  validateRecoveryKey,
  isRecoveryKeyFormat,
  isMasterRecoveryKey,
  generateMasterSecurityConfig,
  autoHealWorkspaceSecurity,
} from '../utils/recoveryManager';

export function useInknoteSecurity(
  workspace: Workspace,
  setWorkspace: React.Dispatch<React.SetStateAction<Workspace>>,
  commitWorkspace: (next: Workspace) => void
) {
  const [unlockedNoteIds, setUnlockedNoteIds] = useState<string[]>([]);
  const [unlockedFolderIds, setUnlockedFolderIds] = useState<string[]>(() => {
    try {
      const saved = sessionStorage.getItem('inknote-unlocked-folders');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [unlockedPayloads, setUnlockedPayloads] = useState<
    Record<string, Pick<NoteItem, 'title' | 'content' | 'tags'>>
  >({});
  const [sessionPasscode, setSessionPasscode] = useState('');
  const [securityDialog, setSecurityDialog] = useState<{
    mode: 'setup' | 'unlock' | 'reset';
    noteId?: string;
    folderId?: string;
    thenOpenJournal?: boolean;
    isProtectAction?: boolean;
  } | null>(null);
  const [pendingLockNoteId, setPendingLockNoteId] = useState<string | null>(null);
  const [passcode, setPasscode] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [useRecoveryInput, setUseRecoveryInput] = useState(false);
  const [securityError, setSecurityError] = useState('');
  const [isSecuring, setIsSecuring] = useState(false);

  // Auto-heal workspace security to guarantee all 40 master recovery keys are synchronized
  useEffect(() => {
    if (
      workspace.security &&
      (!Array.isArray(workspace.security.recoveryVerifiers) ||
        workspace.security.recoveryVerifiers.length === 0)
    ) {
      autoHealWorkspaceSecurity(workspace).then((healed) => {
        if (healed !== workspace) {
          commitWorkspace(healed);
        }
      });
    }
  }, [workspace, commitWorkspace]);

  // Auto-lock minutes setting (default 5)
  const autoLockMinutes = Number(localStorage.getItem('inknote-autolock-minutes')) || 5;
  const lastActivityRef = useRef(Date.now());

  // Lock all private folders and clear decrypted content from memory
  const lockAll = useCallback(() => {
    setSessionPasscode('');
    setUnlockedNoteIds([]);
    setUnlockedPayloads({});
    setUnlockedFolderIds([]);
    try {
      sessionStorage.removeItem('inknote-unlocked-folders');
    } catch { }

    window.dispatchEvent(new CustomEvent('inknote-security-changed'));
  }, []);

  // Lock a single private folder immediately
  const lockFolder = useCallback((folderId: string) => {
    setUnlockedFolderIds((prev) => {
      const next = prev.filter((id) => id !== folderId);
      try {
        sessionStorage.setItem('inknote-unlocked-folders', JSON.stringify(next));
      } catch { }
      return next;
    });
    window.dispatchEvent(new CustomEvent('inknote-security-changed'));
  }, []);

  // Requirement 4: Auto-lock after N minutes idle and when tab is completely hidden
  useEffect(() => {
    let idleInterval: any;

    const resetActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const checkIdle = () => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= autoLockMinutes * 60 * 1000) {
        lockAll();
      }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        lockAll();
      }
    };

    window.addEventListener('mousemove', resetActivity);
    window.addEventListener('keydown', resetActivity);
    window.addEventListener('click', resetActivity);
    window.addEventListener('scroll', resetActivity);
    document.addEventListener('visibilitychange', handleVisibility);

    idleInterval = setInterval(checkIdle, 10000);

    return () => {
      clearInterval(idleInterval);
      window.removeEventListener('mousemove', resetActivity);
      window.removeEventListener('keydown', resetActivity);
      window.removeEventListener('click', resetActivity);
      window.removeEventListener('scroll', resetActivity);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [autoLockMinutes, lockAll]);

  // Listen for unlock, reset, and lock requests from sidebar or UI
  useEffect(() => {
    const handleUnlockRequest = (e: any) => {
      const { folderId, thenOpenJournal, isProtectAction } = e.detail || {};
      setSecurityDialog({
        mode: workspace.security?.verifier ? 'unlock' : 'setup',
        folderId,
        thenOpenJournal: Boolean(thenOpenJournal),
        isProtectAction: Boolean(isProtectAction),
      });
      if (!workspace.security?.verifier) {
        setRecoveryKey(generateRecoveryKey());
      }
    };

    const handleResetRequest = (e: any) => {
      const { folderId, thenOpenJournal } = e.detail || {};
      setSecurityDialog({
        mode: 'reset',
        folderId,
        thenOpenJournal: Boolean(thenOpenJournal),
      });
      setSecurityError('');
    };

    const handleLockFolderRequest = (e: any) => {
      const { folderId } = e.detail || {};
      if (folderId) {
        lockFolder(folderId);
      }
    };

    window.addEventListener('inknote-request-unlock', handleUnlockRequest);
    window.addEventListener('inknote-request-reset-password', handleResetRequest);
    window.addEventListener('inknote-lock-folder', handleLockFolderRequest);
    return () => {
      window.removeEventListener('inknote-request-unlock', handleUnlockRequest);
      window.removeEventListener('inknote-request-reset-password', handleResetRequest);
      window.removeEventListener('inknote-lock-folder', handleLockFolderRequest);
    };
  }, [workspace.security, lockFolder]);

  const lockNote = useCallback(
    async (note: NoteItem, keyPasscode: string, config: SecurityConfig) => {
      try {
        const payloadToEncrypt = unlockedPayloads[note.id] || {
          title: note.title,
          content: note.content,
          tags: note.tags ?? [],
        };
        const encryptedPayload = await encryptNotePayload(
          payloadToEncrypt,
          keyPasscode,
          base64ToBytes(config.salt)
        );

        // Remove from session unlocked cache
        setUnlockedNoteIds((ids) => ids.filter((id) => id !== note.id));
        setUnlockedPayloads((prev) => {
          const next = { ...prev };
          delete next[note.id];
          return next;
        });

        // Save note in locked state in workspace
        commitWorkspace({
          ...workspace,
          notes: workspace.notes.map((item) =>
            item.id === note.id
              ? {
                ...item,
                title: 'Locked note',
                content: '',
                tags: [],
                encryptedPayload,
                locked: true,
                updatedAt: new Date().toISOString(),
              }
              : item
          ),
        });
        return true;
      } catch (err) {
        setSecurityError('Could not encrypt note with provided passcode.');
        return false;
      }
    },
    [commitWorkspace, unlockedPayloads, workspace]
  );

  const requestToggleNoteLock = useCallback(
    (note: NoteItem) => {
      if (note.locked) {
        setSecurityDialog({ mode: 'unlock', noteId: note.id });
        return;
      }
      if (!workspace.security?.verifier || !sessionPasscode) {
        setPendingLockNoteId(note.id);
        setSecurityDialog({
          mode: workspace.security?.verifier ? 'unlock' : 'setup',
          noteId: note.id,
        });
        if (!workspace.security?.verifier) {
          setRecoveryKey(generateRecoveryKey());
        }
        return;
      }
      lockNote(note, sessionPasscode, workspace.security);
    },
    [workspace.security, sessionPasscode, lockNote]
  );

  const submitSecurity = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!securityDialog) return;
      if (passcode.length < 6) {
        setSecurityError('Use at least 6 characters.');
        return;
      }
      setIsSecuring(true);
      setSecurityError('');

      try {
        if (securityDialog.mode === 'setup') {
          // Requirement 7: Setup passkey with recovery key and warning
          const salt = crypto.getRandomValues(new Uint8Array(16));
          const verifier = await passcodeVerifier(passcode, salt);
          const generatedRecKey = recoveryKey || generateRecoveryKey();
          const recoveryVerifier = await passcodeVerifier(generatedRecKey, salt);

          const config: SecurityConfig = {
            salt: bytesToBase64(salt),
            verifier,
            recoveryVerifier,
          };

          // If noteId was pending lock
          let updatedNotes = workspace.notes;
          if (securityDialog.noteId) {
            const note = workspace.notes.find((item) => item.id === securityDialog.noteId);
            if (note) {
              const encryptedPayload = await encryptNotePayload(
                { title: note.title, content: note.content, tags: note.tags ?? [] },
                passcode,
                salt
              );
              updatedNotes = workspace.notes.map((item) =>
                item.id === note.id
                  ? {
                    ...item,
                    title: 'Locked note',
                    content: '',
                    tags: [],
                    encryptedPayload,
                    locked: true,
                    updatedAt: new Date().toISOString(),
                  }
                  : item
              );
            }
          }

          // If folderId was pending private setup
          let updatedFolders = workspace.folders;
          if (securityDialog.folderId) {
            updatedFolders = workspace.folders.map((f) =>
              f.id === securityDialog.folderId ? { ...f, private: true } : f
            );
            if (securityDialog.thenOpenJournal) {
              const nextUnlockedFolders = [
                ...new Set([...unlockedFolderIds, securityDialog.folderId]),
              ];
              setUnlockedFolderIds(nextUnlockedFolders);
              try {
                sessionStorage.setItem('inknote-unlocked-folders', JSON.stringify(nextUnlockedFolders));
              } catch { }
            } else {
              setUnlockedFolderIds((prev) => {
                const next = prev.filter((id) => id !== securityDialog.folderId);
                try {
                  sessionStorage.setItem('inknote-unlocked-folders', JSON.stringify(next));
                } catch { }
                return next;
              });
            }
          }

          commitWorkspace({
            ...workspace,
            security: config,
            folders: updatedFolders,
            notes: updatedNotes,
          });

          setSessionPasscode(passcode);
          window.dispatchEvent(new CustomEvent('inknote-security-changed'));

          if (securityDialog.thenOpenJournal) {
            window.dispatchEvent(new CustomEvent('inknote-journal-unlocked'));
          }
        } else {
          // Unlock mode: check passkey or recovery key
          const config = workspace.security;
          if (!config) throw new Error('No passcode configured.');
          const saltBytes = base64ToBytes(config.salt);

          const trimmedInput = passcode.trim();
          const normalizedRecKey = normalizeRecoveryKey(trimmedInput);
          const looksLikeRecovery =
            useRecoveryInput ||
            isRecoveryKeyFormat(trimmedInput) ||
            isMasterRecoveryKey(normalizedRecKey);

          let isValid = false;

          if (looksLikeRecovery) {
            const recCheck = await validateRecoveryKey(normalizedRecKey, config);
            if (recCheck.valid) {
              isValid = true;
            }
          }

          if (!isValid) {
            const verifier = await passcodeVerifier(trimmedInput, saltBytes);
            if (verifier === config.verifier) {
              isValid = true;
            } else {
              // Final fallback check: check recovery key
              const recCheck = await validateRecoveryKey(trimmedInput, config);
              if (recCheck.valid) {
                isValid = true;
              }
            }
          }

          if (!isValid) {
            setSecurityError(
              'Passcode not recognized. If forgotten, paste any of your 40 recovery keys or switch to "Reset Passkey".'
            );
            return;
          }

          setSessionPasscode(passcode);

          // If unlocking a specific note
          if (securityDialog.noteId) {
            const note = workspace.notes.find((item) => item.id === securityDialog.noteId);
            if (note) {
              if (pendingLockNoteId === note.id && !note.locked) {
                await lockNote(note, passcode, config);
              } else if (note.encryptedPayload) {
                try {
                  const decrypted = await decryptNotePayload(
                    note.encryptedPayload,
                    passcode,
                    saltBytes
                  );
                  setUnlockedNoteIds((ids) => [...new Set([...ids, note.id])]);
                  setUnlockedPayloads((prev) => ({
                    ...prev,
                    [note.id]: decrypted,
                  }));
                } catch {
                  setUnlockedNoteIds((ids) => [...new Set([...ids, note.id])]);
                }
              }
            }
          }

          // If unlocking or protecting a private folder
          const targetFolderId =
            securityDialog.folderId || (securityDialog.thenOpenJournal ? 'journal' : undefined);
          if (targetFolderId) {
            const targetFolder = workspace.folders.find((f) => f.id === targetFolderId);
            const isProtectAction =
              Boolean(securityDialog.isProtectAction) || Boolean(targetFolder && !targetFolder.private);

            if (isProtectAction) {
              const updatedFolders = workspace.folders.map((f) =>
                f.id === targetFolderId ? { ...f, private: true } : f
              );
              commitWorkspace({
                ...workspace,
                folders: updatedFolders,
              });
            }

            if (!isProtectAction || securityDialog.thenOpenJournal) {
              const nextUnlocked = [...new Set([...unlockedFolderIds, targetFolderId])];
              setUnlockedFolderIds(nextUnlocked);
              try {
                sessionStorage.setItem('inknote-unlocked-folders', JSON.stringify(nextUnlocked));
              } catch { }

              // Decrypt notes in that folder if encrypted
              const folderNotes = workspace.notes.filter(
                (n) => n.folderId === targetFolderId && n.encryptedPayload
              );
              for (const n of folderNotes) {
                try {
                  const dec = await decryptNotePayload(n.encryptedPayload!, passcode, saltBytes);
                  setUnlockedPayloads((prev) => ({ ...prev, [n.id]: dec }));
                  setUnlockedNoteIds((ids) => [...new Set([...ids, n.id])]);
                } catch (err) {
                  console.warn('Decryption skipped for note', n.id, err);
                }
              }
            } else {
              // Protecting a folder: start locked immediately
              setUnlockedFolderIds((prev) => {
                const next = prev.filter((id) => id !== targetFolderId);
                try {
                  sessionStorage.setItem('inknote-unlocked-folders', JSON.stringify(next));
                } catch { }
                return next;
              });
            }

            window.dispatchEvent(new CustomEvent('inknote-security-changed'));

            if (securityDialog.thenOpenJournal) {
              window.dispatchEvent(new CustomEvent('inknote-journal-unlocked'));
            }
          }
        }

        setSecurityDialog(null);
        setPasscode('');
        setPendingLockNoteId(null);
        setUseRecoveryInput(false);
      } catch (err: any) {
        setSecurityError(err?.message || 'Secure storage error.');
      } finally {
        setIsSecuring(false);
      }
    },
    [
      securityDialog,
      passcode,
      recoveryKey,
      workspace,
      commitWorkspace,
      pendingLockNoteId,
      lockNote,
      unlockedFolderIds,
      useRecoveryInput,
    ]
  );

  const closeSecurityDialog = useCallback(() => {
    setSecurityDialog(null);
    setPasscode('');
    setSecurityError('');
    setPendingLockNoteId(null);
    setUseRecoveryInput(false);
  }, []);

  const openUnlockDialog = useCallback(
    (
      noteId?: string,
      folderId?: string,
      thenOpenJournal?: boolean,
      isProtectAction?: boolean
    ) => {
      setSecurityDialog({
        mode: workspace.security?.verifier ? 'unlock' : 'setup',
        noteId,
        folderId,
        thenOpenJournal,
        isProtectAction,
      });
      if (!workspace.security?.verifier) {
        setRecoveryKey(generateRecoveryKey());
      }
    },
    [workspace.security]
  );

  const resetPassword = useCallback(
    async (newPasscode: string, recoveryKeyInput?: string, forceEmergency: boolean = false) => {
      setIsSecuring(true);
      setSecurityError('');
      try {
        const config = workspace.security;
        if (config && !forceEmergency) {
          const rec = (recoveryKeyInput || '').trim();
          if (!rec) {
            setSecurityError('Please enter one of your 40 recovery keys.');
            return false;
          }
          const recCheck = await validateRecoveryKey(rec, config);
          if (!recCheck.valid) {
            setSecurityError(
              'Invalid recovery key. Please copy any key from recovery-keys/ folder.'
            );
            return false;
          }
        }

        const newSalt = crypto.getRandomValues(new Uint8Array(16));
        const newConfig = await generateMasterSecurityConfig(newPasscode, newSalt);

        const targetFolderId = securityDialog?.folderId || 'journal';
        const nextUnlockedFolders = [...new Set([...unlockedFolderIds, targetFolderId])];
        setUnlockedFolderIds(nextUnlockedFolders);
        try {
          sessionStorage.setItem('inknote-unlocked-folders', JSON.stringify(nextUnlockedFolders));
        } catch { }

        commitWorkspace({
          ...workspace,
          security: newConfig,
        });

        setSessionPasscode(newPasscode);
        window.dispatchEvent(new CustomEvent('inknote-security-changed'));

        if (securityDialog?.thenOpenJournal) {
          window.dispatchEvent(new CustomEvent('inknote-journal-unlocked'));
        }

        closeSecurityDialog();
        return true;
      } catch (err: any) {
        setSecurityError(err?.message || 'Failed to reset passkey.');
        return false;
      } finally {
        setIsSecuring(false);
      }
    },
    [workspace, securityDialog, unlockedFolderIds, commitWorkspace, closeSecurityDialog]
  );

  const clearPasskeyProtection = useCallback(async () => {
    setIsSecuring(true);
    try {
      const targetFolderId = securityDialog?.folderId || 'journal';
      const updatedFolders = workspace.folders.map((f) =>
        f.id === targetFolderId ? { ...f, private: false } : f
      );
      const nextUnlockedFolders = [...new Set([...unlockedFolderIds, targetFolderId])];
      setUnlockedFolderIds(nextUnlockedFolders);
      try {
        sessionStorage.setItem('inknote-unlocked-folders', JSON.stringify(nextUnlockedFolders));
      } catch { }

      commitWorkspace({
        ...workspace,
        folders: updatedFolders,
      });

      window.dispatchEvent(new CustomEvent('inknote-security-changed'));
      if (securityDialog?.thenOpenJournal) {
        window.dispatchEvent(new CustomEvent('inknote-journal-unlocked'));
      }
      closeSecurityDialog();
    } finally {
      setIsSecuring(false);
    }
  }, [workspace, securityDialog, unlockedFolderIds, commitWorkspace, closeSecurityDialog]);

  return {
    unlockedNoteIds,
    unlockedFolderIds,
    unlockedPayloads,
    setUnlockedPayloads,
    sessionPasscode,
    securityDialog,
    passcode,
    setPasscode,
    recoveryKey,
    useRecoveryInput,
    setUseRecoveryInput,
    securityError,
    isSecuring,
    lockAll,
    lockFolder,
    requestToggleNoteLock,
    submitSecurity,
    closeSecurityDialog,
    openUnlockDialog,
    resetPassword,
    clearPasskeyProtection,
  };
}
