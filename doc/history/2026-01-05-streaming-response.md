# 스트리밍 응답 (Streaming Response)

**날짜:** 2026-01-05
**난이도:** ⭐⭐
**상태:** 완료

## 개요

AI 응답을 실시간으로 스트리밍하여 사용자에게 타이핑 효과처럼 점진적으로 표시. 대기 시간 최소화.

## 기능 상세

- `promptStreaming()` API 사용
- `ReadableStream`을 통한 청크 단위 수신
- 응답 생성 중에도 부분 텍스트 실시간 렌더링
- 빈 청크 무시 (깜빡임 방지)

## 수정 파일

- `src/hooks/use-gemini.ts` - `generateStream` 함수 추가
- `src/sidepanel.tsx` - 스트리밍 처리 로직

## 코드 예시

```typescript
// use-gemini.ts
const generateStream = useCallback(
  (input: string, options?: { signal?: AbortSignal }) => {
    return sessionRef.current.promptStreaming(input, {
      signal: options?.signal,
    })
  },
  [status]
)

// sidepanel.tsx
const stream = generateStream(prompt)
const reader = stream.getReader()

let accumulated = ""
while (true) {
  const { done, value } = await reader.read()
  if (done) break

  // Chrome AI는 누적된 전체 텍스트를 반환
  if (value && value.trim()) {
    accumulated = value
    setMessages((prev) => {
      const updated = [...prev]
      updated[updated.length - 1].text = accumulated
      return updated
    })
  }
}
```

## 주의사항

- Chrome Prompt API는 각 청크에 **누적된 전체 텍스트**를 반환
- 일반 스트리밍 API와 다르게 delta가 아닌 전체 응답
- 빈 청크가 올 수 있으므로 필터링 필요
