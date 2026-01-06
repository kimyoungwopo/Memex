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
  ImagePlus,
  Brain,
  Sparkles,
  MessageSquare,
  Database,
  ToggleLeft,
  ToggleRight,
  Youtube,
  PlayCircle,
  Clock,
  Settings,
  Languages,
} from "lucide-react"
import clsx from "clsx"

import { useGemini } from "./hooks/use-gemini"
import { useMemory } from "./hooks/use-memory"
import { useYouTube } from "./hooks/use-youtube"
import { ChatMessage } from "./components/ChatMessage"
import { PersonaSelector } from "./components/PersonaSelector"
import { SessionList } from "./components/SessionList"
import { MemoryPanel } from "./components/MemoryPanel"
import { MemoryDashboard } from "./components/MemoryDashboard"
import { SettingsPanel } from "./components/SettingsPanel"
import {
  ImagePreview,
  imageToBase64,
  getImageFromClipboard,
  getImageFromDrop,
} from "./components/ImagePreview"
import { PERSONAS, type Persona, type ChatSession } from "./types"
import {
  getAllSessions,
  getSession,
  getCurrentSessionId,
  setCurrentSessionId,
  createSession,
  saveSession,
} from "./lib/chat-storage"
import { formatTimestamp } from "./lib/youtube"
import { isPdfUrl, extractPdfFromUrl } from "./lib/pdf"
import { WelcomePage } from "./components/WelcomePage"
import { TranslationPanel } from "./components/TranslationPanel"
import "./style.css"

const ONBOARDING_COMPLETE_KEY = "memex_onboarding_complete"

interface Message {
  role: "user" | "ai"
  text: string
  image?: string // Base64 data URL
}

interface PageContext {
  title: string
  url: string
  content: string
}

