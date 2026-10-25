import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { ExportableNote, lightTint } from './util'

export const PAGE_CSS = `
@page { size: A4; margin: 18mm; }
body { font: 11pt/1.55 "Inter","Noto Sans","Noto Sans Bengali",system-ui,sans-serif; color:#111; background:#fff; }`

// Everything below is also used nested under .export-root, so it must never touch body/html.
export const CONTENT_CSS = `
h1,h2,h3 { break-after: avoid; }
img { max-width:100%; height:auto; break-inside: avoid; }
pre { background:#f4f4f5; padding:10px; border-radius:6px; white-space:pre-wrap; break-inside:avoid; }
blockquote { border-left:3px solid #ccc; margin-left:0; padding-left:12px; color:#444; }
table { border-collapse:collapse; width:100%; table-layout:fixed; margin:12px 0; }
thead { display: table-header-group; }
tr { break-inside: avoid; }
th,td { border:1px solid #cfcfd4; padding:6px 10px; vertical-align:top; text-align:left; }
th { background:#f0f0f3; }
table.nt-striped tbody tr:nth-child(even) td { background:#f7f7f9; }
table.nt-minimal th, table.nt-minimal td { border:0; border-bottom:1px solid #ddd; }
table.nt-borderless th, table.nt-borderless td { border:0; }
table.nt-compact th, table.nt-compact td { padding:2px 6px; font-size:.9em; }
table.nt-card { border-collapse:separate; border-spacing:0; border:1px solid #cfcfd4; border-radius:8px; overflow:hidden; }
td[data-bg], th[data-bg] { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
input[type=checkbox] { margin-right:6px; }`

const esc = (s = '') => s.replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]!))

function prepare(md: string) {
  return md
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
    .replace(/@\[([^\]]+)\](?:\([^)]+\))?/g, '$1')
    .replace(/\[([^\]]+)\]\(#note-[^)]+\)/g, '$1')
}

async function toDataUrl(src: string) {
  // Tauri local files: pass them through convertFileSrc() first if your images live on disk
  const blob = await (await fetch(new URL(src, location.href))).blob()
  return new Promise<string>(res => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(blob) })
}

export async function noteToDom(note: ExportableNote): Promise<Document> {
  const dirty = marked.parse(prepare(note.content ?? ''), { gfm: true, breaks: true, async: false }) as string
  const doc = new DOMParser().parseFromString(DOMPurify.sanitize(dirty), 'text/html')

  doc.querySelectorAll('table').forEach(t =>
    t.classList.add('nt', `nt-${t.getAttribute('data-variant') || 'grid'}`))
  doc.querySelectorAll<HTMLElement>('[data-bg]').forEach(c =>
    { c.style.backgroundColor = lightTint(c.dataset.bg!) })

  await Promise.all([...doc.images].map(async img => {
    const src = img.getAttribute('src')
    if (!src || src.startsWith('data:')) return
    try { img.setAttribute('src', await toDataUrl(src)) } catch { /* keep original */ }
  }))
  return doc
}

export async function noteBodyHtml(note: ExportableNote) {
  const doc = await noteToDom(note)
  return `<h1>${esc(note.title || 'Untitled')}</h1>` + doc.body.innerHTML
}

export async function noteToHtml(note: ExportableNote) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(note.title)}</title>
<style>${PAGE_CSS}${CONTENT_CSS}</style></head><body>${await noteBodyHtml(note)}</body></html>`
}

// Off-screen render target for PNG/JPG/raster-PDF. CSS nesting scopes the rules to .export-root.
export async function mountOffscreen(note: ExportableNote, width: number) {
  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:-99999px;top:0;width:${width}px;padding:40px;background:#fff;box-sizing:border-box`
  host.innerHTML = `<style>.export-root{font:11pt/1.55 "Inter","Noto Sans","Noto Sans Bengali",system-ui,sans-serif;color:#111;${CONTENT_CSS}}</style>
<div class="export-root">${await noteBodyHtml(note)}</div>`
  document.body.append(host)
  await document.fonts.ready
  await Promise.all([...host.querySelectorAll('img')].map(i => i.decode().catch(() => {})))
  return host
}
