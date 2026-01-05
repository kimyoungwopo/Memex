# 마크다운 & 코드 하이라이팅

**날짜:** 2026-01-05
**난이도:** ⭐⭐
**상태:** 완료

## 개요

AI 응답에서 마크다운 형식을 렌더링하고, 코드 블록에 Syntax Highlighting 적용. 코드 복사 버튼 제공.

## 기능 상세

### 지원 마크다운 요소

- **코드 블록**: ` ```language ... ``` ` (Syntax Highlight)
- **인라인 코드**: `` `code` ``
- **볼드**: `**text**`, `__text__`
- **이탤릭**: `*text*`, `_text_`

### 코드 하이라이팅

- 라이브러리: `react-syntax-highlighter`
- 스타일: `hljs/atomOneDark` (다크 테마)
- 언어 자동 감지
- 원클릭 복사 버튼

## 추가/수정 파일

- `src/components/CodeBlock.tsx` - NEW: 코드 블록 컴포넌트
- `src/components/ChatMessage.tsx` - 마크다운 파서 추가
- `package.json` - `react-syntax-highlighter` 의존성 추가

## 코드 예시

```typescript
// ChatMessage.tsx - 마크다운 파서
function parseMessage(text: string) {
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g
  // 코드 블록과 텍스트 분리
  // ...
}

// CodeBlock.tsx
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism"

export function CodeBlock({ language, children }) {
  return (
    <SyntaxHighlighter language={language} style={atomDark}>
      {children}
    </SyntaxHighlighter>
  )
}
```

## 설치

```bash
pnpm add react-syntax-highlighter
pnpm add -D @types/react-syntax-highlighter
```
