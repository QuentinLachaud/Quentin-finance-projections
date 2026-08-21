const cleanText = (value) => String(value ?? '').replace(/\r?\n/g, ' ').trim()

const escapeCsv = (value) => {
  const source = cleanText(value)
  const protectedValue = /^[=+@]/.test(source) || /^-(?!\d)/.test(source) ? `'${source}` : source
  return `"${protectedValue.replaceAll('"', '""')}"`
}

export const tabularCsv = (columns, rows) => [
  columns.map((column) => escapeCsv(column.label)).join(','),
  ...rows.map((row) => columns.map((column) => escapeCsv(row[column.key])).join(',')),
].join('\r\n')

const downloadBlob = (filename, blob) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

const dateStamp = () => new Date().toISOString().slice(0, 10)

const xmlEscape = (value) => cleanText(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;')

const columnName = (index) => {
  let value = index + 1
  let name = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    name = String.fromCharCode(65 + remainder) + name
    value = Math.floor((value - 1) / 26)
  }
  return name
}

const cellXml = (value, row, column, style = 0) => {
  const reference = `${columnName(column)}${row}`
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${reference}"${style ? ` s="${style}"` : ''} t="n"><v>${value}</v></c>`
  }
  return `<c r="${reference}"${style ? ` s="${style}"` : ''} t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`
}

const worksheetXml = (rows, widths = []) => {
  const cols = widths.length
    ? `<cols>${widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${Math.max(8, Math.min(48, width))}" customWidth="1"/>`).join('')}</cols>`
    : ''
  const body = rows.map((cells, rowIndex) => {
    const style = rowIndex === 0 ? 1 : 0
    return `<row r="${rowIndex + 1}">${cells.map((value, columnIndex) => cellXml(value, rowIndex + 1, columnIndex, style)).join('')}</row>`
  }).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${body}</sheetData></worksheet>`
}

const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

const crc32 = (bytes) => {
  let crc = 0xffffffff
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

const u16 = (value) => new Uint8Array([value & 0xff, (value >>> 8) & 0xff])
const u32 = (value) => new Uint8Array([
  value & 0xff,
  (value >>> 8) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 24) & 0xff,
])

const concatBytes = (...parts) => {
  const size = parts.reduce((sum, part) => sum + part.length, 0)
  const output = new Uint8Array(size)
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }
  return output
}

const zipStored = (files) => {
  const encoder = new TextEncoder()
  const localParts = []
  const centralParts = []
  let offset = 0

  for (const file of files) {
    const name = encoder.encode(file.name)
    const data = typeof file.data === 'string' ? encoder.encode(file.data) : file.data
    const crc = crc32(data)

    const local = concatBytes(
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name, data,
    )
    localParts.push(local)

    const central = concatBytes(
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(offset), name,
    )
    centralParts.push(central)
    offset += local.length
  }

  const centralDirectory = concatBytes(...centralParts)
  const end = concatBytes(
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(centralDirectory.length), u32(offset), u16(0),
  )
  return concatBytes(...localParts, centralDirectory, end)
}

export const buildXlsx = ({ title, subtitle = '', summary = [], columns, rows }) => {
  const summaryRows = [
    [title],
    subtitle ? [subtitle] : [],
    [`Generated ${new Date().toLocaleString('en-GB')}`],
    [],
    ...summary.map(([label, value]) => [label, value]),
  ].filter((row) => row.length)

  const detailRows = [
    columns.map((column) => column.label),
    ...rows.map((row) => columns.map((column) => row[column.key] ?? '')),
  ]
  const widths = columns.map((column) => Math.max(
    column.label.length + 2,
    ...rows.slice(0, 200).map((row) => Math.min(42, cleanText(row[column.key]).length + 2)),
  ))

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Summary" sheetId="1" r:id="rId1"/><sheet name="Details" sheetId="2" r:id="rId2"/></sheets>
</workbook>`
  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/></cellXfs>
</styleSheet>`

  return zipStored([
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rootRels },
    { name: 'xl/workbook.xml', data: workbook },
    { name: 'xl/_rels/workbook.xml.rels', data: workbookRels },
    { name: 'xl/styles.xml', data: styles },
    { name: 'xl/worksheets/sheet1.xml', data: worksheetXml(summaryRows, [30, 28]) },
    { name: 'xl/worksheets/sheet2.xml', data: worksheetXml(detailRows, widths) },
  ])
}

