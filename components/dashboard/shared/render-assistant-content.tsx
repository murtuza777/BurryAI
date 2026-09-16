import type { JSX } from "react"

export type InlineToken =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "italic"; text: string }
  | { type: "code"; text: string }
  | { type: "link"; text: string; href: string }

function trimUrl(url: string): { href: string; text: string } {
  const match = url.match(/^(.*?)([.,!?;:])?$/)
  const href = match?.[1] ?? url
  return { href, text: url }
}

export function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = []
  // Matches:
  // 1: **bold** or 2: __bold__
  // 3: `inline code`
  // 4, 5: [link text](url)
  // 6: *italic* or 7: _italic_
  // 8: raw url
  const pattern =
    /\*\*(.+?)\*\*|__(.+?)__|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*([^*]+)\*|_([^_]+)_|(https?:\/\/[^\s)]+)/g
  let lastIndex = 0

  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > lastIndex) {
      tokens.push({ type: "text", text: text.slice(lastIndex, index) })
    }

    const boldText = match[1] || match[2]
    const codeText = match[3]
    const linkText = match[4]
    const linkHref = match[5]
    const italicText = match[6] || match[7]
    const rawUrl = match[8]

    if (boldText) {
      tokens.push({ type: "bold", text: boldText })
    } else if (codeText) {
      tokens.push({ type: "code", text: codeText })
    } else if (linkText && linkHref) {
      tokens.push({ type: "link", text: linkText, href: linkHref })
    } else if (italicText) {
      tokens.push({ type: "italic", text: italicText })
    } else if (rawUrl) {
      const normalized = trimUrl(rawUrl)
      tokens.push({ type: "link", text: normalized.text, href: normalized.href })
    }

    lastIndex = index + match[0].length
  }

  if (lastIndex < text.length) {
    tokens.push({ type: "text", text: text.slice(lastIndex) })
  }

  return tokens
}

