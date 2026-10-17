// 강착 원반 텍스처 생성 (시작할 때 GPU에서 한 번만 실행)
//   u = 방위각 φ / 2π (이음매 없이 반복), v = ln r / ln 64 (로그 반지름)
// 로그 반지름 좌표를 쓰면 난류 구조의 크기가 반지름에 비례해 자연스럽게 커집니다.
//   R: 주 밀도장 (도메인 워핑된 8옥타브 FBM, 원주 방향으로 길게 늘어난 소용돌이)
//   G: 가는 필라멘트 (ridged noise)
//   B: 큰 덩어리 (뜨거운 영역 / 두께 변화)

varying vec2 vUv;

void main() {
  float ang = vUv.x * TAU;
  // 각도를 노이즈 공간의 원으로 매핑 → φ 방향으로 완벽하게 반복됩니다.
  vec3 p = vec3(cos(ang) * 1.9, sin(ang) * 1.9, vUv.y * 64.0);

  vec3 warp = vec3(
    fbm(p * 0.9 + vec3(3.1, 0.0, 1.7), 4),
    fbm(p * 0.9 + vec3(7.7, 2.3, 0.0), 4),
    fbm(p * 0.9 + vec3(0.0, 5.2, 9.4), 4)
  );
  vec3 q = p + warp * vec3(0.38, 0.38, 2.4);

  float density = fbm(q, 8) * 0.5 + 0.5;

  float filaments = 0.0;
  float amp = 0.6;
  vec3 fp = q * vec3(1.0, 1.0, 2.4) + 13.0;
  for (int i = 0; i < 6; i++) {
    float n = 1.0 - abs(snoise(fp));
    filaments += amp * n * n * n;
    fp = fp * 2.03 + 4.1;
    amp *= 0.5;
  }

  float clumps = fbm(p * vec3(0.5, 0.5, 0.32) + 21.0, 4) * 0.5 + 0.5;

  // Fine, sheared filaments remain continuous around the azimuth seam.
  float thread = sin(vUv.y * 1800.0 + fbm(p * 1.7, 4) * 7.0);
  float fine = pow(0.5 + 0.5 * thread, 7.0);
  filaments = filaments * 0.74 + fine * 0.26;
  density = clamp((density - 0.5) * 1.45 + 0.5, 0.0, 1.0);

  gl_FragColor = vec4(clamp(density, 0.0, 1.0), clamp(filaments, 0.0, 1.0), clamp(clumps, 0.0, 1.0), 1.0);
}