const exportCsv = ({ fileBase, columns, rows }) => {
  downloadBlob(
    `${fileBase}-${dateStamp()}.csv`,
    new Blob([`\ufeff${tabularCsv(columns, rows)}`], { type: 'text/csv;charset=utf-8' }),
  )
}

const exportXlsx = (config) => {
  const bytes = buildXlsx(config)
  downloadBlob(
    `${config.fileBase}-${dateStamp()}.xlsx`,
    new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
  )
}

const drawPdfHeader = (document, title, subtitle, pageNumber) => {
  const width = document.internal.pageSize.getWidth()
  document.setTextColor(28, 107, 80)
  document.setFont('helvetica', 'bold')
  document.setFontSize(10)
  document.text('BTL PORTFOLIO', 42, 38)
  document.setTextColor(25, 32, 30)
  document.setFontSize(20)
  document.text(title, 42, 62)
  document.setFont('helvetica', 'normal')
  document.setTextColor(110, 119, 115)
  document.setFontSize(9)
  if (subtitle) document.text(subtitle, 42, 78, { maxWidth: width - 84 })
  document.text(`Generated ${new Date().toLocaleString('en-GB')} · Page ${pageNumber}`, width - 42, 38, { align: 'right' })
  document.setDrawColor(224, 229, 223)
  document.line(42, 90, width - 42, 90)
  return 108
}

const exportPdf = async ({ fileBase, title, subtitle = '', summary = [], columns, rows, recordTitle }) => {
  const module = await import('jspdf')
  const jsPDF = module.jsPDF || module.default?.jsPDF || module.default
  const document = new jsPDF({ unit: 'pt', format: 'a4' })
  const width = document.internal.pageSize.getWidth()
  const height = document.internal.pageSize.getHeight()
  const bottom = height - 44
  let pageNumber = 1
  let y = drawPdfHeader(document, title, subtitle, pageNumber)

  if (summary.length) {
    document.setFontSize(9)
    summary.forEach(([label, value], index) => {
      const column = index % 2
      const row = Math.floor(index / 2)
      const x = 42 + column * ((width - 84) / 2)
      const yy = y + row * 28
      document.setTextColor(122, 133, 128)
      document.setFont('helvetica', 'normal')
      document.text(label, x, yy)
      document.setTextColor(35, 48, 42)
      document.setFont('helvetica', 'bold')
      document.text(cleanText(value) || '—', x, yy + 12)
    })
    y += Math.ceil(summary.length / 2) * 28 + 12
  }

  const addPage = () => {
    document.addPage()
    pageNumber += 1
    y = drawPdfHeader(document, title, subtitle, pageNumber)
  }

  rows.forEach((row, index) => {
    const heading = recordTitle ? recordTitle(row, index) : `Record ${index + 1}`
    const fieldLines = columns
      .filter((column) => cleanText(row[column.key]))
      .map((column) => {
        const value = cleanText(row[column.key])
        return document.splitTextToSize(`${column.label}: ${value}`, width - 106)
      })
      .flat()
    const blockHeight = 28 + Math.max(1, fieldLines.length) * 12

    if (y + blockHeight > bottom) addPage()

    document.setFillColor(248, 250, 248)
    document.roundedRect(42, y - 12, width - 84, blockHeight, 5, 5, 'F')
    document.setTextColor(35, 48, 42)
    document.setFont('helvetica', 'bold')
    document.setFontSize(10)
    document.text(cleanText(heading) || `Record ${index + 1}`, 52, y + 2)
    document.setFont('helvetica', 'normal')
    document.setTextColor(94, 106, 100)
    document.setFontSize(8.5)
    document.text(fieldLines.length ? fieldLines : ['No additional information'], 52, y + 18)
    y += blockHeight + 8
  })

  if (!rows.length) {
    document.setTextColor(110, 119, 115)
    document.setFontSize(10)
    document.text('No records to report.', 42, y + 12)
  }

  document.save(`${fileBase}-${dateStamp()}.pdf`)
}

export const exportTabularReport = async (format, config) => {
  if (format === 'csv') return exportCsv(config)
  if (format === 'xlsx') return exportXlsx(config)
  if (format === 'pdf') return exportPdf(config)
  throw new Error(`Unsupported report format: ${format}`)
}
