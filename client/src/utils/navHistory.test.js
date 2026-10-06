import { describe, it, expect, beforeEach } from 'vitest';
import { recordLocation, getReferrer, resetNavHistory } from './navHistory';

const loc = (pathname, search = '') => ({ pathname, search });

describe('navHistory', () => {
  beforeEach(() => resetNavHistory());

  it('returns the inventory with its latest filters as the referrer', () => {
    recordLocation(loc('/inventory'));
    recordLocation(loc('/inventory', '?status=in-use'));
    recordLocation(loc('/inventory', '?status=in-use&q=mac'));
    const detail = loc('/inventory/12');
    // Before the detail page is recorded (first render)...
    expect(getReferrer(detail)).toMatchObject({ pathname: '/inventory', search: '?status=in-use&q=mac' });
    // ...and after.
    recordLocation(detail);
    expect(getReferrer(detail)).toMatchObject({ pathname: '/inventory', search: '?status=in-use&q=mac' });
  });

  it('is null on a fresh load', () => {
    expect(getReferrer(loc('/inventory/12'))).toBeNull();
    recordLocation(loc('/inventory/12'));
    expect(getReferrer(loc('/inventory/12'))).toBeNull();
  });

  it('reports the page before when coming from elsewhere', () => {
    recordLocation(loc('/inventory', '?q=x'));
    recordLocation(loc('/employees'));
    expect(getReferrer(loc('/inventory/3'))).toMatchObject({ pathname: '/employees' });
  });
});
