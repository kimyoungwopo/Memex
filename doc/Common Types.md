# Common Types

> `src/types.ts` - 공통 타입 정의
>
> **API Reference:** https://github.com/webmachinelearning/prompt-api

```typescript
export type Role = "user" | "ai" | "system"

export interface Message {
  id?: string
  role: Role
  text: string
  timestamp?: number
  isThinking?: boolean
}

export type AIStatus = "loading" | "ready" | "downloading" | "error" | "unsupported"

// Chrome Built-in AI Prompt API Types (2026 Spec)
// https://github.com/webmachinelearning/prompt-api

export type LanguageModelAvailability = "available" | "downloadable" | "downloading" | "unavailable"

export interface LanguageModelParams {
  defaultTemperature: number
  maxTemperature: number
  defaultTopK: number
  maxTopK: number
}

export interface LanguageModelPrompt {
  role: "system" | "user" | "assistant"
  content: string | LanguageModelContent[]
  prefix?: boolean // 응답 접두어로 사용 시
}

export interface LanguageModelContent {
  type: "text" | "image" | "audio"
  value: string | Blob | ImageData | ImageBitmap | AudioBuffer | BufferSource
}

export interface LanguageModelExpectedIO {
  type?: "text" | "image" | "audio"
  languages?: string[]
}

export interface LanguageModelTool {
  name: string
  description: string
  inputSchema: object
  execute: (args: unknown) => Promise<unknown>
}

export interface LanguageModelCreateOptions {
  initialPrompts?: LanguageModelPrompt[]
  temperature?: number
  topK?: number
  expectedInputs?: LanguageModelExpectedIO[]
  expectedOutputs?: LanguageModelExpectedIO[]
  tools?: LanguageModelTool[]
  signal?: AbortSignal
  monitor?: (monitor: EventTarget) => void
}

export interface LanguageModelPromptOptions {
  signal?: AbortSignal
  responseConstraint?: object | RegExp
  omitResponseConstraintInput?: boolean
}

export interface LanguageModelSessionInfo {
  inputUsage: number
  inputQuota: number
}

// Phase 2: Vector DB
export interface MemoryParams {
  id: string
  url: string
  title: string
  content: string
  embedding: number[]
  createdAt: number
}
```

## 타입 설명

### AIStatus

AI 모델의 현재 상태를 나타냅니다.

| 값 | 설명 |
|----|------|
| `loading` | 초기화 중 |
| `ready` | 사용 가능 |
| `downloading` | 모델 다운로드 중 |
| `error` | 오류 발생 |
| `unsupported` | 지원하지 않는 환경 |

### LanguageModelAvailability

모델 가용성 상태입니다.

| 값 | 설명 |
|----|------|
| `available` | 즉시 사용 가능 |
| `downloadable` | 다운로드 필요 |
| `downloading` | 다운로드 진행 중 |
| `unavailable` | 사용 불가 |

### LanguageModelPrompt

대화 메시지 형식입니다.

```typescript
// 텍스트 메시지
{ role: "user", content: "안녕하세요" }

// 멀티모달 메시지
{
  role: "user",
  content: [
    { type: "text", value: "이 이미지를 설명해주세요" },
    { type: "image", value: imageBlob }
  ]
}

// 응답 접두어 (모델 응답 유도)
{ role: "assistant", content: "물론이죠! ", prefix: true }
```

### LanguageModelExpectedIO

입출력 타입 및 언어 선언입니다.

```typescript
// 입력: 한국어/영어 텍스트
expectedInputs: [{ type: "text", languages: ["ko", "en"] }]

// 출력: 한국어 텍스트
expectedOutputs: [{ type: "text", languages: ["ko"] }]
```
