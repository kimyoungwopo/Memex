/**
 * Embedding Client - Sandbox iframe을 통한 Transformers.js 사용
 *
 * Chrome Extension 환경에서 ONNX Runtime 호환성 문제를 피하기 위해
 * sandbox iframe에서 임베딩을 생성하고 postMessage로 통신합니다.
 */

export const EMBEDDING_DIMENSION = 384
export type EmbeddingStatus = "idle" | "loading" | "ready" | "error"

// Sandbox iframe 인스턴스
let sandboxFrame: HTMLIFrameElement | null = null
let sandboxReady = false
let pendingRequests = new Map<string, { resolve: Function; reject: Function }>()
let statusCache: { status: EmbeddingStatus; error?: string } = { status: "idle" }

// 진행률 콜백
let progressCallback: ((progress: number) => void) | null = null

/**
 * 고유 ID 생성
 */
function generateId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
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

    // 기존 iframe 제거
    if (sandboxFrame) {
      sandboxFrame.remove()
    }

    console.log("[EmbeddingClient] Creating sandbox iframe...")

    sandboxFrame = document.createElement("iframe")
    sandboxFrame.src = chrome.runtime.getURL("assets/sandbox.html")
    sandboxFrame.style.display = "none"
    sandboxFrame.sandbox.add("allow-scripts")

    const timeout = setTimeout(() => {
      reject(new Error("Sandbox initialization timeout"))
    }, 30000)

    // 메시지 핸들러
    const messageHandler = (event: MessageEvent) => {
      // sandbox에서 온 메시지만 처리
      if (event.source !== sandboxFrame?.contentWindow) return

      const data = event.data
      if (!data) return

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
        if (progressCallback) {
          progressCallback(data.progress)
        }
        return
      }

      // 요청 응답 처리
      if (data.id && pendingRequests.has(data.id)) {
        const { resolve, reject } = pendingRequests.get(data.id)!
        pendingRequests.delete(data.id)

        if (data.success) {
          resolve(data)
        } else {
          reject(new Error(data.error || "Unknown error"))
        }
      }
    }

    window.addEventListener("message", messageHandler)
    document.body.appendChild(sandboxFrame)
  })
}

/**
 * Sandbox에 메시지 전송
 */
async function sendToSandbox<T>(message: any): Promise<T> {
  if (!sandboxFrame || !sandboxReady) {
    await createSandbox()
  }

  const id = generateId()
  const messageWithId = { ...message, id }

  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject })

    // 타임아웃 설정
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id)
        reject(new Error("Request timeout"))
      }
    }, 60000)

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
 * 정리
 */
export function cleanup() {
  progressCallback = null
  pendingRequests.clear()

  if (sandboxFrame) {
    sandboxFrame.remove()
    sandboxFrame = null
    sandboxReady = false
  }
}
