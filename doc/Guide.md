# 🚀 Memex Local 실행 가이드

> 환경 설정(Chrome Flags)을 완료했다면, 다음 단계로 바로 실행할 수 있습니다.

## 1. 프로젝트 생성 및 설정

터미널에서 다음 명령어를 순서대로 실행하세요.

```bash
# 1. Plasmo 프로젝트 생성 (React + Tailwind 선택)
pnpm create plasmo --with-tailwindcss

# 2. 프로젝트 폴더로 이동
cd memex-local

# 3. 제공된 코드 파일 덮어쓰기
# (package.json, src/hooks/use-gemini.ts, src/sidepanel.tsx 등을 해당 위치에 생성/덮어쓰기)

# 4. 의존성 설치
pnpm install
```

## 2. 개발 서버 실행

```bash
pnpm dev
```

## 3. Chrome에 로드하기

1. **Chrome Canary**를 엽니다.
2. `chrome://extensions` 로 이동합니다.
3. 우측 상단 **'개발자 모드(Developer mode)'**를 켭니다.
4. **'압축해제된 확장 프로그램을 로드합니다(Load unpacked)'** 버튼을 클릭합니다.
5. `memex-local/build/chrome-mv3-dev` 폴더를 선택합니다.

## 4. 사용하기

1. 브라우저 우측 상단 퍼즐 아이콘을 눌러 **Memex를 고정**합니다.
2. 아이콘을 누르거나 `Cmd+B`를 눌러 사이드 패널을 엽니다.
3. **"ONLINE"** 상태가 뜨면 AI와 대화를 시작하세요!
