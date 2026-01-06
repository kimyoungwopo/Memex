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
  4. **`doc/history/YYYY-MM-DD-feature-name.md`** - 기능별 히스토리 문서 작성
- 새 컴포넌트 생성 시 Source Structure 업데이트
- 새 패키지 설치 시 Tech Stack 업데이트

### 히스토리 문서화 규칙
- 작업 완료 후 `doc/history/` 폴더에 기능별 문서 작성
- 파일명 형식: `YYYY-MM-DD-feature-name.md` (예: `2026-01-05-multimodal-image.md`)
- 필수 포함 내용:
  ```markdown
  # 기능명 (English Name)

  **날짜:** YYYY-MM-DD
  **난이도:** ⭐ ~ ⭐⭐⭐⭐⭐
  **상태:** 완료 | 진행중 | 보류

  ## 개요
  ## 기능 상세
  ## 추가/수정 파일
  ## 코드 예시
  ## 사용법 / 시나리오
  ```
- `doc/history/README.md`에 날짜별 기능 목록 테이블 업데이트

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
├── useMemory Hook (RAG Pipeline)
│   ├── Transformers.js (임베딩 생성)
│   ├── Orama DB (벡터 저장/검색)
│   ├── 하이브리드 검색 (Vector + Keyword)
│   └── chrome.storage.local (영속화)
└── [Future] Advanced Features
    ├── 자동 페이지 기억 (백그라운드)
    └── 크로스 디바이스 동기화
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

### 8. 멀티모달 이미지 입력 (Multimodal Image Input) - ⚠️ 비활성화
> **상태:** 코드 구현 완료, UI 비활성화 (`ENABLE_IMAGE_INPUT = false`)
> **사유:** Gemini Nano 멀티모달 성능 한계 (hallucination 발생)
> **재활성화:** Chrome AI 모델 개선 시 `sidepanel.tsx`에서 플래그 변경

- 이미지를 첨부하여 AI와 대화
- 지원 입력 방식:
  - **드래그 앤 드롭**: 이미지 파일을 채팅창에 드래그
  - **클립보드 붙여넣기**: Ctrl+V / Cmd+V로 스크린샷 붙여넣기
  - **파일 선택**: 버튼 클릭으로 이미지 파일 선택
- 이미지 미리보기 (썸네일) 및 제거 기능
- Base64 인코딩 → Blob 변환 → LanguageModelContent 배열 전달

### 9. 로컬 벡터 RAG (Local Vector RAG) - 🧠 핵심 기능
> **상태:** 구현 완료
> **기술:** Transformers.js (임베딩) + Orama (벡터 검색)

과거에 저장한 페이지를 기억하고, 질문 시 관련 기억을 자동으로 찾아 답변에 활용하는 RAG 시스템.

- **기억하기 (Remember)**:
  - 현재 페이지 텍스트를 벡터(384차원)로 변환
  - Orama DB에 저장 (chrome.storage.local 영속화)
  - 모델: `Xenova/all-MiniLM-L6-v2`
- **회상하기 (Recall)**:
  - 질문을 벡터로 변환
  - 하이브리드 검색 (Vector 70% + Keyword 30%)
  - 상위 3개 관련 기억을 프롬프트에 포함
- **기억 관리**:
  - 저장된 기억 목록 조회
  - 개별/전체 삭제

### 10. YouTube 영상 분석 (YouTube Transcript)
- YouTube 영상 페이지에서 자막 추출 및 AI 요약
- DOM 기반 자막 추출 (Transcript 패널에서 직접 추출)
- 한국어/영어 자막 자동 선택
- 타임스탬프 포함 요약 생성
- 긴 영상은 청크 단위로 분할 처리

### 11. 메모리 백업/복원 (Memory Backup)
- 저장된 기억을 JSON 파일로 백업
- 백업 파일에서 복원 (대체/병합 모드)
- 포함 데이터: URL, 제목, 내용, 요약, 태그, 임베딩 벡터
- 설정 패널에서 저장소 현황 확인
- 전체 삭제 기능 (confirm 다이얼로그)

### 12. 세렌디피티 엔진 (Serendipity Engine)
- 브라우징 중 관련 기억 자동 알림
- 탭 전환/페이지 방문 시 자동 유사도 검색
- 유사도 25% 이상인 기억 감지
- 보라색 배너로 관련 기억 표시 (최대 3개)
- 확장 프로그램 아이콘에 배지 알림
- 디바운스 처리 (1.5초)로 중복 방지

### 13. PDF 문서 분석 (PDF Analysis)
- Chrome에서 열린 PDF 문서 텍스트 추출
- pdf.js 라이브러리 사용 (pdfjs-dist)
- 최대 50페이지까지 지원
- AI 요약 (3줄 핵심, 키워드, 문서 유형)
- 분석 후 질문 응답 가능
- 기억하기 연동

