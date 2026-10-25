export type ExportableNote = { title: string; content: string; locked?: boolean }

export const safeName = (t?: string) =>
  ((t ?? '').trim() || 'Untitled').replace(/[\\/:*?"<>|\n\r]+/g, '-').slice(0, 80)

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export async function saveBlob(blob: Blob, filename: string, subfolder = 'Exports') {
  if (isTauri) {
    const { invoke } = await import('@tauri-apps/api/core')
    if (/\.(md|txt|html|json)$/i.test(filename)) {
      await invoke('save_export_file', { filename, content: await blob.text(), subfolder })
    } else {
      const data = Array.from(new Uint8Array(await blob.arrayBuffer()))
      await invoke('save_export_binary', { filename, data, subfolder })
    }
    return
  }
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.append(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

// Cell colors are dark hexes for the dark UI. Black text on them is unreadable on paper.
export function lightTint(hex: string, mix = 0.82) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim()); if (!m) return hex
  const n = parseInt(m[1], 16), rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  const lum = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255
  if (lum > 0.75) return '#' + m[1]                       // already light
  return '#' + rgb.map(v => Math.round(v + (255 - v) * mix).toString(16).padStart(2, '0')).join('')
}
