import { useEffect, useState, useCallback, useRef } from "react"

// Chrome Built-in AI 최신 타입 정의 (2026 Prompt API Spec)
// https://github.com/webmachinelearning/prompt-api

type LanguageModelAvailability = "available" | "downloadable" | "downloading" | "unavailable"

interface LanguageModelParams {
  defaultTemperature: number
  maxTemperature: number
  defaultTopK: number
  maxTopK: number
}

interface LanguageModelPrompt {
  role: "system" | "user" | "assistant"
  content: string | LanguageModelContent[]
}

interface LanguageModelContent {
  type: "text" | "image" | "audio"
  value: string | Blob | ImageData | ImageBitmap | AudioBuffer | BufferSource
}

interface LanguageModelExpectedIO {
  type?: "text" | "image" | "audio"
  languages?: string[]
}

interface LanguageModelCreateOptions {
  initialPrompts?: LanguageModelPrompt[]
  temperature?: number
  topK?: number
  expectedInputs?: LanguageModelExpectedIO[]
  expectedOutputs?: LanguageModelExpectedIO[]
  signal?: AbortSignal
  monitor?: (monitor: LanguageModelDownloadMonitor) => void
}

interface LanguageModelDownloadMonitor extends EventTarget {
  addEventListener(
    type: "downloadprogress",
    listener: (event: LanguageModelDownloadProgressEvent) => void
  ): void
}

interface LanguageModelDownloadProgressEvent extends Event {
  loaded: number
}

interface LanguageModelPromptOptions {
  signal?: AbortSignal
  responseConstraint?: object | RegExp
}

interface LanguageModelSession {
  prompt: (input: string | LanguageModelPrompt[], options?: LanguageModelPromptOptions) => Promise<string>
  promptStreaming: (input: string | LanguageModelPrompt[], options?: LanguageModelPromptOptions) => ReadableStream<string>
  append: (prompts: LanguageModelPrompt[]) => Promise<void>
  measureInputUsage: (input: string | LanguageModelPrompt[]) => Promise<number>
  clone: (options?: { signal?: AbortSignal }) => Promise<LanguageModelSession>
  destroy: () => void
  readonly inputUsage: number
  readonly inputQuota: number
  addEventListener(type: "quotaoverflow", listener: () => void): void
}

interface LanguageModelAPI {
  availability: (options?: {
    expectedInputs?: LanguageModelExpectedIO[]
    expectedOutputs?: LanguageModelExpectedIO[]
  }) => Promise<LanguageModelAvailability>
  params: () => Promise<LanguageModelParams | null>
  create: (options?: LanguageModelCreateOptions) => Promise<LanguageModelSession>
}

export type AIStatus = "loading" | "ready" | "downloading" | "error" | "unsupported"

// AI API 찾기 (여러 경로 시도)
const getLanguageModel = (): LanguageModelAPI | null => {
  // 1. 전역 LanguageModel 객체 확인 (최신 스펙)
  // @ts-ignore
  if (typeof LanguageModel !== "undefined") {
    // @ts-ignore
    return LanguageModel as LanguageModelAPI
  }
  // 2. window.ai.languageModel 확인 (레거시 호환)
  // @ts-ignore
  if (typeof window !== "undefined" && window.ai?.languageModel) {
    // @ts-ignore
    return window.ai.languageModel as LanguageModelAPI
  }
  // 3. self.ai.languageModel 확인
  // @ts-ignore
  if (typeof self !== "undefined" && self.ai?.languageModel) {
    // @ts-ignore
    return self.ai.languageModel as LanguageModelAPI
  }
  return null
}