export function renderInline(text: string, keyPrefix: string): JSX.Element[] {
  return parseInline(text).map((token, index) => {
    if (token.type === "bold") {
      return (
        <strong key={`${keyPrefix}-b-${index}`} className="font-semibold text-slate-900 dark:text-slate-100">
          {token.text}
        </strong>
      )
    }

    if (token.type === "italic") {
      return (
        <em key={`${keyPrefix}-i-${index}`} className="italic text-slate-800 dark:text-slate-200">
          {token.text}
        </em>
      )
    }

    if (token.type === "code") {
      return (
        <code
          key={`${keyPrefix}-c-${index}`}
          className="rounded-md border border-slate-200/80 bg-slate-100/90 px-1.5 py-0.5 font-mono text-[12.5px] text-cyan-800 dark:border-slate-700/60 dark:bg-slate-800/80 dark:text-cyan-300"
        >
          {token.text}
        </code>
      )
    }

    if (token.type === "link") {
      return (
        <a
          key={`${keyPrefix}-l-${index}`}
          href={token.href}
          target="_blank"
          rel="noreferrer"
          className="break-all font-medium text-cyan-700 underline decoration-cyan-500/50 underline-offset-2 transition hover:text-cyan-800 dark:text-cyan-400 dark:hover:text-cyan-300"
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
  return /^\|?(?:\s*:?-{2,}:?\s*\|)+\s*:?-{2,}:?\s*\|?$/.test(line.trim())
}

interface ParsedTable {
  headers: string[]
  rows: string[][]
}

function parseMarkdownTable(lines: string[]): ParsedTable | null {
  if (lines.length < 2) return null

  const cleanRow = (rowLine: string) =>
    rowLine
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim())

  const headers = cleanRow(lines[0])
  const dataStart = isTableSeparator(lines[1]) ? 2 : 1
  const rows: string[][] = []

  for (let i = dataStart; i < lines.length; i++) {
    if (isTableSeparator(lines[i])) continue
    const cells = cleanRow(lines[i])
    if (cells.some((cell) => cell.length > 0)) {
      rows.push(cells)
    }
  }

  if (headers.length === 0 && rows.length === 0) return null
  return { headers, rows }
}

export function renderAssistantContent(text: string): JSX.Element[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n")
  const nodes: JSX.Element[] = []
  const bulletItems: string[] = []
  const numberedItems: string[] = []
  const tableLines: string[] = []
  const blockquoteLines: string[] = []

  let inCodeBlock = false
  let codeBlockLang = ""
  const codeBlockLines: string[] = []

  function flushBullets(key: number) {
    if (bulletItems.length === 0) return
    nodes.push(
      <ul
        key={`ul-${key}`}
        className="my-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-slate-700 marker:font-semibold marker:text-cyan-600 dark:text-slate-200 dark:marker:text-cyan-400"
      >
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
      <ol
        key={`ol-${key}`}
        className="my-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-slate-700 marker:font-semibold marker:text-cyan-700 dark:text-slate-200 dark:marker:text-cyan-400"
      >
        {numberedItems.map((item, index) => (
          <li key={`num-${index}`}>{renderInline(item, `num-${key}-${index}`)}</li>
        ))}
      </ol>
    )
    numberedItems.length = 0
  }

  function flushTables(key: number) {
    if (tableLines.length === 0) return
    const parsed = parseMarkdownTable(tableLines)
    if (parsed && (parsed.headers.length > 0 || parsed.rows.length > 0)) {
      nodes.push(
        <div
          key={`tbl-${key}`}
          className="my-3 overflow-x-auto rounded-xl border border-slate-200 bg-white/70 shadow-xs dark:border-slate-800 dark:bg-slate-950/60"
        >
          <table className="w-full border-collapse text-left text-xs">
            {parsed.headers.length > 0 ? (
              <thead className="border-b border-slate-200 bg-slate-100/80 dark:border-slate-800 dark:bg-slate-900/80">
                <tr>
                  {parsed.headers.map((hdr, hIdx) => (
                    <th
                      key={`th-${hIdx}`}
                      className="px-3.5 py-2 font-semibold text-slate-900 dark:text-slate-100"
                    >
                      {renderInline(hdr, `th-${key}-${hIdx}`)}
                    </th>
                  ))}
                </tr>
              </thead>
            ) : null}
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {parsed.rows.map((row, rIdx) => (
                <tr
                  key={`tr-${rIdx}`}
                  className="transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-900/40"
                >
                  {row.map((cell, cIdx) => (
                    <td
                      key={`td-${rIdx}-${cIdx}`}
                      className="px-3.5 py-2 text-slate-700 dark:text-slate-300"
                    >
                      {renderInline(cell, `td-${key}-${rIdx}-${cIdx}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }
    tableLines.length = 0
  }

  function flushBlockquotes(key: number) {
    if (blockquoteLines.length === 0) return
    nodes.push(
      <blockquote
        key={`bq-${key}`}
        className="my-2.5 rounded-r-xl border-l-2 border-cyan-500 bg-cyan-500/5 py-2 pl-3.5 pr-3 text-sm italic text-slate-700 dark:border-cyan-400 dark:bg-cyan-500/10 dark:text-slate-300"
      >
        {blockquoteLines.map((line, index) => (
          <p key={`bql-${index}`} className="leading-relaxed">
            {renderInline(line, `bql-${key}-${index}`)}
          </p>
        ))}
      </blockquote>
    )
    blockquoteLines.length = 0
  }

  function flushCodeBlock(key: number) {
    if (!codeBlockLines.length) return
    nodes.push(
      <div
        key={`cb-${key}`}
        className="my-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-900 shadow-xs dark:border-slate-800 dark:bg-slate-950"
      >
        {codeBlockLang ? (
          <div className="border-b border-slate-800 bg-slate-950/60 px-3.5 py-1 text-[11px] font-mono text-slate-400">
            {codeBlockLang}
          </div>
        ) : null}
        <pre className="hide-scrollbar overflow-x-auto p-3.5 font-mono text-xs leading-relaxed text-slate-100 dark:text-slate-200">
          <code>{codeBlockLines.join("\n")}</code>
        </pre>
      </div>
    )
    codeBlockLines.length = 0
    codeBlockLang = ""
  }

  function flushAll(key: number) {
    flushBullets(key)
    flushNumbers(key)
    flushTables(key)
    flushBlockquotes(key)
  }

  lines.forEach((rawLine, index) => {
    // Handle fenced code blocks
    const codeFenceMatch = rawLine.match(/^```(\w*)/)
    if (codeFenceMatch) {
      if (inCodeBlock) {
        // closing fence
        flushCodeBlock(index)
        inCodeBlock = false
      } else {
        // opening fence
        flushAll(index)
        inCodeBlock = true
        codeBlockLang = codeFenceMatch[1] || ""
      }
      return
    }

    if (inCodeBlock) {
      codeBlockLines.push(rawLine)
      return
    }

    const line = rawLine.trim()

    // Blank line
    if (!line) {
      flushAll(index)
      return
    }

    // Horizontal rule
    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flushAll(index)
      nodes.push(<hr key={`hr-${index}`} className="my-3 border-slate-200 dark:border-slate-800" />)
      return
    }

    // Table line
    if (isTableLine(line) || (tableLines.length > 0 && isTableSeparator(line))) {
      flushBullets(index)
      flushNumbers(index)
      flushBlockquotes(index)
      tableLines.push(line)
      return
    }
    flushTables(index)

    // Blockquote
    if (/^>\s?/.test(line)) {
      flushBullets(index)
      flushNumbers(index)
      blockquoteLines.push(line.replace(/^>\s?/, ""))
      return
    }
    flushBlockquotes(index)

    // Headings: #, ##, ###, etc.
    const headingMatch = line.match(/^#{1,6}\s+(.+)$/)
    if (headingMatch) {
      flushBullets(index)
      flushNumbers(index)
      nodes.push(
        <h4 key={`h-${index}`} className="mt-3.5 text-sm font-semibold text-cyan-800 dark:text-cyan-200">
          {renderInline(headingMatch[1], `h-${index}`)}
        </h4>
      )
      return
    }

    // Bullet items: -, *, •
    if (/^[-*•]\s+/.test(line)) {
      flushNumbers(index)
      bulletItems.push(line.replace(/^[-*•]\s+/, ""))
      return
    }

    // Numbered items: 1., 2., etc.
    if (/^\d+\.\s+/.test(line)) {
      flushBullets(index)
      numberedItems.push(line.replace(/^\d+\.\s+/, ""))
      return
    }

    // Section titles ending with colon (like "Here is your immediate action plan:")
    if (line.endsWith(":") && line.length < 80) {
      flushBullets(index)
      flushNumbers(index)
      nodes.push(
        <h4 key={`s-${index}`} className="mt-3 text-sm font-semibold text-cyan-800 dark:text-cyan-300">
          {renderInline(line, `s-${index}`)}
        </h4>
      )
      return
    }

    // Regular paragraph
    flushBullets(index)
    flushNumbers(index)
    nodes.push(
      <p key={`p-${index}`} className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
        {renderInline(line, `p-${index}`)}
      </p>
    )
  })

  // Final flushes
  if (inCodeBlock) {
    flushCodeBlock(lines.length)
  }
  flushAll(lines.length + 1)

  return nodes
}
