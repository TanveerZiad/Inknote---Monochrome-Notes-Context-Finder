import type { Plugin, ViteDevServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import type { IncomingMessage, ServerResponse } from 'http';

interface NoteMetadata {
  id: string;
  title: string;
  folderId?: string;
  folder?: string;
  tags?: string[];
  pinned?: boolean;
  locked?: boolean;
  journalDate?: string;
  priority?: number;
  size?: 'compact' | 'regular' | 'expanded';
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

interface ParsedNote {
  id: string;
  folderId: string;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  locked: boolean;
  journalDate?: string;
  priority?: number;
  size?: 'compact' | 'regular' | 'expanded';
  createdAt: string;
  updatedAt: string;
  _filePath?: string;
}

const CONFIG_FILE = '.inknote-vault.json';

function getDefaultVaultPath(): string {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      if (cfg.vaultPath && fs.existsSync(cfg.vaultPath)) {
        return path.resolve(cfg.vaultPath);
      }
    }
  } catch (err) {
    console.error('[Vault] Error reading config file:', err);
  }
  return path.resolve(process.cwd(), 'inknote-vault');
}

function setVaultConfig(newPath: string): void {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ vaultPath: path.resolve(newPath) }, null, 2), 'utf-8');
}

function sanitizeFileName(name: string): string {
  const sanitized = name.replace(/[\\/:*?"<>|]/g, '_').trim();
  return sanitized.length > 0 ? sanitized : 'Untitled';
}

function parseFrontmatter(fileContent: string): { data: NoteMetadata; content: string } {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
  const match = frontmatterRegex.exec(fileContent);

  if (!match) {
    return { data: { id: '', title: '' }, content: fileContent };
  }

  const rawYaml = match[1];
  const content = match[2] || '';
  const data: Record<string, any> = {};

  for (const line of rawYaml.split(/\r?\n/)) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let val = line.slice(colonIdx + 1).trim();

    if (val.startsWith('[') && val.endsWith(']')) {
      data[key] = val
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
    } else if (val === 'true') {
      data[key] = true;
    } else if (val === 'false') {
      data[key] = false;
    } else if (!isNaN(Number(val)) && val !== '') {
      data[key] = Number(val);
    } else {
      data[key] = val.replace(/^['"]|['"]$/g, '');
    }
  }

  return { data: data as NoteMetadata, content };
}

function stringifyFrontmatter(data: NoteMetadata, content: string): string {
  const lines: string[] = ['---'];
  for (const [key, val] of Object.entries(data)) {
    if (val === undefined || val === null) continue;
    if (Array.isArray(val)) {
      lines.push(`${key}: [${val.map((item) => JSON.stringify(item)).join(', ')}]`);
    } else if (typeof val === 'string') {
      lines.push(`${key}: ${JSON.stringify(val)}`);
    } else {
      lines.push(`${key}: ${val}`);
    }
  }
  lines.push('---');
  lines.push('');
  lines.push(content);
  return lines.join('\n');
}

function ensureInitialVault(vaultPath: string): void {
  if (!fs.existsSync(vaultPath)) {
    fs.mkdirSync(vaultPath, { recursive: true });
  }

  const workspaceFile = path.join(vaultPath, 'workspace.json');
  if (!fs.existsSync(workspaceFile)) {
    const defaultWorkspace = {
      folders: [
        { id: 'inbox', name: 'Inbox', pinned: true, priority: 0 },
        { id: 'projects', name: 'Projects', pinned: true, priority: 1 },
        { id: 'inknote', name: 'Inknote', parentId: 'projects', pinned: false, priority: 0 },
        { id: 'journal', name: 'Journal', pinned: false, priority: 0 },
        { id: 'references', name: 'References', pinned: false, priority: 1 },
      ],
      notes: [],
    };
    fs.writeFileSync(workspaceFile, JSON.stringify(defaultWorkspace, null, 2), 'utf-8');
  }

  // Ensure standard folders exist
  const standardDirs = ['Inbox', 'Projects', path.join('Projects', 'Inknote'), 'Journal', 'References'];
  for (const dir of standardDirs) {
    const fullDir = path.join(vaultPath, dir);
    if (!fs.existsSync(fullDir)) {
      fs.mkdirSync(fullDir, { recursive: true });
    }
  }

  // Create seed notes if folders are empty
  const seedNotes = [
    {
      dir: 'Inbox',
      filename: 'A quieter place to think.md',
      data: {
        id: 'welcome',
        folderId: 'inbox',
        title: 'A quieter place to think',
        tags: ['welcome'],
        pinned: true,
        createdAt: '2026-10-20T08:00:00.000Z',
        updatedAt: '2026-10-20T08:00:00.000Z',
      },
      content:
        'Inknote keeps the important things close. Make a folder, write a note, and let the rest stay out of the way.\n\n- [x] Streamline workspace\n- [ ] Write down great ideas\n- [ ] Link thoughts with @references',
    },
    {
      dir: 'Inbox',
      filename: 'Ideas worth returning to.md',
      data: {
        id: 'ideas',
        folderId: 'inbox',
        title: 'Ideas worth returning to',
        tags: ['ideas'],
        pinned: false,
        createdAt: '2026-10-19T10:30:00.000Z',
        updatedAt: '2026-10-19T10:30:00.000Z',
      },
      content:
        '- [ ] Shape the search experience\n- [ ] Add contextual retrieval\n\nA simple note system should feel like paper: immediate, tactile, and easy to revisit. Search surfaces the right thought before it disappears.',
    },
    {
      dir: path.join('Projects', 'Inknote'),
      filename: 'Inknote direction.md',
      data: {
        id: 'project-brief',
        folderId: 'inknote',
        title: 'Inknote direction',
        tags: ['product', 'inknote'],
        pinned: false,
        createdAt: '2026-10-18T09:00:00.000Z',
        updatedAt: '2026-10-20T07:15:00.000Z',
      },
      content:
        'A black-and-white note space with folders, priorities, pins, keyword search, and context-aware retrieval. Keep interactions calm, fluid, and dynamic.\n\nUse @A quieter place to think to connect a note.',
    },
  ];

  for (const seed of seedNotes) {
    const target = path.join(vaultPath, seed.dir, seed.filename);
    if (!fs.existsSync(target)) {
      const fileData = stringifyFrontmatter(seed.data, seed.content);
      fs.writeFileSync(target, fileData, 'utf-8');
    }
  }
}

function scanVaultNotes(vaultPath: string, folders: Array<{ id: string; name: string; parentId?: string }>): ParsedNote[] {
  const notes: ParsedNote[] = [];
  const folderPathToIdMap: Record<string, string> = {};

  // Build mapping from folder relative path to folderId
  for (const f of folders) {
    if (!f.parentId) {
      folderPathToIdMap[f.name.toLowerCase()] = f.id;
    } else {
      const parent = folders.find((p) => p.id === f.parentId);
      if (parent) {
        folderPathToIdMap[`${parent.name.toLowerCase()}/${f.name.toLowerCase()}`] = f.id;
        folderPathToIdMap[`${parent.name.toLowerCase()}\\${f.name.toLowerCase()}`] = f.id;
      }
    }
  }

  function walk(currentDir: string, relDir = '') {
    if (!fs.existsSync(currentDir)) return;
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.join(relDir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        walk(fullPath, relPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        try {
          const raw = fs.readFileSync(fullPath, 'utf-8');
          const stat = fs.statSync(fullPath);
          const { data, content } = parseFrontmatter(raw);

          // Infer folder
          const dirNormalized = relDir.replace(/\\/g, '/').toLowerCase();
          let matchedFolderId = data.folderId;
          if (!matchedFolderId && dirNormalized) {
            matchedFolderId = folderPathToIdMap[dirNormalized] || dirNormalized.split('/')[0];
          }
          if (!matchedFolderId) matchedFolderId = 'inbox';

          const title = data.title || entry.name.replace(/\.md$/, '');
          const id = data.id || `file_${Buffer.from(relPath).toString('base64url').slice(0, 16)}`;

          notes.push({
            id,
            folderId: matchedFolderId,
            title,
            content,
            tags: Array.isArray(data.tags) ? data.tags : [],
            pinned: Boolean(data.pinned),
            locked: Boolean(data.locked),
            journalDate: data.journalDate,
            priority: typeof data.priority === 'number' ? data.priority : 0,
            size: data.size,
            createdAt: data.createdAt || stat.birthtime.toISOString(),
            updatedAt: data.updatedAt || stat.mtime.toISOString(),
            _filePath: relPath,
          });
        } catch (err) {
          console.error(`[Vault] Error reading note file ${fullPath}:`, err);
        }
      }
    }
  }

  walk(vaultPath);
  return notes;
}

function resolveFolderPath(
  vaultPath: string,
  folderId: string,
  folders: Array<{ id: string; name: string; parentId?: string }>
): string {
  const folder = folders.find((f) => f.id === folderId);
  if (!folder) {
    return path.join(vaultPath, 'Inbox');
  }

  const parts: string[] = [sanitizeFileName(folder.name)];
  let current = folder;
  while (current.parentId) {
    const parent = folders.find((f) => f.id === current.parentId);
    if (!parent) break;
    parts.unshift(sanitizeFileName(parent.name));
    current = parent;
  }

  const fullDir = path.join(vaultPath, ...parts);
  if (!fs.existsSync(fullDir)) {
    fs.mkdirSync(fullDir, { recursive: true });
  }
  return fullDir;
}

function readJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 50 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, data: any, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

export function viteVaultPlugin(): Plugin {
  return {
    name: 'vite-plugin-inknote-vault',
    configureServer(server: ViteDevServer) {
      let vaultPath = getDefaultVaultPath();
      ensureInitialVault(vaultPath);

      // Unwatch vault files so writing notes never triggers browser page reloads
      try {
        server.watcher.unwatch(vaultPath);
        server.watcher.unwatch(path.join(vaultPath, '**'));
        server.watcher.unwatch(path.join(vaultPath, '**', '*.md'));
      } catch {}

      console.log(`[Inknote Vault Backend] Ready at: ${vaultPath}`);

      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';
        if (!url.startsWith('/api/vault')) {
          return next();
        }

        try {
          const endpoint = url.split('?')[0];

          // 1. GET /api/vault/status
          if (req.method === 'GET' && endpoint === '/api/vault/status') {
            ensureInitialVault(vaultPath);
            const workspaceFile = path.join(vaultPath, 'workspace.json');
            let foldersCount = 0;
            if (fs.existsSync(workspaceFile)) {
              try {
                const ws = JSON.parse(fs.readFileSync(workspaceFile, 'utf-8'));
                foldersCount = ws.folders?.length || 0;
              } catch {}
            }
            const notes = scanVaultNotes(vaultPath, []);
            return sendJson(res, {
              ok: true,
              vaultPath,
              notesCount: notes.length,
              foldersCount,
              platform: process.platform,
              storageType: 'local-folder-backend',
            });
          }

          // 2. GET /api/vault/load
          if (req.method === 'GET' && endpoint === '/api/vault/load') {
            ensureInitialVault(vaultPath);
            const workspaceFile = path.join(vaultPath, 'workspace.json');
            let workspaceData: any = {
              folders: [
                { id: 'inbox', name: 'Inbox', pinned: true, priority: 0 },
                { id: 'projects', name: 'Projects', pinned: true, priority: 1 },
                { id: 'inknote', name: 'Inknote', parentId: 'projects', pinned: false, priority: 0 },
                { id: 'journal', name: 'Journal', pinned: false, priority: 0 },
                { id: 'references', name: 'References', pinned: false, priority: 1 },
              ],
            };

            if (fs.existsSync(workspaceFile)) {
              try {
                const parsed = JSON.parse(fs.readFileSync(workspaceFile, 'utf-8'));
                if (Array.isArray(parsed.folders)) {
                  workspaceData = parsed;
                }
              } catch (e) {
                console.error('[Vault] Error parsing workspace.json:', e);
              }
            }

            const notes = scanVaultNotes(vaultPath, workspaceData.folders);
            workspaceData.notes = notes;

            return sendJson(res, {
              ok: true,
              vaultPath,
              workspace: workspaceData,
            });
          }

          // 3. POST /api/vault/save-note
          if (req.method === 'POST' && endpoint === '/api/vault/save-note') {
            const body = await readJsonBody(req);
            const { note, previousTitle, previousFolderId, folders = [] } = body;

            if (!note || !note.id) {
              return sendJson(res, { ok: false, error: 'Missing note data' }, 400);
            }

            const targetDir = resolveFolderPath(vaultPath, note.folderId || 'inbox', folders);
            const safeTitle = sanitizeFileName(note.title || 'Untitled');
            const targetFilePath = path.join(targetDir, `${safeTitle}.md`);

            // Check if title or folder changed, remove previous file if it existed
            if (previousTitle || previousFolderId) {
              const oldDir = resolveFolderPath(vaultPath, previousFolderId || note.folderId || 'inbox', folders);
              const oldSafeTitle = sanitizeFileName(previousTitle || note.title || 'Untitled');
              const oldFilePath = path.join(oldDir, `${oldSafeTitle}.md`);
              if (oldFilePath !== targetFilePath && fs.existsSync(oldFilePath)) {
                try {
                  fs.unlinkSync(oldFilePath);
                } catch (err) {
                  console.warn(`[Vault] Could not remove old file ${oldFilePath}:`, err);
                }
              }
            }

            const metadata: NoteMetadata = {
              id: note.id,
              folderId: note.folderId,
              title: note.title,
              tags: note.tags || [],
              pinned: Boolean(note.pinned),
              locked: Boolean(note.locked),
              journalDate: note.journalDate,
              priority: note.priority,
              size: note.size,
              createdAt: note.createdAt,
              updatedAt: new Date().toISOString(),
            };

            const fileContent = stringifyFrontmatter(metadata, note.content || '');
            fs.writeFileSync(targetFilePath, fileContent, 'utf-8');

            return sendJson(res, {
              ok: true,
              filePath: targetFilePath,
              updatedAt: metadata.updatedAt,
            });
          }

          // 4. POST /api/vault/delete-note
          if (req.method === 'POST' && endpoint === '/api/vault/delete-note') {
            const body = await readJsonBody(req);
            const { noteId, folderId, title, folders = [] } = body;

            const targetDir = resolveFolderPath(vaultPath, folderId || 'inbox', folders);
            const safeTitle = sanitizeFileName(title || 'Untitled');
            const targetFilePath = path.join(targetDir, `${safeTitle}.md`);

            let deleted = false;
            if (fs.existsSync(targetFilePath)) {
              // Move to .trash folder inside vault so user never loses notes accidentally
              const trashDir = path.join(vaultPath, '.trash');
              if (!fs.existsSync(trashDir)) {
                fs.mkdirSync(trashDir, { recursive: true });
              }
              const trashFilePath = path.join(trashDir, `${Date.now()}_${safeTitle}.md`);
              fs.renameSync(targetFilePath, trashFilePath);
              deleted = true;
            } else {
              // Fallback: search for file containing note id
              const notes = scanVaultNotes(vaultPath, folders);
              const found = notes.find((n) => n.id === noteId);
              if (found && found._filePath) {
                const fullP = path.join(vaultPath, found._filePath);
                if (fs.existsSync(fullP)) {
                  fs.unlinkSync(fullP);
                  deleted = true;
                }
              }
            }

            return sendJson(res, { ok: true, deleted });
          }

          // 4b. POST /api/vault/delete-folder
          if (req.method === 'POST' && endpoint === '/api/vault/delete-folder') {
            const body = await readJsonBody(req);
            const { folderId, folders = [] } = body;

            const folder = folders.find((f: any) => f.id === folderId);
            if (folder) {
              const targetDir = resolveFolderPath(vaultPath, folderId, folders);
              if (fs.existsSync(targetDir)) {
                const trashDir = path.join(vaultPath, '.trash');
                if (!fs.existsSync(trashDir)) {
                  fs.mkdirSync(trashDir, { recursive: true });
                }
                const trashTarget = path.join(
                  trashDir,
                  `${Date.now()}_folder_${sanitizeFileName(folder.name)}`
                );
                try {
                  fs.renameSync(targetDir, trashTarget);
                } catch {
                  try {
                    fs.rmSync(targetDir, { recursive: true, force: true });
                  } catch (e) {
                    console.warn('[Vault] Failed to remove folder directory:', e);
                  }
                }
              }
            }

            return sendJson(res, { ok: true });
          }

          // 5. POST /api/vault/save-workspace
          if (req.method === 'POST' && endpoint === '/api/vault/save-workspace') {
            const body = await readJsonBody(req);
            const { workspace } = body;

            if (workspace && Array.isArray(workspace.folders)) {
              const workspaceFile = path.join(vaultPath, 'workspace.json');
              const { notes, ...metaOnly } = workspace;
              fs.writeFileSync(workspaceFile, JSON.stringify(metaOnly, null, 2), 'utf-8');

              // Sync folder directories
              for (const folder of workspace.folders) {
                resolveFolderPath(vaultPath, folder.id, workspace.folders);
              }
            }

            return sendJson(res, { ok: true });
          }

          // 6. POST /api/vault/open-folder
          if (req.method === 'POST' && endpoint === '/api/vault/open-folder') {
            ensureInitialVault(vaultPath);

            // Open in OS File Manager (Explorer on Windows, Finder on macOS, xdg-open on Linux)
            let command = '';
            if (process.platform === 'win32') {
              command = `explorer.exe "${vaultPath}"`;
            } else if (process.platform === 'darwin') {
              command = `open "${vaultPath}"`;
            } else {
              command = `xdg-open "${vaultPath}"`;
            }

            exec(command, (err) => {
              if (err) {
                console.error('[Vault] Error opening folder:', err);
              }
            });

            return sendJson(res, { ok: true, opened: vaultPath });
          }

          // 7. POST /api/vault/set-folder
          if (req.method === 'POST' && endpoint === '/api/vault/set-folder') {
            const body = await readJsonBody(req);
            const { newPath } = body;
            if (!newPath || typeof newPath !== 'string') {
              return sendJson(res, { ok: false, error: 'Invalid path' }, 400);
            }

            const resolved = path.resolve(newPath.trim());
            ensureInitialVault(resolved);
            setVaultConfig(resolved);
            vaultPath = resolved;

            return sendJson(res, { ok: true, vaultPath });
          }

          // Unhandled /api/vault endpoint
          return sendJson(res, { ok: false, error: 'Endpoint not found' }, 404);
        } catch (error: any) {
          console.error('[Vault API Error]', error);
          return sendJson(res, { ok: false, error: error.message || 'Server error' }, 500);
        }
      });
    },
  };
}
