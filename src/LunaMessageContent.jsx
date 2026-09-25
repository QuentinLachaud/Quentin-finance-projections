import React from 'react'

const INLINE_MARKUP = /(\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_)/g

const withoutUnsupportedMarkdown = (text) => String(text)
  .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/`([^`\n]+)`/g, '$1')

const inlineContent = (text, keyPrefix) => withoutUnsupportedMarkdown(text).split(INLINE_MARKUP).filter(Boolean).map((part, index) => {
  const key = `${keyPrefix}-${index}`
  if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
    return <strong key={key}>{part.slice(2, -2)}</strong>
  }
  if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
    return <em key={key}>{part.slice(1, -1)}</em>
  }
  return <React.Fragment key={key}>{part}</React.Fragment>
})

const listMatch = (line) => {
  const bullet = line.match(/^\s*[-*+]\s+(.+)$/)
  if (bullet) return { type: 'ul', text: bullet[1] }
  const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/)
  return numbered ? { type: 'ol', text: numbered[1] } : null
}

const blocks = (text) => {
  const result = []
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n')
  let paragraph = []
  let list = null

  const flushParagraph = () => {
    if (!paragraph.length) return
    result.push({ type: 'p', lines: paragraph })
    paragraph = []
  }
  const flushList = () => {
    if (!list) return
    result.push(list)
    list = null
  }

  for (const rawLine of lines) {
    const line = rawLine
      .replace(/^\s{0,3}#{1,6}\s+/, '')
      .replace(/^\s*>\s?/, '')
    const item = listMatch(line)
    if (item) {
      flushParagraph()
      if (!list || list.type !== item.type) {
        flushList()
        list = { type: item.type, items: [] }
      }
      list.items.push(item.text)
      continue
    }
    flushList()
    if (!line.trim()) {
      flushParagraph()
      continue
    }
    paragraph.push(line)
  }
  flushParagraph()
  flushList()
  return result
}

export default function LunaMessageContent({ text }) {
  return <div className="luna-message-content">{blocks(text).map((block, blockIndex) => {
    if (block.type === 'ul' || block.type === 'ol') {
      const List = block.type
      return <List key={`list-${blockIndex}`}>{block.items.map((item, itemIndex) => (
        <li key={`item-${itemIndex}`}>{inlineContent(item, `${blockIndex}-${itemIndex}`)}</li>
      ))}</List>
    }
    return <p key={`paragraph-${blockIndex}`}>{block.lines.map((line, lineIndex) => <React.Fragment key={`line-${lineIndex}`}>
      {lineIndex > 0 && <br />}
      {inlineContent(line, `${blockIndex}-${lineIndex}`)}
    </React.Fragment>)}</p>
  })}</div>
}
