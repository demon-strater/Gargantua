// 은하수 큐브맵 생성 (시작할 때 한 번). 별은 확대돼도 선명하도록 메인 셰이더에서 절차적으로 그립니다.

varying vec3 vDir;

void main() {
  vec3 d = normalize(vDir);

  // 은하 좌표계: 첫 화면에서 은하수 띠가 블랙홀 뒤를 비스듬히 가로지르도록 배치
  const vec3 GAL_NORTH  = vec3(0.5547, 0.8321, 0.0);
  const vec3 GAL_CENTER = vec3(-0.7015, 0.4648, -0.5403);

  float lat = dot(d, GAL_NORTH) + fbm(d * 2.2 + 4.0, 4) * 0.05;
  float lat2 = lat * lat;
  float toCore = max(dot(d, GAL_CENTER), 0.0);

  float band  = exp(-lat2 / 0.012);
  float halo  = exp(-lat2 / 0.07);
  float bulge = pow(toCore, 18.0) * exp(-lat2 / 0.03);

  vec3 q = d * 3.0 + fbm(d * 1.5 + 9.0, 4) * 0.5;
  float clouds = fbm(q, 7) * 0.5 + 0.5;
  float detail = fbm(d * 14.0 + 2.0, 6) * 0.5 + 0.5;
  float grain  = fbm(d * 70.0, 3) * 0.5 + 0.5;

  float milky = halo * 0.16 + band * (0.22 + 1.25 * clouds * clouds);
  milky *= 0.6 + 1.7 * bulge;
  // 성간 먼지대(dark rift)
  float rift = smoothstep(0.42, 0.72, detail) * exp(-lat2 / 0.003) * (0.6 + 0.4 * clouds);
  milky *= 1.0 - 0.88 * rift;
  // 분해되지 않는 별 구름의 입자감
  milky *= 0.7 + 0.6 * grain;

  vec3 warm = vec3(1.0, 0.80, 0.58);
  vec3 cool = vec3(0.55, 0.64, 0.92);
  vec3 col = mix(cool, warm, clamp(bulge * 1.4 + band * 0.2, 0.0, 1.0)) * milky * 0.085;

  // 옅은 성운 (HII 영역의 붉은빛, 반사 성운의 푸른빛)
  float neb = smoothstep(0.62, 0.95, fbm(d * 5.0 + 30.0, 5) * 0.5 + 0.5) * band;
  col += vec3(0.55, 0.12, 0.22) * neb * 0.014;
  float neb2 = smoothstep(0.64, 0.95, fbm(d * 3.0 - 12.0, 5) * 0.5 + 0.5) * halo;
  col += vec3(0.10, 0.22, 0.35) * neb2 * 0.009;

  gl_FragColor = vec4(col, 1.0);
}
