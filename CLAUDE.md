# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Memex는 Chrome Built-in AI(Gemini Nano)를 활용한 로컬 프라이버시 보장 브라우저 AI 어시스턴트입니다. 모든 연산이 사용자 기기에서 로컬로 수행되며, 외부 서버 통신이 없습니다(Zero-Data Leakage).

**현재 상태:** MVP 완료. 기본 채팅, 페이지 읽기, 우클릭 퀵 액션, 마크다운 렌더링 기능 구현됨.

## Development Rules

### 컴포넌트 분리 규칙
- **모든 UI 컴포넌트는 `src/components/` 폴더에 분리**
- 한 파일에 여러 컴포넌트를 넣지 않음
- 파일명은 PascalCase (예: `ChatMessage.tsx`, `CodeBlock.tsx`)
- 각 컴포넌트는 단일 책임 원칙 준수

### 기능 추가 시 문서 기록 규칙
- 새 기능 추가 시 **반드시** 다음 문서 업데이트:
  1. `CLAUDE.md` - Features 섹션에 기능 추가
  2. `doc/PRD.md` - 기능 요구사항 추가
  3. 필요시 `doc/TechSpec.md` - 기술 명세 추가
- 새 컴포넌트 생성 시 Source Structure 업데이트
- 새 패키지 설치 시 Tech Stack 업데이트

## Development Commands

```bash
pnpm dev      # Plasmo 개발 서버 (HMR 지원)
pnpm build    # 프로덕션 빌드
pnpm package  # Chrome Web Store 배포용 패키징
```

## Prerequisites

- Chrome Canary 또는 Dev (version 131+)
- `chrome://flags#optimization-guide-on-device-model` → Enabled
- `chrome://flags#prompt-api-for-gemini-nano` → Enabled
- WebGPU 지원 GPU (최소 4GB VRAM 권장)
- Gemini Nano 모델 (~1.5GB) 첫 사용 시 자동 다운로드

## Architecture

```
Chrome Browser (Local)
├── Side Panel UI (React + Tailwind)
│   ├── Header (로고, 상태 배지)
│   ├── Page Context Banner (읽은 페이지 표시)
│   ├── ChatMessage (마크다운 렌더링 + 코드 하이라이팅)
│   ├── CodeBlock (Syntax Highlight + 복사 버튼)
│   ├── ChatInput (입력창, 전송 버튼)
│   ├── Page Read Button (페이지 읽기)
│   └── Thinking Indicator
├── Background Script
│   ├── Context Menu (우클릭 퀵 액션)
│   ├── Side Panel 제어
│   └── Storage 통신
├── useGemini Hook
│   ├── LanguageModel API (Prompt API)
│   ├── Session 관리 (create/destroy/clone)
│   ├── 다운로드 모니터링 (monitor)
│   └── 토큰 관리 (inputUsage/inputQuota)
└── [Phase 2] RAG Pipeline
    ├── Content Scripts (페이지 스크래핑)
    ├── Transformers.js (임베딩)
    └── Orama DB (벡터 저장)
```

## Features

### 1. 기본 AI 채팅
- Gemini Nano 로컬 추론
- 100% 오프라인, Zero-Data Leakage

### 2. 이 페이지 읽기 (Chat with Page)
- 현재 탭의 본문 텍스트 추출
- `chrome.scripting.executeScript` 사용
- 불필요한 요소 제거 (nav, footer, script 등)
- 최대 8000자 제한
- 컨텍스트 기반 질문 응답

### 3. 우클릭 퀵 액션 (Context Menu)
- 텍스트 드래그 → 우클릭 → Memex 메뉴
- 지원 액션:
  - **쉽게 설명해줘**: 복잡한 내용 쉽게 풀이
  - **한국어로 번역해줘**: 영어/외국어 번역
  - **요약해줘**: 3줄 요약
  - **이게 뭐야?**: 단어/개념 설명
- 자동으로 사이드 패널 열림 + 즉시 응답

### 4. 마크다운 & 코드 하이라이팅
- AI 답변 마크다운 렌더링 (커스텀 파서)
- 코드 블록 Syntax Highlighting (`react-syntax-highlighter` + hljs/oneDark 테마)
- 원클릭 코드 복사 버튼
- 지원 요소:
  - 코드 블록 (```language ... ```)
  - 인라인 코드 (`code`)
  - 볼드 (**text**, __text__)
  - 이탤릭 (*text*, _text_)

### 5. 스트리밍 응답 (Streaming Response)
- `promptStreaming()` API 사용하여 실시간 응답 표시
- ReadableStream을 통한 청크 단위 데이터 수신
- 응답 생성 중에도 부분 텍스트 실시간 렌더링
- "답변 생성 중..." 대기 시간 최소화
- 사용자 경험 향상 (타이핑 효과)

