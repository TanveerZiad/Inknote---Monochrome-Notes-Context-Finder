import { noteToHtml, mountOffscreen } from './html'
import { ExportableNote } from './util'

// A) Vector PDF via print dialog: selectable text, real page breaks, repeating table headers.
//    Opens the isolated iframe print dialog; the user picks "Save as PDF" or prints directly.
export async function printNote(note: ExportableNote) {
  const html = await noteToHtml(note)
  const iframe = document.createElement('iframe')
  
  // Chromium ignores window.print() on 0x0 or display:none iframes and falls back to window.top (the full web app UI).
  // Giving the iframe full layout dimensions offscreen with opacity: 0 ensures Chromium renders and prints ONLY the note document.
  iframe.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;border:none;opacity:0;pointer-events:none;z-index:-9999;'
  document.body.appendChild(iframe)

  const doc = iframe.contentWindow?.document || iframe.contentDocument
  if (!doc) {
    iframe.remove()
    return
  }

  doc.open()
  doc.write(html)
  doc.close()

  const triggerPrint = () => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } catch (err) {
      console.error('[Inknote] Failed to print note iframe:', err)
    } finally {
      // Remove iframe after user closes print dialog
      setTimeout(() => iframe.remove(), 60_000)
    }
  }

  // Ensure iframe content, styles, and fonts are ready
  if (doc.readyState === 'complete') {
    setTimeout(triggerPrint, 250)
  } else {
    iframe.onload = () => setTimeout(triggerPrint, 250)
  }
}

// B) Standalone PDF file generator that downloads directly.
//    Renders ONLY the note title and content into an A4 PDF document without web page UI.
export async function noteToPdf(note: ExportableNote): Promise<Blob> {
  const [{ toCanvas }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')])
  const host = await mountOffscreen(note, 794)                       // A4 width at 96 dpi
  try {
    const ratio = Math.min(2, 16000 / Math.max(1, host.scrollHeight)) // canvas height limit
    const canvas = await toCanvas(host, { pixelRatio: ratio, backgroundColor: '#ffffff' })
    const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' })
    const pw = pdf.internal.pageSize.getWidth()
    const ph = pdf.internal.pageSize.getHeight()
    const slice = Math.floor((canvas.width * ph) / pw)

    for (let y = 0, i = 0; y < canvas.height; y += slice, i++) {
      const sliceHeight = Math.min(slice, canvas.height - y)
      const part = Object.assign(document.createElement('canvas'), {
        width: canvas.width,
        height: sliceHeight,
      })
      const ctx = part.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, part.width, part.height)
        ctx.drawImage(canvas, 0, y, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight)
      }
      if (i > 0) pdf.addPage()
      pdf.addImage(part.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pw, (sliceHeight * pw) / canvas.width)
    }
    return pdf.output('blob')
  } finally {
    host.remove()
  }
}

// Backwards-compatibility alias
export const noteToPdfRaster = noteToPdf

