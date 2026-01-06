/**
 * Knowledge Graph - 지식 그래프 시각화
 *
 * 저장된 기억들을 노드로, 임베딩 유사도를 엣지로 표현하는
 * 인터랙티브 그래프 시각화 컴포넌트
 */

import { useRef, useEffect, useState, useCallback, useMemo } from "react"
import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d"
import { X, ZoomIn, ZoomOut, Maximize2, RefreshCw } from "lucide-react"

interface MemoryNode {
  id: string
  url: string
  title: string
  summary: string
  tags: string[]
  createdAt: number
  embedding?: number[]
}

interface GraphNode {
  id: string
  name: string
  url: string
  summary: string
  tags: string[]
  val: number // node size
  color: string
  createdAt: number
}

interface GraphLink {
  source: string
  target: string
  similarity: number
}

interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

interface KnowledgeGraphProps {
  memories: MemoryNode[]
  isOpen: boolean
  onClose: () => void
  onNodeClick?: (memory: MemoryNode) => void
}

// 코사인 유사도 계산
function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  if (normA === 0 || normB === 0) return 0
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

// 태그 기반 색상 생성
function getNodeColor(tags: string[]): string {
  const colorPalette = [
    "#6366f1", // indigo
    "#8b5cf6", // violet
    "#ec4899", // pink
    "#f43f5e", // rose
    "#f97316", // orange
    "#eab308", // yellow
    "#22c55e", // green
    "#14b8a6", // teal
    "#06b6d4", // cyan
    "#3b82f6", // blue
  ]

  if (!tags || tags.length === 0) return colorPalette[0]

  // 첫 번째 태그의 해시값으로 색상 선택
  const hash = tags[0].split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return colorPalette[hash % colorPalette.length]
}

// 그래프 데이터 생성
function buildGraphData(memories: MemoryNode[], similarityThreshold: number = 0.3): GraphData {
  const nodes: GraphNode[] = memories.map((mem) => ({
    id: mem.id,
    name: mem.title.length > 30 ? mem.title.slice(0, 30) + "..." : mem.title,
    url: mem.url,
    summary: mem.summary,
    tags: mem.tags || [],
    val: 1 + (mem.tags?.length || 0) * 0.5, // 태그가 많을수록 큰 노드
    color: getNodeColor(mem.tags || []),
    createdAt: mem.createdAt,
  }))

  const links: GraphLink[] = []

  // 모든 메모리 쌍에 대해 유사도 계산
  for (let i = 0; i < memories.length; i++) {
    for (let j = i + 1; j < memories.length; j++) {
      const memA = memories[i]
      const memB = memories[j]

      if (!memA.embedding || !memB.embedding) continue

      const similarity = cosineSimilarity(memA.embedding, memB.embedding)

      // 임계값 이상인 경우만 연결
      if (similarity >= similarityThreshold) {
        links.push({
          source: memA.id,
          target: memB.id,
          similarity,
        })
      }
    }
  }

  return { nodes, links }
}

