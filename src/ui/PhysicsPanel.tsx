import { useMemo } from 'react'
import {
  AU_KM,
  SOLAR_GRAVITATIONAL_RADIUS_KM,
  circularOrbitTimeDilation,
  diskInnerRadius,
  horizonRadius,
  iscoRadius,
  photonOrbitRadii,
} from '../lib/kerr'
import { PRESETS } from '../lib/presets'
import { flyToView, getUi, setUi, tweenPhysics, useUi, type MorphMode, type PhysicsParams } from '../state/store'

type NumericKey = Exclude<keyof PhysicsParams, 'lensing' | 'indigo' | 'morph' | 'morphMode'>

type SliderSpec = {
  key: NumericKey
  label: string
  min: number
  max: number
  step: number
  format: (value: number, params: PhysicsParams) => string
  hint: string
}

const SLIDERS: SliderSpec[] = [
  {
    key: 'spin',
    label: '스핀 a/M',
    min: -0.999,
    max: 0.999,
    step: 0.001,
    format: (v) => v.toFixed(3),
    hint: '그림자 모양 · 원반 안쪽 경계 · 틀 끌림. 음수면 원반이 반대로 공전',
  },
  {
    key: 'beaming',
    label: '도플러 · 적색편이',
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => (v < 0.005 ? '영화 연출' : `${Math.round(v * 100)}%`),
    hint: '0% = 영화처럼 끔, 100% = 실제 물리 (g³ 밝기 · 색온도 이동)',
  },
  {
    key: 'thickness',
    label: '원반 두께 H/r',
    min: 0.005,
    max: 0.08,
    step: 0.001,
    format: (v) => v.toFixed(3),
    hint: '가스층의 상대 두께. 얇을수록 칼날 같은 원반',
  },
  {
    key: 'temperature',
    label: '원반 온도',
    min: 3000,
    max: 12000,
    step: 50,
    format: (v) => `${Math.round(v).toLocaleString()} K`,
    hint: '가장 뜨거운 곳의 온도. 손(Thorne)은 태양 표면 정도로 설정했습니다',
  },
  {
    key: 'outer',
    label: '원반 크기',
    min: 10,
    max: 40,
    step: 0.5,
    format: (v) => `${v.toFixed(1)} M`,
    hint: '원반 바깥 반지름',
  },
  {
    key: 'inner',
    label: '원반 안쪽 경계',
    min: 0,
    max: 0.95,
    step: 0.005,
    format: (v, p) => (v < 0.003 ? 'ISCO' : `${diskInnerRadius(p.spin, p.outer, v).toFixed(1)} M`),
    hint: '원반이 ISCO보다 바깥에서 잘린 경우. 넓힐수록 도넛 → 가는 고리가 됩니다',
  },
  {
    key: 'flow',
    label: '고온 가스층',
    min: 0,
    max: 1,
    step: 0.01,
    format: (v) => (v < 0.005 ? '없음' : `${Math.round(v * 100)}%`),
    hint: '지평선까지 이어지는 두껍고 뜨거운 가스(EHT 관측 모델). 옆에서 보면 그림자 앞을 덮습니다',
  },
  {
    key: 'roll',
    label: '화면 회전',
    min: -90,
    max: 90,
    step: 1,
    format: (v) => `${Math.round(v)}°`,
    hint: '90°면 원반이 세로로 섭니다',
  },
  {
    key: 'exposure',
    label: '노출',
    min: 0.3,
    max: 2.5,
    step: 0.01,
    format: (v) => `${v.toFixed(2)}×`,
    hint: '카메라 노출',
  },
  {
    key: 'massLog',
    label: '질량',
    min: 6,
    max: 10,
    step: 0.05,
    format: (v) => `10^${v.toFixed(1)} M☉`,
    hint: '질량은 크기만 바꿉니다. 모양은 스핀과 시선 각도로만 정해집니다',
  },
]

const MORPH_MODES: { id: MorphMode; label: string; hint: string }[] = [
  { id: 'spin', label: '스핀 변화', hint: '스핀 a/M 하나만 +0.998 ↔ −0.998로 오갑니다 (순수한 물리 값 변화)' },
  { id: 'inner', label: '안쪽 경계', hint: '원반이 잘리는 안쪽 경계만 ISCO ↔ 바깥 가장자리로 오갑니다' },
]

