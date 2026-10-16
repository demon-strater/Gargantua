// 화면 전체를 덮는 사각형. 행렬 변환 없이 클립 공간에 바로 놓고,
// 각 픽셀의 광선은 프래그먼트 셰이더에서 카메라 행렬로 직접 복원합니다.
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
