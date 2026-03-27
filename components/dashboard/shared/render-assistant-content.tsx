type InlineToken =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "link"; text: string; href: string }

function trimUrl(url: string): { href: string; text: string } {
  const match = url.match(/^(.*?)([.,!?;:])?$/)
  const href = match?.[1] ?? url
  return { href, text: url }
}

function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = []
  const pattern = /\*\*(.+?)\*\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)]+)/g
  let lastIndex = 0

  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > lastIndex) {
      tokens.push({ type: "text", text: text.slice(lastIndex, index) })
    }

    if (match[1]) {
      tokens.push({ type: "bold", text: match[1] })
    } else if (match[2] && match[3]) {
      tokens.push({ type: "link", text: match[2], href: match[3] })
    } else if (match[4]) {
      const normalized = trimUrl(match[4])
      tokens.push({ type: "link", text: normalized.text, href: normalized.href })
    }

    lastIndex = index + match[0].length
  }

  if (lastIndex < text.length) {
    tokens.push({ type: "text", text: text.slice(lastIndex) })
  }

  return tokens
}

function renderInline(text: string, keyPrefix: string): JSX.Element[] {
  return parseInline(text).map((token, index) => {
    if (token.type === "bold") {
      return (
        <strong key={`${keyPrefix}-b-${index}`} className="font-semibold text-slate-100">
          {token.text}
        </strong>
      )
    }

    if (token.type === "link") {
      return (
        <a
          key={`${keyPrefix}-l-${index}`}
          href={token.href}
          target="_blank"
          rel="noreferrer"
          className="text-cyan-300 underline decoration-cyan-500/50 underline-offset-2 break-all"
        >
          {token.text}
        </a>
      )
    }

    return <span key={`${keyPrefix}-t-${index}`}>{token.text}</span>
  })
}

function isTableLine(line: string): boolean {
  return /^\|.*\|$/.test(line.trim())
}

function isTableSeparator(line: string): boolean {
  return /^\|?(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(line.trim())
}

function parseTableRows(lines: string[]): string[] {
  if (lines.length < 2) {
    return lines
  }

  const rows = lines.map((line) =>
    line
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((cell) => cell.trim())
  )
  const header = rows[0]
  const dataStart = isTableSeparator(lines[1]) ? 2 : 1

  return rows
    .slice(dataStart)
    .filter((row) => row.some((cell) => cell.length > 0))
    .map((row) =>
      header
        .map((cell, index) => {
          const value = row[index]?.trim()
          if (!cell || !value) return ""
          return `${cell}: ${value}`
        })
        .filter(Boolean)
        .join(" | ")
    )
    .filter(Boolean)
}

export function renderAssistantContent(text: string): JSX.Element[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n")
  const nodes: JSX.Element[] = []
  const bulletItems: string[] = []
  const numberedItems: string[] = []
  const tableLines: string[] = []

  function flushBullets(key: number) {
    if (bulletItems.length === 0) return
    nodes.push(
      <ul key={`ul-${key}`} className="my-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
        {bulletItems.map((item, index) => (
          <li key={`bul-${index}`}>{renderInline(item, `bul-${key}-${index}`)}</li>
        ))}
      </ul>
    )
    bulletItems.length = 0
  }

  function flushNumbers(key: number) {
    if (numberedItems.length === 0) return
    nodes.push(
      <ol key={`ol-${key}`} className="my-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed">
        {numberedItems.map((item, index) => (
          <li key={`num-${index}`}>{renderInline(item, `num-${key}-${index}`)}</li>
        ))}
      </ol>
    )
    numberedItems.length = 0
  }

  function flushTables(key: number) {
    if (tableLines.length === 0) return
    const parsedRows = parseTableRows(tableLines)
    nodes.push(
      <ul key={`tbl-${key}`} className="my-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
        {parsedRows.map((row, index) => (
          <li key={`tbl-row-${index}`}>{renderInline(row, `tbl-${key}-${index}`)}</li>
        ))}
      </ul>
    )
    tableLines.length = 0
  }

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim()

    if (!line) {
      flushBullets(index)
      flushNumbers(index)
      flushTables(index)
      return
    }

    if (/^-{3,}$/.test(line)) {
      flushBullets(index)
      flushNumbers(index)
      flushTables(index)
      return
    }

    if (isTableLine(line) || (tableLines.length > 0 && isTableSeparator(line))) {
      flushBullets(index)
      flushNumbers(index)
      tableLines.push(line)
      return
    }

    flushTables(index)

    const headingMatch = line.match(/^#{1,6}\s+(.+)$/)
    if (headingMatch) {
      flushBullets(index)
      flushNumbers(index)
      nodes.push(
        <h4 key={`h-${index}`} className="mt-3 text-sm font-semibold text-cyan-200">
          {renderInline(headingMatch[1], `h-${index}`)}
        </h4>
      )
      return
    }

    if (/^[-*•]\s+/.test(line)) {
      flushNumbers(index)
      bulletItems.push(line.replace(/^[-*•]\s+/, ""))
      return
    }

    if (/^\d+\.\s+/.test(line)) {
      flushBullets(index)
      numberedItems.push(line.replace(/^\d+\.\s+/, ""))
      return
    }

    if (line.endsWith(":") && line.length < 80) {
      flushBullets(index)
      flushNumbers(index)
      nodes.push(
        <h4 key={`s-${index}`} className="mt-3 text-sm font-semibold text-cyan-200">
          {renderInline(line, `s-${index}`)}
        </h4>
      )
      return
    }

    flushBullets(index)
    flushNumbers(index)
    nodes.push(
      <p key={`p-${index}`} className="text-sm leading-relaxed text-slate-300">
        {renderInline(line, `p-${index}`)}
      </p>
    )
  })

  flushBullets(lines.length + 1)
  flushNumbers(lines.length + 2)
  flushTables(lines.length + 3)

  return nodes
}
