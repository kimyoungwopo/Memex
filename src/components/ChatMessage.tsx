import { Bot, User, Image as ImageIcon } from "lucide-react"
import clsx from "clsx"
import { CodeBlock } from "./CodeBlock"

interface ChatMessageProps {
  role: "user" | "ai"
  text: string
  image?: string // Base64 data URL
}

// 간단한 마크다운 파서 (코드 블록만 처리)
function parseMessage(text: string) {
  const parts: Array<{ type: "text" | "code"; content: string; language?: string }> = []

  // 코드 블록 정규식: ```language\ncode\n```
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g

  let lastIndex = 0
  let match

  while ((match = codeBlockRegex.exec(text)) !== null) {
    // 코드 블록 이전 텍스트
    if (match.index > lastIndex) {
      const textBefore = text.slice(lastIndex, match.index)
      if (textBefore.trim()) {
        parts.push({ type: "text", content: textBefore })
      }
    }

    // 코드 블록
    parts.push({
      type: "code",
      language: match[1] || "text",
      content: match[2]
    })

    lastIndex = match.index + match[0].length
  }

  // 마지막 텍스트
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex)
    if (remaining.trim()) {
      parts.push({ type: "text", content: remaining })
    }
  }

  // 코드 블록이 없으면 전체를 텍스트로
  if (parts.length === 0) {
    parts.push({ type: "text", content: text })
  }

  return parts
}

// 인라인 마크다운 처리 (볼드, 이탤릭, 인라인 코드)
function renderInlineMarkdown(text: string) {
  // 인라인 코드: `code`
  let result = text.replace(
    /`([^`]+)`/g,
    '<code class="px-1.5 py-0.5 bg-slate-100 text-indigo-600 rounded text-xs font-mono">$1</code>'
  )

  // 볼드: **text** 또는 __text__
  result = result.replace(
    /\*\*([^*]+)\*\*/g,
    '<strong class="font-semibold">$1</strong>'
  )
  result = result.replace(
    /__([^_]+)__/g,
    '<strong class="font-semibold">$1</strong>'
  )

  // 이탤릭: *text* 또는 _text_
  result = result.replace(
    /\*([^*]+)\*/g,
    '<em class="italic">$1</em>'
  )
  result = result.replace(
    /_([^_]+)_/g,
    '<em class="italic">$1</em>'
  )

  return result
}

export function ChatMessage({ role, text, image }: ChatMessageProps) {
  const parts = role === "ai" ? parseMessage(text) : []

  return (
    <div
      className={clsx(
        "flex w-full gap-3",
        role === "user" ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={clsx(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm",
          role === "user"
            ? "bg-indigo-100"
            : "bg-white border border-slate-200"
        )}
      >
        {role === "user" ? (
          <User className="w-4 h-4 text-indigo-600" />
        ) : (
          <Bot className="w-4 h-4 text-slate-600" />
        )}
      </div>

      {/* Bubble */}
      <div
        className={clsx(
          "max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm",
          role === "user"
            ? "bg-indigo-600 text-white rounded-tr-none"
            : "bg-white border border-slate-200 text-slate-700 rounded-tl-none"
        )}
      >
        {role === "user" ? (
          <div className="space-y-2">
            {/* 첨부된 이미지 */}
            {image && (
              <div className="relative">
                <img
                  src={image}
                  alt="첨부 이미지"
                  className="max-w-full max-h-48 rounded-lg object-contain bg-white/10"
                />
                <div className="absolute bottom-1 right-1 bg-black/50 text-white p-1 rounded">
                  <ImageIcon className="w-3 h-3" />
                </div>
              </div>
            )}
            {/* 텍스트 */}
            {text && (
              <span className="whitespace-pre-wrap break-words">{text}</span>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {parts.map((part, index) => (
              part.type === "code" ? (
                <CodeBlock key={index} language={part.language}>
                  {part.content}
                </CodeBlock>
              ) : (
                <div
                  key={index}
                  className="whitespace-pre-wrap break-words"
                  dangerouslySetInnerHTML={{
                    __html: renderInlineMarkdown(part.content)
                  }}
                />
              )
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
