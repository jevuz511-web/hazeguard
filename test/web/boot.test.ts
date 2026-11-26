// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { byId } from '../../web/dom';
import { loadPage } from './support';

describe('boot', () => {
  it('starts the page with the real browser services', async () => {
    loadPage();
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    await import('../../web/boot');
    expect(byId('trip-list', HTMLOListElement).children).toHaveLength(1);
    byId('use-location', HTMLButtonElement).click();
    expect(byId('location-status', HTMLElement).textContent).toMatch(/cannot share/u);
    byId('print-plan', HTMLButtonElement).click();
    expect(print).toHaveBeenCalledOnce();
  });
});
