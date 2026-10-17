import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import ts from 'typescript'
import * as THREE from 'three'

const root = fileURLToPath(new URL('../', import.meta.url))
const generated = path.join(root, '.local', 'physics-check')
for (const file of ['lib/kerr', 'lib/presets', 'lib/quality', 'state/store', 'ui/zones']) {
  const input = await readFile(path.join(root, 'src', `${file}.ts`), 'utf8')
  const output = ts.transpileModule(input, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
    .replace(/(from\s+['"])(\.\.?\/[^'"]+)(['"])/g, '$1$2.mjs$3')
  await mkdir(path.dirname(path.join(generated, file)), { recursive: true })
  await writeFile(path.join(generated, `${file}.mjs`), output)
}
const k = await import(pathToFileURL(path.join(generated, 'lib/kerr.mjs')))
const { physics, flight, telemetry, getUi } = await import(pathToFileURL(path.join(generated, 'state/store.mjs')))
const { ZONES, buildContext, detectZone } = await import(pathToFileURL(path.join(generated, 'ui/zones.mjs')))
const { PRESETS } = await import(pathToFileURL(path.join(generated, 'lib/presets.mjs')))
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`)
let assertions = 0
function check(label, run) { run(); assertions++; console.log(`PASS ${label}`) }

check('Schwarzschild analytic radii and lapse', () => {
  near(k.horizonRadius(0), 2); near(k.iscoRadius(0), 6)
  for (const r of k.photonOrbitRadii(0)) near(r, 3)
  near(k.zamo(10, Math.PI / 2, 0, 1).alpha, Math.sqrt(.8))
  near(k.zamo(10, .4, 0, 1).omega, 0)
  near(k.circularOrbitTimeDilation(6, 0), Math.sqrt(2))
})
check('Kerr spin limits and orbit ordering', () => {
  near(k.horizonRadius(.6), 1.8)
  near(k.iscoRadius(.6), 3.82906941881315, 1e-10)
  near(k.iscoRadius(-.9), 8.717352279606489, 1e-10)
  for (const a of [-.999, -.6, 0, .6, .999]) {
    assert.ok(k.iscoRadius(a) > k.horizonRadius(a))
    near(k.ergosphereRadius(a, Math.PI / 2), 2)
    near(k.ergosphereRadius(a, 0), k.horizonRadius(a))
    assert.ok(k.radiativeEfficiency(a) > 0 && k.radiativeEfficiency(a) < .5)
  }
})
check('Oblate coordinate round trips and orthonormal camera basis', () => {
  for (const a of [-.999, 0, .6, .999]) for (const r of [2.2, 4, 19.24, 38, 320]) for (const theta of [.001, .3, 1.57, 2.8, 3.14]) {
    const p = k.blToCartesian(r, theta, 1.2, a, new THREE.Vector3())
    const bl = k.cartesianToBL(p, a, new THREE.Vector3())
    near(bl.x, r, 1e-8); near(bl.y, theta, 1e-8); near(bl.z, 1.2, 1e-8)
    const matrix = k.blBasis(r, theta, 1.2, a, new THREE.Matrix3())
    const v = [0, 1, 2].map(i => new THREE.Vector3().fromArray(matrix.elements, 3 * i))
    v.forEach(x => near(x.length(), 1)); near(v[0].dot(v[1]), 0); near(v[1].dot(v[2]), 0); near(v[0].dot(v[2]), 0)
  }
})
check('Horizon protection survives center, poles, and spin edits', () => {
  for (const a of [-.999, 0, .6, .999]) for (const point of [[0,0,0], [0,.2,0], [.6,0,.8], [0,0,1.1]]) {
    const p = new THREE.Vector3(...point), scratch = new THREE.Vector3()
    assert.ok(k.constrainFlightPosition(p, a, scratch))
    k.cartesianToBL(p, a, scratch)
    near(scratch.x, k.horizonRadius(a) + .12, 1e-9)
    assert.ok(Number.isFinite(k.zamo(scratch.x, scratch.y, a, 1).alpha))
  }
  const safe = new THREE.Vector3(0,0,38)
  assert.equal(k.constrainFlightPosition(safe, .6, new THREE.Vector3()), false)
  near(safe.z, 38)
})
function context(r, height = .1) {
  telemetry.r = r; telemetry.theta = Math.acos(height / r)
  flight.position.set(0, height, Math.sqrt(r * r - height * height))
  telemetry.planet.set(100,100,100)
  const frame = k.zamo(r, telemetry.theta, physics.spin, 1)
  Object.assign(telemetry, frame)
  return buildContext(getUi().params)
}
check('Navigation destinations detect the expected physical zones', () => {
  physics.spin = .6
  assert.equal(detectZone(context(38), null), 'overview')
  assert.equal(detectZone(context(19.24, 3), null), 'disk')
  assert.equal(detectZone(context(k.photonOrbitRadii(.6)[1] + .35, 1), null), 'photon')
  assert.equal(detectZone(context(k.horizonRadius(.6) + .17), null), 'horizon')
  assert.equal(detectZone(context(110), null), null)
})
check('Zone boundaries have hysteresis without hiding higher priority zones', () => {
  assert.equal(detectZone(context(26.5), 'disk'), 'disk')
  assert.equal(detectZone(context(26.5), null), 'lensing')
  assert.equal(detectZone(context(1.95), 'disk'), 'horizon')
})
check('All zone telemetry stays finite outside the horizon', () => {
  for (const a of [-.999, 0, .6, .999]) {
    physics.spin = a
    for (const r of [k.horizonRadius(a) + .12, 6, 20, 38]) {
      const c = context(r)
      const zone = ZONES.find(z => z.id === detectZone(c, null))
      for (const [, value] of zone?.rows(c) ?? []) assert.ok(!/NaN|undefined|Infinity/.test(value), value)
    }
  }
})
check('Every optical preset restores lensing and stays outside its horizon', () => {
  assert.equal(new Set(PRESETS.map(p => p.id)).size, PRESETS.length)
  for (const preset of PRESETS) {
    assert.equal(preset.params.lensing, true)
    assert.ok(preset.view.distance > k.horizonRadius(preset.params.spin))
    assert.ok(preset.params.outer > k.iscoRadius(preset.params.spin))
  }
})
console.log(`${assertions} physics regression groups passed.`)
