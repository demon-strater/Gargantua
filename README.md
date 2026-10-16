# Gargantua

영화 '인터스텔라'의 가르강튀아를 모티프로, 브라우저에서 실시간 레이마칭으로 그리는 시네마틱 블랙홀 탐사 사이트입니다.
스크롤하면 카메라가 블랙홀로 서서히 빨려 들어가고, 마우스를 움직이면 궤도가 부드럽게 따라 움직입니다.

- **중력 렌즈** — 픽셀마다 슈바르츠실트 시공간의 광자 측지선(`a = -1.5·h²·x/r⁵`)을 적분해, 원반 뒷면이 블랙홀 위아래로 감겨 보이고 광자 고리와 은하수가 함께 휘어집니다.
- **강착 원반** — 케플러 차등 회전으로 흐르는 FBM 노이즈. flow-map 교차 페이드로 무늬가 무한히 감기지 않고 계속 소용돌이칩니다.
- **도플러 빔 + 중력 적색편이** — 다가오는 쪽은 청색 편이·밝게(I ∝ g³), 멀어지는 쪽은 적색 편이·어둡게. 흑체 색온도로 색을 계산합니다.
- **사건의 지평선** — r < 1 Rs에 들어간 광선은 완전히 흡수됩니다.
- **스케일감** — 기울어진 궤도로 공전하는 작은 행성 실루엣(광선 적분 안에서 함께 렌즈 효과를 받음), 카메라 앞을 떠다니는 성간 먼지 파티클.
- **후보정** — Bloom, ACES 톤매핑, 렌즈 색수차, 필름 그레인, 비네트 (`@react-three/postprocessing`).
- **성능** — drei `PerformanceMonitor`가 FPS를 보며 렌더 해상도(DPR, 화면 크기별 픽셀 예산)와 셰이더 품질(적분 스텝·노이즈 옥타브·파티클 수)을 함께 조절합니다. 모바일·내장 GPU는 낮은 단계에서 시작합니다.

## 실행

Node.js 20.19 이상(권장 22)이 필요합니다.

```bash
npm install        # 의존성 설치 (처음 한 번)
npm run dev        # 개발 서버 → http://127.0.0.1:8010
npm run build      # 타입 검사 + 프로덕션 빌드 → dist/
npm run preview    # 빌드 결과 미리보기
```

Windows에서는 `START-LAB.ps1`을 실행하면 개발 서버를 띄우고 브라우저를 엽니다.

처음부터 같은 구성을 만들 때 설치한 패키지는 다음과 같습니다.

```bash
npm install react react-dom three @react-three/fiber @react-three/drei @react-three/postprocessing postprocessing gsap
npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom @types/three
```

## 구조

```
index.html                     Vite 진입점 (폰트, 파비콘)
src/
  main.tsx, App.tsx            고정된 3D 무대 + 스크롤 오버레이
  shaders/blackhole.frag.glsl  블랙홀·원반·행성·은하수 레이마처 (핵심)
  shaders/blackhole.vert.glsl  화면 전체 사각형
  scene/Experience.tsx         R3F Canvas 구성
  scene/BlackHole.tsx          셰이더 유니폼 갱신, 행성 궤도
  scene/CameraRig.tsx          스크롤 + 마우스 패럴랙스 + 자동 공전 카메라
  scene/StarDust.tsx           성간 먼지 파티클
  scene/AdaptiveQuality.tsx    FPS 기반 해상도/품질 스케일링
  scene/Effects.tsx            후보정 체인
  ui/Overlay.tsx               인트로, 칼 세이건 인용, 챕터, HUD, 물리 토글 (gsap + ScrollTrigger)
  lib/quality.ts               품질 단계 정의, 기기 감지
  state/store.ts               gsap이 트윈하는 가변 상태 + UI 스토어
```

## 배포 (GitHub Pages)

`.github/workflows/pages.yml`이 main에 push할 때마다 `npm ci → npm run build`로 `dist/`를 만들어 Pages에 배포합니다.
저장소 Settings → Pages → Source를 **GitHub Actions**로 지정해야 합니다. 비공개 저장소는 유료 플랜에서만 Pages를 쓸 수 있습니다.

## 결과물 업로드와 Blender

`public/assets/` 아래 파일은 빌드 시 그대로 복사됩니다. `npm run catalog`는 `public/catalog.json`을 갱신하고, `npm run publish`/`npm run watch`는 결과 파일을 커밋해 업로드합니다. 95MB를 넘는 파일은 GitHub Release 등 별도 배포가 필요합니다.

Blender 원본(`*.blend`)과 빌드 스크립트(`*_build.py`)는 저장소 루트에 있습니다. Blender UI 작업은 실제 데스크톱 도구가 연결된 세션에서 해야 합니다.
