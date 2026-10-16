// ─────────────────────────────────────────────────────────────────────────────
//  Gargantua — Kerr black hole ray tracer
//
//  기하 단위계 G = c = 1, 질량 M = 1. 장면의 Y축이 자전축입니다.
//
//  1) 카메라는 국소 비회전 관측자(ZAMO). 픽셀 방향을 ZAMO의 정규직교 틀에서
//     광자 운동량으로 바꾸고, 보존량 E(=1), L(자전축 각운동량), Q(카터 상수)를 구합니다.
//  2) 커 시공간의 광자 측지선은 미노 시간(Mino time) λ에서 r과 θ가 분리됩니다.
//        (dr/dλ)² = R(r),   (dθ/dλ)² = Θ(θ)
//     2계 형태 r'' = R'/2, θ'' = Θ'/2 를 속도 베를레로 적분하고, 매 스텝 속도 크기를
//     정확한 불변량 √R, √Θ 로 투영해 오차가 쌓이지 않게 합니다.
//  3) 원반은 적도면의 얇은 슬랩(H/r). 광선이 원반면을 지날 때 경로 길이에 따른
//     광학 깊이로 방출–흡수를 합성하고, 관측 진동수비 g = ν_obs/ν_emit 를
//     ZAMO 카메라와 케플러 궤도 가스의 4-속도로 정확히 계산합니다
//     (도플러 + 중력 적색편이 + 틀 끌림).
// ─────────────────────────────────────────────────────────────────────────────

varying vec2 vUv;

uniform float uTime;
uniform float uDiskTime;
uniform mat4  uCamWorld;
uniform mat4  uProjInv;
uniform vec3  uCamBL;          // 카메라 BL 좌표 (r, θ, φ)
uniform mat3  uCamBasis;       // 카메라 위치의 r̂, θ̂, φ̂ (유클리드 단위벡터)
uniform vec4  uZamo;           // α, ω, ϖ, √Σ
uniform float uM;              // 광선 계량의 질량 (렌즈 토글 시 0으로 감소)
uniform float uA;              // 광선 계량의 스핀
uniform float uSpin;           // 원반 가스 궤도용 스핀
uniform float uHorizon;        // r₊
uniform float uDiskInner;      // 원반 안쪽 경계 (ISCO 이상, 잘린 원반이면 더 바깥)
uniform float uDiskOuter;
uniform float uDiskThickness;  // H / r
uniform float uDiskTemp;       // 원반 최고 온도 (K)
uniform float uPalette;        // 0 = 흑체 색, 1 = 인디고 색감
uniform float uBeaming;        // 0 = 영화처럼 g 효과 없음, 1 = 실제 물리
uniform float uExposure;
uniform float uPixelAngle;
uniform int   uSteps;
uniform float uStepScale;
uniform float uEscapeRadius;
uniform vec3  uPlanetPos;
uniform float uPlanetRadius;
uniform float uPlanetOrbit;
uniform sampler2D   uDiskTex;
uniform samplerCube uSkyTex;

const int   MAX_STEPS   = 480;
const float FLOW_PERIOD = 40.0;      // flow-map 주기 (원반 시간, M)
const float LOG_TEX_MAX = 4.158883;  // ln 64 — 원반 텍스처의 로그 반지름 범위
const float FLUX_PEAK   = 0.07704;   // 아래 플럭스 함수의 최댓값 (정규화)
const float POLAR_S2    = 1e-6;      // 전환점이 자전축에서 sin θ < 0.001 이내면 축을 통과하는 광선으로 처리
const float DISK_GAIN   = 1.6;
const float OPACITY     = 1.3;
const float HAZE        = 0.05;

// 광선마다 보존되는 양
float gLq;    // L = q_φ  (E = q_t = 1 로 정규화)
float gLqT;   // θ, φ 방정식에 쓰는 L (자전축을 스치는 광선은 0)
float gQ;     // 카터 상수 Q
float gK;     // (L + a)² + Q
float gEloc;  // 카메라(ZAMO)가 측정한 광자 에너지

