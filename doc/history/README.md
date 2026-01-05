# 개발 히스토리

기능 구현 기록을 날짜별로 정리합니다.

## 문서 형식

각 기능 문서는 다음 형식을 따릅니다:

```markdown
# 기능명 (English Name)

**날짜:** YYYY-MM-DD
**난이도:** ⭐ ~ ⭐⭐⭐⭐⭐
**상태:** 완료 | 진행중 | 보류

## 개요
기능에 대한 간단한 설명

## 기능 상세
- 세부 기능 목록

## 추가/수정 파일
- 변경된 파일 목록

## 코드 예시
주요 코드 스니펫

## 사용법 / 시나리오
사용 예시
```

## 2026-01-05

| 기능 | 난이도 | 파일 |
|------|--------|------|
| [Prompt API 업데이트](./2026-01-05-prompt-api-update.md) | ⭐⭐ | use-gemini.ts, types.ts |
| [이 페이지 읽기](./2026-01-05-chat-with-page.md) | ⭐⭐ | sidepanel.tsx |
| [우클릭 퀵 액션](./2026-01-05-context-menu.md) | ⭐⭐⭐ | background.ts |
| [마크다운 & 코드 하이라이팅](./2026-01-05-markdown-code-highlight.md) | ⭐⭐ | ChatMessage.tsx, CodeBlock.tsx |
| [스트리밍 응답](./2026-01-05-streaming-response.md) | ⭐⭐ | use-gemini.ts, sidepanel.tsx |
| [페르소나 템플릿](./2026-01-05-persona-template.md) | ⭐⭐ | PersonaSelector.tsx, types.ts |
| [대화 히스토리 저장](./2026-01-05-chat-persistence.md) | ⭐⭐⭐ | chat-storage.ts, SessionList.tsx |
| [멀티모달 이미지 입력](./2026-01-05-multimodal-image.md) | ⭐⭐⭐ | ImagePreview.tsx, use-gemini.ts | **비활성화** |
| [로컬 벡터 RAG](./2026-01-05-local-vector-rag.md) | ⭐⭐⭐⭐⭐ | embeddings.ts, vector-db.ts, use-memory.ts | **핵심 기능** |
