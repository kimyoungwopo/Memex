/**
 * Embedding Client - Sandbox iframe을 통한 Transformers.js 사용
 *
 * Chrome Extension 환경에서 ONNX Runtime 호환성 문제를 피하기 위해
 * sandbox iframe에서 임베딩을 생성하고 postMessage로 통신합니다.
 *
 * 보안 고려사항:
 * - sandbox iframe의 origin은 "null"이므로 targetOrigin 지정이 제한적
 * - event.source 검증으로 메시지 출처 확인
 * - 메시지 타입 화이트리스트로 유효성 검증
 */

import { EMBEDDING_REQUEST_TIMEOUT } from "../constants"

export const EMBEDDING_DIMENSION = 384
export type EmbeddingStatus = "idle" | "loading" | "ready" | "error"

// 허용된 메시지 타입 (화이트리스트)
const VALID_MESSAGE_TYPES = [
  "SANDBOX_READY",
  "EMBEDDING_PROGRESS",
  "INIT_EMBEDDING",
  "GET_STATUS",
  "GENERATE_EMBEDDING",
  "GENERATE_DOCUMENT_EMBEDDING",
] as const

// Sandbox iframe 인스턴스
let sandboxFrame: HTMLIFrameElement | null = null
let sandboxReady = false
let pendingRequests = new Map<string, { resolve: Function; reject: Function; timeoutId: ReturnType<typeof setTimeout> }>()
let statusCache: { status: EmbeddingStatus; error?: string } = { status: "idle" }

// 진행률 콜백
let progressCallback: ((progress: number) => void) | null = null

// 메시지 핸들러 참조 (cleanup용)
let messageHandler: ((event: MessageEvent) => void) | null = null

/**
 * 고유 ID 생성
 */
function generateId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/**
 * 메시지 타입이 유효한지 검증
 */
function isValidMessageType(type: unknown): boolean {
  return typeof type === "string" && VALID_MESSAGE_TYPES.includes(type as any)
}

/**
 * Sandbox iframe 생성 및 초기화
 */
function createSandbox(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (sandboxFrame && sandboxReady) {
      resolve()
      return
    }

    // 기존 iframe 및 핸들러 정리
    if (sandboxFrame) {
      sandboxFrame.remove()
    }
    if (messageHandler) {
      window.removeEventListener("message", messageHandler)
    }

    console.log("[EmbeddingClient] Creating sandbox iframe...")

    sandboxFrame = document.createElement("iframe")
    sandboxFrame.src = chrome.runtime.getURL("assets/sandbox.html")
    sandboxFrame.style.display = "none"
    sandboxFrame.sandbox.add("allow-scripts")

    const timeout = setTimeout(() => {
      reject(new Error("샌드박스 초기화 시간 초과"))
    }, EMBEDDING_REQUEST_TIMEOUT)

    // 메시지 핸들러 (보안 강화)
    messageHandler = (event: MessageEvent) => {
      // 1. source 검증: sandbox iframe에서 온 메시지만 처리
      if (event.source !== sandboxFrame?.contentWindow) return

      // 2. origin 검증: sandbox는 "null" origin을 가짐
      if (event.origin !== "null") {
        console.warn("[EmbeddingClient] Unexpected origin:", event.origin)
        return
      }

      const data = event.data
      if (!data || typeof data !== "object") return

      // 3. 메시지 타입 검증 (응답 메시지는 id가 있음)
      if (!data.id && !isValidMessageType(data.type)) {
        console.warn("[EmbeddingClient] Invalid message type:", data.type)
        return
      }

      // Sandbox 준비 완료
      if (data.type === "SANDBOX_READY") {
        console.log("[EmbeddingClient] Sandbox ready")
        sandboxReady = true
        clearTimeout(timeout)
        resolve()
        return
      }

      // 진행률 업데이트
      if (data.type === "EMBEDDING_PROGRESS") {
        if (progressCallback && typeof data.progress === "number") {
          progressCallback(data.progress)
        }
        return
      }

      // 요청 응답 처리
      if (data.id && pendingRequests.has(data.id)) {
        const request = pendingRequests.get(data.id)!
        clearTimeout(request.timeoutId)  // 타임아웃 정리
        pendingRequests.delete(data.id)

        if (data.success) {
          request.resolve(data)
        } else {
          request.reject(new Error(data.error || "Unknown error"))
        }
      }
    }

    window.addEventListener("message", messageHandler)
    document.body.appendChild(sandboxFrame)
  })
}

