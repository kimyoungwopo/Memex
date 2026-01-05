/**
 * Memory Hook - RAG 파이프라인 (Offscreen Document 통합)
 *
 * Transformers.js 임베딩을 Offscreen Document에서 실행하여
 * Chrome Extension CSP 제한을 우회합니다.
 */

import { useState, useEffect, useCallback } from "react"
import {
  getEmbeddingStatus,
  initEmbeddings,
  generateDocumentEmbedding,
} from "../lib/embedding-client"
import {
  addMemory,
  hybridSearch,
  getAllMemories,
  deleteMemory,
  clearAllMemories,
  getMemoryCount,
  isUrlStored,
} from "../lib/vector-db"

export type MemoryStatus = "idle" | "loading" | "ready" | "error"

export interface MemorySearchResult {
  id: string
  url: string
  title: string
  content: string
  summary: string
  tags: string[]
  score: number
  createdAt: number
}

export interface MemoryItem {
  id: string
  url: string
  title: string
  summary: string
  tags: string[]
  createdAt: number
}

export function useMemory() {
  const [status, setStatus] = useState<MemoryStatus>("idle")
  const [memoryCount, setMemoryCount] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 초기화: Offscreen에서 임베딩 상태 확인
  useEffect(() => {
    let mounted = true
    let retryCount = 0
    const maxRetries = 5

    const checkStatus = async () => {
      try {
        const { status: embStatus, error: embError } = await getEmbeddingStatus()

        if (!mounted) return

        if (embStatus === "ready") {
          setStatus("ready")
          // 메모리 개수 로드
          const count = await getMemoryCount()
          setMemoryCount(count)
          return true
        } else if (embStatus === "loading") {
          setStatus("loading")
          return false
        } else if (embStatus === "idle") {
          // 초기화 시도
          setStatus("loading")
          await initEmbeddings()
          return false
        } else if (embStatus === "error") {
          console.error("[useMemory] Embedding error:", embError)
          setError(embError || "Unknown embedding error")
          setStatus("error")
          return true
        }
      } catch (err) {
        console.error("[useMemory] Status check failed:", err)
        // Offscreen이 아직 준비되지 않았을 수 있음 - 재시도
        if (retryCount < maxRetries && mounted) {
          retryCount++
          return false
        }
        setError(err instanceof Error ? err.message : "Unknown error")
        setStatus("error")
        return true
      }
      return false
    }

    const pollStatus = async () => {
      const done = await checkStatus()
      if (!done && mounted) {
        // 1초 후 재시도
        setTimeout(pollStatus, 1000)
      }
    }

    // 초기 상태 확인 (약간의 딜레이 후 - Offscreen 로딩 대기)
    setTimeout(pollStatus, 500)

    return () => {
      mounted = false
    }
  }, [])

  // 페이지 기억하기
  const rememberPage = useCallback(
    async (page: {
      url: string
      title: string
      content: string
      summary?: string // AI 요약 (선택적)
      tags?: string[]  // AI 태그 (선택적)
    }): Promise<{ success: boolean; message: string }> => {
      if (status !== "ready") {
        return { success: false, message: "메모리 시스템이 준비되지 않았습니다." }
      }

      setIsSaving(true)
      setError(null)

      try {
        // 중복 확인
        const exists = await isUrlStored(page.url)
        if (exists) {
          setIsSaving(false)
          return { success: false, message: "이미 저장된 페이지입니다." }
        }

        console.log("[useMemory] Generating document embedding...")

        // 문서 임베딩 생성 (Offscreen에서 처리)
        const embedding = await generateDocumentEmbedding(page.content)

        // 요약 사용 (AI 요약이 있으면 사용, 없으면 첫 200자)
        const summary = page.summary || page.content.slice(0, 200).replace(/\s+/g, " ").trim() + "..."

        // 메모리에 저장
        await addMemory({
          url: page.url,
          title: page.title,
          content: page.content,
          summary,
          tags: page.tags,
          embedding,
        })

        // 카운트 업데이트
        const count = await getMemoryCount()
        setMemoryCount(count)

        setIsSaving(false)
        return { success: true, message: `"${page.title}" 페이지를 기억했습니다!` }
      } catch (err) {
        console.error("[useMemory] Remember failed:", err)
        setError(err instanceof Error ? err.message : "Unknown error")
        setIsSaving(false)
        return {
          success: false,
          message: `저장 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`,
        }
      }
    },
    [status]
  )

  // 기억 회상 (하이브리드 검색 - 벡터 + 키워드)
  const recallMemories = useCallback(
    async (query: string, limit: number = 5): Promise<MemorySearchResult[]> => {
      setIsSearching(true)

      try {
        console.log("[useMemory] Searching memories for:", query, "status:", status)

        // 임베딩이 준비되지 않았으면 키워드 검색만 수행
        if (status !== "ready") {
          console.log("[useMemory] Embedding not ready, falling back to keyword search")
          const { searchByKeyword } = await import("../lib/vector-db")
          const results = await searchByKeyword(query, limit)
          setIsSearching(false)
          return results
        }

        // 쿼리 임베딩 생성
        const { generateEmbedding } = await import("../lib/embedding-client")
        const queryEmbedding = await generateEmbedding(query)

        // 하이브리드 검색 (벡터 70% + 키워드 30%)
        const results = await hybridSearch(query, queryEmbedding, limit)

        setIsSearching(false)
        return results
      } catch (err) {
        console.error("[useMemory] Recall failed:", err)
        // 벡터 검색 실패 시 키워드 검색으로 폴백
        try {
          console.log("[useMemory] Falling back to keyword search due to error")
          const { searchByKeyword } = await import("../lib/vector-db")
          const results = await searchByKeyword(query, limit)
          setIsSearching(false)
          return results
        } catch (keywordErr) {
          console.error("[useMemory] Keyword search also failed:", keywordErr)
          setIsSearching(false)
          return []
        }
      }
    },
    [status]
  )

  // 모든 메모리 목록
  const listMemories = useCallback(async (): Promise<MemoryItem[]> => {
    try {
      return await getAllMemories()
    } catch (err) {
      console.error("[useMemory] List memories failed:", err)
      return []
    }
  }, [])

  // 메모리 삭제
  const forgetMemory = useCallback(async (id: string): Promise<boolean> => {
    try {
      const success = await deleteMemory(id)
      if (success) {
        const count = await getMemoryCount()
        setMemoryCount(count)
      }
      return success
    } catch (err) {
      console.error("[useMemory] Delete failed:", err)
      return false
    }
  }, [])

  // 모든 메모리 삭제
  const forgetAll = useCallback(async (): Promise<void> => {
    try {
      await clearAllMemories()
      setMemoryCount(0)
    } catch (err) {
      console.error("[useMemory] Clear all failed:", err)
    }
  }, [])

  // RAG 컨텍스트 포맷팅
  const formatMemoriesForPrompt = useCallback(
    (memories: MemorySearchResult[]): string => {
      if (memories.length === 0) return ""

      const formatted = memories
        .map(
          (m, i) =>
            `[기억 ${i + 1}] "${m.title}"\n` +
            `URL: ${m.url}\n` +
            `내용: ${m.summary}\n` +
            `관련도: ${Math.round(m.score * 100)}%`
        )
        .join("\n\n")

      return (
        `[관련 기억]\n` +
        `다음은 사용자가 이전에 저장한 페이지들 중 질문과 관련된 내용입니다.\n` +
        `이 정보를 참고하여 답변해주세요.\n\n` +
        formatted +
        `\n\n`
      )
    },
    []
  )

  return {
    status,
    memoryCount,
    isSaving,
    isSearching,
    error,
    rememberPage,
    recallMemories,
    listMemories,
    forgetMemory,
    forgetAll,
    formatMemoriesForPrompt,
  }
}
