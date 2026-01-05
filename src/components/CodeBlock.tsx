import { useState } from "react"
import { Light as SyntaxHighlighter } from "react-syntax-highlighter"
import { atomOneDark } from "react-syntax-highlighter/dist/cjs/styles/hljs"
import { Check, Copy } from "lucide-react"
import clsx from "clsx"

// 자주 사용되는 언어만 등록 (번들 크기 최적화)
import javascript from "react-syntax-highlighter/dist/cjs/languages/hljs/javascript"
import typescript from "react-syntax-highlighter/dist/cjs/languages/hljs/typescript"
import css from "react-syntax-highlighter/dist/cjs/languages/hljs/css"
import json from "react-syntax-highlighter/dist/cjs/languages/hljs/json"
import bash from "react-syntax-highlighter/dist/cjs/languages/hljs/bash"
import python from "react-syntax-highlighter/dist/cjs/languages/hljs/python"
import xml from "react-syntax-highlighter/dist/cjs/languages/hljs/xml"
import markdown from "react-syntax-highlighter/dist/cjs/languages/hljs/markdown"

SyntaxHighlighter.registerLanguage("javascript", javascript)
SyntaxHighlighter.registerLanguage("js", javascript)
SyntaxHighlighter.registerLanguage("typescript", typescript)
SyntaxHighlighter.registerLanguage("ts", typescript)
SyntaxHighlighter.registerLanguage("jsx", javascript)
SyntaxHighlighter.registerLanguage("tsx", typescript)
SyntaxHighlighter.registerLanguage("css", css)
SyntaxHighlighter.registerLanguage("json", json)
SyntaxHighlighter.registerLanguage("bash", bash)
SyntaxHighlighter.registerLanguage("shell", bash)
SyntaxHighlighter.registerLanguage("python", python)
SyntaxHighlighter.registerLanguage("py", python)
SyntaxHighlighter.registerLanguage("html", xml)
SyntaxHighlighter.registerLanguage("xml", xml)
SyntaxHighlighter.registerLanguage("markdown", markdown)
SyntaxHighlighter.registerLanguage("md", markdown)

interface CodeBlockProps {
  language?: string
  children: string
}

export function CodeBlock({ language, children }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(children)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  return (
    <div className="relative group my-3 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 text-slate-400 text-xs">
        <span className="font-mono">{language || "code"}</span>
        <button
          onClick={handleCopy}
          className={clsx(
            "flex items-center gap-1.5 px-2 py-1 rounded transition-all",
            copied
              ? "bg-green-600/20 text-green-400"
              : "hover:bg-slate-700 text-slate-400 hover:text-slate-200"
          )}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>복사됨</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>복사</span>
            </>
          )}
        </button>
      </div>

      {/* Code */}
      <SyntaxHighlighter
        language={language || "text"}
        style={atomOneDark}
        customStyle={{
          margin: 0,
          padding: "1rem",
          fontSize: "0.8125rem",
          lineHeight: "1.5",
          borderRadius: 0,
          background: "#282c34",
        }}
        showLineNumbers={children.split("\n").length > 3}
        lineNumberStyle={{
          minWidth: "2.5em",
          paddingRight: "1em",
          color: "#636e7b",
          userSelect: "none",
        }}
      >
        {children.trim()}
      </SyntaxHighlighter>
    </div>
  )
}
