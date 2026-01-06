# Memex - On-Device AI Brain

<div align="center">

<img src="assets/icon.png" alt="Memex Logo" width="128" height="128">

**당신만의 AI 두뇌를 브라우저에 심으세요**

[![Chrome](https://img.shields.io/badge/Chrome-131+-4285F4?logo=googlechrome&logoColor=white)](https://www.google.com/chrome/canary/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Privacy](https://img.shields.io/badge/Privacy-Zero--Data--Leakage-brightgreen)](PRIVACY_POLICY.md)

**100% 로컬** • **오프라인 지원** • **프라이버시 보장**

</div>

---

## 왜 Memex인가?

> "인터넷에서 읽은 모든 것을 기억하고, 나만의 AI 두뇌로 연결한다면?"

**Memex는 서버가 없습니다.** 모든 AI 처리가 당신의 컴퓨터에서 로컬로 실행됩니다.

| 특징 | 설명 |
|------|------|
| **Zero-Data Leakage** | 데이터가 절대 외부로 나가지 않습니다 |
| **오프라인 지원** | 인터넷 없이도 완벽하게 동작합니다 |
| **진정한 프라이버시** | 개발자도 당신의 데이터에 접근할 수 없습니다 |

---

## 주요 기능

### AI 채팅
Chrome 내장 **Gemini Nano**로 구동되는 AI 어시스턴트. 외부 API 호출 없이 100% 로컬에서 동작합니다.

### 로컬 벡터 RAG
웹페이지를 **"기억"**하면 나중에 관련 질문 시 자동으로 찾아서 답변에 활용합니다.
- Transformers.js로 384차원 벡터 임베딩 생성
- Orama DB로 하이브리드 검색 (벡터 70% + 키워드 30%)

### 지식 그래프
저장된 기억들을 **인터랙티브 2D 그래프**로 시각화. 코사인 유사도 기반으로 관련 주제들의 연결을 한눈에 파악할 수 있습니다.

### 실시간 번역
웹페이지에서 텍스트를 선택하고 번역하면, 결과를 페이지에 직접 표시합니다.
- 8개 언어 지원: 한국어, English, 日本語, 中文, Español, Français, Deutsch, Tiếng Việt

### 페이지 분석
- **이 페이지 읽기**: 현재 탭의 내용을 AI가 분석
- **YouTube 영상**: 자막 추출 및 요약
- **PDF 문서**: 텍스트 추출 및 분석

### 세렌디피티 엔진
브라우징 중 과거에 저장한 **관련 기억을 자동으로 알려줍니다**. "이 페이지와 관련된 기억이 3개 있어요!"

### 우클릭 퀵 액션
텍스트 선택 → 우클릭 → Memex 메뉴로 즉시 번역/요약/설명을 요청할 수 있습니다.

---

## 기술 스택

| 카테고리 | 기술 |
|----------|------|
| **Build** | Vite + @crxjs/vite-plugin |
| **UI** | React 18 + Tailwind CSS |
| **AI** | Chrome Built-in AI (Gemini Nano) |
| **Embeddings** | Transformers.js (all-MiniLM-L6-v2) |
| **Vector DB** | Orama |
| **Graph** | react-force-graph-2d |
| **PDF** | pdfjs-dist |
| **Icons** | lucide-react |
| **Code Highlight** | react-syntax-highlighter |

---

## 설치

### 요구사항
- **Chrome Canary** 또는 **Chrome Dev** (버전 131+)
- **WebGPU 지원 GPU** (최소 4GB VRAM 권장)
- 약 **1.5GB** 저장 공간 (AI 모델)

### Chrome Flags 설정

1. `chrome://flags` 접속
2. 다음 플래그를 **Enabled**로 설정:
   ```
   #optimization-guide-on-device-model
   #prompt-api-for-gemini-nano
   ```
3. Chrome 재시작

### 빌드 및 설치

```bash
# 1. 저장소 클론
git clone https://github.com/kimyoungwopo/Memex.git
cd Memex

# 2. 의존성 설치
npm install

# 3. 개발 서버 실행
npm run dev

# 4. Chrome에서 확장 프로그램 로드
# chrome://extensions → 개발자 모드 ON → "압축 해제된 확장 프로그램 로드" → dist 폴더 선택
```

### 프로덕션 빌드

```bash
npm run build
# dist/ 폴더에 빌드 결과물 생성
```

---

## 사용법

### 기본 사용

1. **Cmd+B** (Mac) 또는 **Ctrl+B** (Windows)로 사이드 패널 열기
2. AI와 대화하거나, **[페이지 읽기]** 버튼으로 현재 페이지 분석
3. **[기억하기]** 버튼으로 페이지를 벡터 DB에 저장
4. 나중에 관련 질문 시 자동으로 기억을 찾아 답변

### 탭 구성

| 탭 | 기능 |
|----|------|
| **채팅** | AI 대화, 페이지 읽기, 기억하기 |
| **기억** | 저장된 기억 관리, 지식 그래프 |
| **번역** | 실시간 번역, 페이지 주입 |
| **설정** | 백업/복원, 모델 관리 |

---

## 아키텍처

```
Chrome Browser (100% Local)
├── Side Panel UI (React + Tailwind)
│   ├── 채팅 탭 - AI 대화
│   ├── 기억 탭 - 기억 관리 + 지식 그래프
│   ├── 번역 탭 - 실시간 번역
│   └── 설정 탭 - 백업/복원/모델 관리
│
├── Background Service Worker
│   ├── Context Menu (우클릭 퀵 액션)
│   └── Serendipity Engine (관련 기억 알림)
│
├── Local AI Stack
│   ├── Gemini Nano (Chrome Built-in)
│   ├── Transformers.js (Embeddings)
│   └── Orama (Vector DB)
│
└── Storage
    └── chrome.storage.local (대화, 기억, 벡터)
```

---

## 프로젝트 구조

```
src/
├── components/          # React UI 컴포넌트
│   ├── ChatMessage.tsx      # 메시지 말풍선
│   ├── KnowledgeGraph.tsx   # 지식 그래프
│   ├── TranslationPanel.tsx # 번역 패널
│   ├── ModelManager.tsx     # 모델 관리
│   └── ...
├── hooks/              # Custom React Hooks
│   ├── use-gemini.ts       # AI 세션 관리
│   └── use-memory.ts       # RAG 파이프라인
├── lib/                # 유틸리티 함수
│   ├── vector-db.ts        # Orama 벡터 DB
│   ├── translation.ts      # 번역 유틸
│   └── ...
├── background.ts       # Service Worker
├── sidepanel.tsx       # 메인 컨테이너
└── types.ts           # TypeScript 타입
```

---

## 개인정보처리방침

**우리는 서버가 없습니다.**

- 모든 데이터는 **브라우저 내부**에만 저장됩니다
- AI 추론은 **Chrome 내장 Gemini Nano**로 로컬에서 실행됩니다
- 외부 서버로 **어떤 데이터도 전송하지 않습니다**

자세한 내용은 [개인정보처리방침](PRIVACY_POLICY.md)을 참조하세요.

---

## 기여

이슈와 PR을 환영합니다!

```bash
# 개발 서버 (HMR 지원)
npm run dev

# 프로덕션 빌드
npm run build
```

---

## 라이선스

MIT License

---

## 연락처

- **Email**: kbc01054575075@gmail.com
- **GitHub**: [Issues](https://github.com/kimyoungwopo/Memex/issues)

---

<div align="center">

**Memex** - Your Second Brain, Locally.

*Built with Chrome Built-in AI (Gemini Nano)*

</div>
