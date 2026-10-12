import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRewardedAdAdapter, type AdSdk } from './rewarded-ad-adapter';

function harness(supported = true) {
  let load!: Parameters<AdSdk['loadFullScreenAd']>[0];
  let show!: Parameters<AdSdk['showFullScreenAd']>[0];
  const cleanup = vi.fn();
  const sdk: AdSdk = {
    loadFullScreenAd: Object.assign(vi.fn((params) => { load = params; return cleanup; }), { isSupported: () => supported }),
    showFullScreenAd: Object.assign(vi.fn((params) => { show = params; return cleanup; }), { isSupported: () => supported }),
  };
  return { sdk, cleanup, load: () => load, show: () => show };
}
afterEach(() => vi.useRealTimers());
describe('rewarded ad lifecycle', () => {
  it('unsupported environment fails without calling native APIs', async () => {
    const h = harness(false);
    expect(await createRewardedAdAdapter(h.sdk, 'test').requestRewardedAd()).toBe('failed');
    expect(h.sdk.loadFullScreenAd).not.toHaveBeenCalled();
  });
  it('requires reward event and waits for dismissal; duplicate events settle once', async () => {
    const h = harness(); const adapter = createRewardedAdAdapter(h.sdk, 'test');
    const request = adapter.requestRewardedAd();
    h.load().onEvent({ type: 'loaded' }); await Promise.resolve();
    h.show().onEvent({ type: 'userEarnedReward' });
    h.show().onEvent({ type: 'userEarnedReward' });
    h.show().onEvent({ type: 'dismissed' });
    h.show().onEvent({ type: 'failedToShow' });
    expect(await request).toBe('completed');
    expect(h.cleanup).toHaveBeenCalledTimes(2);
  });
  it('click and impression alone do not grant rewards', async () => {
    const h = harness(); const request = createRewardedAdAdapter(h.sdk, 'test').requestRewardedAd();
    h.load().onEvent({ type: 'loaded' }); await Promise.resolve();
    h.show().onEvent({ type: 'clicked' }); h.show().onEvent({ type: 'impression' });
    h.show().onEvent({ type: 'dismissed' });
    expect(await request).toBe('dismissed');
  });
  it('rejects parallel requests and reloads after completion', async () => {
    const h = harness(); const adapter = createRewardedAdAdapter(h.sdk, 'test');
    const first = adapter.requestRewardedAd();
    expect(await adapter.requestRewardedAd()).toBe('failed');
    h.load().onError(new Error()); expect(await first).toBe('failed');
    const next = adapter.requestRewardedAd();
    expect(h.sdk.loadFullScreenAd).toHaveBeenCalledTimes(2);
    h.load().onError(new Error()); await next;
  });
  it('load timeout cleans up and ignores late loaded events', async () => {
    vi.useFakeTimers(); const h = harness();
    const request = createRewardedAdAdapter(h.sdk, 'test', 100).requestRewardedAd();
    await vi.advanceTimersByTimeAsync(100);
    expect(await request).toBe('failed');
    h.load().onEvent({ type: 'loaded' });
    expect(h.sdk.showFullScreenAd).not.toHaveBeenCalled();
  });
  it('show errors fail without a reward', async () => {
    const h = harness(); const request = createRewardedAdAdapter(h.sdk, 'test').requestRewardedAd();
    h.load().onEvent({ type: 'loaded' }); await Promise.resolve();
    h.show().onError(new Error()); expect(await request).toBe('failed');
  });
});
