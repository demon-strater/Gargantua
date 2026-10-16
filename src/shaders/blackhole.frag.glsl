// ─────────────────────────────────────────────────────────────────────────────
//  Gargantua — Schwarzschild black hole ray marcher
//
//  단위계: 슈바르츠실트 반지름 Rs = 1 (G = c = 1, M = 0.5)
//    · 사건의 지평선      r = 1
//    · 광자구(photon sphere) r = 1.5
//    · 최내각 안정 궤도(ISCO) r = 3
//
//  각 픽셀마다 카메라에서 광선을 쏘아 "거꾸로" 시간을 거슬러 광자의 측지선을
//  적분합니다. 슈바르츠실트 시공간의 빛 경로는 평면 좌표계에서 다음 가속도로
//  정확히 표현됩니다 (h = |x × v| 는 보존되는 각운동량):
//
//        a = -(3/2) · h² · x / |x|⁵
//
//  적분 중에 원반 평면(y = 0)을 지나면 강착 원반을 샘플링하고, 지평선(r < 1)에
//  들어가면 흡수, 충분히 멀어지면 휘어진 최종 방향으로 은하수/별을 조회합니다.
// ─────────────────────────────────────────────────────────────────────────────

precision highp float;
precision highp int;

varying vec2 vUv;

uniform float uTime;          // 실제 경과 시간(초) — 별 반짝임
uniform float uDiskTime;      // 원반 회전용 누적 시간(속도 배율 적용)
uniform vec3  uCamPos;
uniform mat4  uCamWorld;
uniform mat4  uProjInv;
uniform float uPixelAngle;    // 픽셀 하나가 차지하는 시야각(rad) — 별 안티앨리어싱
uniform int   uSteps;         // 품질 단계별 최대 적분 스텝
uniform float uStepScale;     // 적응형 스텝 크기 계수 (dt = k · r)
uniform int   uOctaves;       // FBM 옥타브 수
uniform float uExposure;
uniform float uDoppler;       // 0 = 빔 효과 없음, 1 = 물리값
uniform float uLensing;       // 0 = 직선 광선, 1 = 일반상대론적 굴절
uniform float uEscapeRadius;
uniform vec3  uPlanetPos;
uniform float uPlanetRadius;

const int   MAX_STEPS   = 320;
const float R_IN        = 2.6;   // 원반 안쪽 경계(ISCO 근처)
const float R_OUT       = 14.0;  // 원반 바깥 경계
const float FLOW_PERIOD = 40.0;  // 무한히 감기는 것을 막는 flow-map 주기(원반 시간)
const float DISK_GAIN   = 2.7;

// ── Hash (Dave Hoskins, sin 없는 해시) ──────────────────────────────────────
float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

vec3 hash33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yxx) * p3.zyx);
}

// ── 3D Simplex noise (Ashima Arts / Stefan Gustavson, MIT) ──────────────────
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g  = step(x0.yzx, x0.xyz);
  vec3 l  = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j  = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float fbm(vec3 p, int octaves) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    sum += amp * snoise(p);
    p = p * 2.02 + vec3(1.7, 9.2, 3.1);
    amp *= 0.5;
  }
  return sum;
}

// ── 흑체 복사 색 (Tanner Helland 근사, 선형 RGB로 변환) ─────────────────────
vec3 blackbody(float kelvin) {
  float t = clamp(kelvin, 1000.0, 40000.0) / 100.0;
  vec3 c;
  if (t <= 66.0) {
    c.r = 1.0;
    c.g = clamp(0.39008157876 * log(t) - 0.63184144378, 0.0, 1.0);
    c.b = t <= 19.0 ? 0.0 : clamp(0.54320678911 * log(t - 10.0) - 1.19625408914, 0.0, 1.0);
  } else {
    c.r = clamp(1.29293618606 * pow(t - 60.0, -0.1332047592), 0.0, 1.0);
    c.g = clamp(1.12989086089 * pow(t - 60.0, -0.0755148492), 0.0, 1.0);
    c.b = 1.0;
  }
  return pow(c, vec3(2.2));
}

// ── 배경: 별 + 은하수 ───────────────────────────────────────────────────────
// 3D 격자 셀마다 확률적으로 별 하나를 배치합니다. 광선의 "최종" 방향으로
// 조회하므로 블랙홀 주변의 별과 은하수도 함께 렌즈 효과를 받습니다.
vec3 starLayer(vec3 d, float scale, float density, float sizeMul, float gain) {
  vec3 p = d * scale;
  vec3 id = floor(p);
  float h = hash13(id);
  if (h > density) return vec3(0.0);

  vec3 jitter = 0.25 + 0.5 * hash33(id + 17.0);
  vec3 dv = fract(p) - jitter;
  float depth = dot(dv, d);
  vec3 tangential = (dv - d * depth) / scale;    // 광선 방향과의 각거리(rad)

  float sigma = uPixelAngle * sizeMul;
  float core = exp(-dot(tangential, tangential) / (sigma * sigma));
  float visible = exp(-depth * depth * 30.0);

  float mag = pow(hash13(id + 3.7), 7.0);
  float temp = mix(3000.0, 12000.0, pow(hash13(id + 9.1), 1.6));
  float twinkle = 0.78 + 0.22 * sin(uTime * (1.3 + 4.0 * hash13(id + 1.3)) + h * 60.0);
  return blackbody(temp) * core * visible * (0.12 + 3.5 * mag) * gain * twinkle;
}

