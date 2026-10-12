import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../utils/monitoring', () => ({ reportError: vi.fn() }));

import { ErrorBoundary, ErrorFallback } from './ErrorBoundary';

describe('ErrorFallback', () => {
  it('shows a friendly message with Reload and Go to dashboard', () => {
    const html = renderToStaticMarkup(<ErrorFallback error={new Error('boom')} showDetails={false} />);
    expect(html).toContain('Something went wrong');
    expect(html).toContain('Reload');
    expect(html).toContain('Go to dashboard');
    expect(html).toContain('role="alert"');
    // Error text stays hidden outside development.
    expect(html).not.toContain('boom');
  });

  it('shows collapsed error details in development', () => {
    const html = renderToStaticMarkup(<ErrorFallback error={new Error('boom')} showDetails />);
    expect(html).toContain('<details');
    expect(html).toContain('boom');
  });

  it('explains a missing page file after a deploy', () => {
    const html = renderToStaticMarkup(
      <ErrorFallback error={new TypeError('Failed to fetch dynamically imported module: /assets/Settings-abc.js')} showDetails={false} />,
    );
    expect(html).toContain('was updated');
  });
});

describe('ErrorBoundary', () => {
  it('renders its children when nothing failed', () => {
    const html = renderToStaticMarkup(<ErrorBoundary resetKey="/"><p>page</p></ErrorBoundary>);
    expect(html).toBe('<p>page</p>');
  });

  it('stores the error and clears it when the route changes', () => {
    const error = new Error('boom');
    expect(ErrorBoundary.getDerivedStateFromError(error)).toEqual({ error });
    expect(ErrorBoundary.getDerivedStateFromProps({ resetKey: '/a' }, { error, resetKey: '/a' })).toBeNull();
    expect(ErrorBoundary.getDerivedStateFromProps({ resetKey: '/b' }, { error, resetKey: '/a' }))
      .toEqual({ error: null, resetKey: '/b' });
  });

  it('renders the fallback while an error is stored', () => {
    const boundary = new ErrorBoundary({ resetKey: '/', children: <p>page</p> });
    boundary.state = { error: new Error('boom'), resetKey: '/' };
    const html = renderToStaticMarkup(boundary.render());
    expect(html).toContain('Something went wrong');
  });
});
