# Inknote

Inknote is a local-first, black-and-white note workspace. Notes live inside folders, which can be pinned and prioritized to keep the right work close.

## Current workspace

- Folder-first organization with per-folder note spaces
- Pin folders and move them up or down to define priority
- Fast keyword search across titles, folders, and note content
- Local context finder: ask for a topic or phrase and open the best-matching notes
- A responsive, reduced-motion-aware interface with smooth, lightweight transitions
- Browser-local persistence for the initial workspace

## Feature adaptation from DiaryNote

Inknote keeps DiaryNote's note-taking capabilities while intentionally replacing the infinite canvas with a folder-first workflow.

- Markdown and task-list preview
- PBKDF2 passcode verifier plus AES-GCM encryption when a note is locked
- `@Note title` autocomplete, clickable linked-note chips, and backlinks-ready note references
- Nested folders, plus drag-and-drop priority sorting for folders and notes
- Daily journal pages (`Ctrl`/`Cmd` + `Shift` + `J`)
- Search by title, content, tag, or folder; local context retrieval through Ask Inknote
- Local semantic-style retrieval expands related concepts such as app/product/project and design/interface/layout; the scorer is isolated for a later embedding/context-engineering replacement
- JSON backup import/export and individual Markdown export
- Trash recovery data and a 30-step workspace undo stack (`Ctrl`/`Cmd` + `Z`)

## Development

```bash
npm install
npm run dev
```

The Tauri desktop shell uses the same application and is named **Inknote**.
# Inknote---Monochrome-Notes-Context-Finder