vec3 sky(vec3 d) {
  // 은하 좌표계: 은하수 띠가 첫 화면에서 블랙홀 뒤를 비스듬히 가로지르도록 배치
  const vec3 GAL_NORTH  = vec3(0.5547, 0.8321, 0.0);
  const vec3 GAL_CENTER = vec3(-0.7015, 0.4648, -0.5403);

  float lat  = dot(d, GAL_NORTH);
  float lat2 = lat * lat;
  float toCore = max(dot(d, normalize(GAL_CENTER)), 0.0);

  float band  = exp(-lat2 / 0.016);
  float halo  = exp(-lat2 / 0.085);
  float bulge = pow(toCore, 24.0);

  int skyOct = max(uOctaves - 1, 2);
  float clouds = fbm(d * 3.2 + 11.0, skyOct) * 0.5 + 0.5;
  float detail = fbm(d * 9.5 - 4.0, skyOct) * 0.5 + 0.5;

  float milky = halo * 0.22 + band * (0.25 + 1.1 * clouds * clouds);
  milky *= 0.55 + 1.4 * bulge;
  // 성간 먼지대(dark rift): 은하면 중심선을 따라 빛을 가립니다
  float rift = smoothstep(0.42, 0.72, detail) * exp(-lat2 / 0.0028);
  milky *= 1.0 - 0.85 * rift;

  vec3 warm = vec3(1.0, 0.78, 0.55);
  vec3 cool = vec3(0.50, 0.60, 0.90);
  vec3 col = mix(cool, warm, clamp(bulge * 1.6 + band * 0.25, 0.0, 1.0)) * milky * 0.085;

  // 아주 옅은 성운 색조
  float neb = smoothstep(0.55, 0.95, clouds) * halo;
  col += vec3(0.32, 0.10, 0.20) * neb * 0.02;

  // 별: 은하수 방향일수록 촘촘하게
  col += starLayer(d, 340.0, 0.10 + band * 0.22, 0.85, 0.55);
  col += starLayer(d, 130.0, 0.05 + band * 0.08, 1.00, 1.30);
  col += starLayer(d,  42.0, 0.035,             1.35, 5.50);
  return col;
}

// ── 강착 원반 ───────────────────────────────────────────────────────────────
// 케플러 차등 회전으로 노이즈를 이류시키면 시간이 갈수록 무한히 감겨 들어가므로
// 위상을 반 주기 어긋난 두 레이어를 교차 페이드(flow map)해서 영원히 흐르게 합니다.
float diskLayer(float r, float phi, float tau, float seed) {
  float omega = 0.70711 / (r * sqrt(r));          // 케플러 각속도 (GM = 0.5)
  float ang = phi - omega * tau + seed;
  // 각도를 노이즈 공간의 원으로 매핑 → 이음매 없음. 원주 방향으로 길게 늘어난 줄무늬.
  vec3 q = vec3(cos(ang) * 2.1, sin(ang) * 2.1, r * 1.7 - tau * 0.03) + seed;
  float n = fbm(q, uOctaves);
  // 미세한 동심 줄무늬
  n += 0.16 * snoise(vec3(cos(ang) * 0.9, sin(ang) * 0.9, r * 6.5 + seed));
  return n;
}

vec4 shadeDisk(vec3 p, vec3 dir) {
  float r = length(p.xz);
  if (r < R_IN * 0.85 || r > R_OUT) return vec4(0.0);
  float phi = atan(p.z, p.x);

  float ph1 = fract(uDiskTime / FLOW_PERIOD);
  float ph2 = fract(uDiskTime / FLOW_PERIOD + 0.5);
  float w1 = 1.0 - abs(2.0 * ph1 - 1.0);
  float w2 = 1.0 - w1;
  float n = (w1 * diskLayer(r, phi, ph1 * FLOW_PERIOD, 0.0) +
             w2 * diskLayer(r, phi, ph2 * FLOW_PERIOD, 7.31)) / sqrt(w1 * w1 + w2 * w2);

  float dens = smoothstep(-0.55, 0.75, n);
  dens = dens * dens * 1.35;

  float inner = smoothstep(R_IN * 0.85, R_IN * 1.3, r);
  float outer = 1.0 - smoothstep(R_OUT * 0.22, R_OUT, r);
  float profile = inner * outer;

  float x = R_IN / r;
  float emissivity = x * x * 1.25 + 0.015;
  float temp = max(7200.0 * pow(x, 0.75), 1800.0);   // Shakura–Sunyaev: T ∝ r^(-3/4)

  // 상대론적 도플러 빔 + 중력 적색편이
  vec3 vdir = vec3(-p.z, 0.0, p.x) / r;               // 원반의 공전 방향
  float beta = min(sqrt(0.5 / max(r - 1.0, 0.25)), 0.8) * uDoppler;
  float gam = inversesqrt(1.0 - beta * beta);
  float cosT = dot(vdir, -dir);                       // 광자는 -dir 방향으로 관측자에게 향함
  float delta = 1.0 / (gam * (1.0 - beta * cosT));
  float grav = sqrt(max(1.0 - 1.0 / r, 0.05));
  float g = delta * mix(1.0, grav, 0.6);

  vec3 color = blackbody(temp * g);
  float boost = g * g * g;                            // I_ν / ν³ 불변량 → g³

  vec3 emission = color * emissivity * boost * DISK_GAIN * dens * profile;

  // 얇은 원반을 비스듬히 볼수록 경로가 길어져 밝아지는 가장자리 광채
  float grazing = min(1.0 / max(abs(dir.y), 0.05), 12.0);
  emission += color * emissivity * boost * DISK_GAIN * profile * 0.05 * grazing * (0.35 + dens);

  float alpha = clamp(dens * profile * 1.1, 0.0, 0.97);
  return vec4(emission, alpha);
}

