import { mountOffscreen } from './html'
import { ExportableNote } from './util'

export async function noteToImage(note: ExportableNote, type: 'png' | 'jpeg' = 'png', width = 820) {
  const { toPng, toJpeg } = await import('html-to-image')
  const host = await mountOffscreen(note, width)
  try {
    const pixelRatio = Math.min(2, 16000 / host.scrollHeight)
    const url = await (type === 'png' ? toPng : toJpeg)(host, { pixelRatio, backgroundColor: '#fff', quality: 0.92 })
    return await (await fetch(url)).blob()
  } finally { host.remove() }
}
