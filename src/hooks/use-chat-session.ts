/**
 * Chat Session Hook - 대화 세션 관리
 *
 * 대화 히스토리 저장/로드, 세션 전환, 메시지 관리를 담당합니다.
 */

import { useState, useEffect, useCallback } from "react"
import type { ChatSession, Persona, Message } from "../types"
import { PERSONAS } from "../types"
import {
  getAllSessions,
  getSession,
  getCurrentSessionId,
  setCurrentSessionId,
  createSession,
  saveSession,
} from "../lib/chat-storage"
import { DEBOUNCE_DELAY } from "../constants"

// Message 타입을 types.ts에서 가져와 사용
export type { Message } from "../types"

const DEFAULT_MESSAGE: Message = {
  role: "ai",
  text: "안녕하세요! 브라우저 속 개인 두뇌 Memex입니다. \n오늘 어떤 정보를 찾고 계신가요?",
}

export function useChatSession() {
  const [messages, setMessages] = useState<Message[]>([DEFAULT_MESSAGE])
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentPersona, setCurrentPersona] = useState<Persona>(PERSONAS[0])
  const [isLoading, setIsLoading] = useState(true)

  // 세션 로드 (초기화)
  useEffect(() => {
    const loadSessions = async () => {
      try {
        setIsLoading(true)
        const allSessions = await getAllSessions()
        setSessions(allSessions)

        const currentId = await getCurrentSessionId()
        if (currentId) {
          const session = await getSession(currentId)
          if (session) {
            setCurrentSession(session)
            setMessages(
              session.messages.length > 0
                ? (session.messages as Message[])
                : [DEFAULT_MESSAGE]
            )
            // 페르소나 복원
            const persona = PERSONAS.find((p) => p.id === session.personaId)
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
        setIsLoading(false)
      }
    }

    loadSessions()
  }, [])

  // 메시지 변경 시 자동 저장 (디바운스)
  useEffect(() => {
    if (!currentSession || isLoading) return

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
      setSessions((prev) => {
        const index = prev.findIndex((s) => s.id === updatedSession.id)
        if (index >= 0) {
          const updated = [...prev]
          updated[index] = updatedSession
          return updated.sort((a, b) => b.updatedAt - a.updatedAt)
        }
        return prev
      })
    }, DEBOUNCE_DELAY)

    return () => clearTimeout(saveTimer)
  }, [messages, currentPersona.id, currentSession?.id, isLoading])

  // 새 대화 시작
  const startNewSession = useCallback(async () => {
    const newSession = await createSession(currentPersona.id)
    setCurrentSession(newSession)
    setMessages([DEFAULT_MESSAGE])
    setSessions((prev) => [newSession, ...prev])
    return newSession
  }, [currentPersona.id])

  // 세션 선택
  const selectSession = useCallback(async (session: ChatSession) => {
    setCurrentSession(session)
    setMessages(
      session.messages.length > 0
        ? (session.messages as Message[])
        : [DEFAULT_MESSAGE]
    )
    await setCurrentSessionId(session.id)
    // 페르소나 복원
    const persona = PERSONAS.find((p) => p.id === session.personaId)
    if (persona) setCurrentPersona(persona)
  }, [])

  // 세션 삭제 후 처리
  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      setSessions((prev) => prev.filter((s) => s.id !== sessionId))

      // 현재 세션이 삭제된 경우
      if (currentSession?.id === sessionId) {
        const remaining = sessions.filter((s) => s.id !== sessionId)
        if (remaining.length > 0) {
          await selectSession(remaining[0])
        } else {
          await startNewSession()
        }
      }
    },
    [currentSession?.id, sessions, selectSession, startNewSession]
  )

  // 메시지 추가
  const addMessage = useCallback((message: Message) => {
    setMessages((prev) => [...prev, message])
  }, [])

  // 마지막 메시지 업데이트 (스트리밍용)
  const updateLastMessage = useCallback((text: string) => {
    setMessages((prev) => {
      const updated = [...prev]
      if (updated.length > 0 && updated[updated.length - 1].role === "ai") {
        updated[updated.length - 1] = { role: "ai", text }
      }
      return updated
    })
  }, [])

  // 페르소나 변경
  const changePersona = useCallback((persona: Persona) => {
    setCurrentPersona(persona)
  }, [])

  return {
    messages,
    setMessages,
    currentSession,
    sessions,
    currentPersona,
    isLoading,
    startNewSession,
    selectSession,
    handleDeleteSession,
    addMessage,
    updateLastMessage,
    changePersona,
  }
}
