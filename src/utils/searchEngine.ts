import { NoteItem } from '../types/workspace';

export function snippet(note: NoteItem): string {
  const value = (note.content || '').replace(/\s+/g, ' ').trim();
  return value || 'An empty page.';
}

export function scoreNote(note: NoteItem, folderName: string, query: string): number {
  const terms = query.toLowerCase().match(/[a-z0-9]{2,}/g) ?? [];
  if (!terms.length) return 0;
  const title = (note.title || '').toLowerCase();
  const content = (note.content || '').toLowerCase();
  const folder = folderName.toLowerCase();
  const tags = (note.tags ?? []).join(' ').toLowerCase();

  let score = 0;
  for (let i = 0; i < terms.length; i++) {
    const term = terms[i];
    if (title.includes(term)) score += 5;
    if (folder.includes(term)) score += 3;
    if (tags.includes(term)) score += 2;
    if (content.includes(term)) score += 1;
  }
  return score;
}

const semanticMap: Record<string, string[]> = {
  app: ['product', 'project', 'software', 'application'],
  design: ['ui', 'interface', 'visual', 'layout'],
  plan: ['roadmap', 'direction', 'strategy', 'brief'],
  idea: ['concept', 'thought', 'brainstorm'],
  note: ['writing', 'page', 'document'],
};

export function conceptTerms(value: string): Set<string> {
  const raw = value.toLowerCase().match(/[a-z0-9]{2,}/g) ?? [];
  return new Set(
    raw.flatMap((term) => [
      term,
      ...(semanticMap[term] ?? []),
      ...Object.entries(semanticMap)
        .filter(([, words]) => words.includes(term))
        .map(([key]) => key),
    ])
  );
}

export function semanticScore(note: NoteItem, folderName: string, query: string): number {
  const exact = scoreNote(note, folderName, query);
  const queryTerms = conceptTerms(query);
  const noteTerms = conceptTerms(
    `${note.title || ''} ${note.content || ''} ${folderName} ${(note.tags ?? []).join(' ')}`
  );
  const overlap = [...queryTerms].filter((term) => noteTerms.has(term)).length;
  const coverage = queryTerms.size ? overlap / queryTerms.size : 0;
  return Number(exact) + overlap * 2 + coverage * 6;
}

export function downloadFile(fileName: string, content: string, type = 'text/plain;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function dateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
  } catch {
    return value;
  }
}

export function makeId(prefix: string): string {
  const value =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return `${prefix}-${value}`;
}
