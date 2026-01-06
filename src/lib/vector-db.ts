/**
 * Vector DB Module - Orama를 사용한 벡터 저장 및 검색
 *
 * Orama 2.0의 벡터 검색 기능을 활용하여 시맨틱 검색 지원
 * chrome.storage.local에 DB 상태 영속화
 */

import { create, insert, search, remove, save, load, type Orama } from "@orama/orama"
import { EMBEDDING_DIMENSION } from "./embedding-client"

// DB 스키마 정의
const schema = {
  id: "string",
  url: "string",
  title: "string",
  content: "string",
  summary: "string",
  tags: "string[]",  // AI 자동 태깅
  embedding: `vector[${EMBEDDING_DIMENSION}]`,
  embeddingJson: "string",  // 임베딩 백업 (save/load 시 벡터 손실 방지)
  createdAt: "number",
} as const

type MemoryDB = Orama<typeof schema>

// 싱글톤 DB 인스턴스
let db: MemoryDB | null = null
const STORAGE_KEY = "memex_vector_db"

/**
 * DB 초기화
 */
export async function initVectorDB(): Promise<MemoryDB> {
  if (db) return db

  try {
    // chrome.storage에서 기존 DB 로드 시도
    const stored = await chrome.storage.local.get(STORAGE_KEY)

    if (stored[STORAGE_KEY]) {
      console.log("📂 Loading existing vector DB from storage...")
      db = await create({ schema })
      await load(db, stored[STORAGE_KEY])
      console.log("✅ Vector DB loaded from storage")
    } else {
      console.log("🆕 Creating new vector DB...")
      db = await create({ schema })
      console.log("✅ New vector DB created")
    }

    return db
  } catch (error) {
    console.error("❌ Failed to initialize vector DB:", error)
    // 오류 시 새 DB 생성
    db = await create({ schema })
    return db
  }
}

/**
 * DB 상태를 chrome.storage에 저장
 */
async function persistDB(): Promise<void> {
  if (!db) return

  try {
    const serialized = await save(db)
    await chrome.storage.local.set({ [STORAGE_KEY]: serialized })
    console.log("💾 Vector DB persisted to storage")
  } catch (error) {
    console.error("❌ Failed to persist vector DB:", error)
  }
}

/**
 * 메모리 추가
 */
export async function addMemory(memory: {
  url: string
  title: string
  content: string
  summary: string
  tags?: string[]  // AI 자동 태깅
  embedding: number[]
}): Promise<string> {
  const database = await initVectorDB()

  const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

  await insert(database, {
    id,
    url: memory.url,
    title: memory.title,
    content: memory.content.slice(0, 10000), // 최대 10KB
    summary: memory.summary,
    tags: memory.tags || [],
    embedding: memory.embedding,
    embeddingJson: JSON.stringify(memory.embedding),  // 백업용
    createdAt: Date.now(),
  })

  await persistDB()
  console.log("📝 Memory added:", id, memory.title, "tags:", memory.tags)

  return id
}

/**
 * 시맨틱 검색 (벡터 유사도 기반)
 */
export async function searchMemories(
  queryEmbedding: number[],
  limit: number = 5,
  threshold: number = 0.5
): Promise<Array<{
  id: string
  url: string
  title: string
  content: string
  summary: string
  tags: string[]
  score: number
  createdAt: number
}>> {
  const database = await initVectorDB()

  const results = await search(database, {
    mode: "vector",
    vector: {
      value: queryEmbedding,
      property: "embedding",
    },
    similarity: threshold,
    limit,
    includeVectors: false,
  })

  return results.hits.map((hit) => ({
    id: hit.document.id,
    url: hit.document.url,
    title: hit.document.title,
    content: hit.document.content,
    summary: hit.document.summary,
    tags: hit.document.tags || [],
    score: hit.score,
    createdAt: hit.document.createdAt,
  }))
}

/**
 * 텍스트 기반 검색 (키워드) - 한글 지원 강화
 */
export async function searchByKeyword(
  query: string,
  limit: number = 5
): Promise<Array<{
  id: string
  url: string
  title: string
  content: string
  summary: string
  tags: string[]
  score: number
  createdAt: number
}>> {
  const database = await initVectorDB()
  const queryLower = query.toLowerCase()

  // 한글/특수문자 포함 검색 - 직접 필터링 방식 사용
  // (Orama의 term 검색은 한글 토큰화를 지원하지 않고, tags는 배열이라 검색 불가)
  console.log("[searchByKeyword] Searching for:", query)

  const allDocs = await search(database, {
    term: "",
    limit: 1000,
  })

  const containsResults = allDocs.hits
    .filter((hit) => {
      const title = (hit.document.title || "").toLowerCase()
      const content = (hit.document.content || "").toLowerCase()
      const summary = (hit.document.summary || "").toLowerCase()
      const tags = (hit.document.tags || []).join(" ").toLowerCase()

      return (
        title.includes(queryLower) ||
        content.includes(queryLower) ||
        summary.includes(queryLower) ||
        tags.includes(queryLower)
      )
    })
    .slice(0, limit)
    .map((hit, index) => ({
      id: hit.document.id,
      url: hit.document.url,
      title: hit.document.title,
      content: hit.document.content,
      summary: hit.document.summary,
      tags: hit.document.tags || [],
      score: 1 - index * 0.05, // 순서대로 점수 부여 (95%, 90%, ...)
      createdAt: hit.document.createdAt,
    }))

  console.log(`[searchByKeyword] Found ${containsResults.length} results`)
  return containsResults
}

