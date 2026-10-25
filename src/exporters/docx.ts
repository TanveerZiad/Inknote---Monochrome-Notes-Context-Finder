import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType,
  ImageRun, ShadingType, AlignmentType, ExternalHyperlink, LevelFormat, BorderStyle,
} from 'docx'
import { noteToDom } from './html'
import { ExportableNote } from './util'

type Block = Paragraph | Table
type Ctx = { level: number; quote: number; num: { n: number; configs: any[] } }
type Style = { b?: boolean; i?: boolean; s?: boolean; u?: boolean; code?: boolean; mark?: boolean; link?: boolean }

const HEADS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3,
               HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6]
const BLOCK = new Set(['p','h1','h2','h3','h4','h5','h6','ul','ol','pre','table','blockquote','hr','div','details'])
const hex = (c?: string) => (c ?? '').replace('#', '')

function rgbToHex(css: string) {                         // style.backgroundColor comes back as rgb(r, g, b)
  const m = css.match(/\d+/g); if (!m || m.length < 3) return ''
  return m.slice(0, 3).map(v => (+v).toString(16).padStart(2, '0')).join('')
}

async function loadImage(src: string) {
  const bmp = await createImageBitmap(await (await fetch(src)).blob())
  const c = Object.assign(document.createElement('canvas'), { width: bmp.width, height: bmp.height })
  c.getContext('2d')!.drawImage(bmp, 0, 0)
  const png = await new Promise<Blob>(r => c.toBlob(b => r(b!), 'image/png'))
  return { data: await png.arrayBuffer(), w: bmp.width, h: bmp.height }
}

async function inline(node: Node, st: Style = {}): Promise<(TextRun | ExternalHyperlink | ImageRun)[]> {
  if (node.nodeType === 3) {
    const text = (node.textContent ?? '').replace(/\n+/g, ' ')
    return text ? [new TextRun({
      text, bold: st.b, italics: st.i, strike: st.s, underline: st.u ? {} : undefined,
      font: st.code ? 'Consolas' : undefined, color: st.link ? '0563C1' : undefined,
      highlight: st.mark ? 'yellow' : undefined,
      shading: st.code ? { type: ShadingType.CLEAR, fill: 'EEEEEE', color: 'auto' } : undefined,
    })] : []
  }
  if (!(node instanceof HTMLElement)) return []
  const tag = node.tagName.toLowerCase()
  if (tag === 'br') return [new TextRun({ break: 1 })]
  if (tag === 'input') return []                                       // checkbox: handled by the list code
  if (tag === 'img') {
    try {
      const { data, w, h } = await loadImage(node.getAttribute('src')!)
      const s = Math.min(1, 600 / w)
      return [new ImageRun({ type: 'png', data, transformation: { width: w * s, height: h * s } })]
    } catch { return [new TextRun({ text: '[image could not be exported]', italics: true })] }
  }
  const next: Style = { ...st }
  if (tag === 'strong' || tag === 'b') next.b = true
  if (tag === 'em' || tag === 'i') next.i = true
  if (tag === 'del' || tag === 's') next.s = true
  if (tag === 'u') next.u = true
  if (tag === 'code') next.code = true
  if (tag === 'mark') next.mark = true
  if (tag === 'a') next.link = true
  const kids = (await Promise.all([...node.childNodes].map(c => inline(c, next)))).flat()
  const href = node.getAttribute('href')
  if (tag === 'a' && href && /^(https?:|mailto:)/.test(href))
    return [new ExternalHyperlink({ link: href, children: kids.filter(k => k instanceof TextRun) as TextRun[] })]
  return kids
}

const quoteOpts = (ctx: Ctx) => ctx.quote ? {
  indent: { left: 540 * ctx.quote },
  border: { left: { style: BorderStyle.SINGLE, size: 12, color: 'BBBBBB', space: 8 } },
} : {}

async function children(parent: Element, ctx: Ctx): Promise<Block[]> {
  const out: Block[] = []
  let buf: Node[] = []
  const flush = async () => {
    if (!buf.length) return
    const runs = (await Promise.all(buf.map(n => inline(n)))).flat()
    if (runs.length) out.push(new Paragraph({ children: runs, ...quoteOpts(ctx) }))
    buf = []
  }
  for (const n of parent.childNodes) {
    if (n instanceof HTMLElement && BLOCK.has(n.tagName.toLowerCase())) { await flush(); out.push(...await block(n, ctx)) }
    else buf.push(n)
  }
  await flush()
  return out
}

