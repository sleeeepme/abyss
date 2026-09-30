/* Provider-neutral rewarded ads. Providers return {status:'rewarded'} ONLY
   from the SDK's verified completion callback. No reward logic lives here. */
(() => {
  'use strict';
  let provider = null, active = null;
  const statuses = new Set(['rewarded', 'cancelled', 'unavailable', 'error']);
  window.ABYSS_ADS = Object.freeze({
    get busy() { return active !== null; },
    get providerName() { return provider?.name || 'none'; },
    setProvider(next) {
      if (active) throw new Error('Cannot replace an active ad provider');
      if (next !== null && (typeof next.name !== 'string' || typeof next.requestRewarded !== 'function'))
        throw new TypeError('Invalid ad provider');
      provider = next;
    },
    cancel() { active?.finish('cancelled'); },
    requestRewarded(placement, {timeoutMs = 120000} = {}) {
      if (active) return Promise.resolve({status:'busy'});
      if (!provider) return Promise.resolve({status:'unavailable'});
      if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new TypeError('Invalid ad timeout');
      const selected = provider;
      return new Promise(resolve => {
        const controller = new AbortController();
        let settled = false, timer;
        const job = {finish(status) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          active = null;
          controller.abort(); // SDK adapters must remove callbacks / release owned UI.
          resolve({status});
        }};
        active = job;
        timer = setTimeout(() => job.finish('timeout'), timeoutMs);
        try {
          Promise.resolve(selected.requestRewarded({placement, signal:controller.signal}))
            .then(result => job.finish(statuses.has(result?.status) ? result.status : 'error'),
                  () => job.finish('error'));
        } catch (_) { job.finish('error'); }
      });
    }
  });
})();