// ── 측지선 ─────────────────────────────────────────────────────────────────
void geodesicForces(float r, float th, out float rAcc, out float thAcc,
                    out float phDot, out float phRate, out float s, out float c) {
  s = sin(th);
  c = cos(th);
  float invS2 = 1.0 / max(s * s, 1e-12);
  float a2 = uA * uA;
  float Ar = r * r + a2 + uA * gLq;
  float delta = r * r - 2.0 * uM * r + a2;
  delta = abs(delta) < 1e-4 ? 1e-4 : delta;

  rAcc  = 2.0 * r * Ar - (r - uM) * gK;                       // R'(r) / 2
  thAcc = -a2 * s * c + gLqT * gLqT * c * s * invS2 * invS2;  // Θ'(θ) / 2
  phRate = gLqT * invS2 + uA;                                 // 스텝 크기용 (지평선 발산항 제외)
  phDot = phRate - uA * Ar / delta;                           // dφ/dλ
}

// 편구면 좌표 → 장면 직교좌표. sin θ < 0 이면 자전축 건너편으로 자연스럽게 이어집니다.
vec3 blToCartesian(float r, float th, float ph) {
  float R = sqrt(r * r + uA * uA) * sin(th);
  return vec3(R * cos(ph), r * cos(th), R * sin(ph));
}

// ── 배경: 은하수 큐브맵 + 절차적 별 ─────────────────────────────────────────
vec3 starLayer(vec3 d, float scale, float density, float sizeMul, float gain) {
  vec3 p = d * scale;
  vec3 id = floor(p);
  float h = hash13(id);
  if (h > density) return vec3(0.0);

  vec3 dv = fract(p) - (0.25 + 0.5 * hash33(id + 17.0));
  float depth = dot(dv, d);
  vec3 tangential = (dv - d * depth) / scale;

  float sigma = uPixelAngle * sizeMul;
  float core = exp(-dot(tangential, tangential) / (sigma * sigma));
  float visible = exp(-depth * depth * 30.0);

  float mag = pow(hash13(id + 3.7), 7.0);
  float temp = mix(3000.0, 12000.0, pow(hash13(id + 9.1), 1.6));
  float twinkle = 0.8 + 0.2 * sin(uTime * (1.3 + 4.0 * hash13(id + 1.3)) + h * 60.0);
  return blackbody(temp) * core * visible * (0.12 + 3.5 * mag) * gain * twinkle;
}

vec3 sky(vec3 d) {
  vec3 milky = textureLod(uSkyTex, d, 0.0).rgb;
  float band = clamp(dot(milky, vec3(0.3, 0.5, 0.2)) * 9.0, 0.0, 1.0);
  vec3 col = milky;
  col += starLayer(d, 340.0, 0.10 + band * 0.22, 0.85, 0.55);
  col += starLayer(d, 130.0, 0.05 + band * 0.08, 1.00, 1.30);
  col += starLayer(d,  42.0, 0.035,             1.35, 5.50);
  return col;
}

// ── 강착 원반 ───────────────────────────────────────────────────────────────
// 원궤도 가스에서 나와 카메라에 닿는 빛의 진동수비 g = (p·u_cam) / (p·u_gas)
float redshift(float rr) {
  float a2 = uA * uA;
  float omega = 1.0 / (rr * sqrt(rr) + uSpin);                  // 케플러 각속도 (순행)
  float gtt = -(1.0 - 2.0 * uM / rr);
  float gtp = -2.0 * uM * uA / rr;
  float gpp = rr * rr + a2 + 2.0 * uM * a2 / rr;
  float ut = inversesqrt(max(-(gtt + 2.0 * omega * gtp + omega * omega * gpp), 0.02));
  float g = gEloc / (ut * max(1.0 + omega * gLq, 0.05));
  return pow(max(g, 0.01), uBeaming);
}

// 노비코프–손 형태의 복사 플럭스 F ∝ r⁻³ (1 − √(r_in / r)), 최댓값 1로 정규화
float diskFlux(float rr) {
  float x = rr / uDiskInner;
  return max((1.0 - 0.95 * inversesqrt(max(x, 0.5))) / (x * x * x), 0.0) / FLUX_PEAK;
}