async function block(el: HTMLElement, ctx: Ctx): Promise<Block[]> {
  const tag = el.tagName.toLowerCase()
  const runs = async () => (await Promise.all([...el.childNodes].map(n => inline(n)))).flat()

  if (/^h[1-6]$/.test(tag)) return [new Paragraph({ heading: HEADS[+tag[1] - 1], children: await runs() })]
  if (tag === 'p') return [new Paragraph({ children: await runs(), ...quoteOpts(ctx) })]
  if (tag === 'hr') return [new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'AAAAAA', space: 1 } } })]
  if (tag === 'blockquote') return children(el, { ...ctx, quote: ctx.quote + 1 })
  if (tag === 'pre')
    return (el.textContent ?? '').replace(/\n$/, '').split('\n').map(line =>
      new Paragraph({ shading: { type: ShadingType.CLEAR, fill: 'F4F4F5', color: 'auto' },
        children: [new TextRun({ text: line, font: 'Consolas', size: 20 })] }))

  if (tag === 'ul' || tag === 'ol') {
    let ref = 'bullets'
    if (tag === 'ol') {                                  // unique reference per list so numbering restarts at 1
      ref = `num-${ctx.num.n++}`
      ctx.num.configs.push({ reference: ref, levels: Array.from({ length: 9 }, (_, i) => ({
        level: i, format: LevelFormat.DECIMAL, text: `%${i + 1}.`, alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720 * (i + 1), hanging: 360 } } } })) })
    }
    const out: Block[] = []
    for (const li of el.children) {
      if (li.tagName.toLowerCase() !== 'li') continue
      const cb = li.querySelector(':scope > input[type=checkbox], :scope > p > input[type=checkbox]') as HTMLInputElement | null
      let first = true, buf: Node[] = []
      const para = async (nodes: Node[]) => {
        const r = (await Promise.all(nodes.map(n => inline(n)))).flat()
        if (!r.length) return
        const mark = cb && first ? [new TextRun(cb.hasAttribute('checked') ? '☑ ' : '☐ ')] : []
        out.push(new Paragraph({
          children: [...mark, ...r],
          numbering: cb || !first ? undefined : { reference: ref, level: Math.min(ctx.level, 8) },
          indent: cb || !first ? { left: 360 * (ctx.level + 1) + (first ? 0 : 360) } : undefined,
        }))
        first = false
      }
      for (const n of li.childNodes) {
        const t = n instanceof HTMLElement ? n.tagName.toLowerCase() : ''
        if (t === 'p') { await para([...n.childNodes]) }
        else if (t === 'ul' || t === 'ol') { await para(buf); buf = []; out.push(...await block(n as HTMLElement, { ...ctx, level: ctx.level + 1 })) }
        else if (BLOCK.has(t)) { await para(buf); buf = []; out.push(...await block(n as HTMLElement, ctx)) }
        else buf.push(n)
      }
      await para(buf)
    }
    return out
  }

  if (tag === 'table') {
    const rows: TableRow[] = []
    for (const tr of el.querySelectorAll('tr')) {
      const cells: TableCell[] = []
      for (const td of tr.children as unknown as HTMLTableCellElement[]) {
        const head = td.tagName === 'TH'
        const bg = rgbToHex(td.style.backgroundColor) || hex(td.dataset.bg)
        const body = await children(td, { ...ctx, quote: 0 })
        cells.push(new TableCell({
          columnSpan: td.colSpan > 1 ? td.colSpan : undefined,
          rowSpan: td.rowSpan > 1 ? td.rowSpan : undefined,
          shading: bg || head ? { type: ShadingType.CLEAR, color: 'auto', fill: bg || 'F0F0F3' } : undefined,
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          children: (body.length ? body : [new Paragraph({})]) as Paragraph[],
        }))
      }
      rows.push(new TableRow({ children: cells, tableHeader: tr.parentElement?.tagName === 'THEAD' }))
    }
    return [new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }), new Paragraph({})]
  }
  return children(el, ctx)                              // div, details, unknown: keep the content
}

export async function noteToDocx(note: ExportableNote): Promise<Blob> {
  const ctx: Ctx = { level: 0, quote: 0, num: { n: 0, configs: [] } }
  const body = await children((await noteToDom(note)).body, ctx)
  const bullets = { reference: 'bullets', levels: Array.from({ length: 9 }, (_, i) => ({
    level: i, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 720 * (i + 1), hanging: 360 } } } })) }
  return Packer.toBlob(new Document({
    numbering: { config: [bullets, ...ctx.num.configs] },
    sections: [{ children: [
      new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(note.title || 'Untitled')] }),
      ...body,
    ] }],
  }))
}
