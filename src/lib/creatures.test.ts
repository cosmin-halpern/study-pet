import { describe, it, expect } from 'vitest';
import {
  SPECIES,
  THRESH,
  MOODS,
  MOOD_COPY,
  ART,
  FADE_HUE,
  lvOf,
  moodOf,
  colorOf,
  speciesOf,
  type SpeciesId,
} from './creatures';

describe('lvOf', () => {
  it('is 0 below the first threshold', () => {
    expect(lvOf(0)).toBe(0);
    expect(lvOf(9)).toBe(0);
  });

  it('crosses to 1 exactly at day 10, never before', () => {
    expect(lvOf(10)).toBe(1);
    expect(lvOf(29)).toBe(1);
  });

  it('crosses to 2 exactly at day 30, never before', () => {
    expect(lvOf(30)).toBe(2);
    expect(lvOf(1000)).toBe(2);
  });

  it('matches THRESH boundaries directly', () => {
    for (const t of THRESH) {
      expect(lvOf(t)).toBe(THRESH.indexOf(t));
    }
  });
});

describe('speciesOf', () => {
  it('resolves every SpeciesId back to its own record', () => {
    for (const s of SPECIES) {
      expect(speciesOf(s.id)).toBe(s);
    }
  });
});

describe('moodOf', () => {
  it('is happy at full and near-full health', () => {
    expect(moodOf(100)).toBe('happy');
    expect(moodOf(70)).toBe('happy');
  });

  it('is flat in the middle band', () => {
    expect(moodOf(69)).toBe('flat');
    expect(moodOf(30)).toBe('flat');
  });

  it('is sad while still alive but low', () => {
    expect(moodOf(29)).toBe('sad');
    expect(moodOf(1)).toBe('sad');
  });

  it('is x (faded) at zero or below', () => {
    expect(moodOf(0)).toBe('x');
    expect(moodOf(-5)).toBe('x');
  });
});

describe('colorOf', () => {
  it('keeps the species hue while any health remains', () => {
    expect(colorOf('#5C9E6E', 1)).toBe('#5C9E6E');
    expect(colorOf('#5C9E6E', 100)).toBe('#5C9E6E');
  });

  it('falls back to the shared fade colour at zero health', () => {
    expect(colorOf('#5C9E6E', 0)).toBe(FADE_HUE);
  });
});

describe('MOOD_COPY', () => {
  it('has non-empty copy for every mood', () => {
    for (const m of MOODS) {
      expect(MOOD_COPY[m].label.length).toBeGreaterThan(0);
      expect(MOOD_COPY[m].blurb.length).toBeGreaterThan(0);
    }
  });
});

describe('SPECIES', () => {
  it('has exactly 5 species with unique ids', () => {
    expect(SPECIES).toHaveLength(5);
    expect(new Set(SPECIES.map((s) => s.id)).size).toBe(5);
  });

  it('gives every species exactly 3 evolution names, one per THRESH stage', () => {
    for (const s of SPECIES) {
      expect(s.names).toHaveLength(THRESH.length);
    }
  });

  it('uses a valid 6-digit hex hue for every species', () => {
    for (const s of SPECIES) {
      expect(s.hue).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

// These deliberately avoid asserting exact path data — that's placeholder
// geometry meant to be replaced with real Linearity Curve art. What has to
// hold regardless of the exact shapes is the design-guide's own contract:
// single fill via var(--mood), no gradients/filters, no embedded <svg>,
// and strictly additive levels.
describe('ART', () => {
  const ids = SPECIES.map((s) => s.id) as SpeciesId[];

  it.each(ids)('%s: uses only var(--mood) plus the two fixed code colours', (id) => {
    for (const lv of [0, 1, 2]) {
      for (const mood of MOODS) {
        const svg = ART[id](lv, mood);
        const hexColors = svg.match(/#[0-9A-Fa-f]{3,6}/g) ?? [];
        for (const hex of hexColors) {
          expect(['#16283C', '#fff']).toContain(hex);
        }
        expect(svg).toContain('var(--mood)');
      }
    }
  });

  it.each(ids)('%s: never emits gradients, filters, or a nested <svg>', (id) => {
    for (const lv of [0, 1, 2]) {
      const svg = ART[id](lv, 'happy');
      expect(svg).not.toMatch(/gradient|filter|blur|<svg/i);
    }
  });

  it.each(ids)('%s: each evolution level strictly adds content, never shrinks', (id) => {
    const lengths = [0, 1, 2].map((lv) => ART[id](lv, 'happy').length);
    expect(lengths[1]).toBeGreaterThan(lengths[0]);
    expect(lengths[2]).toBeGreaterThan(lengths[1]);
  });

  it.each(ids)('%s: face changes shape between a healthy mood and x (faded)', (id) => {
    const happy = ART[id](0, 'happy');
    const faded = ART[id](0, 'x');
    expect(happy).not.toBe(faded);
  });
});