# 이 페이지 읽기 (Chat with Page)

**날짜:** 2026-01-05
**난이도:** ⭐⭐
**상태:** 완료

## 개요

현재 보고 있는 웹 페이지의 본문 텍스트를 추출하여 AI와 대화할 수 있는 기능. 페이지 컨텍스트를 기반으로 질문 응답 가능.

## 기능 상세

- **페이지 읽기 버튼**: 헤더에 FileText 아이콘 버튼
- **본문 추출**: `chrome.scripting.executeScript` 사용
- **불필요 요소 제거**: nav, footer, script, style, aside 등
- **최대 길이 제한**: 8000자 (토큰 절약)
- **컨텍스트 배너**: 읽은 페이지 제목/URL 표시

## 수정 파일

- `src/sidepanel.tsx` - 페이지 읽기 로직 및 UI
- `package.json` - `scripting` 권한 추가

## 사용법

1. 웹 페이지 방문
2. 사이드 패널 열기 (Cmd+B)
3. 📄 버튼 클릭
4. "이 페이지 요약해줘" 등 질문

## 코드 예시

```typescript
const result = await chrome.scripting.executeScript({
  target: { tabId: tab.id },
  func: () => {
    // 불필요 요소 제거
    const selectorsToRemove = ["nav", "footer", "script", "style", "aside"]
    selectorsToRemove.forEach((s) => {
      document.querySelectorAll(s).forEach((el) => el.remove())
    })
    return document.body.innerText.slice(0, 8000)
  },
})
```

## 시나리오

- 긴 블로그 글 요약
- 영어 기사 한국어로 설명
- 코드 문서 이해
