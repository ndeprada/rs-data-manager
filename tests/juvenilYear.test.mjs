import assert from 'node:assert/strict';
import { juvenilYear } from '../src/lib/juvenilYear.js';

assert.equal(juvenilYear(2010, '2026-2027'), 1);
assert.equal(juvenilYear(2009, '2026-2027'), 2);
assert.equal(juvenilYear('2008', '2026-2027'), 3);
assert.equal(juvenilYear(2011, '2026-2027'), null, 'cadete');
assert.equal(juvenilYear(2007, '2026-2027'), null, 'ya no es juvenil');
assert.equal(juvenilYear(2009, '2025-2026'), 1);
assert.equal(juvenilYear(null, '2026-2027'), null);
assert.equal(juvenilYear(2010, ''), null);
console.log('juvenilYear ok');
