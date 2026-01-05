import { useState, useEffect, useRef, useCallback } from "react"
import {
  Send,
  Bot,
  Loader2,
  AlertCircle,
  CheckCircle2,
  BrainCircuit,
  FileText,
  X,
  History,
  Plus,
} from "lucide-react"
import clsx from "clsx"

import { useGemini } from "./hooks/use-gemini"
import { ChatMessage } from "./components/ChatMessage"
import { PersonaSelector } from "./components/PersonaSelector"
import { SessionList } from "./components/SessionList"
import { PERSONAS, type Persona, type ChatSession } from "./types"
import {
  getAllSessions,
  getSession,
  getCurrentSessionId,
  setCurrentSessionId,
  createSession,
  saveSession,
} from "./lib/chat-storage"
import "./style.css"

interface Message {
  role: "user" | "ai"
  text: string
}

interface PageContext {
  title: string
  url: string
  content: string
}

function IndexSidePanel() {
  const { status, generate, generateStream } = useGemini()
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "ai",
      text: "안녕하세요! 브라우저 속 개인 두뇌 Memex입니다. \n오늘 어떤 정보를 찾고 계신가요?",
    },
  ])
  const [isThinking, setIsThinking] = useState(false)
  const [pageContext, setPageContext] = useState<PageContext | null>(null)
  const [isLoadingPage, setIsLoadingPage] = useState(false)
  const [currentPersona, setCurrentPersona] = useState<Persona>(PERSONAS[0])

  // Session management
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [showSessionList, setShowSessionList] = useState(false)
  const [isLoadingSession, setIsLoadingSession] = useState(true)

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

  // 세션 로드 (초기화)
  useEffect(() => {
    const loadSessions = async () => {
      try {
        setIsLoadingSession(true)
        const allSessions = await getAllSessions()
        setSessions(allSessions)

        const currentId = await getCurrentSessionId()
        if (currentId) {
          const session = await getSession(currentId)
          if (session) {
            setCurrentSession(session)
            setMessages(session.messages.length > 0 ? session.messages as Message[] : [
              { role: "ai", text: "안녕하세요! 브라우저 속 개인 두뇌 Memex입니다. \n오늘 어떤 정보를 찾고 계신가요?" }
            ])
            // 페르소나 복원
            const persona = PERSONAS.find(p => p.id === session.personaId)
            if (persona) setCurrentPersona(persona)
            return
          }
        }

        // 세션이 없으면 새로 생성
        const newSession = await createSession()
        setCurrentSession(newSession)
        setSessions([newSession])
      } catch (error) {
        console.error("Failed to load sessions:", error)
      } finally {
        setIsLoadingSession(false)
      }
    }

    loadSessions()
  }, [])

  // 메시지 변경 시 자동 저장
  useEffect(() => {
    if (!currentSession || isLoadingSession) return

    const saveTimer = setTimeout(async () => {
      const updatedSession: ChatSession = {
        ...currentSession,
        messages: messages,
        personaId: currentPersona.id,
        updatedAt: Date.now(),
      }
      await saveSession(updatedSession)
      setCurrentSession(updatedSession)

      // 세션 목록도 업데이트
      setSessions(prev => {
        const index = prev.findIndex(s => s.id === updatedSession.id)
        if (index >= 0) {
          const updated = [...prev]
          updated[index] = updatedSession
          return updated.sort((a, b) => b.updatedAt - a.updatedAt)
        }
        return prev
      })
    }, 500) // 500ms 디바운스

    return () => clearTimeout(saveTimer)
  }, [messages, currentPersona.id, currentSession?.id, isLoadingSession])

  // 새 대화 시작
  const handleNewSession = useCallback(async () => {
    const newSession = await createSession(currentPersona.id)
    setCurrentSession(newSession)
    setMessages([
      { role: "ai", text: "안녕하세요! 브라우저 속 개인 두뇌 Memex입니다. \n오늘 어떤 정보를 찾고 계신가요?" }
    ])
    setPageContext(null)
    setSessions(prev => [newSession, ...prev])
    setShowSessionList(false)
  }, [currentPersona.id])

  // 세션 선택
  const handleSelectSession = useCallback(async (session: ChatSession) => {
    setCurrentSession(session)
    setMessages(session.messages.length > 0 ? session.messages as Message[] : [
      { role: "ai", text: "안녕하세요! 브라우저 속 개인 두뇌 Memex입니다. \n오늘 어떤 정보를 찾고 계신가요?" }
    ])
    await setCurrentSessionId(session.id)
    // 페르소나 복원
    const persona = PERSONAS.find(p => p.id === session.personaId)
    if (persona) setCurrentPersona(persona)
    setPageContext(null)
    setShowSessionList(false)
  }, [])

  // 세션 삭제 후 처리
  const handleDeleteSession = useCallback(async (sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId))

    // 현재 세션이 삭제된 경우 새 세션 생성
    if (currentSession?.id === sessionId) {
      const remaining = sessions.filter(s => s.id !== sessionId)
      if (remaining.length > 0) {
        handleSelectSession(remaining[0])
      } else {
        handleNewSession()
      }
    }
  }, [currentSession?.id, sessions, handleSelectSession, handleNewSession])

  // Quick Action (우클릭 메뉴) 처리
  useEffect(() => {
    const handleQuickAction = async () => {
      const result = await chrome.storage.local.get("quickAction")
      const quickAction = result.quickAction

      if (quickAction && quickAction.timestamp) {
        // 5초 이내의 액션만 처리 (오래된 액션 무시)
        const isRecent = Date.now() - quickAction.timestamp < 5000

        if (isRecent && status === "ready" && !isThinking) {
          // storage 클리어
          await chrome.storage.local.remove("quickAction")

          // 사용자 메시지 추가
          setMessages((prev) => [
            ...prev,
            { role: "user", text: quickAction.selectedText },
          ])
          setIsThinking(true)

          // 스트리밍 AI 응답 생성
          try {
            const stream = generateStream(quickAction.prompt)

            // AI 메시지를 빈 상태로 먼저 추가
            setMessages((prev) => [...prev, { role: "ai", text: "" }])
            setIsThinking(false)

            let accumulatedText = ""

            // @ts-ignore - ReadableStream은 async iterable
            for await (const chunk of stream) {
              if (!chunk) continue

              // 청크가 누적형인지 델타형인지 자동 감지
              if (chunk.length > accumulatedText.length) {
                accumulatedText = chunk
              } else {
                accumulatedText += chunk
              }

              setMessages((prev) => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: "ai", text: accumulatedText }
                return updated
              })
            }

            // 빈 응답 fallback
            if (!accumulatedText) {
              const fallbackResponse = await generate(quickAction.prompt)
              setMessages((prev) => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: "ai", text: fallbackResponse }
                return updated
              })
            }
          } catch (error) {
            console.error("Quick action streaming error:", error)
            // fallback to non-streaming
            try {
              const fallbackResponse = await generate(quickAction.prompt)
              setMessages((prev) => {
                const updated = [...prev]
                if (updated[updated.length - 1]?.role === "ai") {
                  updated[updated.length - 1] = { role: "ai", text: fallbackResponse }
                } else {
                  updated.push({ role: "ai", text: fallbackResponse })
                }
                return updated
              })
            } catch {
              setMessages((prev) => {
                const updated = [...prev]
                if (updated[updated.length - 1]?.role === "ai") {
                  updated[updated.length - 1] = { role: "ai", text: "죄송합니다. 응답 생성 중 오류가 발생했습니다." }
                } else {
                  updated.push({ role: "ai", text: "죄송합니다. 응답 생성 중 오류가 발생했습니다." })
                }
                return updated
              })
            }
          } finally {
            setIsThinking(false)
          }
        }
      }
    }

    // 초기 로드 시 체크
    if (status === "ready") {
      handleQuickAction()
    }

    // storage 변경 리스너
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.quickAction?.newValue) {
        handleQuickAction()
      }
    }

    chrome.storage.local.onChanged.addListener(listener)
    return () => chrome.storage.local.onChanged.removeListener(listener)
  }, [status, isThinking, generateStream, generate])

  // 현재 페이지 텍스트 추출
  const extractPageContent = async () => {
    setIsLoadingPage(true)
    try {
      // 현재 활성 탭 가져오기
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

      if (!tab.id || !tab.url) {
        throw new Error("탭 정보를 가져올 수 없습니다.")
      }

      // chrome:// 페이지는 스크립트 실행 불가
      if (tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://")) {
        throw new Error("Chrome 내부 페이지에서는 사용할 수 없습니다.")
      }

      // 페이지 텍스트 추출
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // 불필요한 요소 제거 후 텍스트 추출
          const elementsToRemove = document.querySelectorAll(
            "script, style, nav, footer, header, aside, [role='banner'], [role='navigation'], [role='complementary']"
          )
          const clone = document.body.cloneNode(true) as HTMLElement
          clone.querySelectorAll("script, style, nav, footer, header, aside").forEach(el => el.remove())

          // 본문 텍스트 정리
          let text = clone.innerText || ""
          // 연속 공백/줄바꿈 정리
          text = text.replace(/\s+/g, " ").trim()
          // 최대 길이 제한 (약 8000자 = ~2000 토큰)
          if (text.length > 8000) {
            text = text.substring(0, 8000) + "..."
          }
          return text
        },
      })

      const content = results[0]?.result || ""

      if (!content || content.length < 50) {
        throw new Error("페이지에서 충분한 텍스트를 찾을 수 없습니다.")
      }

      setPageContext({
        title: tab.title || "제목 없음",
        url: tab.url,
        content,
      })

      // 시스템 메시지 추가
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: `📄 **"${tab.title}"** 페이지를 읽었습니다!\n\n이제 이 페이지에 대해 질문해 보세요. 예시:\n- "3줄로 요약해줘"\n- "핵심 내용이 뭐야?"\n- "여기서 중요한 포인트는?"`,
        },
      ])
    } catch (error) {
      console.error("페이지 추출 실패:", error)
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: `❌ 페이지를 읽을 수 없습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
        },
      ])
    } finally {
      setIsLoadingPage(false)
    }
  }

  // 컨텍스트 초기화
  const clearPageContext = () => {
    setPageContext(null)
    setMessages((prev) => [
      ...prev,
      {
        role: "ai",
        text: "📋 페이지 컨텍스트를 해제했습니다. 이제 일반 대화 모드입니다.",
      },
    ])
  }

  const handleSend = async () => {
    if (!input.trim() || status !== "ready" || isThinking) return

    const userText = input
    setInput("")
    setMessages((prev) => [...prev, { role: "user", text: userText }])
    setIsThinking(true)

    // 프롬프트 구성 (페르소나 + 컨텍스트 포함)
    let prompt = ""

    // 1. 페르소나 시스템 프롬프트 추가
    prompt += `[시스템 지시사항]\n${currentPersona.systemPrompt}\n\n`

    // 2. 페이지 컨텍스트 추가 (있는 경우)
    if (pageContext) {
      prompt += `[참고 페이지]\n제목: ${pageContext.title}\nURL: ${pageContext.url}\n\n본문:\n${pageContext.content}\n\n`
    }

    // 3. 사용자 질문 추가
    prompt += `[사용자 질문]\n${userText}`

    // 스트리밍 응답 처리
    try {
      const stream = generateStream(prompt)

      // AI 메시지를 빈 상태로 먼저 추가
      setMessages((prev) => [...prev, { role: "ai", text: "" }])
      setIsThinking(false)

      let accumulatedText = ""

      // for await...of로 스트림 소비
      // @ts-ignore - ReadableStream은 async iterable
      for await (const chunk of stream) {
        if (!chunk) continue

        // 청크가 누적형인지 델타형인지 자동 감지
        // 청크가 현재 누적 텍스트보다 길면 누적형 (전체 텍스트)
        // 아니면 델타형 (증분 텍스트)
        if (chunk.length > accumulatedText.length) {
          accumulatedText = chunk
        } else {
          accumulatedText += chunk
        }

        // 마지막 AI 메시지 업데이트
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: "ai", text: accumulatedText }
          return updated
        })
      }

      // 스트림이 빈 응답으로 끝난 경우 fallback
      if (!accumulatedText) {
        console.warn("Empty streaming response, falling back to prompt()")
        const fallbackResponse = await generate(prompt)
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: "ai", text: fallbackResponse }
          return updated
        })
      }
    } catch (error) {
      console.error("Streaming error:", error)
      // 스트리밍 실패 시 일반 prompt로 fallback
      try {
        const fallbackResponse = await generate(prompt)
        setMessages((prev) => {
          const updated = [...prev]
          if (updated[updated.length - 1]?.role === "ai") {
            updated[updated.length - 1] = { role: "ai", text: fallbackResponse }
          } else {
            updated.push({ role: "ai", text: fallbackResponse })
          }
          return updated
        })
      } catch (fallbackError) {
        console.error("Fallback error:", fallbackError)
        setMessages((prev) => {
          const updated = [...prev]
          if (updated[updated.length - 1]?.role === "ai") {
            updated[updated.length - 1] = { role: "ai", text: "죄송합니다. 응답 생성 중 오류가 발생했습니다." }
          } else {
            updated.push({ role: "ai", text: "죄송합니다. 응답 생성 중 오류가 발생했습니다." })
          }
          return updated
        })
      }
    } finally {
      setIsThinking(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans">
      {/* --- Header --- */}
      <header className="px-4 py-2.5 bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        {/* Top Row: Logo + Status */}
        <div className="flex items-center justify-between mb-2">
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
        </div>

        {/* Bottom Row: Persona Selector + Session Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-medium">모드:</span>
            <PersonaSelector
              selectedPersona={currentPersona}
              onSelect={(persona) => {
              setCurrentPersona(persona)
              setMessages((prev) => [
                ...prev,
                {
                  role: "ai",
                  text: `${persona.icon} **${persona.name}** 모드로 전환했습니다.\n\n_${persona.description}_`,
                },
              ])
            }}
            disabled={status !== "ready" || isThinking}
          />
          </div>

          {/* Session Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleNewSession}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
              title="새 대화"
            >
              <Plus className="w-4 h-4 text-slate-500" />
            </button>
            <button
              onClick={() => setShowSessionList(true)}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
              title="대화 목록"
            >
              <History className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>
      </header>

      {/* --- Page Context Banner --- */}
      {pageContext && (
        <div className="px-4 py-2 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="text-xs text-indigo-700 font-medium truncate">
              {pageContext.title}
            </span>
          </div>
          <button
            onClick={clearPageContext}
            className="p-1 hover:bg-indigo-100 rounded transition-colors shrink-0"
            title="컨텍스트 해제"
          >
            <X className="w-4 h-4 text-indigo-600" />
          </button>
        </div>
      )}

      {/* --- Chat Area --- */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg, idx) => (
          <ChatMessage key={idx} role={msg.role} text={msg.text} />
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
      <footer className="p-4 bg-white border-t border-slate-200 space-y-3">
        {/* Page Read Button */}
        <button
          onClick={extractPageContent}
          disabled={status !== "ready" || isLoadingPage || isThinking}
          className={clsx(
            "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
            pageContext
              ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
              : "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200",
            (status !== "ready" || isLoadingPage || isThinking) && "opacity-50 cursor-not-allowed"
          )}
        >
          {isLoadingPage ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>페이지 읽는 중...</span>
            </>
          ) : (
            <>
              <FileText className="w-4 h-4" />
              <span>{pageContext ? "페이지 다시 읽기" : "이 페이지 읽기"}</span>
            </>
          )}
        </button>

        {/* Input */}
        <div className="relative flex items-center shadow-sm rounded-xl">
          <input
            ref={inputRef}
            type="text"
            className="w-full pl-4 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none disabled:opacity-50 placeholder:text-slate-400"
            placeholder={
              status === "ready"
                ? pageContext
                  ? "이 페이지에 대해 질문하세요..."
                  : "무엇이든 물어보세요..."
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
        <div className="text-center">
          <p className="text-[10px] text-slate-400 font-medium">
            Powered by Gemini Nano (On-Device)
          </p>
        </div>
      </footer>

      {/* Session List Panel */}
      {showSessionList && (
        <SessionList
          sessions={sessions}
          currentSessionId={currentSession?.id || null}
          onSelectSession={handleSelectSession}
          onNewSession={handleNewSession}
          onDeleteSession={handleDeleteSession}
          onClose={() => setShowSessionList(false)}
        />
      )}
    </div>
  )
}

export default IndexSidePanel
