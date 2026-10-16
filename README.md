# Gargantua

영화 '인터스텔라'의 가르강튀아를, 회전하는 블랙홀(커 계량)의 광선 추적으로 브라우저에서 실시간 렌더링하는 시네마틱 탐사 사이트입니다.
스크롤하면 카메라가 블랙홀로 서서히 빨려 들어가고, 마우스를 움직이면 궤도가 부드럽게 따라 움직입니다. 오른쪽 아래 **Physics** 패널에서 물리 값을 바꾸면 블랙홀의 모양이 실시간으로 변합니다.

## 물리 모델

영화 속 가르강튀아 이미지는 스핀 a/M = 0.6의 커 블랙홀로, 관객의 혼동을 막기 위해 도플러 효과를 뺀 채 렌더링되었습니다 ([James, von Tunzelmann, Franklin & Thorne 2015](https://arxiv.org/abs/1502.03808)). 이 사이트의 기본값은 같은 스핀에 실제 물리(도플러 빔 + 중력 적색편이)를 모두 적용한 모습이고, 패널의 '영화 연출' 프리셋이 영화의 설정입니다.

- **커 측지선** — 카메라는 국소 비회전 관측자(ZAMO). 픽셀마다 보존량 E, L, 카터 상수 Q를 구하고, 미노 시간에서 분리되는 `r'' = R'(r)/2`, `θ'' = Θ'(θ)/2`를 속도 베를레로 적분합니다. 매 스텝 속도 크기를 불변량 `√R`, `√Θ`로 투영해 오차가 쌓이지 않고, 자전축 근처의 방위각 회전은 스텝 제한으로 해상합니다.
- **틀 끌림** — 스핀에 따라 그림자 한쪽이 납작해지고, 원반 안쪽 경계가 최내각 안정 궤도(ISCO)를 따라 움직입니다 (a = 0.6 → 3.83 M, a = 0.999 → 1.18 M, 역회전 a = −0.9 → 8.7 M).
- **적색편이** — 관측 진동수비 `g = (p·u_cam)/(p·u_gas)`를 ZAMO 카메라와 케플러 원궤도 가스의 4-속도로 정확히 계산합니다. 색온도는 `T·g`, 밝기는 `I_ν/ν³` 불변량에 따라 `g³`.
- **강착 원반** — 적도면의 얇은 슬랩(H/r). 노비코프–손 형태의 플럭스 `F ∝ r⁻³(1 − √(r_in/r))`로 온도를 정하고, 비스듬히 볼수록 광학 깊이가 커지는 방출–흡수로 합성합니다. 소용돌이 무늬는 시작할 때 GPU에서 구운 2048×1024 텍스처를 케플러 차등 회전으로 흘려 보냅니다.
- **배경** — 미리 구운 은하수 HDR 큐브맵 + 절차적 별. 최종 광선 방향으로 조회하므로 별과 은하수도 함께 휘어집니다.
- **스케일감** — 기울어진 궤도로 공전하는 작은 행성(광선 적분 안에서 함께 렌즈 효과를 받음), 카메라 앞을 떠다니는 성간 먼지 파티클.

## 물리 패널

| 파라미터 | 효과 |
| --- | --- |
| 스핀 a/M (−0.999 ~ 0.999) | 그림자 모양, ISCO, 틀 끌림. 음수면 원반이 블랙홀과 반대로 공전 |
| 관측 경사 | 원반 평면 기준 시선 고도 (옆모습 ↔ 위에서 본 고리) |
| 도플러 · 적색편이 | 0% = 영화 연출, 100% = 실제 물리 |
| 원반 두께 · 온도 · 크기 | 원반의 광학 깊이, 흑체 색, 바깥 반지름 |
| 질량 | 모양은 바꾸지 않고 실제 크기(지평선 반지름, 공전 주기)만 바꿉니다 |
| 중력 렌즈 | 끄면 빛이 직진하는 평평한 시공간과 비교 |

프리셋: 실제 물리 · 영화 연출 · 극한 스핀(a = 0.999) · 무회전(슈바르츠실트) · M87* 시점.

## 렌더링

- **후보정** — Bloom, ACES 톤매핑, 렌즈 색수차, 필름 그레인, 비네트 (`@react-three/postprocessing`).
- **성능** — drei `PerformanceMonitor`가 FPS를 보며 렌더 해상도(DPR, 화면 크기별 픽셀 예산)와 적분 품질(스텝 수·스텝 크기·파티클 수)을 함께 조절합니다. 모바일·내장 GPU는 낮은 단계에서 시작합니다.

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
  shaders/blackhole.frag.glsl  커 블랙홀 광선 추적: 측지선·원반·행성·배경 (핵심)
  shaders/common.glsl          노이즈·해시·흑체 색 공용 함수
  shaders/diskTexture.frag.glsl, sky.*.glsl  시작할 때 한 번 굽는 원반 텍스처 / 은하수 큐브맵
  shaders/blackhole.vert.glsl  화면 전체 사각형
  scene/Experience.tsx         R3F Canvas 구성
  scene/BlackHole.tsx          카메라 ZAMO 틀 계산, 셰이더 유니폼, 행성 궤도
  scene/generatedTextures.ts   원반 텍스처 · 은하수 큐브맵 굽기
  scene/CameraRig.tsx          스크롤 + 마우스 패럴랙스 + 자동 공전 카메라
  scene/StarDust.tsx           성간 먼지 파티클
  scene/AdaptiveQuality.tsx    FPS 기반 해상도/품질 스케일링
  scene/Effects.tsx            후보정 체인
  ui/Overlay.tsx               인트로, 칼 세이건 인용, 챕터, HUD (gsap + ScrollTrigger)
  ui/PhysicsPanel.tsx          물리 파라미터 슬라이더 · 프리셋 · 파생 수치
  lib/kerr.ts                  지평선 · ISCO · 광자 궤도 · ZAMO · 좌표 변환
  lib/presets.ts               물리 프리셋
  lib/quality.ts               품질 단계 정의, 기기 감지
  state/store.ts               gsap이 트윈하는 가변 상태 + UI 스토어
```

## 배포 (GitHub Pages)

`.github/workflows/pages.yml`이 main에 push할 때마다 `npm ci → npm run build`로 `dist/`를 만들어 Pages에 배포합니다.
저장소 Settings → Pages → Source를 **GitHub Actions**로 지정해야 합니다. 비공개 저장소는 유료 플랜에서만 Pages를 쓸 수 있습니다.

## 결과물 업로드와 Blender

`public/assets/` 아래 파일은 빌드 시 그대로 복사됩니다. `npm run catalog`는 `public/catalog.json`을 갱신하고, `npm run publish`/`npm run watch`는 결과 파일을 커밋해 업로드합니다. 95MB를 넘는 파일은 GitHub Release 등 별도 배포가 필요합니다.

Blender 원본(`*.blend`)과 빌드 스크립트(`*_build.py`)는 저장소 루트에 있습니다. Blender UI 작업은 실제 데스크톱 도구가 연결된 세션에서 해야 합니다.
