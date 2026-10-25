import { saveBlob, safeName, ExportableNote } from './util'

type Fmt = { label: string; ext: string; run: (n: ExportableNote) => Promise<Blob | void> }

export const FORMATS: Record<string, Fmt> = {
  pdf:   { label: 'PDF Document (.pdf)', ext: 'pdf', run: async n => (await import('./pdf')).noteToPdf(n) },
  print: { label: 'Print / System PDF…', ext: 'pdf', run: async n => { await (await import('./pdf')).printNote(n) } },
  docx:  { label: 'Word (.docx)', ext: 'docx', run: async n => (await import('./docx')).noteToDocx(n) },
  md:    { label: 'Markdown (.md)', ext: 'md', run: async n => new Blob([n.content], { type: 'text/markdown' }) },
  txt:   { label: 'Plain text (.txt)', ext: 'txt', run: async n => {
           const doc = await (await import('./html')).noteToDom(n)
           return new Blob([`${n.title}\n\n${(doc.body as any).innerText || doc.body.textContent}`], { type: 'text/plain' }) } },
  html:  { label: 'Web page (.html)', ext: 'html', run: async n => new Blob([await (await import('./html')).noteToHtml(n)], { type: 'text/html' }) },
  png:   { label: 'Image (PNG)', ext: 'png', run: async n => (await import('./image')).noteToImage(n, 'png') },
  jpg:   { label: 'Image (JPG)', ext: 'jpg', run: async n => (await import('./image')).noteToImage(n, 'jpeg') },
  json:  { label: 'Backup (.json)', ext: 'json', run: async n => new Blob([JSON.stringify(n, null, 2)], { type: 'application/json' }) },
  pdf2:  { label: 'PDF (direct download)', ext: 'pdf', run: async n => (await import('./pdf')).noteToPdf(n) },
}

export async function exportNote(note: ExportableNote, id: keyof typeof FORMATS) {
  if (note.locked && !note.content?.trim()) throw new Error('Unlock this note before exporting it.')
  const f = FORMATS[id]
  const blob = await f.run(note)
  if (blob) await saveBlob(blob, `${safeName(note.title)}.${f.ext}`)
}

export type { ExportableNote }
