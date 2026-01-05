
# Prompt API 업데이트 (2026 Spec)

**날짜:** 2026-01-05
**난이도:** ⭐⭐
**상태:** 완료

## 개요

Chrome Built-in AI의 최신 Prompt API 스펙(2026)으로 업데이트. 기존 `window.ai.languageModel` 방식에서 전역 `LanguageModel` 객체 방식으로 마이그레이션.

## 변경 사항

### API 변경점

| 항목 | 이전 | 이후 |
|------|------|------|
| API 접근 | `window.ai.languageModel` | `LanguageModel` (전역) |
| 가용성 확인 | `capabilities()` | `availability()` |
| 상태값 | `"readily"`, `"after-download"`, `"no"` | `"available"`, `"downloadable"`, `"downloading"`, `"unavailable"` |
| 시스템 프롬프트 | `systemPrompt` | `initialPrompts: [{ role: "system", content }]` |
| 다운로드 모니터 | 없음 | `monitor` 콜백 |

### 수정 파일

- `src/hooks/use-gemini.ts` - API 호출 방식 전면 수정
- `src/types.ts` - 새로운 타입 정의 추가

## 코드 예시

```typescript
// 이전 방식
const session = await window.ai.languageModel.create({
  systemPrompt: "..."
})

// 새로운 방식
const session = await LanguageModel.create({
  initialPrompts: [{ role: "system", content: "..." }],
  monitor: (m) => m.addEventListener("downloadprogress", console.log)
})
```

## 참고 자료

- https://github.com/webmachinelearning/prompt-api