### 6. 페르소나 템플릿 (Persona Switcher)
- 헤더 드롭다운으로 AI 모드 전환
- 사전 정의된 페르소나:
  - **기본**: 일반적인 AI 어시스턴트
  - **번역가**: 다국어 번역 전문가
  - **코드 리뷰어**: 시니어 개발자 관점 리뷰
  - **요약 전문가**: 핵심만 뽑아내는 요약
  - **선생님**: 쉽게 설명해주는 선생님
- 각 페르소나별 systemPrompt 동적 적용
- 모드 전환 시 안내 메시지 표시

### 7. 대화 히스토리 저장 (Chat Persistence)
- `chrome.storage.local`에 대화 내용 자동 저장
- 브라우저 재시작 후에도 대화 내용 유지
- 대화 목록 사이드바 (SessionList)
- 세션별 제목 자동 생성 (첫 사용자 메시지 기반)
- 대화 내보내기 (JSON, Markdown)
- 페르소나 설정도 세션과 함께 저장/복원

## Tech Stack

| 카테고리 | 기술 |
|----------|------|
| Framework | Plasmo 0.85.0 |
| UI | React 18.2.0 + Tailwind CSS 3.4.1 |
| Icons | lucide-react |
| AI | Chrome Built-in AI (Gemini Nano) - Prompt API |
| Markdown | 커스텀 파서 (코드 블록, 인라인 마크다운) |
| Code Highlight | react-syntax-highlighter (hljs + atomOneDark) |
| Utilities | clsx, tailwind-merge |
| Vector DB | Orama 2.0.0 (Phase 2) |

## Source Structure

```
src/
├── components/
│   ├── ChatMessage.tsx     # 메시지 말풍선 (마크다운 렌더링)
│   ├── CodeBlock.tsx       # 코드 블록 (Syntax Highlight + 복사)
│   ├── PersonaSelector.tsx # 페르소나 선택 드롭다운
│   └── SessionList.tsx     # 대화 목록 사이드바
├── hooks/
│   └── use-gemini.ts       # AI 세션 관리 (Prompt API)
├── lib/
│   └── chat-storage.ts     # 대화 저장소 유틸 (chrome.storage)
├── background.ts           # Context Menu, Side Panel 제어
├── types.ts                # 공통 타입 + Persona + ChatSession
├── style.css               # Tailwind + 커스텀 스타일
└── sidepanel.tsx           # 메인 컨테이너
```

## Chrome Extension Permissions

```json
{
  "permissions": ["sidePanel", "activeTab", "scripting", "storage", "unlimitedStorage", "contextMenus"],
  "host_permissions": ["https://*/*"],
  "side_panel": { "default_path": "sidepanel.html" }
}
```

**단축키:** `Cmd+B` → 사이드 패널 열기

## UI Theme

- **Primary Color:** Indigo (bg-indigo-600)
- **Status Colors:** Green (ready), Red (error), Yellow (downloading), Indigo (loading)
- **Code Theme:** oneDark (dark background)
- **Font:** Inter, sans-serif
- **아바타:** User (indigo), AI (Bot 아이콘)

## Important Notes

- `LanguageModel` API는 Chrome 버전에 따라 변경될 수 있음 → 방어적 코딩 필수
- UI 문자열은 한국어
- Status 상태: `loading` | `ready` | `downloading` | `error` | `unsupported`
- 컴포넌트 언마운트 시 `session.destroy()` 및 `AbortController.abort()` 호출 필수
- `quotaoverflow` 이벤트로 컨텍스트 창 초과 감지

## Chrome AI API Pattern

```typescript
// 가용성 확인
const availability = await LanguageModel.availability()

// 세션 생성
const session = await LanguageModel.create({
  initialPrompts: [{ role: "system", content: "..." }],
  signal: abortController.signal,
  monitor: (m) => m.addEventListener("downloadprogress", console.log)
})

// 일반 응답 생성
const response = await session.prompt(userInput)

// 스트리밍 응답 생성
const stream = session.promptStreaming(userInput)
const reader = stream.getReader()

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  console.log(value) // 누적된 전체 텍스트
}

// 정리
session.destroy()
```

## Documentation Files

| 파일 | 설명 |
|------|------|
| PRD.md | 제품 요구사항 정의서 |
| TechSpec.md | 기술 설계서 (아키텍처, 데이터 모델) |
| Guide.md | 실행 가이드 (설치 → 사용) |
| SideUi.md | 사이드 패널 UI 컴포넌트 |
| AI Logic Hook.md | useGemini 훅 구현 |
| Common Types.md | 공통 타입 정의 |
