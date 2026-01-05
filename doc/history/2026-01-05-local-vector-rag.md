# 로컬 벡터 RAG (Local Vector RAG)

**날짜:** 2026-01-05
**난이도:** ⭐⭐⭐⭐⭐
**상태:** 완료

## 개요

과거에 저장한 페이지를 기억하고, 질문 시 관련 기억을 자동으로 찾아 답변에 활용하는 RAG(Retrieval-Augmented Generation) 시스템.

- **기억하기**: 현재 페이지를 벡터로 변환하여 로컬 DB에 저장
- **회상하기**: 질문과 관련된 과거 기억을 검색하여 AI 응답에 활용

## 기술 스택

| 기술 | 용도 |
|------|------|
| Transformers.js | 텍스트 → 벡터 임베딩 (all-MiniLM-L6-v2) |
| Orama 2.0 | 벡터 저장 + 시맨틱 검색 |
| chrome.storage.local | DB 영속화 |

## 아키텍처

```
사용자 질문
    │
    ▼
┌───────────────────────────────────────┐
│         Query Embedding               │
│   (Transformers.js → 384차원 벡터)    │
└───────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────┐
│         Hybrid Search                 │
│   (Vector 70% + Keyword 30%)          │
└───────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────┐
│       Top-K Relevant Memories         │
│   (유사도 기반 상위 3개 문서)          │
└───────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────┐
│         Prompt Augmentation           │
│   ([관련 기억] 컨텍스트로 추가)        │
└───────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────┐
│         Gemini Nano Response          │
│   (기억 기반 맞춤 응답 생성)           │
└───────────────────────────────────────┘
```

## 아키텍처 (Sandbox Iframe 패턴)

Chrome Extension CSP 제한으로 인해 WASM 기반 Transformers.js를 직접 실행할 수 없습니다.
이를 우회하기 위해 **Sandboxed iframe** 패턴을 사용합니다.

```
┌─────────────────────────────────────────────────────────────┐
│                    SidePanel (React)                         │
│                                                              │
│   ┌──────────────────────────────────────────────────────┐   │
│   │  "기억하기" 버튼 클릭                                  │   │
│   └──────────────────────────────────────────────────────┘   │
│                           │                                   │
│                    postMessage                                │
│                           │                                   │
│   ┌──────────────────────────────────────────────────────┐   │
│   │  Sandbox iframe (assets/sandbox.html)                │   │
│   │  ─────────────────────────────────────────────────   │   │
│   │  • CDN에서 Transformers.js 로드                       │   │
│   │  • WebAssembly 실행 가능 (sandbox CSP)               │   │
│   │  • 임베딩 생성 후 postMessage로 결과 전달            │   │
│   └──────────────────────────────────────────────────────┘   │
│                           │                                   │
│                    postMessage (embedding[384])               │
│                           │                                   │
│   ┌──────────────────────────────────────────────────────┐   │
│   │  Orama DB (chrome.storage.local)                     │   │
│   │  벡터 저장 및 검색                                     │   │
│   └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 핵심 해결책

1. **Sandbox CSP**: `sandbox` CSP는 `extension_pages`보다 유연하여 CDN 스크립트 로드 가능
2. **iframe 격리**: 별도 컨텍스트에서 WASM 실행, 메인 UI 블로킹 방지
3. **postMessage 통신**: iframe과 비동기 메시지 교환

## 추가 파일

| 파일 | 설명 |
|------|------|
| `assets/sandbox.html` | Transformers.js 실행용 샌드박스 페이지 |
| `src/lib/embedding-client.ts` | Sandbox iframe과 통신하는 클라이언트 |
| `src/lib/vector-db.ts` | Orama 벡터 DB 모듈 |
| `src/hooks/use-memory.ts` | RAG 파이프라인 통합 훅 |
| `src/components/MemoryPanel.tsx` | 기억 목록 UI 패널 |

## 수정 파일

- `src/sidepanel.tsx` - 기억하기/회상하기 기능 통합
- `src/style.css` - 애니메이션 추가
- `package.json` - @xenova/transformers 의존성 추가

## 코드 예시

### 임베딩 생성

```typescript
// embeddings.ts
import { pipeline } from "@xenova/transformers"

const pipe = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2")
const output = await pipe(text, { pooling: "mean", normalize: true })
const embedding = Array.from(output.data) // 384차원 벡터
```

### 벡터 검색

```typescript
// vector-db.ts
import { search } from "@orama/orama"

const results = await search(db, {
  mode: "vector",
  vector: {
    value: queryEmbedding,
    property: "embedding",
  },
  similarity: 0.5,
  limit: 5,
})
```

### 하이브리드 검색

```typescript
// use-memory.ts
const [vectorResults, keywordResults] = await Promise.all([
  searchMemories(queryEmbedding, limit, 0.3),
  searchByKeyword(query, limit),
])

// 점수 병합: Vector 70% + Keyword 30%
for (const result of vectorResults) {
  scoreMap.set(result.id, { ...result, score: result.score * 0.7 })
}
for (const result of keywordResults) {
  existing.score += result.score * 0.3
}
```

## 사용법

### 페이지 기억하기

1. 웹 페이지 방문
2. "페이지 읽기" 버튼 클릭
3. "기억하기" 버튼 클릭
4. 임베딩 생성 후 DB에 저장됨

### 기억 회상하기

1. 질문 입력 (예: "아까 그 리액트 에러 해결법 뭐였지?")
2. 자동으로 관련 기억 검색
3. 기억 컨텍스트가 프롬프트에 포함됨
4. AI가 과거 기억을 참고하여 답변

### 기억 관리

- "저장된 기억" 버튼으로 목록 확인
- 개별 삭제 또는 전체 삭제 가능

## 데이터 모델

```typescript
// Orama 스키마
{
  id: "string",
  url: "string",
  title: "string",
  content: "string",
  summary: "string",
  embedding: "vector[384]",
  createdAt: "number",
}
```

## 성능 최적화

- **텍스트 청킹**: 500자 단위로 분할, 50자 오버랩
- **평균 임베딩**: 청크별 임베딩의 평균으로 문서 대표 벡터 생성
- **하이브리드 검색**: 벡터 + 키워드 검색 병행으로 정확도 향상
- **DB 영속화**: chrome.storage.local에 직렬화하여 저장

## 한계점

- 첫 임베딩 모델 로딩에 시간 소요 (~1.5GB 모델)
- 저장 용량 제한 (chrome.storage.local 한도)
- Gemini Nano 컨텍스트 윈도우 제한
