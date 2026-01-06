import { useEffect, useState, useCallback, useRef } from "react"

// Chrome Built-in AI 타입은 src/global.d.ts에서 전역 선언됨
// https://github.com/webmachinelearning/prompt-api

export type AIStatus = "loading" | "ready" | "downloading" | "error" | "unsupported"

/**
 * AI API 찾기 (여러 경로 시도)
 * 타입은 global.d.ts에서 전역 선언되어 @ts-ignore 불필요
 */
const getLanguageModel = (): LanguageModelAPI | null => {
  // 1. 전역 LanguageModel 객체 확인 (최신 스펙)
  if (typeof LanguageModel !== "undefined") {
    return LanguageModel
  }
  // 2. window.ai.languageModel 확인 (레거시 호환)
  if (typeof window !== "undefined" && window.ai?.languageModel) {
    return window.ai.languageModel
  }
  // 3. self.ai.languageModel 확인 (Service Worker 환경)
  if (typeof self !== "undefined" && self.ai?.languageModel) {
    return self.ai.languageModel
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

        // 4. 세션 생성 (최신 API 스펙 - 2026) + 30초 타임아웃
        const createSessionPromise = languageModel.create({
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
          // 출력 언어 설정 (Chrome AI Safety Check 필수)
          // 지원 언어: en, es, ja (ko 미지원 - systemPrompt로 한국어 응답 유도)
          expectedOutputs: [
            { type: "text", languages: ["en"] }
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

        // 타임아웃 (30초) - 모델 다운로드 중이 아닐 때만 적용
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error("AI 세션 생성 시간 초과 (30초). Chrome을 재시작해주세요."))
          }, 30000)
        })

        const newSession = await Promise.race([createSessionPromise, timeoutPromise])

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

  // 스트리밍 답변 생성 함수 (멀티모달 지원)
  const generateStream = useCallback(
    (input: string, options?: { signal?: AbortSignal; image?: string }) => {
      if (!sessionRef.current || status !== "ready") {
        throw new Error("AI 모델이 준비되지 않았습니다.")
      }

      // 이미지가 있는 경우 멀티모달 프롬프트 구성
      if (options?.image) {
        // Base64 데이터 URL에서 Blob 생성
        const base64Data = options.image.split(",")[1]
        const mimeType = options.image.split(";")[0].split(":")[1]
        const byteCharacters = atob(base64Data)
        const byteNumbers = new Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        const byteArray = new Uint8Array(byteNumbers)
        const imageBlob = new Blob([byteArray], { type: mimeType })

        // 멀티모달 콘텐츠 배열
        const content: LanguageModelContent[] = [
          { type: "image", value: imageBlob },
          { type: "text", value: input }
        ]

        return sessionRef.current.promptStreaming(
          [{ role: "user", content }] as LanguageModelPrompt[],
          { signal: options?.signal }
        )
      }

      // 텍스트만 있는 경우
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
