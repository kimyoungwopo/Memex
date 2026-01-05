# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Memex는 Chrome Built-in AI(Gemini Nano)를 활용한 로컬 프라이버시 보장 브라우저 AI 어시스턴트입니다. 모든 연산이 사용자 기기에서 로컬로 수행되며, 외부 서버 통신이 없습니다(Zero-Data Leakage).

**현재 상태:** MVP 단계. 문서 파일(*.md)에 코드 명세가 포함되어 있으며, 이를 기반으로 실제 소스 파일을 생성해야 합니다.

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
│   ├── ChatList (메시지 목록, 아바타)
│   ├── ChatInput (입력창, 전송 버튼)
│   └── Thinking Indicator
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

## Chrome AI API Pattern (2026 Prompt API Spec)

> **API Reference:** https://github.com/webmachinelearning/prompt-api

```typescript
// 타입 정의
type LanguageModelAvailability = "available" | "downloadable" | "downloading" | "unavailable"

interface LanguageModelSession {
  prompt: (input: string | LanguageModelPrompt[]) => Promise<string>
  promptStreaming: (input: string) => ReadableStream<string>
  append: (prompts: LanguageModelPrompt[]) => Promise<void>
  measureInputUsage: (input: string) => Promise<number>
  clone: () => Promise<LanguageModelSession>
  destroy: () => void
  readonly inputUsage: number
  readonly inputQuota: number
}

// 가용성 확인 (최신 API)
const availability = await LanguageModel.availability({
  expectedInputs: [{ type: "text" }],
  expectedOutputs: [{ type: "text" }]
})
// availability: "available" | "downloadable" | "downloading" | "unavailable"

// 모델 파라미터 조회
const params = await LanguageModel.params()
// { defaultTemperature, maxTemperature, defaultTopK, maxTopK }

// 세션 생성
const session = await LanguageModel.create({
  initialPrompts: [
    { role: "system", content: "..." }
  ],
  expectedInputs: [{ type: "text", languages: ["ko", "en"] }],
  expectedOutputs: [{ type: "text", languages: ["ko"] }],
  temperature: 0.8,
  topK: 10,
  signal: abortController.signal,
  monitor: (m) => {
    m.addEventListener("downloadprogress", (e) => {
      console.log(`Downloaded ${e.loaded * 100}%`)
    })
  }
})

// 응답 생성
const response = await session.prompt(userInput)

// 스트리밍 응답
const stream = session.promptStreaming(userInput)
for await (const chunk of stream) {
  console.log(chunk)
}

// 구조화된 출력 (JSON Schema)
const result = await session.prompt("Generate email", {
  responseConstraint: { type: "object", properties: { email: { type: "string" } } }
})

// 정리
session.destroy()
```

## API Migration Guide

| 이전 API | 최신 API |
|----------|----------|
| `window.ai.languageModel` | `LanguageModel` (전역 객체) |
| `capabilities()` | `availability()` |
| `"readily"` | `"available"` |
| `"after-download"` | `"downloadable"` |
| `"no"` | `"unavailable"` |
| `systemPrompt` | `initialPrompts[{role:"system"}]` |
| - | `params()` (신규) |
| - | `measureInputUsage()` (신규) |
| - | `inputUsage` / `inputQuota` (신규) |
| - | `clone()` (신규) |
| - | `monitor` (신규) |
| - | `responseConstraint` (신규) |

## Tech Stack

| 카테고리 | 기술 |
|----------|------|
| Framework | Plasmo 0.85.0 |
| UI | React 18.2.0 + Tailwind CSS 3.4.1 |
| Icons | lucide-react (BrainCircuit, User, Bot, Send 등) |
| AI | Chrome Built-in AI (Gemini Nano) - Prompt API |
| Utilities | clsx, tailwind-merge |
| Vector DB | Orama 2.0.0 (Phase 2) |

## Source Structure

```
src/
├── components/
│   ├── Header.tsx        # 로고 및 AI 상태 배지
│   ├── ChatMessage.tsx   # 말풍선 (User/AI 아바타 포함)
│   ├── ChatList.tsx      # 메시지 목록 및 스크롤 관리
│   └── ChatInput.tsx     # 입력창 및 전송 버튼
├── hooks/
│   └── use-gemini.ts     # AI 세션 관리 (최신 Prompt API 적용)
├── types.ts              # Message, AIStatus, LanguageModel 타입
├── style.css             # Tailwind + 스크롤바 커스텀
└── sidepanel.tsx         # 메인 컨테이너
```

## Chrome Extension Permissions

```json
{
  "permissions": ["sidePanel", "activeTab", "scripting", "storage", "unlimitedStorage"],
  "host_permissions": ["https://*/*"],
  "side_panel": { "default_path": "sidepanel.html" }
}
```

**단축키:** `Cmd+B` → 사이드 패널 열기

## UI Theme

- **Primary Color:** Indigo (bg-indigo-600)
- **Status Colors:** Green (ready), Red (error), Yellow (downloading), Indigo (loading)
- **Font:** Inter, sans-serif
- **아바타:** User (indigo), AI (Bot 아이콘)

## Important Notes

- `LanguageModel` API는 Chrome 버전에 따라 변경될 수 있음 → 방어적 코딩 필수 (레거시 `window.ai.languageModel` 폴백 포함)
- UI 문자열은 한국어
- Status 상태: `loading` | `ready` | `downloading` | `error` | `unsupported`
- `expectedInputs/expectedOutputs`로 입출력 타입 및 언어 선언
- 컴포넌트 언마운트 시 `session.destroy()` 및 `AbortController.abort()` 호출 필수
- `quotaoverflow` 이벤트로 컨텍스트 창 초과 감지
- `downloadProgress` 상태로 모델 다운로드 진행상황 표시 가능

## Documentation Files

| 파일 | 설명 |
|------|------|
| PRD.md | 제품 요구사항 정의서 |
| TechSpec.md | 기술 설계서 (아키텍처, 데이터 모델) |
| Guide.md | 실행 가이드 (설치 → 사용) |
| SideUi.md | 사이드 패널 UI 컴포넌트 (최신 v2) |
| AI Logic Hook.md | useGemini 훅 구현 (Prompt API 스펙) |
| Common Types.md | 공통 타입 정의 |
| Package Configuration.md | package.json |
| Tailwind Configuration.md | tailwind.config.js |
| Global styles.md | style.css |
