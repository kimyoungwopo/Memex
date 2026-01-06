# Memex - On-Device AI Brain for Your Browser

<div align="center">

![Memex Logo](assets/icon.png)

**100% 로컬 AI 브라우저 어시스턴트**

[![Chrome](https://img.shields.io/badge/Chrome-131+-4285F4?logo=googlechrome&logoColor=white)](https://www.google.com/chrome/canary/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Privacy](https://img.shields.io/badge/Privacy-Zero--Data--Leakage-brightgreen)](PRIVACY_POLICY.md)

[한국어](#features) | [English](#features-1)

</div>

---

## Why Memex?

> "인터넷에서 읽은 모든 것을 기억하고, 나만의 AI 두뇌로 연결한다면?"

Memex는 **서버가 없습니다**. 모든 AI 처리가 당신의 컴퓨터에서 로컬로 실행됩니다.
- **Zero-Data Leakage**: 데이터가 절대 외부로 나가지 않습니다
- **오프라인 지원**: 인터넷 없이도 완벽하게 동작합니다
- **진정한 프라이버시**: 개발자도 당신의 데이터에 접근할 수 없습니다

---

## Features

### 1. AI 채팅
Chrome 내장 Gemini Nano로 구동되는 AI 어시스턴트. 외부 API 호출 없이 100% 로컬에서 동작합니다.

### 2. 이 페이지 읽기
현재 탭의 내용을 AI가 읽고 이해합니다. "이 글 요약해줘", "핵심이 뭐야?" 등의 질문에 답변합니다.

### 3. 로컬 벡터 RAG
웹페이지를 "기억"하면 나중에 관련 질문 시 자동으로 찾아서 답변에 활용합니다. 모든 데이터는 브라우저 내부에만 저장됩니다.

### 4. 지식 그래프
저장된 기억들을 인터랙티브 2D 그래프로 시각화. 관련 주제들이 어떻게 연결되어 있는지 한눈에 파악할 수 있습니다.

### 5. 실시간 번역
웹페이지에서 텍스트를 선택하고 번역하면, 결과를 페이지에 직접 표시합니다. 8개 언어 지원.

### 6. YouTube 영상 분석
YouTube 영상의 자막을 추출하고 AI가 요약해줍니다.

### 7. PDF 문서 분석
브라우저에서 열린 PDF 문서를 분석하고 질문에 답변합니다.

### 8. 세렌디피티 엔진
브라우징 중 과거에 저장한 관련 기억을 자동으로 알려줍니다. "이 페이지와 관련된 기억이 3개 있어요!"

### 9. 우클릭 퀵 액션
텍스트 선택 → 우클릭 → Memex 메뉴로 즉시 번역/요약/설명을 요청할 수 있습니다.

---

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Plasmo (Chrome Extension) |
| UI | React 18 + Tailwind CSS |
| AI | Chrome Built-in AI (Gemini Nano) |
| Embeddings | Transformers.js (all-MiniLM-L6-v2) |
| Vector DB | Orama (Local) |
| Graph | react-force-graph-2d |
| PDF | pdfjs-dist |

---

## Installation

### Requirements
- **Chrome Canary** 또는 **Chrome Dev** (버전 131+)
- **WebGPU 지원 GPU** (최소 4GB VRAM 권장)
- 약 **1.5GB** 저장 공간 (AI 모델)

### Chrome Flags 설정

1. `chrome://flags` 접속
2. 다음 플래그를 **Enabled**로 설정:
   - `#optimization-guide-on-device-model`
   - `#prompt-api-for-gemini-nano`
3. Chrome 재시작

### 설치 방법

```bash
# 1. 저장소 클론
git clone https://github.com/anthropics/memex.git
cd memex

# 2. 의존성 설치
pnpm install

# 3. 개발 서버 실행
pnpm dev

# 4. Chrome에서 확장 프로그램 로드
# chrome://extensions → 개발자 모드 ON → "압축 해제된 확장 프로그램 로드" → build/chrome-mv3-dev 선택
```

### 프로덕션 빌드

```bash
pnpm build
# dist/ 폴더에 빌드 결과물 생성
```

---

## Usage

### 기본 사용법

1. **Cmd+B** (Mac) 또는 **Ctrl+B** (Windows)로 사이드 패널 열기
2. AI와 대화하거나, [이 페이지 읽기] 버튼으로 현재 페이지 분석
3. [기억하기] 버튼으로 페이지를 벡터 DB에 저장
4. 나중에 관련 질문 시 자동으로 기억을 찾아 답변

### 번역 기능

1. 웹페이지에서 텍스트 드래그
2. [번역] 탭 → [선택 텍스트 가져오기]
3. 대상 언어 선택 → [번역하기]
4. [페이지에 표시하기]로 결과 확인

### 지식 그래프

1. [기억] 탭 → [그래프] 버튼
2. 노드를 드래그하여 탐색
3. 연결 강도 슬라이더로 유사도 임계값 조절

---

## Architecture

```
Chrome Browser (Local Only)
├── Side Panel UI (React + Tailwind)
│   ├── Chat Tab - AI 대화
│   ├── Memory Tab - 기억 관리 + 지식 그래프
│   ├── Translate Tab - 실시간 번역
│   └── Settings Tab - 백업/복원/모델 관리
├── Background Script
│   ├── Context Menu (우클릭 퀵 액션)
│   └── Serendipity Engine (관련 기억 알림)
├── Local AI Stack
│   ├── Gemini Nano (Chrome Built-in)
│   ├── Transformers.js (Embeddings)
│   └── Orama (Vector DB)
└── Storage
    ├── chrome.storage.local (대화, 기억)
    └── IndexedDB (벡터 인덱스)
```

---

## Privacy

**우리는 서버가 없습니다.**

- 모든 데이터는 **브라우저 내부**에만 저장됩니다
- AI 추론은 **Chrome 내장 Gemini Nano**로 로컬에서 실행됩니다
- 임베딩은 **Transformers.js**로 로컬에서 생성됩니다
- 외부 서버로 **어떤 데이터도 전송하지 않습니다**

자세한 내용은 [개인정보처리방침](PRIVACY_POLICY.md)을 참조하세요.

---

## Development

```bash
# 개발 서버 (HMR 지원)
pnpm dev

# 프로덕션 빌드
pnpm build

# 배포용 패키징
pnpm package
```

### 프로젝트 구조

```
src/
├── components/       # React UI 컴포넌트
├── hooks/           # Custom React Hooks
├── lib/             # 유틸리티 함수
├── background.ts    # Service Worker
├── sidepanel.tsx    # 메인 컨테이너
└── types.ts         # TypeScript 타입
```

자세한 개발 가이드는 [CLAUDE.md](CLAUDE.md)를 참조하세요.

---

## Contributing

이슈와 PR을 환영합니다!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Contact

- **Email**: kbc01054575075@gmail.com
- **Issues**: [GitHub Issues](https://github.com/anthropics/memex/issues)

---

<div align="center">

**Memex** - Your Second Brain, Locally.

*Built with Chrome Built-in AI*

</div>
