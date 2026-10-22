import { Workspace, NoteItem, FolderItem } from '../types/workspace';
import { invoke } from '@tauri-apps/api/core';

export interface VaultStatus {
  connected: boolean;
  vaultPath: string;
  notesCount: number;
  foldersCount: number;
  lastSyncedAt?: string;
  storageType: 'local-folder' | 'tauri' | 'browser-fallback';
}

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/**
 * Check if the local backend server is reachable
 */
export async function checkVaultStatus(): Promise<VaultStatus> {
  try {
    const res = await fetch('/api/vault/status', {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      return {
        connected: true,
        vaultPath: data.vaultPath || 'inknote-vault',
        notesCount: data.notesCount ?? 0,
        foldersCount: data.foldersCount ?? 0,
        storageType: 'local-folder',
      };
    }
  } catch (err) {
    // Vite local API not available
  }

  if (isTauri) {
    return {
      connected: true,
      vaultPath: '~/DiaryNote',
      notesCount: 0,
      foldersCount: 0,
      storageType: 'tauri',
    };
  }

  return {
    connected: false,
    vaultPath: '',
    notesCount: 0,
    foldersCount: 0,
    storageType: 'browser-fallback',
  };
}

/**
 * Load complete workspace directly from the filesystem vault folder
 */
export async function loadVaultWorkspace(): Promise<Workspace | null> {
  try {
    const res = await fetch('/api/vault/load', {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      if (data.ok && data.workspace) {
        return data.workspace as Workspace;
      }
    }
  } catch (err) {
    console.warn('[Vault] Failed to load workspace from local backend:', err);
  }
  return null;
}

/**
 * Save a single note directly into its folder on disk as an intact .md file
 */
export async function saveVaultNote(
  note: NoteItem,
  folders: FolderItem[],
  previousTitle?: string,
  previousFolderId?: string
): Promise<boolean> {
  try {
    const res = await fetch('/api/vault/save-note', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        note,
        folders,
        previousTitle,
        previousFolderId,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return Boolean(data.ok);
    }
  } catch (err) {
    console.warn('[Vault] Failed to save note to local file:', err);
  }
  return false;
}

/**
 * Delete a note from the local folder on disk (or move to .trash)
 */
export async function deleteVaultNote(
  noteId: string,
  folderId: string,
  title: string,
  folders: FolderItem[]
): Promise<boolean> {
  try {
    const res = await fetch('/api/vault/delete-note', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        noteId,
        folderId,
        title,
        folders,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return Boolean(data.ok);
    }
  } catch (err) {
    console.warn('[Vault] Failed to delete note from local file:', err);
  }
  return false;
}

/**
 * Delete a folder from disk (moves to .trash)
 */
export async function deleteVaultFolder(
  folderId: string,
  folders: FolderItem[]
): Promise<boolean> {
  try {
    const res = await fetch('/api/vault/delete-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        folderId,
        folders,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return Boolean(data.ok);
    }
  } catch (err) {
    console.warn('[Vault] Failed to delete folder from local disk:', err);
  }
  return false;
}

/**
 * Save workspace structure and metadata to disk
 */
export async function saveVaultWorkspace(workspace: Workspace): Promise<boolean> {
  try {
    const res = await fetch('/api/vault/save-workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace }),
    });
    if (res.ok) {
      const data = await res.json();
      return Boolean(data.ok);
    }
  } catch (err) {
    console.warn('[Vault] Failed to save workspace manifest:', err);
  }
  return false;
}

/**
 * Open the notes vault folder in the native Windows Explorer / Mac Finder / Linux file manager
 */
export async function openVaultInExplorer(vaultPath?: string): Promise<boolean> {
  // If Tauri native
  if (isTauri) {
    try {
      await invoke('open_vault_folder', { folderPath: vaultPath || null });
      return true;
    } catch (err) {
      console.warn('[Vault] Tauri open_vault_folder failed, trying HTTP backend:', err);
    }
  }

  // Try HTTP backend
  try {
    const res = await fetch('/api/vault/open-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      return Boolean(data.ok);
    }
  } catch (err) {
    console.warn('[Vault] Failed to open folder via backend:', err);
  }

  return false;
}

/**
 * Change vault directory path
 */
export async function setVaultDirectory(newPath: string): Promise<{ ok: boolean; vaultPath?: string }> {
  try {
    const res = await fetch('/api/vault/set-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPath }),
    });
    if (res.ok) {
      const data = await res.json();
      return { ok: Boolean(data.ok), vaultPath: data.vaultPath };
    }
  } catch (err) {
    console.warn('[Vault] Failed to set directory:', err);
  }
  return { ok: false };
}
