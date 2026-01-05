import { useState, useEffect, useRef } from "react"
import {
  Send,
  Bot,
  Loader2,
  AlertCircle,
  CheckCircle2,
  BrainCircuit,
  User,
} from "lucide-react"
import clsx from "clsx"

import { useGemini } from "./hooks/use-gemini"
import "./style.css"

interface Message {
  role: "user" | "ai"
  text: string
}

function IndexSidePanel() {
  const { status, generate } = useGemini()
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "ai",
      text: "안녕하세요! 브라우저 속 개인 두뇌 Memex입니다. \n오늘 어떤 정보를 찾고 계신가요?",
    },
  ])
  const [isThinking, setIsThinking] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 자동 스크롤
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      })
    }
  }, [messages, isThinking])

  // 초기 로딩 후 입력창 포커스
  useEffect(() => {
    if (status === "ready" && inputRef.current) {
      inputRef.current.focus()
    }
  }, [status])

  const handleSend = async () => {
    if (!input.trim() || status !== "ready" || isThinking) return

    const userText = input
    setInput("")
    setMessages((prev) => [...prev, { role: "user", text: userText }])
    setIsThinking(true)

    // AI 생성 호출
    const aiResponse = await generate(userText)

    setIsThinking(false)
    setMessages((prev) => [...prev, { role: "ai", text: aiResponse }])
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans">
      {/* --- Header --- */}
      <header className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-600 rounded-lg shadow-sm">
            <BrainCircuit className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-tight text-slate-800 leading-none">
              Memex
            </h1>
            <span className="text-[10px] text-slate-400 font-medium">
              Local Brain Indexer
            </span>
          </div>
        </div>

        {/* Status Badge */}
        <div
          className={clsx(
            "flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border transition-colors duration-300",
            status === "ready"
              ? "bg-green-50 border-green-200 text-green-700"
              : status === "error"
                ? "bg-red-50 border-red-200 text-red-700"
                : "bg-indigo-50 border-indigo-200 text-indigo-700"
          )}
        >
          {status === "ready" && <CheckCircle2 className="w-3 h-3" />}
          {(status === "loading" || status === "downloading") && (
            <Loader2 className="w-3 h-3 animate-spin" />
          )}
          {(status === "error" || status === "unsupported") && (
            <AlertCircle className="w-3 h-3" />
          )}

          <span>
            {status === "ready"
              ? "ONLINE"
              : status === "error"
                ? "ERROR"
                : "LOADING"}
          </span>
        </div>
      </header>

      {/* --- Chat Area --- */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={clsx(
              "flex w-full gap-3",
              msg.role === "user" ? "flex-row-reverse" : "flex-row"
            )}
          >
            {/* Avatar */}
            <div
              className={clsx(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm",
                msg.role === "user"
                  ? "bg-indigo-100"
                  : "bg-white border border-slate-200"
              )}
            >
              {msg.role === "user" ? (
                <User className="w-4 h-4 text-indigo-600" />
              ) : (
                <Bot className="w-4 h-4 text-slate-600" />
              )}
            </div>

            {/* Bubble */}
            <div
              className={clsx(
                "max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm whitespace-pre-wrap break-words",
                msg.role === "user"
                  ? "bg-indigo-600 text-white rounded-tr-none"
                  : "bg-white border border-slate-200 text-slate-700 rounded-tl-none"
              )}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {/* Thinking State */}
        {isThinking && (
          <div className="flex w-full gap-3">
            <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-sm">
              <Bot className="w-4 h-4 text-slate-600" />
            </div>
            <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
              <span className="text-xs text-slate-400 font-medium animate-pulse">
                답변 생성 중...
              </span>
            </div>
          </div>
        )}
      </main>

      {/* --- Input Area --- */}
      <footer className="p-4 bg-white border-t border-slate-200">
        <div className="relative flex items-center shadow-sm rounded-xl">
          <input
            ref={inputRef}
            type="text"
            className="w-full pl-4 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none disabled:opacity-50 placeholder:text-slate-400"
            placeholder={
              status === "ready"
                ? "무엇이든 물어보세요..."
                : "AI 모델을 연결하고 있습니다..."
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && !e.nativeEvent.isComposing && handleSend()
            }
            disabled={status !== "ready" || isThinking}
          />
          <button
            onClick={handleSend}
            disabled={status !== "ready" || isThinking || !input.trim()}
            className="absolute right-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-all duration-200 active:scale-95"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-2 text-center">
          <p className="text-[10px] text-slate-400 font-medium">
            Powered by Gemini Nano (On-Device)
          </p>
        </div>
      </footer>
    </div>
  )
}

export default IndexSidePanel
