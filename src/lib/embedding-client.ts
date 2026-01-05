/**
 * Embedding Client - Transformers.js 직접 사용
 *
 * Vite 환경에서는 wasm-unsafe-eval CSP와 함께
 * Transformers.js가 정상 작동합니다.
 */

import {
  initEmbeddings as initTransformers,
  generateEmbedding as generateTransformersEmbedding,
  getEmbeddingStatus as getTransformersStatus,
  chunkText,
  averageEmbeddings,
  EMBEDDING_DIMENSION,
  type EmbeddingStatus,
} from "./embeddings"

export { EMBEDDING_DIMENSION }
export type { EmbeddingStatus }

// 진행률 콜백 (로딩 UI 용)
let progressCallback: ((progress: number) => void) | null = null

export function setProgressCallback(callback: ((progress: number) => void) | null) {
  progressCallback = callback
}

/**
 * 임베딩 초기화
 */
export async function initEmbeddings(): Promise<boolean> {
  try {
    console.log("[EmbeddingClient] Initializing Transformers.js...")
    await initTransformers()
    console.log("[EmbeddingClient] Transformers.js initialized")
    return true
  } catch (error) {
    console.error("[EmbeddingClient] Failed to initialize:", error)
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
  const status = getTransformersStatus()
  return { status }
}

/**
 * 텍스트 임베딩 생성 (쿼리용 - 짧은 텍스트)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    return await generateTransformersEmbedding(text)
  } catch (error) {
    console.error("[EmbeddingClient] Embedding generation failed:", error)
    throw error
  }
}

/**
 * 문서 임베딩 생성 (긴 텍스트 - 청킹 + 평균)
 */
export async function generateDocumentEmbedding(content: string): Promise<number[]> {
  try {
    console.log("[EmbeddingClient] Generating document embedding...")

    // 텍스트 청킹
    const chunks = chunkText(content)
    console.log(`[EmbeddingClient] Split into ${chunks.length} chunks`)

    // 각 청크 임베딩 생성
    const embeddings: number[][] = []
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await generateTransformersEmbedding(chunks[i])
      embeddings.push(embedding)

      // 진행률 콜백
      if (progressCallback) {
        progressCallback(((i + 1) / chunks.length) * 100)
      }
    }

    // 평균 임베딩 계산
    const avgEmbedding = averageEmbeddings(embeddings)
    console.log("[EmbeddingClient] Document embedding generated")

    return avgEmbedding
  } catch (error) {
    console.error("[EmbeddingClient] Document embedding failed:", error)
    throw error
  }
}

/**
 * 정리
 */
export function cleanup() {
  progressCallback = null
}
