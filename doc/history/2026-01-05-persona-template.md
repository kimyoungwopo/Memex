# 페르소나 템플릿 (Persona Switcher)

**날짜:** 2026-01-05
**난이도:** ⭐⭐
**상태:** 완료

## 개요

AI의 역할/성격을 사전 정의된 템플릿으로 전환. 용도에 맞는 최적화된 응답 제공.

## 지원 페르소나

| ID | 이름 | 아이콘 | 설명 |
|----|------|--------|------|
| `default` | 기본 | 🧠 | 일반적인 AI 어시스턴트 |
| `translator` | 번역가 | 🌐 | 다국어 번역 전문가 |
| `code-reviewer` | 코드 리뷰어 | 👨‍💻 | 시니어 개발자 관점 리뷰 |
| `summarizer` | 요약 전문가 | 📝 | 핵심만 뽑아내는 요약 |
| `teacher` | 선생님 | 👩‍🏫 | 쉽게 설명해주는 선생님 |

## 추가/수정 파일

- `src/components/PersonaSelector.tsx` - NEW: 페르소나 선택 드롭다운
- `src/types.ts` - Persona 인터페이스 및 PERSONAS 배열
- `src/sidepanel.tsx` - 페르소나 상태 관리

## 코드 예시

```typescript
// types.ts
export interface Persona {
  id: string
  name: string
  icon: string
  description: string
  systemPrompt: string
}

export const PERSONAS: Persona[] = [
  {
    id: "default",
    name: "기본",
    icon: "🧠",
    description: "일반적인 AI 어시스턴트",
    systemPrompt: "당신은 'Memex'라는 이름의 유능한 로컬 AI 비서입니다..."
  },
  // ...
]

// PersonaSelector.tsx
export function PersonaSelector({
  personas,
  selected,
  onSelect
}: Props) {
  return (
    <select onChange={(e) => onSelect(e.target.value)}>
      {personas.map((p) => (
        <option key={p.id} value={p.id}>
          {p.icon} {p.name}
        </option>
      ))}
    </select>
  )
}
```

## 동작 방식

1. 헤더 드롭다운에서 페르소나 선택
2. 선택된 페르소나의 `systemPrompt`가 프롬프트 앞에 추가
3. 세션과 함께 저장되어 대화 복원 시 유지
