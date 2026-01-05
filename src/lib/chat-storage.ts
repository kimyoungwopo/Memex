import type { ChatSession, Message } from "../types"

const STORAGE_KEY = "memex_chat_sessions"
const CURRENT_SESSION_KEY = "memex_current_session_id"

// 고유 ID 생성
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// 첫 번째 사용자 메시지에서 제목 추출
export function generateTitle(messages: Message[]): string {
  const firstUserMessage = messages.find((m) => m.role === "user")
  if (firstUserMessage) {
    const text = firstUserMessage.text.trim()
    return text.length > 30 ? text.substring(0, 30) + "..." : text
  }
  return "새 대화"
}

// 모든 세션 가져오기
export async function getAllSessions(): Promise<ChatSession[]> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY)
    const sessions = result[STORAGE_KEY] || []
    // 최신순 정렬
    return sessions.sort((a: ChatSession, b: ChatSession) => b.updatedAt - a.updatedAt)
  } catch (error) {
    console.error("Failed to get sessions:", error)
    return []
  }
}

// 특정 세션 가져오기
export async function getSession(sessionId: string): Promise<ChatSession | null> {
  const sessions = await getAllSessions()
  return sessions.find((s) => s.id === sessionId) || null
}

// 현재 세션 ID 가져오기
export async function getCurrentSessionId(): Promise<string | null> {
  try {
    const result = await chrome.storage.local.get(CURRENT_SESSION_KEY)
    return result[CURRENT_SESSION_KEY] || null
  } catch (error) {
    console.error("Failed to get current session ID:", error)
    return null
  }
}

// 현재 세션 ID 설정
export async function setCurrentSessionId(sessionId: string): Promise<void> {
  try {
    await chrome.storage.local.set({ [CURRENT_SESSION_KEY]: sessionId })
  } catch (error) {
    console.error("Failed to set current session ID:", error)
  }
}

// 새 세션 생성
export async function createSession(personaId: string = "default"): Promise<ChatSession> {
  const newSession: ChatSession = {
    id: generateId(),
    title: "새 대화",
    messages: [],
    personaId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  const sessions = await getAllSessions()
  sessions.unshift(newSession)

  await chrome.storage.local.set({ [STORAGE_KEY]: sessions })
  await setCurrentSessionId(newSession.id)

  return newSession
}

// 세션 저장 (업데이트)
export async function saveSession(session: ChatSession): Promise<void> {
  try {
    const sessions = await getAllSessions()
    const index = sessions.findIndex((s) => s.id === session.id)

    // 제목 자동 생성 (첫 사용자 메시지 기반)
    if (session.title === "새 대화" && session.messages.length > 0) {
      session.title = generateTitle(session.messages)
    }

    session.updatedAt = Date.now()

    if (index >= 0) {
      sessions[index] = session
    } else {
      sessions.unshift(session)
    }

    await chrome.storage.local.set({ [STORAGE_KEY]: sessions })
  } catch (error) {
    console.error("Failed to save session:", error)
  }
}

// 세션 삭제
export async function deleteSession(sessionId: string): Promise<void> {
  try {
    const sessions = await getAllSessions()
    const filtered = sessions.filter((s) => s.id !== sessionId)
    await chrome.storage.local.set({ [STORAGE_KEY]: filtered })

    // 현재 세션이 삭제된 경우 초기화
    const currentId = await getCurrentSessionId()
    if (currentId === sessionId) {
      await chrome.storage.local.remove(CURRENT_SESSION_KEY)
    }
  } catch (error) {
    console.error("Failed to delete session:", error)
  }
}

// 모든 세션 삭제
export async function clearAllSessions(): Promise<void> {
  try {
    await chrome.storage.local.remove([STORAGE_KEY, CURRENT_SESSION_KEY])
  } catch (error) {
    console.error("Failed to clear sessions:", error)
  }
}

// 세션을 JSON으로 내보내기
export function exportSession(session: ChatSession): string {
  const exportData = {
    title: session.title,
    exportedAt: new Date().toISOString(),
    messages: session.messages.map((m) => ({
      role: m.role,
      text: m.text,
      timestamp: m.timestamp,
    })),
  }
  return JSON.stringify(exportData, null, 2)
}

// 세션을 마크다운으로 내보내기
export function exportSessionAsMarkdown(session: ChatSession): string {
  let md = `# ${session.title}\n\n`
  md += `> Exported from Memex on ${new Date().toLocaleString()}\n\n---\n\n`

  for (const msg of session.messages) {
    if (msg.role === "user") {
      md += `## 👤 User\n\n${msg.text}\n\n`
    } else if (msg.role === "ai") {
      md += `## 🤖 AI\n\n${msg.text}\n\n`
    }
  }

  return md
}

// 다운로드 트리거
export function downloadFile(content: string, filename: string, type: string): void {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