export function PhysicsPanel() {
  const open = useUi((state) => state.panelOpen)
  const params = useUi((state) => state.params)
  const presetId = useUi((state) => state.preset)
  const derived = useMemo(() => deriveQuantities(params), [params])
  const activePreset = PRESETS.find((preset) => preset.id === presetId)

  const update = (patch: Partial<PhysicsParams>, preset: string | null = null) => {
    const next = { ...getUi().params, ...patch }
    setUi({ params: next, preset })
    tweenPhysics(next, preset ? 1.8 : 0.5)
  }

  return (
    <div className="panel-dock" data-open={open}>
      <section id="physics-panel" className="panel" aria-label="블랙홀 물리 파라미터" inert={!open}>
        <header className="panel__head">
          <p className="panel__eyebrow">Kerr spacetime</p>
          <h2 className="panel__title">물리 파라미터</h2>
        </header>

        <div className="panel__presets" role="group" aria-label="프리셋">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              aria-pressed={preset.id === presetId}
              onClick={() => {
                update(preset.params, preset.id)
                flyToView(preset.view.inclination, preset.view.distance)
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <p className="panel__note">{activePreset ? activePreset.note : '사용자 설정'}</p>

        <button
          type="button"
          className="panel__morph"
          aria-pressed={params.morph}
          onClick={() => update({ morph: !params.morph })}
        >
          <i aria-hidden="true" />
          {params.morph ? '형태 변형 멈추기' : '형태 변형 재생'}
          <span>{MORPH_MODES.find((mode) => mode.id === params.morphMode)?.hint}</span>
        </button>
        <div className="panel__modes" role="group" aria-label="형태 변형 방식">
          {MORPH_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              aria-pressed={params.morphMode === mode.id}
              onClick={() => update({ morphMode: mode.id })}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <div className="panel__sliders">
          {SLIDERS.map((spec) => (
            <label key={spec.key} className="slider">
              <span className="slider__row">
                <span className="slider__label">
                  {spec.key === 'temperature' && (
                    <i className="slider__swatch" style={{ background: kelvinToCss(params.temperature) }} />
                  )}
                  {spec.label}
                </span>
                <output className="slider__value">{spec.format(params[spec.key], params)}</output>
              </span>
              <input
                type="range"
                disabled={params.morph && ((spec.key === 'spin' && params.morphMode === 'spin') || (spec.key === 'inner' && params.morphMode === 'inner'))}
                min={spec.min}
                max={spec.max}
                step={spec.step}
                value={params[spec.key]}
                onChange={(event) => update({ [spec.key]: Number(event.currentTarget.value) })}
              />
              <span className="slider__hint">{spec.hint}</span>
            </label>
          ))}

          <label className="switch">
            <span>
              <span className="slider__label">인디고 색감</span>
              <span className="slider__hint">흑체 색 대신 푸른 보랏빛으로 칠합니다 (연출용)</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={params.indigo}
              onChange={(event) => update({ indigo: event.currentTarget.checked })}
            />
          </label>

          <label className="switch">
            <span>
              <span className="slider__label">중력 렌즈</span>
              <span className="slider__hint">끄면 빛이 직진합니다 — 휘어짐이 얼마나 큰지 비교해 보세요</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={params.lensing}
              onChange={(event) => update({ lensing: event.currentTarget.checked })}
            />
          </label>
        </div>

        <dl className="panel__derived">
          <div>
            <dt>사건의 지평선 r₊</dt>
            <dd>
              {derived.horizon.toFixed(3)} M <small>{derived.horizonSize}</small>
            </dd>
          </div>
          <div>
            <dt>원반 안쪽 경계 (ISCO)</dt>
            <dd>{derived.isco.toFixed(3)} M</dd>
          </div>
          <div>
            <dt>원형 광자 궤도</dt>
            <dd>
              {derived.photon[0].toFixed(2)} – {derived.photon[1].toFixed(2)} M
            </dd>
          </div>
          <div>
            <dt>ISCO 공전 주기</dt>
            <dd>{derived.period}</dd>
          </div>
          <div className="panel__wide">
            <dt>ISCO 궤도의 1시간은 먼 곳에서</dt>
            <dd>{derived.dilation}</dd>
          </div>
        </dl>

        <p className="panel__source">
          영화 속 이미지는 a/M = 0.6, 도플러 효과 제외로 렌더링되었습니다 —{' '}
          <a href="https://arxiv.org/abs/1502.03808" target="_blank" rel="noreferrer">
            James, von Tunzelmann, Franklin &amp; Thorne (2015)
          </a>
        </p>
      </section>

      <button
        type="button"
        className="panel-toggle"
        aria-expanded={open}
        aria-controls="physics-panel"
        onClick={() => setUi({ panelOpen: !open })}
      >
        <i /> Physics <span>{open ? '닫기' : '물리 파라미터'}</span>
      </button>
    </div>
  )
}

function deriveQuantities(params: PhysicsParams) {
  const a = params.spin
  const horizon = horizonRadius(a)
  const isco = iscoRadius(a)
  const mass = 10 ** params.massLog
  const kmPerM = SOLAR_GRAVITATIONAL_RADIUS_KM * mass
  const horizonKm = horizon * kmPerM
  const horizonAu = horizonKm / AU_KM
  // 먼 관측자가 보는 원궤도 주기 T = 2π (r^{3/2} + a) GM/c³
  const periodSeconds = 2 * Math.PI * (Math.pow(isco, 1.5) + a) * mass * 4.9255e-6
  const dilation = circularOrbitTimeDilation(isco * 1.0001, a)
  return {
    horizon,
    isco,
    photon: photonOrbitRadii(a),
    horizonSize: horizonAu >= 0.01 ? `≈ ${horizonAu.toPrecision(3)} AU` : `≈ ${Math.round(horizonKm).toLocaleString()} km`,
    period: formatDuration(periodSeconds),
    dilation: Number.isFinite(dilation) ? `${dilation.toFixed(2)}시간` : '—',
  }
}

function formatDuration(seconds: number) {
  if (seconds < 120) return `${seconds.toFixed(0)}초`
  if (seconds < 7200) return `${(seconds / 60).toFixed(1)}분`
  if (seconds < 172800) return `${(seconds / 3600).toFixed(1)}시간`
  return `${(seconds / 86400).toFixed(1)}일`
}

/** 흑체 색온도 → CSS 색 (셰이더의 blackbody()와 같은 근사) */
function kelvinToCss(kelvin: number) {
  const t = kelvin / 100
  const clamp = (v: number) => Math.min(Math.max(v, 0), 1)
  const r = t <= 66 ? 1 : clamp(1.29293618606 * Math.pow(t - 60, -0.1332047592))
  const g = t <= 66 ? clamp(0.39008157876 * Math.log(t) - 0.63184144378) : clamp(1.12989086089 * Math.pow(t - 60, -0.0755148492))
  const b = t >= 66 ? 1 : t <= 19 ? 0 : clamp(0.54320678911 * Math.log(t - 10) - 1.19625408914)
  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`
}