// 인디고 색감: 상대 온도(T·g / T_max)를 짙은 남색 → 푸른 보라 → 흰빛 → 뜨거운 금빛으로
vec3 indigoPalette(float heat) {
  vec3 col = mix(vec3(0.07, 0.05, 0.42), vec3(0.32, 0.34, 1.0), smoothstep(0.35, 0.95, heat));
  col = mix(col, vec3(0.9, 0.92, 1.0), smoothstep(0.95, 1.25, heat));
  return mix(col, vec3(1.0, 0.72, 0.42), smoothstep(1.2, 1.6, heat));
}

// 진동수 이동은 색온도로(T ∝ F^¼ · g), 밝기는 I_ν/ν³ 불변량에 따라 g³ 으로
vec3 diskSource(float rr, float g, float heat, float brightness) {
  float flux = diskFlux(rr);
  float temp = uDiskTemp * pow(flux, 0.25) * heat;
  vec3 color = mix(blackbody(temp * g), indigoPalette(pow(flux, 0.25) * heat * g), uPalette);
  return color * (pow(flux, 0.55) * brightness * g * g * g * DISK_GAIN);
}

// 바깥 가장자리 감쇠: 잘린 원반이 가는 고리가 되어도 밝기가 남도록 고리 폭에 비례
float outerFade(float rr) {
  return 1.0 - smoothstep(uDiskOuter - 0.55 * (uDiskOuter - uDiskInner), uDiskOuter, rr);
}

// 케플러 차등 회전으로 흐르는 원반 텍스처 (반 주기 어긋난 두 위상을 교차 페이드)
vec3 diskField(float rr, float phi, float footprint) {
  float omega = 1.0 / (rr * sqrt(rr) + uSpin);
  float v = log(rr) / LOG_TEX_MAX;
  float lod = max(log2(footprint / (0.0035 * rr)), 0.0);
  float ph1 = fract(uDiskTime / FLOW_PERIOD);
  float ph2 = fract(uDiskTime / FLOW_PERIOD + 0.5);
  float w1 = 1.0 - abs(2.0 * ph1 - 1.0);
  float w2 = 1.0 - w1;
  float u0 = phi / TAU;
  vec3 A = textureLod(uDiskTex, vec2(u0 - omega * ph1 * FLOW_PERIOD / TAU, v), lod).rgb;
  vec3 B = textureLod(uDiskTex, vec2(u0 - omega * ph2 * FLOW_PERIOD / TAU + 0.5, v + 0.011), lod).rgb;
  return (w1 * (A - 0.5) + w2 * (B - 0.5)) * inversesqrt(w1 * w1 + w2 * w2) + 0.5;
}

// 광선이 원반면을 지나는 지점: 슬랩을 비스듬히 지날수록 광학 깊이가 커집니다.
void diskCrossing(vec3 P, vec3 dir, float footprint, inout vec3 col, inout float trans) {
  float rr = sqrt(max(P.x * P.x + P.z * P.z - uA * uA, 1e-6));
  if (rr < uDiskInner * 0.8 || rr > uDiskOuter) return;

  vec3 m = diskField(rr, atan(P.z, P.x), footprint);
  float inner = smoothstep(uDiskInner * 0.8, uDiskInner * 1.1, rr);
  float dens = smoothstep(0.26, 0.82, m.r) * (0.3 + 1.2 * m.g) * (0.55 + 0.9 * m.b) * inner * outerFade(rr);

  float cosI = max(abs(dir.y), uDiskThickness * 1.5);
  float tau = OPACITY * dens / cosI;
  if (tau < 1e-4) return;

  vec3 S = diskSource(rr, redshift(rr), 0.88 + 0.24 * m.b, 0.3 + 1.1 * dens + 0.4 * m.g);
  float att = exp(-tau);
  col += trans * S * (1.0 - att);
  trans *= att;
}