/**
 * Sandbox에 메시지 전송
 * 보안: sandbox iframe은 origin이 "null"이므로 targetOrigin을 "*"로 설정해야 함
 * 대신 수신 측에서 source/origin 검증으로 보안 확보
 */
async function sendToSandbox<T>(message: any): Promise<T> {
  if (!sandboxFrame || !sandboxReady) {
    await createSandbox()
  }

  const id = generateId()
  const messageWithId = { ...message, id }

  return new Promise((resolve, reject) => {
    // 타임아웃 설정 (참조 저장으로 cleanup 가능)
    const timeoutId = setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id)
        reject(new Error("요청 시간 초과"))
      }
    }, 60000)

    pendingRequests.set(id, { resolve, reject, timeoutId })

    // sandbox iframe의 origin은 "null"이므로 targetOrigin 지정 불가
    // 보안은 messageHandler에서 source/origin 검증으로 확보
    sandboxFrame!.contentWindow!.postMessage(messageWithId, "*")
  })
}

/**
 * 진행률 콜백 설정
 */
export function setProgressCallback(callback: ((progress: number) => void) | null) {
  progressCallback = callback
}

/**
 * 임베딩 초기화
 */
export async function initEmbeddings(): Promise<boolean> {
  try {
    console.log("[EmbeddingClient] Initializing via sandbox...")
    statusCache = { status: "loading" }

    await createSandbox()
    const response = await sendToSandbox<{ success: boolean; status: EmbeddingStatus; error?: string }>({
      type: "INIT_EMBEDDING",
    })

    statusCache = { status: response.status, error: response.error }
    console.log("[EmbeddingClient] Initialization result:", response.status)

    return response.status === "ready"
  } catch (error) {
    console.error("[EmbeddingClient] Failed to initialize:", error)
    statusCache = { status: "error", error: String(error) }
    return false
  }
}

/**
 * 임베딩 상태 조회
 */
export async function getEmbeddingStatus(): Promise<{
  status: EmbeddingStatus
  error?: string
}> {
  if (!sandboxReady) {
    return statusCache
  }

  try {
    const response = await sendToSandbox<{ status: EmbeddingStatus; error?: string }>({
      type: "GET_STATUS",
    })
    statusCache = response
    return response
  } catch {
    return statusCache
  }
}

/**
 * 텍스트 임베딩 생성 (쿼리용 - 짧은 텍스트)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await sendToSandbox<{ embedding: number[] }>({
    type: "GENERATE_EMBEDDING",
    text,
  })
  return response.embedding
}

/**
 * 문서 임베딩 생성 (긴 텍스트 - 청킹 + 평균)
 */
export async function generateDocumentEmbedding(content: string): Promise<number[]> {
  console.log("[EmbeddingClient] Generating document embedding via sandbox...")

  const response = await sendToSandbox<{ embedding: number[] }>({
    type: "GENERATE_DOCUMENT_EMBEDDING",
    content,
  })

  console.log("[EmbeddingClient] Document embedding generated")
  return response.embedding
}

/**
 * 정리 - 모든 리소스 해제
 */
export function cleanup() {
  progressCallback = null

  // 모든 pending 요청의 타임아웃 정리
  for (const [id, request] of pendingRequests) {
    clearTimeout(request.timeoutId)
    request.reject(new Error("요청이 취소되었습니다"))
  }
  pendingRequests.clear()

  // 메시지 핸들러 제거
  if (messageHandler) {
    window.removeEventListener("message", messageHandler)
    messageHandler = null
  }

  // iframe 제거
  if (sandboxFrame) {
    sandboxFrame.remove()
    sandboxFrame = null
    sandboxReady = false
  }
}
