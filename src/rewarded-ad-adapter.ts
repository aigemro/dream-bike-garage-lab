import type { RewardedAdAdapter, RewardedAdResult } from './energy-refill';

type Event = { type: string };
type Call = ((params: { options: { adGroupId: string }; onEvent(event: Event): void; onError(error: unknown): void }) => () => void) & { isSupported(): boolean };
export type AdSdk = { loadFullScreenAd: Call; showFullScreenAd: Call };

/** One request owns its callbacks. Reward is confirmed only by the SDK reward event. */
export function createRewardedAdAdapter(sdk: AdSdk, adGroupId: string, loadTimeoutMs = 15000): RewardedAdAdapter {
  let busy = false;
  return {
    async requestRewardedAd() {
      if (busy || !adGroupId) return 'failed';
      busy = true;
      try {
        if (!sdk.loadFullScreenAd.isSupported() || !sdk.showFullScreenAd.isSupported()) return 'failed';
        const loaded = await new Promise<boolean>((resolve) => {
          let done = false;
          let cleanup: (() => void) | undefined;
          const finish = (ok: boolean) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            cleanup?.();
            resolve(ok);
          };
          const timer = setTimeout(() => finish(false), loadTimeoutMs);
          try {
            cleanup = sdk.loadFullScreenAd({ options: { adGroupId }, onEvent: (event) => {
              if (event.type === 'loaded') finish(true);
            }, onError: () => finish(false) });
            if (done) cleanup();
          } catch { finish(false); }
        });
        if (!loaded) return 'failed';
        return await new Promise<RewardedAdResult>((resolve) => {
          let done = false;
          let earned = false;
          let cleanup: (() => void) | undefined;
          const finish = (result: RewardedAdResult) => {
            if (done) return;
            done = true;
            cleanup?.();
            resolve(result);
          };
          try {
            cleanup = sdk.showFullScreenAd({ options: { adGroupId }, onEvent: (event) => {
              if (event.type === 'userEarnedReward') earned = true;
              if (event.type === 'dismissed') finish(earned ? 'completed' : 'dismissed');
              if (event.type === 'failedToShow') finish(earned ? 'completed' : 'failed');
            }, onError: () => finish(earned ? 'completed' : 'failed') });
            if (done) cleanup();
          } catch { finish(earned ? 'completed' : 'failed'); }
          // No show timeout: a timer cannot determine whether the user earned a reward.
        });
      } catch { return 'failed'; }
      finally { busy = false; }
    },
  };
}

export function createTossTestAdapter(): RewardedAdAdapter {
  let adapter: RewardedAdAdapter | undefined;
  return {
    async requestRewardedAd() {
      try {
        const sdk = await import('@apps-in-toss/web-framework');
        adapter ??= createRewardedAdAdapter(sdk, 'ait-ad-test-rewarded-id');
        return await adapter.requestRewardedAd();
      } catch { return 'failed'; }
    },
  };
}
