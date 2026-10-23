import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const muscles = JSON.parse(fs.readFileSync(new URL('../src/muscles.json', import.meta.url)));
const directory = new URL('../public/models/', import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', directory)));

test('every learning entry has identifiable bilateral geometry and useful content', () => {
  assert.equal(new Set(muscles.map(m => m.id)).size, muscles.length);
  for (const muscle of muscles) {
    const parts = manifest.muscles.parts.filter(p => p.muscleId === muscle.id);
    assert(parts.length >= 2, `Missing geometry: ${muscle.name}`);
    assert(parts.some(p => p.side === 'left'), `Missing left side: ${muscle.name}`);
    assert(parts.some(p => p.side === 'right'), `Missing right side: ${muscle.name}`);
    assert(muscle.actions.length > 0 && muscle.exercises.length > 0);
    assert(muscle.origin && muscle.insertion && muscle.tip && muscle.summary);
    for (const part of parts) {
      const matching = muscles.filter(m => new RegExp(m.pattern, 'i').test(part.name));
      assert.deepEqual(matching.map(m => m.id), [muscle.id], `Ambiguous definition: ${part.name}`);
      assert(['bp3d', 'z-anatomy'].includes(part.source));
    }
  }
});

test('nearby anatomical names cannot be silently mapped to a different muscle', () => {
  const brachialis = new RegExp(muscles.find(m => m.id === 'brachialis').pattern, 'i');
  const extensor = new RegExp(muscles.find(m => m.id === 'extensor-digitorum').pattern, 'i');
  assert(brachialis.test('left brachialis'));
  assert(!brachialis.test('left coracobrachialis'));
  assert(extensor.test('left extensor digitorum'));
  assert(!extensor.test('left extensor digitorum longus'));
});

for (const kind of ['muscles', 'skeleton']) {
  test(`${kind}: distributed geometry is intact, finite, correctly indexed and human-sized`, () => {
    const chunk = manifest[kind];
    const compressed = fs.readFileSync(new URL(chunk.url, directory));
    assert.equal(createHash('sha256').update(compressed).digest('hex'), chunk.sha256);
    assert.equal(compressed.byteLength, chunk.compressedBytes);
    const bytes = gunzipSync(compressed);
    assert.equal(bytes.byteLength, chunk.bytes);
    const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let minimumY = Infinity;
    let maximumY = -Infinity;
    for (const part of chunk.parts) {
      assert(part.vertexCount > 0 && part.indexCount > 0 && part.indexCount % 3 === 0);
      assert.equal(part.positions % 4, 0);
      assert.equal(part.indices % 4, 0);
      for (let i = 0; i < part.indexCount; i++) {
        assert(data.getUint32(part.indices + i * 4, true) < part.vertexCount, part.name);
      }
      for (let i = 0; i < part.vertexCount; i++) {
        const x = data.getFloat32(part.positions + i * 12, true);
        const y = data.getFloat32(part.positions + i * 12 + 4, true);
        const z = data.getFloat32(part.positions + i * 12 + 8, true);
        assert(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z));
        assert(Math.abs(x) < 0.7 && y > -0.15 && y < 2 && Math.abs(z) < 0.6, `${part.name}: invalid axes or units`);
        minimumY = Math.min(minimumY, y);
        maximumY = Math.max(maximumY, y);
      }
    }
    assert(maximumY - minimumY > 1.4, 'Expected full-body coverage');
  });
}
