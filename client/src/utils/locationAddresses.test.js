import { describe, it, expect } from 'vitest';
import { parseLocationAddresses } from './locationAddresses';

describe('parseLocationAddresses', () => {
  it('returns array addresses as-is', () => {
    expect(parseLocationAddresses({ addresses: ['A', 'B'] })).toEqual(['A', 'B']);
  });

  it('parses JSON-encoded addresses', () => {
    expect(parseLocationAddresses({ addresses: '["A","B"]' })).toEqual(['A', 'B']);
  });

  it('returns an empty list for malformed or non-array JSON', () => {
    expect(parseLocationAddresses({ addresses: '["A",' })).toEqual([]);
    expect(parseLocationAddresses({ addresses: '{"a":1}' })).toEqual([]);
  });

  it('returns an empty list when there are no addresses', () => {
    expect(parseLocationAddresses({})).toEqual([]);
    expect(parseLocationAddresses(null)).toEqual([]);
    expect(parseLocationAddresses(undefined)).toEqual([]);
  });
});
