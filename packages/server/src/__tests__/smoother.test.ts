import { describe, it, expect } from 'vitest';
import { NoteSmoother } from '../smoother.js';

describe('NoteSmoother', () => {
  it('returns the first frequency immediately (no locked note yet)', () => {
    const s = new NoteSmoother();
    expect(s.smooth(440, 3)).toBe(440);
  });

  it('returns null for null input', () => {
    const s = new NoteSmoother();
    expect(s.smooth(null, 3)).toBeNull();
  });

  it('holds the locked note when a transient different pitch appears', () => {
    const s = new NoteSmoother();
    s.smooth(440, 3); // lock A4
    expect(s.smooth(500, 3)).toBe(440); // different pitch — still locked
  });

  it('resets candidate when an unstable second candidate appears', () => {
    const s = new NoteSmoother();
    s.smooth(440, 3);   // lock
    s.smooth(500, 3);   // candidate 500 Hz (count = 1)
    s.smooth(600, 3);   // different candidate — reset to 600 Hz (count = 1)
    // Only 1 vote for 600, window = 3 → still locked to 440
    expect(s.smooth(440, 3)).toBe(440);
  });

  it('switches to a new note after window consecutive consistent frames', () => {
    const s = new NoteSmoother();
    s.smooth(440, 3); // lock A4
    s.smooth(500, 3); // candidate, count = 1
    s.smooth(500, 3); // candidate, count = 2
    // Third occurrence reaches window = 3 — accept new note
    expect(s.smooth(500, 3)).toBeCloseTo(500);
  });

  it('returns the locked note while candidate is accumulating', () => {
    const s = new NoteSmoother();
    s.smooth(440, 3);
    s.smooth(500, 3); // count = 1, window = 3 → still locked
    expect(s.smooth(500, 3)).toBe(440); // count = 2, still locked
  });

  it('accepts frequencies within 50 cents as the same note', () => {
    const s = new NoteSmoother();
    s.smooth(440, 3); // lock A4
    // 440 * 2^(40/1200) ≈ 450.7 Hz — 40 cents sharp, within 50-cent threshold
    const nearA4 = 440 * Math.pow(2, 40 / 1200);
    expect(s.smooth(nearA4, 3)).toBe(440); // stays locked, no candidate started
  });

  it('bypasses smoothing when window is 1', () => {
    const s = new NoteSmoother();
    s.smooth(440, 1); // lock
    expect(s.smooth(880, 1)).toBe(880); // window ≤ 1 → pass through immediately
  });

  it('resets cleanly', () => {
    const s = new NoteSmoother();
    s.smooth(440, 3); // lock
    s.reset();
    // After reset, the next frequency is accepted immediately as the first note
    expect(s.smooth(880, 3)).toBe(880);
  });

  it('resetting null input clears any in-progress candidate', () => {
    const s = new NoteSmoother();
    s.smooth(440, 3);
    s.smooth(500, 3); // start building candidate
    s.smooth(null, 3); // null clears candidate
    // 500 Hz would need to restart its 3-frame window from scratch
    s.smooth(500, 3); // count = 1
    expect(s.smooth(440, 3)).toBe(440); // still locked to 440
  });
});