export function KnowledgeGraph({ memories, isOpen, onClose, onNodeClick }: KnowledgeGraphProps) {
  const graphRef = useRef<ForceGraphMethods>()
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 400, height: 500 })
  const [similarityThreshold, setSimilarityThreshold] = useState(0.15)
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null)

  // 그래프 데이터 메모이제이션
  const graphData = useMemo(() => {
    // 디버깅: 임베딩 상태 확인
    const memoriesWithEmbeddings = memories.filter(m => m.embedding && m.embedding.length > 0)
    console.log(`[KnowledgeGraph] Total memories: ${memories.length}, With embeddings: ${memoriesWithEmbeddings.length}`)

    if (memoriesWithEmbeddings.length > 0) {
      console.log(`[KnowledgeGraph] Sample embedding length: ${memoriesWithEmbeddings[0].embedding?.length}`)
    }

    const data = buildGraphData(memories, similarityThreshold)
    console.log(`[KnowledgeGraph] Nodes: ${data.nodes.length}, Links: ${data.links.length}, Threshold: ${similarityThreshold}`)

    // 유사도 분포 확인
    if (data.links.length > 0) {
      const similarities = data.links.map(l => l.similarity)
      console.log(`[KnowledgeGraph] Similarity range: ${Math.min(...similarities).toFixed(3)} ~ ${Math.max(...similarities).toFixed(3)}`)
    }

    return data
  }, [memories, similarityThreshold])

  // 컨테이너 크기 감지
  useEffect(() => {
    if (!containerRef.current || !isOpen) return

    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setDimensions({
          width: rect.width,
          height: rect.height - 60, // 헤더 높이 제외
        })
      }
    }

    updateSize()
    window.addEventListener("resize", updateSize)
    return () => window.removeEventListener("resize", updateSize)
  }, [isOpen])

  // 줌 컨트롤
  const handleZoomIn = useCallback(() => {
    graphRef.current?.zoom(1.5, 400)
  }, [])

  const handleZoomOut = useCallback(() => {
    graphRef.current?.zoom(0.67, 400)
  }, [])

  const handleFitView = useCallback(() => {
    graphRef.current?.zoomToFit(400, 50)
  }, [])

  const handleRefresh = useCallback(() => {
    graphRef.current?.d3ReheatSimulation()
  }, [])

  // 노드 클릭 핸들러
  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      const memory = memories.find((m) => m.id === node.id)
      if (memory && onNodeClick) {
        onNodeClick(memory)
      } else if (node.url) {
        window.open(node.url, "_blank")
      }
    },
    [memories, onNodeClick]
  )

  // 노드 호버 핸들러
  const handleNodeHover = useCallback((node: GraphNode | null) => {
    setHoveredNode(node)
  }, [])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/95 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🕸️</span>
          <div>
            <h2 className="text-white font-bold text-lg">Knowledge Graph</h2>
            <p className="text-slate-400 text-xs">
              {graphData.nodes.length}개 노드 • {graphData.links.length}개 연결
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 유사도 임계값 슬라이더 */}
          <div className="flex items-center gap-2 mr-4">
            <span className="text-slate-400 text-xs">연결 강도:</span>
            <input
              type="range"
              min="0.05"
              max="0.7"
              step="0.05"
              value={similarityThreshold}
              onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))}
              className="w-24 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-slate-300 text-xs w-8">{Math.round(similarityThreshold * 100)}%</span>
          </div>

          {/* 줌 컨트롤 */}
          <button
            onClick={handleZoomIn}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            title="확대"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            title="축소"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleFitView}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            title="전체 보기"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleRefresh}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            title="재배치"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* 닫기 */}
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors ml-2"
            title="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Graph Container */}
      <div ref={containerRef} className="flex-1 relative">
        {graphData.nodes.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <span className="text-6xl mb-4 block">🧠</span>
              <p className="text-slate-400 text-lg">저장된 기억이 없습니다</p>
              <p className="text-slate-500 text-sm mt-2">
                페이지를 읽고 "기억하기" 버튼을 눌러 기억을 추가하세요
              </p>
            </div>
          </div>
        ) : (
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor="#0f172a"
            // 노드 스타일
            nodeLabel={(node: any) => `${node.name}\n${node.summary || ""}`}
            nodeColor={(node: any) => node.color}
            nodeRelSize={6}
            nodeVal={(node: any) => node.val}
            // 링크 스타일
            linkColor={(link: any) => {
              const alpha = Math.min(0.8, link.similarity)
              return `rgba(148, 163, 184, ${alpha})`
            }}
            linkWidth={(link: any) => link.similarity * 3}
            linkDirectionalParticles={2}
            linkDirectionalParticleWidth={(link: any) => link.similarity * 2}
            linkDirectionalParticleSpeed={0.005}
            // 인터랙션
            onNodeClick={handleNodeClick}
            onNodeHover={handleNodeHover}
            // 시뮬레이션 설정
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
            warmupTicks={100}
            cooldownTicks={200}
            // 노드 캔버스 커스터마이징
            nodeCanvasObject={(node: any, ctx, globalScale) => {
              const label = node.name
              const fontSize = 12 / globalScale
              const nodeSize = node.val * 3

              // 노드 원
              ctx.beginPath()
              ctx.arc(node.x, node.y, nodeSize, 0, 2 * Math.PI)
              ctx.fillStyle = node.color
              ctx.fill()

              // 호버 시 글로우 효과
              if (hoveredNode?.id === node.id) {
                ctx.strokeStyle = "#fff"
                ctx.lineWidth = 2 / globalScale
                ctx.stroke()
              }

              // 라벨 (줌 레벨에 따라 표시)
              if (globalScale > 0.8) {
                ctx.font = `${fontSize}px Sans-Serif`
                ctx.textAlign = "center"
                ctx.textBaseline = "middle"
                ctx.fillStyle = "#e2e8f0"
                ctx.fillText(label, node.x, node.y + nodeSize + fontSize)
              }
            }}
          />
        )}

        {/* 호버 툴팁 */}
        {hoveredNode && (
          <div className="absolute bottom-4 left-4 right-4 bg-slate-800 border border-slate-600 rounded-lg p-3 max-w-md">
            <h3 className="text-white font-medium text-sm truncate">{hoveredNode.name}</h3>
            {hoveredNode.summary && (
              <p className="text-slate-400 text-xs mt-1 line-clamp-2">{hoveredNode.summary}</p>
            )}
            {hoveredNode.tags && hoveredNode.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {hoveredNode.tags.slice(0, 5).map((tag, i) => (
                  <span
                    key={i}
                    className="px-1.5 py-0.5 bg-slate-700 text-slate-300 text-[10px] rounded"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
            <p className="text-slate-500 text-[10px] mt-2">
              {new Date(hoveredNode.createdAt).toLocaleDateString("ko-KR")} 저장
            </p>
          </div>
        )}

        {/* 범례 */}
        <div className="absolute top-4 right-4 bg-slate-800/80 border border-slate-700 rounded-lg p-3">
          <p className="text-slate-300 text-xs font-medium mb-2">💡 사용법</p>
          <ul className="text-slate-400 text-[10px] space-y-1">
            <li>• 드래그: 화면 이동</li>
            <li>• 스크롤: 확대/축소</li>
            <li>• 노드 클릭: 페이지 열기</li>
            <li>• 선: 유사한 기억 연결</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
