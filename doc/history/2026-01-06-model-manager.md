# 스마트 온보딩 & 모델 관리자 (Model Manager UI)

**날짜:** 2026-01-06
**난이도:** ⭐⭐⭐⭐
**상태:** 완료

## 개요

사용자가 설치하자마자 1.5GB AI 모델을 다운받아야 하는 Cold Start 문제를 해결하기 위한 친절한 온보딩 UI. 기술이 아무리 좋아도 진입 장벽을 넘지 못하면 실패한 제품이 됩니다.

## 기능 상세

### 1. Welcome Page (환영 페이지)
- 첫 설치 시 자동으로 표시되는 온보딩 페이지
- 제품 소개 및 핵심 기능 설명
- "AI 두뇌 설치하기" 버튼으로 모델 다운로드 시작
- 그라데이션 배경과 애니메이션으로 세련된 UX

### 2. Model Manager (모델 관리자)
- **프로그레스 바**: "AI 두뇌를 심는 중입니다... (35%)" 형태의 예쁜 진행률 표시
- **원형 프로그레스**: 상태 아이콘 주변에 원형 진행률 표시
- **다운로드 크기 표시**: "523.4 MB / 1.5 GB" 형태로 상세 정보 제공
- **상태 배지**: checking | downloading | ready | error | unsupported

### 3. Hardware Check (하드웨어 체크)
- **WebGPU 지원 확인**: GPU 어댑터 정보 및 지원 여부 검사
- **Chrome AI API 확인**: LanguageModel.availability() 호출로 상태 확인
- **브라우저 버전 확인**: Chrome 131+ 필요, Canary/Dev 권장
- **해결 방법 안내**: 요구사항 미충족 시 구체적인 해결 방법 제시

### 4. 모델 재설치 기능
- 설정 패널에서 "모델 다시 다운로드" 버튼 제공
- 모델 파일이 깨졌을 때를 대비한 복구 기능
- 컴팩트 UI로 설정 페이지에 자연스럽게 통합

## 추가/수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/lib/hardware-check.ts` | (신규) WebGPU/Chrome AI 하드웨어 체크 유틸리티 |
| `src/components/ModelManager.tsx` | (신규) 모델 상태 관리 및 프로그레스 UI 컴포넌트 |
| `src/components/WelcomePage.tsx` | (신규) 온보딩 환영 페이지 컴포넌트 |
| `src/components/SettingsPanel.tsx` | ModelManager 컴팩트 모드 추가 |
| `src/sidepanel.tsx` | 온보딩 로직 통합, WelcomePage 조건부 렌더링 |

## 코드 예시

### 하드웨어 체크
```typescript
export async function performHardwareCheck(): Promise<HardwareCheckResult> {
  const [webGPU, chromeAI] = await Promise.all([
    checkWebGPU(),
    checkChromeAI(),
  ])
  const browser = checkBrowser()

  return {
    webGPU,      // { supported: boolean, adapterInfo?, error? }
    chromeAI,    // { available: boolean, status: "readily" | "after-download" | "no" }
    browser,     // { isChrome: boolean, version: number, isCanaryOrDev: boolean }
    overall: {
      ready: boolean,
      message: string,
      suggestions: string[],
    },
  }
}
```

### 다운로드 진행률 모니터링
```typescript
const session = await LanguageModel.create({
  monitor: (monitor) => {
    monitor.addEventListener("downloadprogress", (e) => {
      setProgress({
        loaded: e.loaded,
        total: e.total || 1500000000,
        percentage: Math.round((e.loaded / e.total) * 100),
      })
    })
  },
})
```

### 온보딩 상태 관리
```typescript
// 온보딩 완료 여부 확인
const stored = await chrome.storage.local.get(ONBOARDING_COMPLETE_KEY)
const isOnboardingComplete = stored[ONBOARDING_COMPLETE_KEY] === true

if (!isOnboardingComplete) {
  setShowOnboarding(true)
} else {
  // 모델 다운로드 필요 여부 추가 확인
  const availability = await LanguageModel.availability()
  if (availability === "after-download") {
    setShowOnboarding(true)
  }
}
```

## 사용법 / 시나리오

### 시나리오 1: 첫 설치
1. 확장 프로그램 설치 후 사이드 패널 열기
2. Welcome Page가 자동으로 표시됨
3. "AI 두뇌 설치하기" 버튼 클릭
4. 하드웨어 체크 수행 → 문제 없으면 다운로드 시작
5. 프로그레스 바로 진행률 확인
6. 다운로드 완료 후 "AI 준비 완료" 메시지
7. 메인 채팅 화면으로 자동 전환

### 시나리오 2: 하드웨어 미지원
1. Welcome Page에서 "AI 두뇌 설치하기" 클릭
2. 하드웨어 체크 실패 시 경고 화면 표시
3. "해결 방법" 섹션에서 구체적인 안내 제공:
   - Chrome 버전 업데이트 방법
   - chrome://flags 활성화 방법
   - GPU 드라이버 업데이트 안내
4. "다시 시도" 버튼으로 재확인 가능

### 시나리오 3: 모델 재설치
1. 설정 탭으로 이동
2. "AI 모델" 섹션에서 현재 상태 확인
3. "모델 다시 다운로드" 버튼 클릭
4. 프로그레스 표시 후 완료

## UI 디자인

### Welcome Page
- **배경**: 그라데이션 (slate-900 → indigo-950 → slate-900)
- **히어로**: 큰 타이틀 + 보라색 그라데이션 텍스트
- **기능 카드**: 3개 열 그리드 (프라이버시, 오프라인, 지식베이스)
- **CTA 버튼**: 그라데이션 버튼 + 호버 애니메이션

### Model Manager
- **상태 아이콘**: 원형 배경 + 아이콘 (checking: 로딩, downloading: 다운로드, ready: 체크)
- **프로그레스 바**: 가로형 + 그라데이션 (indigo → purple)
- **원형 프로그레스**: SVG 기반 stroke-dasharray 애니메이션
- **시스템 정보**: 확장 가능한 세부 정보 패널

### 컴팩트 모드 (설정용)
- 최소화된 UI로 설정 패널에 자연스럽게 통합
- 상태 배지 + 재다운로드 버튼
- GPU 정보 한 줄 표시

## 성능 고려사항

- 온보딩 체크는 사이드 패널 로드 시 한 번만 실행
- 하드웨어 체크는 병렬로 수행 (WebGPU + Chrome AI 동시)
- 프로그레스 업데이트는 requestAnimationFrame 수준의 부드러움
- 다운로드 완료 후 세션 즉시 destroy하여 메모리 해제
