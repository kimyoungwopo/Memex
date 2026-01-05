# 대화 히스토리 저장 (Chat Persistence)

**날짜:** 2026-01-05
**난이도:** ⭐⭐⭐
**상태:** 완료

## 개요

대화 내용을 `chrome.storage.local`에 자동 저장. 브라우저 재시작 후에도 대화 내용 유지. 여러 세션 관리 및 내보내기 지원.

## 기능 상세

- **자동 저장**: 메시지 추가 시 자동으로 storage에 저장
- **세션 관리**: 여러 대화 세션 생성/전환
- **제목 자동 생성**: 첫 번째 사용자 메시지 기반
- **내보내기**: JSON, Markdown 형식 지원
- **페르소나 저장**: 세션별 선택된 페르소나 함께 저장

## 추가/수정 파일

- `src/lib/chat-storage.ts` - NEW: Storage 유틸리티 함수
- `src/components/SessionList.tsx` - NEW: 세션 목록 사이드바
- `src/types.ts` - ChatSession 인터페이스 추가
- `src/sidepanel.tsx` - 세션 상태 관리

## 데이터 구조

```typescript
// types.ts
export interface ChatSession {
  id: string
  title: string
  messages: Message[]
  personaId: string
  createdAt: number
  updatedAt: number
}

// Storage 키 구조
{
  "memex_sessions": ChatSession[],
  "memex_current_session": string // 현재 세션 ID
}
```

## 코드 예시

```typescript
// chat-storage.ts
export async function saveSession(session: ChatSession) {
  const sessions = await getAllSessions()
  const index = sessions.findIndex((s) => s.id === session.id)

  if (index >= 0) {
    sessions[index] = session
  } else {
    sessions.push(session)
  }

  await chrome.storage.local.set({ memex_sessions: sessions })
}

export async function getAllSessions(): Promise<ChatSession[]> {
  const result = await chrome.storage.local.get("memex_sessions")
  return result.memex_sessions || []
}
```

## 내보내기 형식

### JSON
```json
{
  "title": "대화 제목",
  "exportedAt": "2026-01-05T12:00:00Z",
  "messages": [...]
}
```

### Markdown
```markdown
# 대화 제목
Exported: 2026-01-05

---

**User:** 안녕하세요

**AI:** 안녕하세요! 무엇을 도와드릴까요?
```