function IndexSidePanel() {
  const { status, generate, generateStream } = useGemini()
  const {
    status: memoryStatus,
    memoryCount,
    isSaving: isMemorySaving,
    isSearching: isMemorySearching,
    rememberPage,
    recallMemories,
    listMemories,
    forgetMemory,
    forgetAll,
    formatMemoriesForPrompt,
    getMemoriesWithEmbeddings,
  } = useMemory()

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

  // Tab navigation
  type TabType = "chat" | "memory" | "translate" | "settings"
  const [activeTab, setActiveTab] = useState<TabType>("chat")
  const [isLoadingMemories, setIsLoadingMemories] = useState(false)

  // Memory panel
  const [showMemoryPanel, setShowMemoryPanel] = useState(false)
  const [memoryList, setMemoryList] = useState<Array<{
    id: string
    url: string
    title: string
    summary: string
    tags: string[]
    createdAt: number
  }>>([])

  // 맥락 모드: "brain" (RAG) | "page" (현재 탭) | "both" (둘 다)
  type ContextMode = "brain" | "page" | "both"
  const [contextMode, setContextMode] = useState<ContextMode>("both")

  // Image input (disabled - Gemini Nano multimodal performance is limited)
  // TODO: Re-enable when Chrome AI model improves
  const ENABLE_IMAGE_INPUT = false

  // YouTube analysis (disabled - under improvement)
  // TODO: Re-enable after refactoring
  const ENABLE_YOUTUBE_ANALYSIS = false
  const [attachedImage, setAttachedImage] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // YouTube 영상 분석 (훅 사용)
  const {
    isYouTubePage,
    videoId: youtubeVideoId,
    isAnalyzing: isAnalyzingVideo,
    transcript: videoTranscript,
    lastAnalysis: lastVideoAnalysis,
    progress: youtubeProgress,
    error: youtubeError,
    analyzeVideo,
    jumpToTimestamp,
  } = useYouTube({ generate, aiStatus: status })

  // 세렌디피티 엔진 (관련 기억 자동 알림)
  const [serendipityMemories, setSerendipityMemories] = useState<Array<{
    id: string
    url: string
    title: string
    summary: string
    score: number
    createdAt: number
  }>>([])
  const [showSerendipityBanner, setShowSerendipityBanner] = useState(false)
  const [lastSerendipityUrl, setLastSerendipityUrl] = useState("")

  // PDF 문서 분석
  const [isPdfPage, setIsPdfPage] = useState(false)
  const [isAnalyzingPdf, setIsAnalyzingPdf] = useState(false)
  const [pdfContext, setPdfContext] = useState<{
    title: string
    url: string
    content: string
    pageCount: number
  } | null>(null)

  // 온보딩 상태
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [onboardingChecked, setOnboardingChecked] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 자동 스크롤
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      })
    }
  }, [messages, isThinking])

  // 온보딩 체크 (첫 실행 또는 모델 다운로드 필요 시)
  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        // 1. 온보딩 완료 여부 확인
        const stored = await chrome.storage.local.get(ONBOARDING_COMPLETE_KEY)
        const isOnboardingComplete = stored[ONBOARDING_COMPLETE_KEY] === true

        if (!isOnboardingComplete) {
          setShowOnboarding(true)
        } else {
          // 2. 모델 다운로드 필요 여부 확인 (온보딩 완료 후에도 모델이 없을 수 있음)
          try {
            // @ts-ignore
            if (typeof LanguageModel !== "undefined") {
              // @ts-ignore
              const availability = await LanguageModel.availability()
              if (availability === "after-download") {
                // 모델 다운로드가 필요하면 온보딩 표시
                setShowOnboarding(true)
              }
            }
          } catch (e) {
            // Chrome AI API 오류 시 온보딩 표시
            console.warn("[Onboarding] Chrome AI check failed:", e)
          }
        }
      } catch (error) {
        console.error("[Onboarding] Check failed:", error)
      } finally {
        setOnboardingChecked(true)
      }
    }

    checkOnboarding()
  }, [])

  // 온보딩 완료 핸들러
  const handleOnboardingComplete = useCallback(async () => {
    await chrome.storage.local.set({ [ONBOARDING_COMPLETE_KEY]: true })
    setShowOnboarding(false)
  }, [])

  // 초기 로딩 후 입력창 포커스
  useEffect(() => {
    if (status === "ready" && inputRef.current) {
      inputRef.current.focus()
    }
  }, [status])

  // PDF 페이지 감지 (YouTube는 useYouTube 훅에서 처리)
  useEffect(() => {
    const checkPdfPage = async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (tab?.url && !isYouTubePage) {
          const isPdf = isPdfUrl(tab.url)
          setIsPdfPage(isPdf)
          if (!isPdf) {
            setPdfContext(null)
          }
        } else {
          setIsPdfPage(false)
        }
      } catch (error) {
        console.error("PDF page check failed:", error)
      }
    }

    checkPdfPage()

    const handleTabChange = () => checkPdfPage()
    const handleTabUpdate = (_: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (changeInfo.url) checkPdfPage()
    }

    chrome.tabs.onActivated.addListener(handleTabChange)
    chrome.tabs.onUpdated.addListener(handleTabUpdate)

    return () => {
      chrome.tabs.onActivated.removeListener(handleTabChange)
      chrome.tabs.onUpdated.removeListener(handleTabUpdate)
    }
  }, [isYouTubePage])

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

  // 이미지 파일 처리
  const handleImageFile = useCallback(async (file: File) => {
    try {
      // 이미지 타입 확인
      if (!file.type.startsWith("image/")) {
        console.warn("Not an image file:", file.type)
        return
      }

      // 파일 크기 제한 (10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert("이미지 크기는 10MB 이하여야 합니다.")
        return
      }

      // Base64로 변환
      const base64 = await imageToBase64(file)
      setAttachedImage(base64)
    } catch (error) {
      console.error("Failed to process image:", error)
      alert("이미지 처리에 실패했습니다.")
    }
  }, [])

  // 드래그 앤 드롭 핸들러
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const file = getImageFromDrop(e.dataTransfer.files)
    if (file) {
      handleImageFile(file)
    }
  }, [handleImageFile])

  // 붙여넣기 핸들러 (Cmd+V / Ctrl+V)
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const file = getImageFromClipboard(e.clipboardData.items)
    if (file) {
      e.preventDefault()
      handleImageFile(file)
    }
  }, [handleImageFile])

  // 파일 선택 핸들러
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleImageFile(file)
    }
    // 같은 파일 재선택 허용을 위해 value 초기화
    e.target.value = ""
  }, [handleImageFile])

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

  // ========== 세렌디피티 엔진: 관련 기억 자동 알림 ==========
  useEffect(() => {
    const SIMILARITY_THRESHOLD = 0.25 // 유사도 임계값 (25% 이상이면 알림)

    const checkSerendipity = async () => {
      // 메모리 시스템이 준비되지 않았으면 스킵
      if (memoryStatus !== "ready") return

      const result = await chrome.storage.local.get("serendipityPage")
      const pageData = result.serendipityPage

      if (!pageData || !pageData.content || pageData.content.length < 100) return

      // 이미 분석한 URL이면 스킵
      if (pageData.url === lastSerendipityUrl) return

      console.log("[Serendipity] Checking for related memories:", pageData.title)
      setLastSerendipityUrl(pageData.url)

      try {
        // 현재 페이지로 유사 기억 검색
        const relatedMemories = await recallMemories(pageData.content.slice(0, 1000), 5)

        // 유사도 임계값 이상인 기억만 필터링
        const highSimilarityMemories = relatedMemories.filter(
          (m) => m.score >= SIMILARITY_THRESHOLD && m.url !== pageData.url
        )

        if (highSimilarityMemories.length > 0) {
          console.log("[Serendipity] Found", highSimilarityMemories.length, "related memories!")

          setSerendipityMemories(highSimilarityMemories.slice(0, 3))
          setShowSerendipityBanner(true)

          // 배지 표시
          chrome.runtime.sendMessage({
            type: "SET_BADGE",
            count: highSimilarityMemories.length,
          })
        } else {
          setSerendipityMemories([])
          setShowSerendipityBanner(false)
          chrome.runtime.sendMessage({ type: "SET_BADGE", count: 0 })
        }
      } catch (error) {
        console.error("[Serendipity] Search error:", error)
      }
    }

    // 초기 체크
    checkSerendipity()

    // Storage 변경 리스너
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.serendipityPage?.newValue) {
        checkSerendipity()
      }
    }

    chrome.storage.local.onChanged.addListener(listener)
    return () => chrome.storage.local.onChanged.removeListener(listener)
  }, [memoryStatus, recallMemories, lastSerendipityUrl])

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

  // === Memory Functions ===

  // 현재 페이지를 기억에 저장
  const handleRememberPage = async () => {
    if (!pageContext) {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "❌ 먼저 '이 페이지 읽기' 버튼을 눌러 페이지를 읽어주세요.",
        },
      ])
      return
    }

    if (memoryStatus !== "ready") {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "⏳ 메모리 시스템이 아직 준비 중입니다. 잠시 후 다시 시도해주세요.",
        },
      ])
      return
    }

    setMessages((prev) => [
      ...prev,
      {
        role: "ai",
        text: "🧠 페이지를 기억하는 중입니다...\n\n1️⃣ AI 요약 생성 중...",
      },
    ])

    // 1. AI 요약 생성
    let aiSummary: string | undefined
    try {
      if (status === "ready") {
        const summaryPrompt = `다음 웹페이지 내용을 50자 이내로 핵심만 요약해줘. 불필요한 수식어 없이 핵심 정보만:\n\n제목: ${pageContext.title}\n\n내용: ${pageContext.content.slice(0, 2000)}`
        aiSummary = await generate(summaryPrompt)
        // 50자로 제한
        if (aiSummary && aiSummary.length > 80) {
          aiSummary = aiSummary.slice(0, 77) + "..."
        }
      }
    } catch (err) {
      console.error("[handleRememberPage] AI summary failed:", err)
      // AI 요약 실패해도 계속 진행 (fallback으로 첫 200자 사용)
    }

    // 메시지 업데이트 - 태그 생성 단계
    setMessages((prev) => {
      const updated = [...prev]
      updated[updated.length - 1] = {
        role: "ai",
        text: "🧠 페이지를 기억하는 중입니다...\n\n1️⃣ AI 요약 생성 ✓\n2️⃣ AI 태그 생성 중...",
      }
      return updated
    })

    // 2. AI 태그 생성
    let aiTags: string[] = []
    try {
      if (status === "ready") {
        const tagPrompt = `이 텍스트의 주제를 나타내는 핵심 키워드 3개를 해시태그 형식으로 뽑아줘. 반드시 #으로 시작하는 한글 키워드만 출력해. 예: #인공지능 #머신러닝 #딥러닝\n\n제목: ${pageContext.title}\n\n내용: ${pageContext.content.slice(0, 1500)}`
        const tagResponse = await generate(tagPrompt)
        // 해시태그 파싱 (#으로 시작하는 단어들 추출)
        const hashtagRegex = /#([^\s#]+)/g
        const matches = tagResponse.match(hashtagRegex)
        if (matches && matches.length > 0) {
          aiTags = matches.slice(0, 5).map(tag => tag.replace('#', ''))
        }
        console.log("[handleRememberPage] AI tags:", aiTags)
      }
    } catch (err) {
      console.error("[handleRememberPage] AI tag generation failed:", err)
      // 태그 생성 실패해도 계속 진행
    }

    // 메시지 업데이트 - 임베딩 단계
    setMessages((prev) => {
      const updated = [...prev]
      updated[updated.length - 1] = {
        role: "ai",
        text: `🧠 페이지를 기억하는 중입니다...\n\n1️⃣ AI 요약 생성 ✓\n2️⃣ AI 태그 생성 ✓${aiTags.length > 0 ? ` (${aiTags.map(t => '#' + t).join(' ')})` : ''}\n3️⃣ 임베딩 생성 중...`,
      }
      return updated
    })

    // 3. 메모리에 저장 (임베딩 + 저장)
    const result = await rememberPage({
      url: pageContext.url,
      title: pageContext.title,
      content: pageContext.content,
      summary: aiSummary,
      tags: aiTags,
    })

    // 마지막 메시지 업데이트
    setMessages((prev) => {
      const updated = [...prev]
      updated[updated.length - 1] = {
        role: "ai",
        text: result.success
          ? `✅ ${result.message}\n\n📝 **요약:** ${aiSummary || "(자동 생성)"}\n🏷️ **태그:** ${aiTags.length > 0 ? aiTags.map(t => '#' + t).join(' ') : "(없음)"}\n\n이제 나중에 "${pageContext.title}"에 대해 물어보면 기억에서 찾아드릴게요!`
          : `❌ ${result.message}`,
      }
      return updated
    })
  }

  // YouTube 영상을 기억에 저장
  const handleRememberVideo = async () => {
    if (!lastVideoAnalysis) {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "❌ 먼저 '영상 분석' 버튼을 눌러 영상을 분석해주세요.",
        },
      ])
      return
    }

    if (memoryStatus !== "ready") {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "⏳ 메모리 시스템이 아직 준비 중입니다. 잠시 후 다시 시도해주세요.",
        },
      ])
      return
    }

    setMessages((prev) => [
      ...prev,
      {
        role: "ai",
        text: "🧠 영상을 기억하는 중입니다...\n\n1️⃣ AI 태그 생성 중...",
      },
    ])

    // AI 태그 생성
    let aiTags: string[] = []
    try {
      if (status === "ready") {
        const tagPrompt = `이 YouTube 영상의 주제를 나타내는 핵심 키워드 3개를 해시태그 형식으로 뽑아줘. 반드시 #으로 시작하는 한글 키워드만 출력해. 예: #프로그래밍 #튜토리얼 #자바스크립트\n\n제목: ${lastVideoAnalysis.title}\n채널: ${lastVideoAnalysis.channelName}\n요약: ${lastVideoAnalysis.summary.slice(0, 500)}`
        const tagResponse = await generate(tagPrompt)
        const hashtagRegex = /#([^\s#]+)/g
        const matches = tagResponse.match(hashtagRegex)
        if (matches && matches.length > 0) {
          aiTags = matches.slice(0, 5).map(tag => tag.replace('#', ''))
        }
      }
    } catch (err) {
      console.error("[handleRememberVideo] AI tag generation failed:", err)
    }

    // 메시지 업데이트 - 임베딩 단계
    setMessages((prev) => {
      const updated = [...prev]
      updated[updated.length - 1] = {
        role: "ai",
        text: `🧠 영상을 기억하는 중입니다...\n\n1️⃣ AI 태그 생성 ✓${aiTags.length > 0 ? ` (${aiTags.map(t => '#' + t).join(' ')})` : ''}\n2️⃣ 임베딩 생성 중...`,
      }
      return updated
    })

    // 메모리에 저장
    const result = await rememberPage({
      url: lastVideoAnalysis.url,
      title: `🎬 ${lastVideoAnalysis.title}`,
      content: `[YouTube 영상]\n채널: ${lastVideoAnalysis.channelName}\n\n요약:\n${lastVideoAnalysis.summary}\n\n자막:\n${lastVideoAnalysis.transcript}`,
      summary: lastVideoAnalysis.summary.slice(0, 80),
      tags: ["YouTube", ...aiTags],
    })

    // 결과 메시지
    setMessages((prev) => {
      const updated = [...prev]
      updated[updated.length - 1] = {
        role: "ai",
        text: result.success
          ? `✅ 영상이 기억에 저장되었습니다!\n\n🎬 **${lastVideoAnalysis.title}**\n🏷️ **태그:** ${["YouTube", ...aiTags].map(t => '#' + t).join(' ')}\n\n이제 나중에 이 영상에 대해 물어보면 기억에서 찾아드릴게요!`
          : `❌ ${result.message}`,
      }
      return updated
    })

  }

  // === YouTube 영상 분석 (훅 사용) ===
  const handleAnalyzeVideo = async () => {
    if (!isYouTubePage || !youtubeVideoId || status !== "ready") return

    // 분석 시작 메시지
    setMessages((prev) => [
      ...prev,
      {
        role: "ai",
        text: "🎬 **YouTube 영상 분석 중...**\n\n1️⃣ 자막 추출 중...",
      },
    ])

    try {
      // 훅의 analyzeVideo 호출
      const analysis = await analyzeVideo()

      if (analysis) {
        const durationMin = Math.ceil(analysis.duration / 60)
        // 최종 결과 표시
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: "ai",
            text: `🎬 **"${analysis.title}"**\n📺 ${analysis.channelName} • ${durationMin}분\n\n${analysis.summary}\n\n---\n💡 타임스탬프(예: 03:45)를 복사해서 YouTube에서 검색하면 해당 시점으로 이동합니다.`,
          }
          return updated
        })
      }
    } catch (error) {
      console.error("YouTube analysis failed:", error)
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: "ai",
          text: `❌ 영상 분석 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}\n\n💡 이 영상에 자막이 있는지 확인해주세요.`,
        }
        return updated
      })
    }
  }

  // YouTube 프로그레스 업데이트 반영
  useEffect(() => {
    if (youtubeProgress && isAnalyzingVideo) {
      setMessages((prev) => {
        const updated = [...prev]
        if (updated.length > 0 && updated[updated.length - 1].role === "ai") {
          updated[updated.length - 1] = {
            role: "ai",
            text: `🎬 **YouTube 영상 분석 중...**\n\n${youtubeProgress}`,
          }
        }
        return updated
      })
    }
  }, [youtubeProgress, isAnalyzingVideo])

  // === PDF 문서 분석 ===
  const handleAnalyzePdf = async () => {
    if (!isPdfPage || status !== "ready") return

    setIsAnalyzingPdf(true)
    setMessages((prev) => [
      ...prev,
      {
        role: "ai",
        text: "📄 **PDF 문서 분석 중...**\n\n1️⃣ PDF 텍스트 추출 중...",
      },
    ])

    try {
      // 1. 현재 탭 URL 가져오기
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (!tab.url) throw new Error("탭 URL을 가져올 수 없습니다.")

      // 2. PDF 텍스트 추출
      const result = await extractPdfFromUrl(tab.url)

      if (!result.success || !result.text) {
        throw new Error(result.error || "PDF 텍스트를 추출할 수 없습니다.")
      }

      console.log(`[PDF] Extracted ${result.text.length} chars from ${result.pageCount} pages`)

      // 메시지 업데이트
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: "ai",
          text: `📄 **PDF 문서 분석 중...**\n\n1️⃣ PDF 텍스트 추출 ✓ (${result.pageCount}페이지)\n2️⃣ AI 요약 생성 중...`,
        }
        return updated
      })

      // 3. PDF 컨텍스트 설정
      const pdfTitle = result.title || tab.title || "PDF 문서"
      setPdfContext({
        title: pdfTitle,
        url: tab.url,
        content: result.text,
        pageCount: result.pageCount,
      })

      // 4. AI 요약 생성
      const summaryPrompt = `다음 PDF 문서 내용을 분석하여 요약해줘.

**문서 제목:** ${pdfTitle}
${result.author ? `**저자:** ${result.author}` : ""}
**페이지 수:** ${result.pageCount}페이지

**문서 내용:**
${result.text.slice(0, 6000)}

---

다음 형식으로 답변해줘:

## 📄 문서 요약

### 핵심 내용 (3줄)
1.
2.
3.

### 주요 키워드
- 키워드1, 키워드2, 키워드3

### 문서 유형
(예: 논문, 보고서, 매뉴얼 등)`

      const summary = await generate(summaryPrompt)

      // 결과 표시
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: "ai",
          text: `📄 **"${pdfTitle}"**\n📑 ${result.pageCount}페이지${result.author ? ` • ${result.author}` : ""}\n\n${summary}\n\n---\n💡 이제 이 PDF에 대해 질문할 수 있습니다.`,
        }
        return updated
      })

      // 페이지 컨텍스트도 설정 (질문 응답용)
      setPageContext({
        title: pdfTitle,
        url: tab.url,
        content: result.text,
      })
    } catch (error) {
      console.error("PDF analysis failed:", error)
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: "ai",
          text: `❌ PDF 분석 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}\n\n💡 온라인 PDF URL만 분석 가능합니다. 로컬 파일(file://)은 지원되지 않습니다.`,
        }
        return updated
      })
    } finally {
      setIsAnalyzingPdf(false)
    }
  }

  // 탭 전환 핸들러
  const handleTabChange = async (tab: TabType) => {
    setActiveTab(tab)
    if (tab === "memory") {
      setIsLoadingMemories(true)
      const memories = await listMemories()
      setMemoryList(memories)
      setIsLoadingMemories(false)
    }
  }

  // 메모리 새로고침
  const refreshMemories = async () => {
    setIsLoadingMemories(true)
    const memories = await listMemories()
    setMemoryList(memories)
    setIsLoadingMemories(false)
  }

  // 메모리 패널 열기
  const openMemoryPanel = async () => {
    const memories = await listMemories()
    setMemoryList(memories)
    setShowMemoryPanel(true)
  }

  // 메모리 삭제
  const handleMemoryDelete = async (id: string) => {
    const success = await forgetMemory(id)
    if (success) {
      setMemoryList((prev) => prev.filter((m) => m.id !== id))
    }
    return success
  }

  // 모든 메모리 삭제
  const handleMemoryClearAll = async () => {
    await forgetAll()
    setMemoryList([])
  }

  const handleSend = async () => {
    // 텍스트 필수 (이미지 기능 비활성화됨)
    const userImage = ENABLE_IMAGE_INPUT ? attachedImage : null
    if ((!input.trim() && !userImage) || status !== "ready" || isThinking) return

    const userText = input

    setInput("")
    if (ENABLE_IMAGE_INPUT) setAttachedImage(null)

    // 사용자 메시지 추가 (이미지 포함 - 비활성화 시 무시)
    setMessages((prev) => [...prev, { role: "user", text: userText, image: userImage || undefined }])
    setIsThinking(true)

    // === 맥락 모드에 따른 분기 처리 ===
    let memoryContext = ""
    let currentPageContext = pageContext
    const useBrain = contextMode === "brain" || contextMode === "both"
    const usePage = contextMode === "page" || contextMode === "both"

    // Brain 모드 또는 Both 모드: RAG 검색
    if (useBrain && memoryStatus === "ready" && memoryCount > 0) {
      try {
        const relevantMemories = await recallMemories(userText, 3)
        if (relevantMemories.length > 0) {
          memoryContext = formatMemoriesForPrompt(relevantMemories)
          console.log(`🧠 [${contextMode} Mode] Found ${relevantMemories.length} relevant memories`)
        }
      } catch (error) {
        console.error("Memory recall failed:", error)
      }
    }

    // Page 모드 또는 Both 모드: 현재 탭 컨텍스트 (없으면 자동 추출)
    if (usePage && !currentPageContext) {
      try {
        console.log(`📄 [${contextMode} Mode] Auto-extracting page content...`)
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

        if (tab.id && tab.url && !tab.url.startsWith("chrome://") && !tab.url.startsWith("chrome-extension://")) {
          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              const clone = document.body.cloneNode(true) as HTMLElement
              clone.querySelectorAll("script, style, nav, footer, header, aside").forEach(el => el.remove())
              let text = clone.innerText || ""
              text = text.replace(/\s+/g, " ").trim()
              if (text.length > 8000) {
                text = text.substring(0, 8000) + "..."
              }
              return text
            },
          })

          const content = results[0]?.result || ""
          if (content && content.length >= 50) {
            currentPageContext = {
              title: tab.title || "제목 없음",
              url: tab.url,
              content,
            }
            setPageContext(currentPageContext)
          }
        }
      } catch (error) {
        console.error("Page extraction failed:", error)
      }
    }

    // 프롬프트 구성 (페르소나 + 기억/페이지 컨텍스트 포함)
    let prompt = ""

    // 현재 날짜 (한국 시간)
    const today = new Date()
    const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`

    // 1. 페르소나 시스템 프롬프트 + 현재 날짜
    prompt += `[시스템 지시사항]\n${currentPersona.systemPrompt}\n\n현재 날짜: ${dateStr}\n\n`

    // 2. 기억 컨텍스트 추가 (Brain 또는 Both 모드)
    if (useBrain && memoryContext) {
      prompt += memoryContext
    }

    // 3. 페이지 컨텍스트 추가 (Page 또는 Both 모드)
    if (usePage && currentPageContext) {
      const modeLabel = contextMode === "both"
        ? "[현재 페이지 + 기억 통합]"
        : contextMode === "page"
          ? "[현재 페이지]"
          : "[참고 페이지]"
      prompt += `${modeLabel}\n제목: ${currentPageContext.title}\nURL: ${currentPageContext.url}\n\n본문:\n${currentPageContext.content}\n\n`
    }

    // 4. 이미지 첨부 표시 (있는 경우)
    if (userImage) {
      prompt += `[첨부된 이미지가 있습니다. 이미지를 분석하여 답변해주세요.]\n\n`
    }

    // 5. 사용자 질문 추가
    prompt += `[사용자 질문]\n${userText || "(이미지를 보고 답변해주세요)"}`

    // 스트리밍 응답 처리
    try {
      const stream = generateStream(prompt, { image: userImage || undefined })

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

  // 온보딩 체크 완료 전 로딩 표시
  if (!onboardingChecked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
        <p className="mt-4 text-slate-400">로딩 중...</p>
      </div>
    )
  }

  // 온보딩 필요 시 환영 페이지 표시
  if (showOnboarding) {
    return <WelcomePage onComplete={handleOnboardingComplete} />
  }

  return (
    <div className="flex flex-col min-h-screen h-full bg-slate-50 text-slate-900 font-sans" style={{ height: '100vh' }}>
      {/* --- Header --- */}
      <header className="px-4 py-2.5 bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        {/* Top Row: Logo + Persona + Actions + Status */}
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

          {/* Persona + Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Persona Selector */}
            <PersonaSelector
              selectedPersona={currentPersona}
              onSelect={setCurrentPersona}
              disabled={isThinking}
            />
            {/* New Chat Button */}
            <button
              onClick={handleNewSession}
              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              title="새 대화"
            >
              <Plus className="w-4 h-4" />
            </button>

            {/* History Button */}
            <button
              onClick={() => setShowSessionList(true)}
              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              title="대화 히스토리"
            >
              <History className="w-4 h-4" />
            </button>

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
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => handleTabChange("chat")}
            className={clsx(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              activeTab === "chat"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            채팅
          </button>
          <button
            onClick={() => handleTabChange("memory")}
            className={clsx(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              activeTab === "memory"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Database className="w-3.5 h-3.5" />
            기억
            {memoryCount > 0 && (
              <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-medium rounded-full">
                {memoryCount}
              </span>
            )}
          </button>
          <button
            onClick={() => handleTabChange("translate")}
            className={clsx(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              activeTab === "translate"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Languages className="w-3.5 h-3.5" />
            번역
          </button>
          <button
            onClick={() => handleTabChange("settings")}
            className={clsx(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              activeTab === "settings"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Settings className="w-3.5 h-3.5" />
            설정
          </button>
        </div>
      </header>

      {/* === Chat Tab Content === */}
      {activeTab === "chat" && (
        <>
          {/* --- 세렌디피티 배너: 관련 기억 알림 --- */}
          {showSerendipityBanner && serendipityMemories.length > 0 && (
            <div className="px-4 py-3 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-100">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-purple-700">
                      💡 이 페이지와 관련된 기억이 {serendipityMemories.length}개 있어요!
                    </p>
                    <div className="mt-2 space-y-1.5">
                      {serendipityMemories.map((mem) => (
                        <a
                          key={mem.id}
                          href={mem.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-[11px] text-purple-600 hover:text-purple-800 hover:underline truncate"
                          title={`유사도: ${Math.round(mem.score * 100)}%\n${mem.summary || mem.title}`}
                        >
                          <span className="inline-block px-1.5 py-0.5 bg-purple-100 rounded text-[10px] mr-1.5">
                            {Math.round(mem.score * 100)}%
                          </span>
                          {mem.title}
                        </a>
                      ))}
                    </div>
                    <p className="text-[10px] text-purple-500 mt-2">
                      {new Date(serendipityMemories[0].createdAt).toLocaleDateString('ko-KR')}에 저장한 기억과 연관됩니다
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowSerendipityBanner(false)
                    chrome.runtime.sendMessage({ type: "SET_BADGE", count: 0 })
                  }}
                  className="p-1 hover:bg-purple-100 rounded transition-colors shrink-0"
                  title="닫기"
                >
                  <X className="w-4 h-4 text-purple-600" />
                </button>
              </div>
            </div>
          )}

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
          <ChatMessage key={idx} role={msg.role} text={msg.text} image={msg.image} />
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
      <footer
        className={clsx(
          "p-4 bg-white border-t border-slate-200 space-y-3 transition-colors",
          ENABLE_IMAGE_INPUT && isDragging && "bg-indigo-50 border-indigo-300"
        )}
        onDragOver={ENABLE_IMAGE_INPUT ? handleDragOver : undefined}
        onDragLeave={ENABLE_IMAGE_INPUT ? handleDragLeave : undefined}
        onDrop={ENABLE_IMAGE_INPUT ? handleDrop : undefined}
      >
        {/* Drag Overlay (disabled) */}
        {ENABLE_IMAGE_INPUT && isDragging && (
          <div className="absolute inset-0 bg-indigo-100/80 border-2 border-dashed border-indigo-400 rounded-lg flex items-center justify-center z-10 pointer-events-none">
            <div className="text-center">
              <ImagePlus className="w-12 h-12 text-indigo-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-indigo-700">이미지를 여기에 놓으세요</p>
            </div>
          </div>
        )}

        {/* Image Preview (disabled) */}
        {ENABLE_IMAGE_INPUT && attachedImage && (
          <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg">
            <ImagePreview
              src={attachedImage}
              onRemove={() => setAttachedImage(null)}
            />
            <span className="text-xs text-slate-500">이미지가 첨부되었습니다</span>
          </div>
        )}

        {/* Action Buttons Row */}
        <div className="flex gap-2">
          {/* YouTube Analysis Button - 유튜브 페이지에서만 표시 (현재 개선중으로 비활성화) */}
          {ENABLE_YOUTUBE_ANALYSIS && isYouTubePage ? (
            <>
              <button
                onClick={handleAnalyzeVideo}
                disabled={status !== "ready" || isAnalyzingVideo || isThinking}
                className={clsx(
                  "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                  "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100",
                  (status !== "ready" || isAnalyzingVideo || isThinking) && "opacity-50 cursor-not-allowed"
                )}
                title="YouTube 영상 자막을 분석하여 요약합니다"
              >
                {isAnalyzingVideo ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>분석 중...</span>
                  </>
                ) : (
                  <>
                    <Youtube className="w-4 h-4" />
                    <span>영상 분석</span>
                  </>
                )}
              </button>
              {/* 영상 기억하기 버튼 - 분석 후 활성화 */}
              <button
                onClick={handleRememberVideo}
                disabled={!lastVideoAnalysis || memoryStatus !== "ready" || isThinking}
                className={clsx(
                  "flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                  lastVideoAnalysis
                    ? "bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100"
                    : "bg-slate-100 text-slate-400 border border-slate-200",
                  (!lastVideoAnalysis || memoryStatus !== "ready" || isThinking) && "opacity-50 cursor-not-allowed"
                )}
                title={lastVideoAnalysis ? "분석한 영상을 기억에 저장합니다" : "먼저 영상을 분석하세요"}
              >
                <Brain className="w-4 h-4" />
                <span>기억</span>
              </button>
            </>
          ) : isPdfPage ? (
            /* PDF Analysis Button - PDF 페이지에서 표시 */
            <>
              <button
                onClick={handleAnalyzePdf}
                disabled={status !== "ready" || isAnalyzingPdf || isThinking}
                className={clsx(
                  "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                  "bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100",
                  (status !== "ready" || isAnalyzingPdf || isThinking) && "opacity-50 cursor-not-allowed"
                )}
                title="PDF 문서의 텍스트를 추출하여 분석합니다"
              >
                {isAnalyzingPdf ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>분석 중...</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    <span>PDF 분석</span>
                  </>
                )}
              </button>
              {/* PDF 기억하기 버튼 - 분석 후 활성화 */}
              <button
                onClick={handleRememberPage}
                disabled={!pdfContext || memoryStatus !== "ready" || isMemorySaving || isThinking}
                className={clsx(
                  "flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                  pdfContext
                    ? "bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100"
                    : "bg-slate-100 text-slate-400 border border-slate-200",
                  (!pdfContext || memoryStatus !== "ready" || isMemorySaving || isThinking) && "opacity-50 cursor-not-allowed"
                )}
                title={pdfContext ? "분석한 PDF를 기억에 저장합니다" : "먼저 PDF를 분석하세요"}
              >
                <Brain className="w-4 h-4" />
                <span>기억</span>
              </button>
            </>
          ) : (
            /* Page Read Button - 일반 페이지에서 표시 */
            <button
              onClick={extractPageContent}
              disabled={status !== "ready" || isLoadingPage || isThinking}
              className={clsx(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                pageContext
                  ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
                  : "bg-slate-100 text-slate-700 border border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200",
                (status !== "ready" || isLoadingPage || isThinking) && "opacity-50 cursor-not-allowed"
              )}
            >
              {isLoadingPage ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>읽는 중...</span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  <span>{pageContext ? "다시 읽기" : "페이지 읽기"}</span>
                </>
              )}
            </button>
          )}

          {/* Remember Button - 일반 페이지에서만 표시 (YouTube/PDF는 인라인 버튼 사용) */}
          {!isYouTubePage && !isPdfPage && (
            <button
              onClick={handleRememberPage}
              disabled={!pageContext || memoryStatus !== "ready" || isMemorySaving || isThinking}
              className={clsx(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                "bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100",
                (!pageContext || memoryStatus !== "ready" || isMemorySaving || isThinking) && "opacity-50 cursor-not-allowed"
              )}
              title={
                memoryStatus === "loading"
                  ? "임베딩 모델 로딩 중..."
                  : memoryStatus === "error"
                  ? "메모리 시스템 오류"
                  : !pageContext
                  ? "먼저 '페이지 읽기' 버튼을 눌러주세요"
                  : "현재 페이지를 기억에 저장"
              }
            >
              {isMemorySaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>저장 중...</span>
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4" />
                  <span>기억하기</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Context Mode Selector */}
        <div className="bg-slate-100 rounded-xl p-1.5">
          {/* 3-way Segmented Control */}
          <div className="flex gap-1">
            {/* Brain Mode */}
            <button
              onClick={() => setContextMode("brain")}
              className={clsx(
                "flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all",
                contextMode === "brain"
                  ? "bg-purple-500 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-200"
              )}
            >
              <Brain className="w-3.5 h-3.5" />
              <span>Brain</span>
              {contextMode === "brain" && memoryCount > 0 && (
                <span className="text-[9px] opacity-80">({memoryCount})</span>
              )}
            </button>

            {/* Both Mode */}
            <button
              onClick={() => setContextMode("both")}
              className={clsx(
                "flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all",
                contextMode === "both"
                  ? "bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-200"
              )}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Both</span>
            </button>

            {/* Page Mode */}
            <button
              onClick={() => setContextMode("page")}
              className={clsx(
                "flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all",
                contextMode === "page"
                  ? "bg-indigo-500 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-200"
              )}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Page</span>
              {contextMode === "page" && pageContext && (
                <CheckCircle2 className="w-3 h-3 opacity-80" />
              )}
            </button>
          </div>

          {/* Mode Description */}
          <div className="mt-1.5 px-1 flex items-center justify-between">
            <span className="text-[10px] text-slate-500">
              {contextMode === "brain" && "저장된 기억에서 검색하여 답변"}
              {contextMode === "page" && "현재 탭 내용만 읽고 답변"}
              {contextMode === "both" && "기억 + 현재 페이지 통합 답변"}
            </span>
            {memoryStatus === "loading" && (
              <Loader2 className="w-3 h-3 text-amber-500 animate-spin" />
            )}
            {memoryStatus === "error" && (
              <AlertCircle className="w-3 h-3 text-red-500" />
            )}
          </div>
        </div>

        {/* Input */}
        <div className="relative flex items-center gap-2">
          {/* Image Upload Button (disabled) */}
          {ENABLE_IMAGE_INPUT && (
            <>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={status !== "ready" || isThinking}
                className="p-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="이미지 첨부 (드래그 또는 붙여넣기도 가능)"
              >
                <ImagePlus className="w-5 h-5" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </>
          )}

          {/* Text Input */}
          <div className="relative flex-1">
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
              onPaste={ENABLE_IMAGE_INPUT ? handlePaste : undefined}
              disabled={status !== "ready" || isThinking}
            />
            <button
              onClick={handleSend}
              disabled={status !== "ready" || isThinking || !input.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-all duration-200 active:scale-95"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-slate-400 font-medium">
            Powered by Gemini Nano (On-Device)
          </p>
        </div>
      </footer>
        </>
      )}

      {/* === Memory Tab Content === */}
      {activeTab === "memory" && (
        <MemoryDashboard
          memories={memoryList}
          isLoading={isLoadingMemories}
          onDelete={handleMemoryDelete}
          onClearAll={handleMemoryClearAll}
          onRefresh={refreshMemories}
          onSearch={async (query) => {
            // 시맨틱 검색 (벡터 + 키워드 하이브리드)
            const results = await recallMemories(query, 10)
            return results.map((r) => ({
              id: r.id,
              url: r.url,
              title: r.title,
              summary: r.summary,
              tags: r.tags || [],
              createdAt: r.createdAt,
              score: r.score,
            }))
          }}
          onGetMemoriesWithEmbeddings={getMemoriesWithEmbeddings}
        />
      )}

      {/* === Translate Tab Content === */}
      {activeTab === "translate" && (
        <TranslationPanel
          onTranslate={async (prompt) => {
            const result = await generate(prompt, currentPersona.systemPrompt)
            return result
          }}
          isLoading={isThinking}
        />
      )}

      {/* === Settings Tab Content === */}
      {activeTab === "settings" && (
        <SettingsPanel
          memoryCount={memoryCount}
          onClearAll={handleMemoryClearAll}
          onMemoryCountChange={async () => {
            const memories = await listMemories()
            setMemoryList(memories)
          }}
        />
      )}

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

      {/* Memory Panel */}
      <MemoryPanel
        isOpen={showMemoryPanel}
        onClose={() => setShowMemoryPanel(false)}
        memories={memoryList}
        onDelete={handleMemoryDelete}
        onClearAll={handleMemoryClearAll}
        isLoading={memoryStatus === "loading"}
      />
    </div>
  )
}

export default IndexSidePanel
