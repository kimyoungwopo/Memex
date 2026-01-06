# 지식 그래프 시각화 (Knowledge Graph Visualization)

**날짜:** 2026-01-06
**난이도:** ⭐⭐⭐⭐
**상태:** 완료

## 개요

저장된 기억들을 노드로, 임베딩 유사도를 엣지로 표현하는 인터랙티브 2D 그래프 시각화 기능. "On-Device AI Brain" 컨셉을 시각적으로 완벽하게 표현합니다.

## 기능 상세

### 그래프 노드
- 각 기억이 하나의 노드로 표시
- 태그 기반 색상 구분 (10가지 컬러 팔레트)
- 태그가 많을수록 큰 노드
- 호버 시 글로우 효과
- 클릭 시 원본 페이지 열기

### 그래프 엣지 (연결선)
- 코사인 유사도 기반 연결
- 유사도 임계값 조절 가능 (10%~70%)
- 유사도가 높을수록 두꺼운 선
- 파티클 애니메이션으로 연결 강조

### 인터랙션
- 드래그: 화면 이동
- 스크롤: 확대/축소
- 노드 드래그: 재배치
- 줌 컨트롤 버튼
- 전체 보기 (Fit View)
- 시뮬레이션 재시작

### UI 디자인
- 검은 배경 (`#0f172a`)
- 전체 화면 오버레이
- 우측 상단 범례
- 하단 호버 툴팁 (제목, 요약, 태그, 날짜)

## 추가/수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/components/KnowledgeGraph.tsx` | (신규) 그래프 시각화 컴포넌트 |
| `src/components/MemoryDashboard.tsx` | 그래프 보기 버튼, 상태 관리 추가 |
| `src/lib/vector-db.ts` | `getAllMemoriesWithEmbeddings` 함수 추가 |
| `src/hooks/use-memory.ts` | `getMemoriesWithEmbeddings` 래퍼 추가 |
| `src/sidepanel.tsx` | MemoryDashboard에 prop 전달 |
| `package.json` | react-force-graph-2d 패키지 추가 |

## 코드 예시

### 코사인 유사도 계산
```typescript
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}
```

### 그래프 데이터 생성
```typescript
function buildGraphData(memories: MemoryNode[], threshold: number = 0.3): GraphData {
  const nodes = memories.map((mem) => ({
    id: mem.id,
    name: mem.title,
    color: getNodeColor(mem.tags),
    val: 1 + (mem.tags?.length || 0) * 0.5,
  }))

  const links = []
  for (let i = 0; i < memories.length; i++) {
    for (let j = i + 1; j < memories.length; j++) {
      const similarity = cosineSimilarity(memories[i].embedding, memories[j].embedding)
      if (similarity >= threshold) {
        links.push({ source: memories[i].id, target: memories[j].id, similarity })
      }
    }
  }

  return { nodes, links }
}
```

### ForceGraph2D 사용
```tsx
<ForceGraph2D
  graphData={graphData}
  nodeColor={(node) => node.color}
  linkColor={(link) => `rgba(148, 163, 184, ${link.similarity})`}
  linkWidth={(link) => link.similarity * 3}
  linkDirectionalParticles={2}
  onNodeClick={handleNodeClick}
/>
```

## 사용법 / 시나리오

### 시나리오 1: 지식 탐색
1. [기억] 탭으로 이동
2. **그래프** 버튼 클릭 (보라색)
3. 전체 화면 그래프 열림
4. 연결된 노드들을 탐색하여 관련 기억 발견
5. 노드 클릭으로 원본 페이지 방문

### 시나리오 2: 유사도 조절
1. 그래프 상단의 "연결 강도" 슬라이더 조절
2. 10%: 약한 연결도 표시 (많은 엣지)
3. 70%: 강한 연결만 표시 (핵심 관계)
4. 실시간으로 그래프 업데이트

### 시나리오 3: 지식 클러스터 발견
1. 비슷한 주제의 기억들이 자연스럽게 클러스터 형성
2. 색상으로 태그 기반 그룹 확인
3. 예상치 못한 연결 발견 (세렌디피티)

## 기술 스택

- **react-force-graph-2d**: d3-force 기반 2D 그래프 렌더링
- **Canvas API**: 고성능 노드/엣지 렌더링
- **d3-force**: 물리 시뮬레이션 (척력, 인력)

## 성능 고려사항

- 노드 1000개까지 테스트 완료
- Canvas 기반 렌더링으로 DOM 오버헤드 최소화
- 워밍업/쿨다운 틱 최적화
- 메모이제이션으로 불필요한 재계산 방지
