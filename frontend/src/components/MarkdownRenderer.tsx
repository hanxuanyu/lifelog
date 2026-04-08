import { useMemo, useEffect, useRef } from "react"
import MarkdownIt from "markdown-it"
import taskLists from "markdown-it-task-lists"

const md = MarkdownIt({ html: true, linkify: true, typographer: true })
  .use(taskLists, { enabled: false, label: true, labelAfter: true })

// Sanitize: strip dangerous tags but keep safe inline formatting tags
const ALLOWED_TAGS = new Set(["em", "strong", "u", "s", "del", "code", "br", "sub", "sup", "mark"])

function sanitizeHtml(html: string): string {
  // Remove script/style/iframe and event handlers; keep only safe tags
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/<\/?(\w+)([^>]*)>/g, (match, tag: string, attrs: string) => {
      const t = tag.toLowerCase()
      if (ALLOWED_TAGS.has(t)) return `<${match.startsWith("</") ? "/" : ""}${t}>`
      // Allow block-level tags that markdown-it generates
      if (["p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "pre", "table", "thead", "tbody", "tr", "th", "td", "hr", "a", "img", "div", "span", "input", "label"].includes(t)) {
        return match
      }
      return ""
    })
}

interface MarkdownRendererProps {
  content: string
  className?: string
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const html = useMemo(() => sanitizeHtml(md.render(content)), [content])
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const pres = containerRef.current.querySelectorAll("pre")
    pres.forEach((pre) => {
      if (pre.querySelector(".code-copy-btn")) return
      const btn = document.createElement("button")
      btn.className = "code-copy-btn"
      btn.textContent = "复制"
      btn.addEventListener("click", () => {
        const code = pre.querySelector("code")
        const text = code ? code.textContent || "" : pre.textContent || ""
        navigator.clipboard.writeText(text).then(() => {
          btn.textContent = "已复制"
          setTimeout(() => { btn.textContent = "复制" }, 1500)
        })
      })
      pre.appendChild(btn)
    })
  }, [html])

  return (
    <div
      ref={containerRef}
      className={`prose-compact ${className || ""}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
