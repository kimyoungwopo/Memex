/**
 * Embeddings Module - Transformers.js를 사용한 텍스트 임베딩
 *
 * 모델: Xenova/all-MiniLM-L6-v2 (384차원, 빠르고 가벼움)
 * 용도: 텍스트를 벡터로 변환하여 시맨틱 검색 지원
 */

import { pipeline, env, type FeatureExtractionPipeline } from "@xenova/transformers"

// Chrome Extension 환경 설정 (ONNX Runtime 호환)
env.allowLocalModels = false
env.useBrowserCache = true
// WASM 백엔드만 사용 (WebGPU/WebGL 비활성화)
env.backends = {
  onnx: {
    wasm: {
      numThreads: 1,
    },
  },
}
// CDN에서 WASM 파일 로드
env.allowRemoteModels = true

// 싱글톤 파이프라인 인스턴스
let embeddingPipeline: FeatureExtractionPipeline | null = null
let isLoading = false
let loadPromise: Promise<FeatureExtractionPipeline> | null = null

// 모델 설정
const MODEL_NAME = "Xenova/all-MiniLM-L6-v2"
export const EMBEDDING_DIMENSION = 384

// 텍스트 청킹 설정
const CHUNK_SIZE = 500 // 청크당 최대 문자 수
const CHUNK_OVERLAP = 50 // 청크 간 오버랩

export type EmbeddingStatus = "idle" | "loading" | "ready" | "error"

/**
 * 임베딩 파이프라인 초기화
 */
export async function initEmbeddings(): Promise<FeatureExtractionPipeline> {
  // 이미 로드된 경우
  if (embeddingPipeline) {
    return embeddingPipeline
  }

  // 로딩 중인 경우 기존 Promise 반환
  if (isLoading && loadPromise) {
    return loadPromise
  }

  isLoading = true
  console.log("🧠 Loading embedding model:", MODEL_NAME)

  loadPromise = pipeline("feature-extraction", MODEL_NAME, {
    // @ts-ignore - Chrome Extension 환경 최적화
    progress_callback: (progress: { status: string; progress?: number }) => {
      if (progress.status === "progress" && progress.progress) {
        console.log(`📥 Model loading: ${Math.round(progress.progress)}%`)
      }
    },
  }).then((pipe) => {
    embeddingPipeline = pipe as FeatureExtractionPipeline
    isLoading = false
    console.log("✅ Embedding model loaded successfully")
    return embeddingPipeline
  }).catch((error) => {
    isLoading = false
    console.error("❌ Failed to load embedding model:", error)
    throw error
  })

  return loadPromise
}

/**
 * 텍스트를 벡터로 변환
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const pipe = await initEmbeddings()

  // 텍스트 정규화
  const normalizedText = text
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 512) // 모델 최대 토큰 수 고려

  const output = await pipe(normalizedText, {
    pooling: "mean",
    normalize: true,
  })

  // Float32Array를 일반 배열로 변환
  return Array.from(output.data as Float32Array)
}

/**
 * 긴 텍스트를 청크로 분할
 */
export function chunkText(text: string): string[] {
  const chunks: string[] = []
  const sentences = text.split(/(?<=[.!?。])\s+/)

  let currentChunk = ""

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length <= CHUNK_SIZE) {
      currentChunk += (currentChunk ? " " : "") + sentence
    } else {
      if (currentChunk) {
        chunks.push(currentChunk)
      }
      // 오버랩 적용
      const words = currentChunk.split(" ")
      const overlapWords = words.slice(-Math.ceil(CHUNK_OVERLAP / 5))
      currentChunk = overlapWords.join(" ") + " " + sentence
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }

  // 청크가 없으면 원본 텍스트 사용
  if (chunks.length === 0 && text.trim()) {
    chunks.push(text.slice(0, CHUNK_SIZE))
  }

  return chunks
}

/**
 * 여러 텍스트 청크의 임베딩 생성
 */
export async function generateChunkEmbeddings(
  chunks: string[]
): Promise<number[][]> {
  const embeddings: number[][] = []

  for (const chunk of chunks) {
    const embedding = await generateEmbedding(chunk)
    embeddings.push(embedding)
  }

  return embeddings
}

/**
 * 여러 임베딩의 평균 계산 (문서 전체 임베딩)
 */
export function averageEmbeddings(embeddings: number[][]): number[] {
  if (embeddings.length === 0) {
    return new Array(EMBEDDING_DIMENSION).fill(0)
  }

  if (embeddings.length === 1) {
    return embeddings[0]
  }

  const avgEmbedding = new Array(EMBEDDING_DIMENSION).fill(0)

  for (const emb of embeddings) {
    for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
      avgEmbedding[i] += emb[i]
    }
  }

  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    avgEmbedding[i] /= embeddings.length
  }

  // 정규화
  const norm = Math.sqrt(avgEmbedding.reduce((sum, val) => sum + val * val, 0))
  if (norm > 0) {
    for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
      avgEmbedding[i] /= norm
    }
  }

  return avgEmbedding
}

/**
 * 두 임베딩 간 코사인 유사도 계산
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  normA = Math.sqrt(normA)
  normB = Math.sqrt(normB)

  if (normA === 0 || normB === 0) return 0

  return dotProduct / (normA * normB)
}

/**
 * 임베딩 상태 확인
 */
export function getEmbeddingStatus(): EmbeddingStatus {
  if (embeddingPipeline) return "ready"
  if (isLoading) return "loading"
  return "idle"
}
