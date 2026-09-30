import { describe, it, expect } from 'vitest';
import { escapeCsvCell, buildCsv, buildSkippedRowsCsv } from './csv';

describe('csv helpers', () => {
  it('leaves plain values unquoted', () => {
    expect(escapeCsvCell('Row 4: missing name')).toBe('Row 4: missing name');
    expect(escapeCsvCell(12)).toBe('12');
    expect(escapeCsvCell(null)).toBe('');
  });

  it('quotes commas, quotes, line breaks and edge whitespace', () => {
    expect(escapeCsvCell('a, b')).toBe('"a, b"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(escapeCsvCell(' padded')).toBe('" padded"');
  });

  it('joins rows with CRLF', () => {
    expect(buildCsv(['a', 'b'], [[1, 'x,y']])).toBe('a,b\r\n1,"x,y"');
  });

  it('builds a single "reason" column for skipped import rows', () => {
    expect(buildSkippedRowsCsv(['Row 2: duplicate serial "SN-1"', 'Row 5: bad date, expected YYYY-MM-DD']))
      .toBe('reason\r\n"Row 2: duplicate serial ""SN-1"""\r\n"Row 5: bad date, expected YYYY-MM-DD"');
    expect(buildSkippedRowsCsv([])).toBe('reason');
  });
});
