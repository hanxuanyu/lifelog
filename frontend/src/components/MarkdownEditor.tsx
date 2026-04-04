import { useRef, useState, useCallback, useEffect, useMemo } from "react"
import { createPortal } from "react-dom"
import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  linkPlugin,
  linkDialogPlugin,
  tablePlugin,
  markdownShortcutPlugin,
  toolbarPlugin,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  CreateLink,
  ListsToggle,
  InsertTable,
  InsertCodeBlock,
  UndoRedo,
  Separator,
  codeBlockPlugin,
  codeMirrorPlugin,
  type MDXEditorMethods,
} from "@mdxeditor/editor"
import "@mdxeditor/editor/style.css"
import { Maximize2, Minimize2 } from "lucide-react"

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  minHeight?: number
}

const codeMirrorLanguages = {
  "": "Plain Text",
  js: "JavaScript",
  ts: "TypeScript",
  go: "Go",
  python: "Python",
  bash: "Bash",
  json: "JSON",
  css: "CSS",
  html: "HTML",
  sql: "SQL",
  yaml: "YAML",
}

/** Compact toolbar for inline (narrow) mode — no BlockTypeSelect */
function CompactToolbar() {
  return (
    <>
      <BoldItalicUnderlineToggles options={['Bold', 'Italic']} />
      <Separator />
      <ListsToggle />
      <Separator />
      <CreateLink />
      <InsertCodeBlock />
    </>
  )
}

/** Full toolbar for fullscreen mode */
function FullToolbar() {
  return (
    <>
      <UndoRedo />
      <Separator />
      <BoldItalicUnderlineToggles options={['Bold', 'Italic']} />
      <Separator />
      <BlockTypeSelect />
      <Separator />
      <ListsToggle />
      <Separator />
      <CreateLink />
      <InsertCodeBlock />
      <InsertTable />
    </>
  )
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder = "输入详情（支持 Markdown）...",
  className = "",
}: MarkdownEditorProps) {
  const inlineEditorRef = useRef<MDXEditorMethods>(null)
  const fullscreenEditorRef = useRef<MDXEditorMethods>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const prevValueRef = useRef(value)

  // Sync external value changes into inline editor
  useEffect(() => {
    if (value !== prevValueRef.current) {
      prevValueRef.current = value
      inlineEditorRef.current?.setMarkdown(value)
    }
  }, [value])

  const handleChange = useCallback(
    (md: string) => {
      prevValueRef.current = md
      onChange(md)
    },
    [onChange]
  )

  const openFullscreen = useCallback(() => {
    setFullscreen(true)
  }, [])

  const closeFullscreen = useCallback(() => {
    // Read latest markdown from fullscreen editor and sync back
    const md = fullscreenEditorRef.current?.getMarkdown()
    if (md != null && md !== prevValueRef.current) {
      prevValueRef.current = md
      onChange(md)
      inlineEditorRef.current?.setMarkdown(md)
    }
    setFullscreen(false)
  }, [onChange])

  // Escape key exits fullscreen
  useEffect(() => {
    if (!fullscreen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        closeFullscreen()
      }
    }
    window.addEventListener("keydown", onKeyDown, true)
    return () => window.removeEventListener("keydown", onKeyDown, true)
  }, [fullscreen, closeFullscreen])

  // Sync value into fullscreen editor on open
  useEffect(() => {
    if (fullscreen) {
      // Small delay to ensure ref is attached
      requestAnimationFrame(() => {
        fullscreenEditorRef.current?.setMarkdown(prevValueRef.current)
      })
    }
  }, [fullscreen])

  const inlinePlugins = useMemo(
    () => [
      headingsPlugin(),
      listsPlugin(),
      quotePlugin(),
      thematicBreakPlugin(),
      linkPlugin(),
      linkDialogPlugin(),
      tablePlugin(),
      codeBlockPlugin({ defaultCodeBlockLanguage: "" }),
      codeMirrorPlugin({ codeBlockLanguages: codeMirrorLanguages }),
      markdownShortcutPlugin(),
      toolbarPlugin({ toolbarContents: () => <CompactToolbar /> }),
    ],
    []
  )

  const fullscreenPlugins = useMemo(
    () => [
      headingsPlugin(),
      listsPlugin(),
      quotePlugin(),
      thematicBreakPlugin(),
      linkPlugin(),
      linkDialogPlugin(),
      tablePlugin(),
      codeBlockPlugin({ defaultCodeBlockLanguage: "" }),
      codeMirrorPlugin({ codeBlockLanguages: codeMirrorLanguages }),
      markdownShortcutPlugin(),
      toolbarPlugin({ toolbarContents: () => <FullToolbar /> }),
    ],
    []
  )

  return (
    <>
      <div className={`relative mdx-editor-wrapper mdx-compact ${className}`}>
        <button
          type="button"
          onClick={openFullscreen}
          className="absolute right-1 top-1 z-10 p-1 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          title="全屏编辑"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
        <MDXEditor
          ref={inlineEditorRef}
          markdown={value}
          onChange={handleChange}
          plugins={inlinePlugins}
          placeholder={placeholder}
          contentEditableClassName="prose-compact mdx-content"
          className="mdx-editor-root"
      />
    </div>

    {/* Fullscreen editor rendered via Portal to escape any stacking context */}
    {fullscreen &&
      createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col bg-background">
          <div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
            <span className="text-sm font-medium">编辑详情</span>
            <button
              type="button"
              onClick={closeFullscreen}
              className="p-1.5 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
              title="退出全屏 (Esc)"
            >
              <Minimize2 className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto mdx-editor-wrapper mdx-fullscreen">
            <MDXEditor
              ref={fullscreenEditorRef}
              markdown={value}
              onChange={handleChange}
              plugins={fullscreenPlugins}
              placeholder={placeholder}
              contentEditableClassName="prose-compact mdx-content"
              className="mdx-editor-root h-full"
              autoFocus
            />
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