/**
 * 하이브리드 검색 (벡터 + 키워드)
 */
export async function hybridSearch(
  query: string,
  queryEmbedding: number[],
  limit: number = 5
): Promise<Array<{
  id: string
  url: string
  title: string
  content: string
  summary: string
  tags: string[]
  score: number
  createdAt: number
}>> {
  // 벡터 검색과 키워드 검색 병행
  const [vectorResults, keywordResults] = await Promise.all([
    searchMemories(queryEmbedding, limit, 0.3),
    searchByKeyword(query, limit),
  ])

  // 결과 병합 및 중복 제거
  const scoreMap = new Map<string, {
    id: string
    url: string
    title: string
    content: string
    summary: string
    tags: string[]
    score: number
    createdAt: number
  }>()

  // 벡터 검색 결과 (가중치 0.7)
  for (const result of vectorResults) {
    scoreMap.set(result.id, {
      ...result,
      score: result.score * 0.7,
    })
  }

  // 키워드 검색 결과 (가중치 0.3)
  for (const result of keywordResults) {
    const existing = scoreMap.get(result.id)
    if (existing) {
      existing.score += result.score * 0.3
    } else {
      scoreMap.set(result.id, {
        ...result,
        score: result.score * 0.3,
      })
    }
  }

  // 점수순 정렬 후 상위 N개 반환
  return Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/**
 * 메모리 삭제
 */
export async function deleteMemory(id: string): Promise<boolean> {
  const database = await initVectorDB()

  try {
    await remove(database, id)
    await persistDB()
    console.log("🗑️ Memory deleted:", id)
    return true
  } catch (error) {
    console.error("❌ Failed to delete memory:", error)
    return false
  }
}

/**
 * 모든 메모리 조회
 */
export async function getAllMemories(): Promise<Array<{
  id: string
  url: string
  title: string
  summary: string
  tags: string[]
  createdAt: number
}>> {
  const database = await initVectorDB()

  // 빈 검색으로 모든 문서 조회
  const results = await search(database, {
    term: "",
    limit: 1000,
  })

  return results.hits
    .map((hit) => ({
      id: hit.document.id,
      url: hit.document.url,
      title: hit.document.title,
      summary: hit.document.summary,
      tags: hit.document.tags || [],
      createdAt: hit.document.createdAt,
    }))
    .sort((a, b) => b.createdAt - a.createdAt)
}

/**
 * 태그로 메모리 필터링
 */
export async function searchByTag(
  tag: string,
  limit: number = 100
): Promise<Array<{
  id: string
  url: string
  title: string
  summary: string
  tags: string[]
  createdAt: number
}>> {
  const database = await initVectorDB()

  const results = await search(database, {
    term: tag,
    properties: ["tags"],
    limit,
  })

  return results.hits
    .map((hit) => ({
      id: hit.document.id,
      url: hit.document.url,
      title: hit.document.title,
      summary: hit.document.summary,
      tags: hit.document.tags || [],
      createdAt: hit.document.createdAt,
    }))
    .sort((a, b) => b.createdAt - a.createdAt)
}

/**
 * 메모리 개수 조회
 */
export async function getMemoryCount(): Promise<number> {
  const database = await initVectorDB()

  const results = await search(database, {
    term: "",
    limit: 0,
  })

  return results.count
}

/**
 * URL로 중복 확인
 */
export async function isUrlStored(url: string): Promise<boolean> {
  const database = await initVectorDB()

  const results = await search(database, {
    term: url,
    properties: ["url"],
    exact: true,
    limit: 1,
  })

  return results.count > 0
}

/**
 * DB 초기화 (모든 메모리 삭제)
 */
export async function clearAllMemories(): Promise<void> {
  db = await create({ schema })
  await persistDB()
  console.log("🧹 All memories cleared")
}

// === 백업/복원 기능 ===

export interface MemoryBackupItem {
  id: string
  url: string
  title: string
  content: string
  summary: string
  tags: string[]
  embedding: number[]
  createdAt: number
}

export interface MemoryBackup {
  version: 1
  exportedAt: number
  memoryCount: number
  memories: MemoryBackupItem[]
}

/**
 * 모든 메모리를 JSON 백업 형식으로 내보내기
 */
export async function exportMemories(): Promise<MemoryBackup> {
  const database = await initVectorDB()

  // 모든 문서 조회 (임베딩 포함)
  const results = await search(database, {
    term: "",
    limit: 10000,
    includeVectors: true,
  })

  const memories: MemoryBackupItem[] = results.hits.map((hit) => ({
    id: hit.document.id,
    url: hit.document.url,
    title: hit.document.title,
    content: hit.document.content,
    summary: hit.document.summary,
    tags: hit.document.tags || [],
    embedding: hit.document.embedding as unknown as number[],
    createdAt: hit.document.createdAt,
  }))

  const backup: MemoryBackup = {
    version: 1,
    exportedAt: Date.now(),
    memoryCount: memories.length,
    memories,
  }

  console.log(`📦 Exported ${memories.length} memories`)
  return backup
}

/**
 * JSON 백업에서 메모리 복원
 * @param backup - 복원할 백업 데이터
 * @param mode - "replace" (기존 삭제 후 복원) | "merge" (기존에 추가)
 */
export async function importMemories(
  backup: MemoryBackup,
  mode: "replace" | "merge" = "merge"
): Promise<{ success: boolean; imported: number; skipped: number; message: string }> {
  try {
    // 버전 확인
    if (backup.version !== 1) {
      return {
        success: false,
        imported: 0,
        skipped: 0,
        message: `지원하지 않는 백업 버전입니다: ${backup.version}`,
      }
    }

    // 백업 데이터 검증
    if (!backup.memories || !Array.isArray(backup.memories)) {
      return {
        success: false,
        imported: 0,
        skipped: 0,
        message: "잘못된 백업 파일 형식입니다.",
      }
    }

    // replace 모드: 기존 DB 초기화
    if (mode === "replace") {
      db = await create({ schema })
      console.log("🧹 Existing memories cleared for replace mode")
    }

    const database = await initVectorDB()
    let imported = 0
    let skipped = 0

    for (const memory of backup.memories) {
      try {
        // merge 모드에서 URL 중복 체크
        if (mode === "merge") {
          const exists = await isUrlStored(memory.url)
          if (exists) {
            skipped++
            continue
          }
        }

        // 메모리 삽입
        await insert(database, {
          id: memory.id,
          url: memory.url,
          title: memory.title,
          content: memory.content,
          summary: memory.summary,
          tags: memory.tags || [],
          embedding: memory.embedding,
          embeddingJson: JSON.stringify(memory.embedding),  // 백업용
          createdAt: memory.createdAt,
        })
        imported++
      } catch (error) {
        console.error(`Failed to import memory ${memory.id}:`, error)
        skipped++
      }
    }

    await persistDB()
    console.log(`📥 Imported ${imported} memories, skipped ${skipped}`)

    return {
      success: true,
      imported,
      skipped,
      message: `${imported}개의 기억을 복원했습니다.${skipped > 0 ? ` (${skipped}개 건너뜀)` : ""}`,
    }
  } catch (error) {
    console.error("❌ Import failed:", error)
    return {
      success: false,
      imported: 0,
      skipped: 0,
      message: `복원 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`,
    }
  }
}

/**
 * 모든 메모리를 임베딩과 함께 조회 (Knowledge Graph용)
 */
export async function getAllMemoriesWithEmbeddings(): Promise<Array<{
  id: string
  url: string
  title: string
  summary: string
  tags: string[]
  embedding: number[]
  createdAt: number
}>> {
  const database = await initVectorDB()

  const results = await search(database, {
    term: "",
    limit: 10000,
    includeVectors: true,
  })

  // 디버깅
  if (results.hits.length > 0) {
    const firstHit = results.hits[0] as any
    const hasEmbeddingJson = !!firstHit.document.embeddingJson
    console.log("[getAllMemoriesWithEmbeddings] embeddingJson exists:", hasEmbeddingJson)
    if (hasEmbeddingJson) {
      console.log("[getAllMemoriesWithEmbeddings] embeddingJson length:", firstHit.document.embeddingJson.length)
    }
  }

  return results.hits
    .map((hit: any) => {
      // embeddingJson 필드에서 복원 (save/load 시 벡터 손실 방지)
      let embedding: number[] = []

      if (hit.document.embeddingJson) {
        try {
          embedding = JSON.parse(hit.document.embeddingJson)
        } catch (e) {
          console.error("[getAllMemoriesWithEmbeddings] Failed to parse embeddingJson:", e)
        }
      }

      return {
        id: hit.document.id,
        url: hit.document.url,
        title: hit.document.title,
        summary: hit.document.summary,
        tags: hit.document.tags || [],
        embedding,
        createdAt: hit.document.createdAt,
      }
    })
    .sort((a, b) => b.createdAt - a.createdAt)
}

/**
 * 백업 파일 다운로드 헬퍼
 */
export function downloadBackup(backup: MemoryBackup): void {
  const json = JSON.stringify(backup, null, 2)
  const blob = new Blob([json], { type: "application/json" })
  const url = URL.createObjectURL(blob)

  const date = new Date().toISOString().split("T")[0]
  const filename = `memex-backup-${date}.json`

  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  console.log(`💾 Downloaded backup: ${filename}`)
}
