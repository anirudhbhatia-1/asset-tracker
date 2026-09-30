import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import ImportResultsPanel from './ImportResultsPanel';
import { formatImportError, importProblemReasons } from '../../utils/importResults';

const checkResult = {
  dryRun: true,
  imported: 12,
  skipped: ['Duplicate serial: LAP-1'],
  errors: [{ row: 4, sheet: 'Laptops', serial: 'LAP-9', messages: ['Purchase Price "1e3" is not a valid amount', 'bad date'] }],
  warnings: ['Employee not found: x@y.com (Laptops, serial LAP-2); imported as available'],
  categoriesCreated: [],
  generatedSerials: 1,
  handovers: 0,
};

describe('ImportResultsPanel', () => {
  it('shows a dry run as a check with confirm and cancel, and nothing saved yet', () => {
    const html = renderToStaticMarkup(<ImportResultsPanel result={checkResult} />);
    expect(html).toContain('ready to import');
    expect(html).toContain('Nothing has been saved yet');
    expect(html).toContain('Import 12 assets');
    expect(html).toContain('Cancel');
    expect(html).toContain('Rows with errors will be left out.');
    // Errors and warnings are expanded for a check.
    expect(html).toContain('Laptops row 4 (LAP-9): Purchase Price &quot;1e3&quot; is not a valid amount; bad date');
    expect(html).toContain('Employee not found: x@y.com');
    expect(html).not.toContain('Dismiss');
  });

  it('disables the confirm button when nothing would be imported', () => {
    const html = renderToStaticMarkup(<ImportResultsPanel result={{ ...checkResult, imported: 0 }} />);
    expect(html).toContain('Nothing to import');
  });

  it('shows a finished import with dismiss and the download of problem rows', () => {
    const html = renderToStaticMarkup(<ImportResultsPanel result={{ ...checkResult, dryRun: false }} />);
    expect(html).toContain('Excel import finished: 12 imported');
    expect(html).toContain('Dismiss');
    expect(html).toContain('Download problem rows (CSV)');
    expect(html).not.toContain('Import 12 assets');
  });
});

describe('import result text', () => {
  it('formats errors and lists every problem for the CSV download', () => {
    expect(formatImportError({ row: 3, serial: null, messages: ['x'] })).toBe('row 3: x');
    expect(importProblemReasons(checkResult)).toEqual([
      'Error: Laptops row 4 (LAP-9): Purchase Price "1e3" is not a valid amount; bad date',
      'Skipped: Duplicate serial: LAP-1',
      'Warning: Employee not found: x@y.com (Laptops, serial LAP-2); imported as available',
    ]);
  });
});