// ── 공전하는 작은 행성 ─────────────────────────────────────────────────────
vec3 shadePlanet(vec3 hit, vec3 rd) {
  vec3 n = normalize(hit - uPlanetPos);
  vec3 toHole = normalize(-uPlanetPos);
  float lambert = max(dot(n, toHole), 0.0);
  float wrap = dot(n, toHole) * 0.5 + 0.5;
  vec3 diskLight = vec3(1.0, 0.72, 0.45);
  vec3 col = vec3(0.05, 0.055, 0.06) * diskLight * (lambert * 2.4 + wrap * 0.05);
  float rim = pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
  col += vec3(0.55, 0.70, 1.0) * rim * 0.08 * (0.25 + lambert);
  return col;
}

void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  vec4 view = uProjInv * vec4(ndc, 1.0, 1.0);
  vec3 rd = normalize((uCamWorld * vec4(normalize(view.xyz / view.w), 0.0)).xyz);

  // ZAMO 틀에서의 방향 성분 → 광자 운동량 (과거 방향으로 추적)
  vec3 n = vec3(dot(rd, uCamBasis[0]), dot(rd, uCamBasis[1]), dot(rd, uCamBasis[2]));
  float alpha = uZamo.x;
  float omegaZ = uZamo.y;
  float varpi = uZamo.z;
  float sqrtSigma = uZamo.w;

  float r  = uCamBL.x;
  float th = uCamBL.y;
  float ph = uCamBL.z;
  float a2 = uA * uA;

  gEloc = 1.0 / (alpha - omegaZ * varpi * n.z);
  gLq = gEloc * varpi * n.z;
  float s0 = sin(th);
  float c0 = cos(th);
  float delta0 = r * r - 2.0 * uM * r + a2;
  float dr  = gEloc * sqrtSigma * sqrt(max(delta0, 1e-6)) * n.x;   // dr/dλ = Δ q_r
  float dth = gEloc * sqrtSigma * n.y;                               // dθ/dλ = q_θ
  gQ = dth * dth + c0 * c0 * (gLq * gLq / max(s0 * s0, 1e-6) - a2);
  gK = (gLq + uA) * (gLq + uA) + gQ;
  // θ 전환점 sin²θ_min ≈ L² / (Q + a² + L²). 축에 아주 가까이 스치는 광선은 축을 지나는 극한으로.
  float sMin2 = gLq * gLq / max(gQ + a2 + gLq * gLq, 1e-6);
  gLqT = sMin2 < POLAR_S2 ? 0.0 : gLq;

  float rAcc, thAcc, phDot, phRate, s, c;
  geodesicForces(r, th, rAcc, thAcc, phDot, phRate, s, c);

  vec3 col = vec3(0.0);
  float trans = 1.0;
  bool captured = false;
  bool escaped = false;
  float pathLen = 0.0;
  float rPrev = r, thPrev = th, phPrev = ph;
  float captureR = uHorizon * 1.01 + 0.005;

  for (int i = 0; i < MAX_STEPS; i++) {
    if (i >= uSteps) break;

    // 공간 이동량 ≈ k·r (시공간이 거의 평평한 먼 곳에서는 최대 3배), 방위각 변화 ≤ 0.1 rad.
    // 자전축 근처에서 되튕기는 광선은 축까지 남은 각거리의 1/4 이상 한 번에 다가가지 않게 해
    // 축을 도는 급격한 방위각 회전을 놓치지 않습니다.
    float speed = sqrt(dr * dr + r * r * (dth * dth + s * s * phRate * phRate));
    float k = uStepScale * clamp(r * 0.125, 1.0, 3.0);
    float h = min(k * r / max(speed, 1e-6), 0.1 / max(abs(phRate), 1e-6));
    if (gLqT != 0.0) h = min(h, 0.25 * abs(s) / max(abs(dth), 1e-6));

    float r1  = r  + dr  * h + 0.5 * rAcc  * h * h;
    float th1 = th + dth * h + 0.5 * thAcc * h * h;
    float rAcc1, thAcc1, phDot1, phRate1, s1, c1;
    geodesicForces(r1, th1, rAcc1, thAcc1, phDot1, phRate1, s1, c1);
    float dr1  = dr  + 0.5 * (rAcc  + rAcc1)  * h;
    float dth1 = dth + 0.5 * (thAcc + thAcc1) * h;
    float ph1  = ph  + 0.5 * (phDot + phDot1) * h;

    // 투영: 속도 크기를 정확한 불변량 |r'| = √R(r), |θ'| = √Θ(θ) 로 되돌립니다.
    // (미노 시간에서는 먼 곳의 작은 상대 오차가 블랙홀 근처에서 치명적으로 커지기 때문)
    float Ar1 = r1 * r1 + a2 + uA * gLq;
    float delta1 = r1 * r1 - 2.0 * uM * r1 + a2;
    dr1 = sign(dr1) * sqrt(max(Ar1 * Ar1 - delta1 * gK, 0.0));
    float theta1 = gQ + a2 * c1 * c1 - gLqT * gLqT * c1 * c1 / max(s1 * s1, 1e-12);
    dth1 = sign(dth1) * sqrt(max(theta1, 0.0));

    vec3 P0, P1;
    bool haveCartesian = false;
    float tCut = 1.0;
    bool hitPlanet = false;
    float segLen = speed * h;

    // 행성 (궤도 반지름 근처를 지날 때만 직교좌표로 변환해 선분–구 교차)
    if (abs(0.5 * (r + r1) - uPlanetOrbit) < uPlanetRadius + abs(r1 - r) + 1.0) {
      P0 = blToCartesian(r, th, ph);
      P1 = blToCartesian(r1, th1, ph1);
      haveCartesian = true;
      vec3 seg = P1 - P0;
      float len = length(seg);
      vec3 sd = seg / len;
      vec3 oc = P0 - uPlanetPos;
      float pb = dot(oc, sd);
      float disc = pb * pb - (dot(oc, oc) - uPlanetRadius * uPlanetRadius);
      if (disc > 0.0) {
        float tHit = -pb - sqrt(disc);
        if (tHit > 0.0 && tHit < len) {
          tCut = tHit / len;
          hitPlanet = true;
        }
      }
    }

    // 원반: 적도면(y = 0) 통과 지점에서 샘플링, 스치기만 하면 두께만큼 옅은 광채
    float y0 = r * c;
    float y1 = r1 * c1;
    bool inDiskRange = min(r, r1) < uDiskOuter * 1.02 && max(r, r1) > uDiskInner * 0.75;
    if (inDiskRange && y0 * y1 <= 0.0 && y0 != y1) {
      if (!haveCartesian) {
        P0 = blToCartesian(r, th, ph);
        P1 = blToCartesian(r1, th1, ph1);
        haveCartesian = true;
      }
      float tc = y0 / (y0 - y1);
      if (tc < tCut) {
        diskCrossing(mix(P0, P1, tc), normalize(P1 - P0), uPixelAngle * (pathLen + segLen * tc), col, trans);
      }
    } else if (inDiskRange) {
      float rm = 0.5 * (r + r1);
      float H = uDiskThickness * rm;
      float yMin = min(abs(y0), abs(y1));
      if (yMin < 2.5 * H && rm > uDiskInner && rm < uDiskOuter) {
        float w = exp(-yMin * yMin / (H * H)) * min(segLen / H, 4.0) * outerFade(rm) * HAZE;
        col += trans * diskSource(rm, redshift(rm), 1.0, 0.6) * w;
      }
    }

    if (hitPlanet) {
      col += trans * shadePlanet(mix(P0, P1, tCut), normalize(P1 - P0));
      trans = 0.0;
      break;
    }
    if (trans < 0.004) break;

    pathLen += segLen;
    rPrev = r; thPrev = th; phPrev = ph;
    r = r1; th = th1; ph = ph1;
    dr = dr1; dth = dth1;
    rAcc = rAcc1; thAcc = thAcc1; phDot = phDot1; phRate = phRate1;
    s = s1; c = c1;

    if (r < captureR) { captured = true; break; }                 // 사건의 지평선
    if (r > uEscapeRadius && dr > 0.0) { escaped = true; break; } // 무한으로 탈출
  }

  if (!captured && trans > 0.004 && (escaped || (dr > 0.0 && r > 8.0))) {
    vec3 dir = normalize(blToCartesian(r, th, ph) - blToCartesian(rPrev, thPrev, phPrev));
    col += trans * sky(dir);
  }

  gl_FragColor = vec4(col * uExposure, 1.0);
}