// ── 공전하는 작은 행성 (실루엣 + 원반 빛에 의한 테두리 조명) ────────────────
vec3 shadePlanet(vec3 hit, vec3 rd) {
  vec3 n = normalize(hit - uPlanetPos);
  vec3 toHole = normalize(-uPlanetPos);
  float lambert = max(dot(n, toHole), 0.0);
  float wrap = dot(n, toHole) * 0.5 + 0.5;
  vec3 diskLight = vec3(1.0, 0.70, 0.42);
  vec3 albedo = vec3(0.05, 0.055, 0.06);
  vec3 col = albedo * diskLight * (lambert * 2.2 + wrap * 0.06);
  float rim = pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
  col += vec3(0.55, 0.70, 1.0) * rim * 0.08 * (0.25 + lambert);
  return col;
}

void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  vec4 view = uProjInv * vec4(ndc, 1.0, 1.0);
  vec3 rd = normalize((uCamWorld * vec4(normalize(view.xyz / view.w), 0.0)).xyz);

  vec3 pos = uCamPos;
  vec3 vel = rd;
  vec3 L = cross(pos, vel);
  float k = -1.5 * dot(L, L) * uLensing;

  float r2 = dot(pos, pos);
  vec3 acc = k * pos / (r2 * r2 * sqrt(r2));

  vec3 col = vec3(0.0);
  float transmittance = 1.0;
  bool captured = false;
  float escape2 = uEscapeRadius * uEscapeRadius;

  for (int i = 0; i < MAX_STEPS; i++) {
    if (i >= uSteps) break;

    float r = sqrt(dot(pos, pos));
    float dt = uStepScale * r;

    // Velocity Verlet 적분 (스텝당 힘 계산 1회, 2차 정확도)
    vec3 npos = pos + vel * dt + 0.5 * acc * dt * dt;
    float nr2 = dot(npos, npos);
    vec3 nacc = k * npos / (nr2 * nr2 * sqrt(nr2));
    vec3 nvel = vel + 0.5 * (acc + nacc) * dt;

    // 행성과의 교차 (선분–구)
    vec3 seg = npos - pos;
    float segLen = length(seg);
    vec3 sd = seg / segLen;
    float tPlanet = 2.0;
    vec3 oc = pos - uPlanetPos;
    float pb = dot(oc, sd);
    float pc = dot(oc, oc) - uPlanetRadius * uPlanetRadius;
    float disc = pb * pb - pc;
    if (disc > 0.0) {
      float th = -pb - sqrt(disc);
      if (th > 0.0 && th < segLen) tPlanet = th / segLen;
    }

    // 원반 평면 통과 여부
    float tDisk = 2.0;
    if (pos.y * npos.y < 0.0) tDisk = pos.y / (pos.y - npos.y);

    if (tDisk < tPlanet) {
      vec4 d = shadeDisk(mix(pos, npos, tDisk), normalize(mix(vel, nvel, tDisk)));
      col += transmittance * d.rgb;
      transmittance *= 1.0 - d.a;
    }
    if (tPlanet <= 1.0) {
      col += transmittance * shadePlanet(mix(pos, npos, tPlanet), sd);
      transmittance = 0.0;
      break;
    }
    if (transmittance < 0.01) break;

    pos = npos;
    vel = nvel;
    acc = nacc;

    if (nr2 < 1.0) { captured = true; break; }                 // 사건의 지평선
    if (nr2 > escape2 && dot(pos, vel) > 0.0) break;           // 탈출
  }

  if (!captured && transmittance > 0.01 && dot(pos, vel) > 0.0) {
    col += transmittance * sky(normalize(vel));
  }

  gl_FragColor = vec4(col * uExposure, 1.0);
}