export const useGemini = () => {
  const [status, setStatus] = useState<AIStatus>("loading")
  const [downloadProgress, setDownloadProgress] = useState<number>(0)
  const sessionRef = useRef<LanguageModelSession | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const initModel = async () => {
      try {
        abortControllerRef.current = new AbortController()

        // 1. API 존재 여부 확인
        const languageModel = getLanguageModel()

        console.log("🔍 Checking AI API...")

        if (!languageModel) {
          console.error("❌ Chrome AI API not found. Please check:")
          console.error("1. Use Chrome Canary or Dev (version 131+)")
          console.error("2. Enable chrome://flags/#optimization-guide-on-device-model")
          console.error("3. Enable chrome://flags/#prompt-api-for-gemini-nano")
          setStatus("error")
          return
        }

        console.log("✅ AI API found")

        // 2. 모델 가용성 확인 (최신 API: availability())
        const availability = await languageModel.availability()
        console.log("📊 Model Availability:", availability)

        if (availability === "unavailable") {
          console.error("❌ Model not available on this device")
          setStatus("unsupported")
          return
        }

        if (availability === "downloadable" || availability === "downloading") {
          setStatus("downloading")
        }

        // 3. 모델 파라미터 확인 (선택사항)
        const params = await languageModel.params()
        if (params) {
          console.log("📊 Model Params:", params)
        }

        console.log("🚀 Creating AI session...")

        // 4. 세션 생성 (최신 API 스펙)
        const newSession = await languageModel.create({
          // initialPrompts로 시스템 프롬프트 설정
          initialPrompts: [
            {
              role: "system",
              content:
                "당신은 'Memex'라는 이름의 유능한 로컬 AI 비서입니다. " +
                "사용자의 질문에 대해 항상 한국어로 답변하세요. " +
                "답변은 명확하고 친절해야 하며, 마크다운 형식을 사용할 수 있습니다."
            }
          ],
          // AbortSignal 전달
          signal: abortControllerRef.current.signal,
          // 다운로드 진행상황 모니터링
          monitor: (monitor) => {
            monitor.addEventListener("downloadprogress", (event) => {
              const progress = Math.round(event.loaded * 100)
              console.log(`📥 Download progress: ${progress}%`)
              setDownloadProgress(progress)
            })
          }
        })

        sessionRef.current = newSession
        setStatus("ready")

        // 세션 정보 로깅
        console.log(`✅ Session ready. Usage: ${newSession.inputUsage}/${newSession.inputQuota} tokens`)

        // Quota overflow 이벤트 리스너
        newSession.addEventListener("quotaoverflow", () => {
          console.warn("⚠️ Context window exceeded; old messages may be removed")
        })

      } catch (e) {
        console.error("AI Initialization Failed:", e)
        setStatus("error")
      }
    }

    initModel()

    // Cleanup: 컴포넌트 언마운트 시 세션 정리
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (sessionRef.current) {
        try {
          sessionRef.current.destroy()
        } catch (e) {
          // ignore error
        }
      }
    }
  }, [])

  // 답변 생성 함수
  const generate = useCallback(
    async (input: string, options?: { signal?: AbortSignal }) => {
      if (!sessionRef.current || status !== "ready") {
        throw new Error("AI 모델이 준비되지 않았습니다.")
      }
      try {
        const response = await sessionRef.current.prompt(input, {
          signal: options?.signal
        })
        return response
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
          return "요청이 취소되었습니다."
        }
        console.error("Generation Error:", e)
        return "죄송합니다. 오류가 발생했습니다."
      }
    },
    [status]
  )

  // 스트리밍 답변 생성 함수
  const generateStream = useCallback(
    (input: string, options?: { signal?: AbortSignal }) => {
      if (!sessionRef.current || status !== "ready") {
        throw new Error("AI 모델이 준비되지 않았습니다.")
      }
      return sessionRef.current.promptStreaming(input, {
        signal: options?.signal
      })
    },
    [status]
  )

  // 토큰 사용량 측정
  const measureTokens = useCallback(
    async (input: string) => {
      if (!sessionRef.current) return 0
      return await sessionRef.current.measureInputUsage(input)
    },
    []
  )

  // 현재 세션 정보
  const getSessionInfo = useCallback(() => {
    if (!sessionRef.current) return null
    return {
      inputUsage: sessionRef.current.inputUsage,
      inputQuota: sessionRef.current.inputQuota
    }
  }, [])

  return {
    status,
    downloadProgress,
    generate,
    generateStream,
    measureTokens,
    getSessionInfo
  }
}
