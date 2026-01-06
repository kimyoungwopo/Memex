# 메모리 백업 및 복원 (Memory Backup & Restore)

**날짜:** 2026-01-05
**난이도:** ⭐⭐⭐
**상태:** 완료

## 개요

저장된 기억(벡터 데이터)을 JSON 파일로 백업하고 복원하는 기능. 컴퓨터 교체, 브라우저 초기화 등의 상황에서 데이터 손실을 방지합니다.

## 기능 상세

### 1. 백업 내보내기 (Export)
- 모든 기억 데이터를 JSON 파일로 다운로드
- 포함 데이터: URL, 제목, 내용, 요약, 태그, 임베딩 벡터
- 파일명 형식: `memex-backup-YYYY-MM-DD.json`
- Blob 다운로드 방식 사용

### 2. 백업 복원 (Import)
- JSON 백업 파일 선택하여 복원
- 복원 모드 선택:
  - **대체(Replace)**: 기존 데이터 삭제 후 백업으로 대체
  - **병합(Merge)**: 기존 데이터 유지, 중복 URL 건너뜀
- 버전 호환성 검증 (`version: 1`)

### 3. 전체 삭제 (Clear All)
- 모든 기억 데이터 삭제
- confirm 다이얼로그로 실수 방지
- 삭제 전 백업 권장 안내

### 4. 저장소 현황 표시
- 현재 저장된 기억 개수 실시간 표시

## 추가/수정 파일

| 파일 | 역할 |
|------|------|
| `src/lib/vector-db.ts` | 백업/복원 핵심 로직 (`exportMemories`, `importMemories`, `downloadBackup`) |
| `src/components/SettingsPanel.tsx` | 설정 UI 패널 (백업/복원/삭제 버튼) |

## 코드 예시

### 백업 데이터 타입
```typescript
// src/lib/vector-db.ts
export interface MemoryBackupItem {
  id: string
  url: string
  title: string
  content: string
  summary: string
  tags: string[]
  embedding: number[]  // 384차원 벡터
  createdAt: number
}

export interface MemoryBackup {
  version: 1
  exportedAt: number
  memoryCount: number
  memories: MemoryBackupItem[]
}
```

### 백업 내보내기
```typescript
// src/lib/vector-db.ts
export async function exportMemories(): Promise<MemoryBackup> {
  const database = await initVectorDB()

  const results = await search(database, {
    term: "",
    limit: 10000,
    includeVectors: true,  // 임베딩 벡터 포함
  })

  const memories = results.hits.map((hit) => ({
    id: hit.document.id,
    url: hit.document.url,
    title: hit.document.title,
    content: hit.document.content,
    summary: hit.document.summary,
    tags: hit.document.tags || [],
    embedding: hit.document.embedding as number[],
    createdAt: hit.document.createdAt,
  }))

  return {
    version: 1,
    exportedAt: Date.now(),
    memoryCount: memories.length,
    memories,
  }
}
```

### 백업 복원
```typescript
// src/lib/vector-db.ts
export async function importMemories(
  backup: MemoryBackup,
  mode: "replace" | "merge" = "merge"
): Promise<{ success: boolean; imported: number; skipped: number; message: string }> {
  // 버전 확인
  if (backup.version !== 1) {
    return { success: false, imported: 0, skipped: 0, message: "지원하지 않는 백업 버전" }
  }

  if (mode === "replace") {
    await clearAllMemories()
  }

  // 기존 URL 목록 조회 (중복 체크용)
  const existingUrls = new Set(/* ... */)

  let imported = 0
  let skipped = 0

  for (const memory of backup.memories) {
    if (mode === "merge" && existingUrls.has(memory.url)) {
      skipped++
      continue
    }
    await addMemory(memory)
    imported++
  }

  return { success: true, imported, skipped, message: `${imported}개 복원, ${skipped}개 건너뜀` }
}
```

### 파일 다운로드
```typescript
// src/lib/vector-db.ts
export function downloadBackup(backup: MemoryBackup): void {
  const json = JSON.stringify(backup, null, 2)
  const blob = new Blob([json], { type: "application/json" })
  const url = URL.createObjectURL(blob)

  const date = new Date().toISOString().split("T")[0]
  const a = document.createElement("a")
  a.href = url
  a.download = `memex-backup-${date}.json`
  a.click()

  URL.revokeObjectURL(url)
}
```

## 사용법 / 시나리오

### 백업하기
1. 사이드 패널 하단의 "설정" 탭 클릭
2. "내 기억 백업하기 (.json)" 버튼 클릭
3. `memex-backup-2026-01-05.json` 파일 자동 다운로드

### 복원하기
1. 설정 탭에서 "백업에서 복원하기" 버튼 클릭
2. 백업 JSON 파일 선택
3. 기존 데이터가 있으면 복원 모드 선택
   - [확인] → 기존 데이터 삭제 후 백업으로 대체
   - [취소] → 기존 데이터에 백업 추가 (중복 URL 건너뜀)
4. 복원 완료 메시지 확인

### 전체 삭제
1. 설정 탭의 "위험 구역"에서 "모든 기억 삭제" 버튼 클릭
2. 확인 다이얼로그에서 [확인] 클릭
3. 모든 기억이 삭제됨

## UI 구성

```
┌─ 설정 ─────────────────────┐
│                            │
│ ┌─ 저장소 현황 ──────────┐ │
│ │ 저장된 기억: 42개      │ │
│ └────────────────────────┘ │
│                            │
│ ┌─ 데이터 백업 ──────────┐ │
│ │ [📥 내 기억 백업하기]  │ │
│ │ [📤 백업에서 복원하기] │ │
│ │ ℹ️ 백업 파일에는 ...   │ │
│ └────────────────────────┘ │
│                            │
│ ┌─ 위험 구역 ────────────┐ │
│ │ [🗑️ 모든 기억 삭제]   │ │
│ └────────────────────────┘ │
└────────────────────────────┘
```

## 기술적 고려사항

### 임베딩 벡터 포함
백업 파일에 384차원 임베딩 벡터를 포함하여, 복원 시 재계산 없이 바로 사용 가능합니다. 단, 파일 크기가 커질 수 있습니다.

### 대용량 데이터 처리
- 최대 10,000개 기억까지 한 번에 백업
- 복원 시 개별 insert로 처리 (메모리 효율성)
