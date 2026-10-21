import { useState, useCallback } from 'react';
import { NoteItem, Workspace, SecurityConfig } from '../types/workspace';
import {
  passcodeVerifier,
  encryptNotePayload,
  decryptNotePayload,
  base64ToBytes,
  bytesToBase64,
} from '../utils/cryptoSecurity';

export function useInknoteSecurity(
  workspace: Workspace,
  setWorkspace: React.Dispatch<React.SetStateAction<Workspace>>,
  commitWorkspace: (next: Workspace) => void
) {
  const [unlockedNoteIds, setUnlockedNoteIds] = useState<string[]>([]);
  const [unlockedPayloads, setUnlockedPayloads] = useState<
    Record<string, Pick<NoteItem, 'title' | 'content' | 'tags'>>
  >({});
  const [sessionPasscode, setSessionPasscode] = useState('');
  const [securityDialog, setSecurityDialog] = useState<{
    mode: 'setup' | 'unlock';
    noteId: string;
  } | null>(null);
  const [pendingLockNoteId, setPendingLockNoteId] = useState<string | null>(null);
  const [passcode, setPasscode] = useState('');
  const [securityError, setSecurityError] = useState('');
  const [isSecuring, setIsSecuring] = useState(false);

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
      if (!workspace.security || !sessionPasscode) {
        setPendingLockNoteId(note.id);
        setSecurityDialog({
          mode: workspace.security ? 'unlock' : 'setup',
          noteId: note.id,
        });
        return;
      }
      lockNote(note, sessionPasscode, workspace.security);
    },
    [workspace.security, sessionPasscode, lockNote]
  );

  const submitSecurity = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!securityDialog || passcode.length < 6) {
        setSecurityError('Use at least 6 characters.');
        return;
      }
      setIsSecuring(true);
      setSecurityError('');

      try {
        if (securityDialog.mode === 'setup') {
          const salt = crypto.getRandomValues(new Uint8Array(16));
          const verifier = await passcodeVerifier(passcode, salt);
          const config: SecurityConfig = { salt: bytesToBase64(salt), verifier };
          const note = workspace.notes.find((item) => item.id === securityDialog.noteId);
          if (!note) throw new Error('Missing note');

          const encryptedPayload = await encryptNotePayload(
            {
              title: note.title,
              content: note.content,
              tags: note.tags ?? [],
            },
            passcode,
            salt
          );

          commitWorkspace({
            ...workspace,
            security: config,
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
          setSessionPasscode(passcode);
        } else {
          // Unlock mode
          const config = workspace.security;
          if (!config) throw new Error('No passcode configured.');
          const verifier = await passcodeVerifier(passcode, base64ToBytes(config.salt));
          if (verifier !== config.verifier) {
            setSecurityError('Passcode does not match.');
            return;
          }

          setSessionPasscode(passcode);
          const note = workspace.notes.find((item) => item.id === securityDialog.noteId);
          if (note) {
            if (pendingLockNoteId === note.id && !note.locked) {
              await lockNote(note, passcode, config);
            } else if (note.encryptedPayload) {
              const decrypted = await decryptNotePayload(
                note.encryptedPayload,
                passcode,
                base64ToBytes(config.salt)
              );
              setUnlockedNoteIds((ids) => [...new Set([...ids, note.id])]);
              setUnlockedPayloads((prev) => ({
                ...prev,
                [note.id]: decrypted,
              }));
            }
          }
        }

        setSecurityDialog(null);
        setPasscode('');
        setPendingLockNoteId(null);
      } catch (err: any) {
        setSecurityError(err?.message || 'Secure storage error.');
      } finally {
        setIsSecuring(false);
      }
    },
    [securityDialog, passcode, workspace, commitWorkspace, pendingLockNoteId, lockNote]
  );

  const closeSecurityDialog = useCallback(() => {
    setSecurityDialog(null);
    setPasscode('');
    setSecurityError('');
    setPendingLockNoteId(null);
  }, []);

  const openUnlockDialog = useCallback((noteId: string) => {
    setSecurityDialog({ mode: 'unlock', noteId });
  }, []);

  return {
    unlockedNoteIds,
    unlockedPayloads,
    setUnlockedPayloads,
    sessionPasscode,
    securityDialog,
    passcode,
    setPasscode,
    securityError,
    isSecuring,
    requestToggleNoteLock,
    submitSecurity,
    closeSecurityDialog,
    openUnlockDialog,
  };
}