### 14. 지식 그래프 시각화 (Knowledge Graph)
- 저장된 기억들을 인터랙티브 2D 그래프로 시각화
- 노드: 각 기억 (태그 기반 색상, 크기)
- 엣지: 임베딩 코사인 유사도 기반 연결
- 유사도 임계값 슬라이더 (10%~70%)
- 드래그, 줌, 노드 클릭 인터랙션
- react-force-graph-2d 사용
- "On-Device AI Brain" 컨셉 시각화

### 15. 스마트 온보딩 & 모델 관리자 (Model Manager)
- **Welcome Page**: 첫 설치 시 친절한 온보딩 페이지
- **하드웨어 체크**: WebGPU, Chrome AI, 브라우저 버전 자동 확인
- **프로그레스 바**: "AI 두뇌를 심는 중... (35%)" 형태의 다운로드 진행률
- **해결 방법 안내**: 요구사항 미충족 시 chrome://flags 설정 등 구체적 안내
- **모델 재설치**: 설정 패널에서 모델 다시 다운로드 버튼
- Cold Start 문제 해결로 사용자 이탈 방지

### 16. 실시간 번역 (Real-time Translation)
- 웹페이지에서 선택한 텍스트를 로컬 AI로 번역
- **지원 언어**: 한국어, English, 日本語, 中文, Español, Français, Deutsch, Tiếng Việt
- **페이지 주입**: 번역 결과를 웹페이지에 직접 표시 (툴팁 또는 텍스트 교체)
- 외부 번역 서비스 없이 100% 로컬에서 동작
- 편집 가능 영역에서는 선택 텍스트 직접 교체

## Tech Stack

| 카테고리 | 기술 |
|----------|------|
| Build | Vite 5.0 + @crxjs/vite-plugin |
| UI | React 18.2.0 + Tailwind CSS 3.4.1 |
| Icons | lucide-react |
| AI | Chrome Built-in AI (Gemini Nano) - Prompt API |
| Embeddings | @xenova/transformers (all-MiniLM-L6-v2) |
| Vector DB | @orama/orama 2.0.0 (벡터 검색) |
| Graph | react-force-graph-2d (d3-force 기반) |
| Markdown | 커스텀 파서 (코드 블록, 인라인 마크다운) |
| Code Highlight | react-syntax-highlighter (hljs + atomOneDark) |
| PDF | pdfjs-dist (pdf.js) |
| Utilities | clsx, tailwind-merge |

## Source Structure

```
src/
├── components/
│   ├── ChatMessage.tsx     # 메시지 말풍선 (마크다운 렌더링)
│   ├── CodeBlock.tsx       # 코드 블록 (Syntax Highlight + 복사)
│   ├── ImagePreview.tsx    # 이미지 미리보기 + 유틸 함수
│   ├── KnowledgeGraph.tsx  # 지식 그래프 시각화 (react-force-graph)
│   ├── MemoryDashboard.tsx # 기억 탭 대시보드
│   ├── MemoryPanel.tsx     # 저장된 기억 목록 패널
│   ├── ModelManager.tsx    # AI 모델 상태 관리 + 프로그레스 UI
│   ├── PersonaSelector.tsx   # 페르소나 선택 드롭다운
│   ├── WelcomePage.tsx       # 첫 설치 온보딩 페이지
│   ├── TranslationPanel.tsx  # 실시간 번역 탭
│   ├── SessionList.tsx       # 대화 목록 사이드바
│   └── SettingsPanel.tsx     # 설정 패널 (백업/복원)
├── hooks/
│   ├── use-gemini.ts       # AI 세션 관리 (Prompt API)
│   └── use-memory.ts       # RAG 파이프라인 (기억하기/회상하기)
├── lib/
│   ├── chat-storage.ts     # 대화 저장소 유틸 (chrome.storage)
│   ├── embedding-client.ts # Sandbox 기반 임베딩 클라이언트
│   ├── hardware-check.ts   # 하드웨어 요구사항 체크 (WebGPU, Chrome AI)
│   ├── pdf.ts              # PDF 텍스트 추출 유틸 (pdf.js)
│   ├── translation.ts      # 번역 유틸 (선택 텍스트, 주입)
│   ├── vector-db.ts        # Orama 벡터 DB 모듈
│   └── youtube.ts          # YouTube 자막 추출 유틸
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

// 멀티모달 입력 (이미지 + 텍스트)
const content = [
  { type: "image", value: imageBlob },
  { type: "text", value: "이 이미지를 설명해줘" }
]
const multimodalStream = session.promptStreaming([{ role: "user", content }])

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
| **history/** | 기능별 개발 히스토리 (날짜별 문서) |
