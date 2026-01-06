/**
 * 애플리케이션 전역 상수
 *
 * 하드코딩된 값을 중앙 집중 관리하여 유지보수성을 높입니다.
 */

// ============ 텍스트 길이 제한 ============

/** 페이지 콘텐츠 최대 길이 (약 2000 토큰) */
export const MAX_PAGE_CONTENT_LENGTH = 8000

/** 세렌디피티/자막 요약용 콘텐츠 길이 */
export const MAX_SERENDIPITY_CONTENT_LENGTH = 3000

/** 태그 생성용 콘텐츠 길이 */
export const MAX_TAG_PROMPT_CONTENT_LENGTH = 1500

/** 기억 저장 시 콘텐츠 최대 길이 */
export const MAX_MEMORY_CONTENT_LENGTH = 10000

/** 회상 쿼리 콘텐츠 길이 */
export const MAX_RECALL_QUERY_LENGTH = 1000

// ============ 타임아웃/딜레이 ============

/** 임베딩 요청 타임아웃 (ms) */
export const EMBEDDING_REQUEST_TIMEOUT = 30000

/** 디바운스 지연 시간 (ms) */
export const DEBOUNCE_DELAY = 500

/** 세렌디피티 디바운스 지연 시간 (ms) */
export const SERENDIPITY_DEBOUNCE_DELAY = 1500

/** 빠른 액션 유효 시간 (ms) */
export const QUICK_ACTION_EXPIRY = 5000

/** YouTube 패널 최대 대기 시간 (ms) */
export const YOUTUBE_PANEL_MAX_WAIT = 15000

/** 폴링 간격 (ms) */
export const POLL_INTERVAL = 500

/** 임베딩 초기화 폴링 간격 (ms) */
export const EMBEDDING_INIT_POLL_INTERVAL = 1000

// ============ 유사도 임계값 ============

/** 세렌디피티 유사도 임계값 (25%) */
export const SIMILARITY_THRESHOLD = 0.25

/** 벡터 검색 기본 임계값 */
export const VECTOR_SEARCH_THRESHOLD = 0.3

/** 하이브리드 검색 기본 임계값 */
export const DEFAULT_SEARCH_THRESHOLD = 0.5

// ============ 검색 가중치 ============

/** 벡터 검색 가중치 */
export const VECTOR_SEARCH_WEIGHT = 0.7

/** 키워드 검색 가중치 */
export const KEYWORD_SEARCH_WEIGHT = 0.3

// ============ 쿼리 제한 ============

/** 메모리 쿼리 기본 제한 */
export const MEMORY_QUERY_LIMIT = 1000

/** 백업/내보내기 제한 */
export const BACKUP_EXPORT_LIMIT = 10000

// ============ PDF 처리 ============

/** PDF 최대 페이지 수 */
export const MAX_PDF_PAGES = 50

// ============ 임베딩 ============

/** 임베딩 청크 크기 */
export const EMBEDDING_CHUNK_SIZE = 500

// ============ 지식 그래프 ============

/** 그래프 기본 유사도 임계값 */
export const GRAPH_DEFAULT_SIMILARITY_THRESHOLD = 0.15

/** 그래프 유사도 최소값 */
export const GRAPH_SIMILARITY_MIN = 0.05

/** 그래프 유사도 최대값 */
export const GRAPH_SIMILARITY_MAX = 0.7

// ============ UI ============

/** 세렌디피티 배너 최대 표시 개수 */
export const MAX_SERENDIPITY_DISPLAY = 3

/** 관련 기억 검색 개수 */
export const RELATED_MEMORIES_LIMIT = 5

/** 이미지 압축 품질 */
export const IMAGE_COMPRESSION_QUALITY = 0.85

// ============ 모델 ============

/** Gemini Nano 예상 크기 (bytes) */
export const GEMINI_NANO_SIZE_ESTIMATE = 1500000000 // ~1.5GB
