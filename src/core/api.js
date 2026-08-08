// Core API request layer — single source of truth, injected by scripts/build.js.
// Requirable directly by node:test.
//
// Deps object (injected by the build wrapper) keeps this hermetic:
//   { api, maxRetries, logRate, logRetry, sleepSec }
//     api        the Discord webpack API module (api.get/api.post/api.del), live thunk not required
//     maxRetries number of retries after the first attempt
//     logRate()  rate-limit notice logger
//     logRetry() generic retry notice logger
//     sleep      ms -> Promise
//
// Behavior (kept identical to the legacy in-file apiReq):
//   - res.status 429              -> wait retry_after + jitter, retry
//   - res.status 4xx (non-429)    -> return response (no retry)
//   - thrown 429                  -> wait, retry
//   - thrown 4xx                  -> rethrow (no retry)
//   - thrown 5xx/network          -> retry up to maxRetries, then rethrow
//   - satisfied -> return response

async function apiReq(deps, method, url, body) {
  const { api, maxRetries, logRate, logRetry, sleep } = deps;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      let res;
      if (method === 'GET') {
        res = await api.get({ url });
      } else if (method === 'DEL' || method === 'DELETE') {
        res = await api.del({ url });
      } else {
        res = await api.post({ url, body });
      }
      if (res.status === 429) {
        const w = (res.body?.retry_after || 30) + Math.random() * 5;
        logRate('Rate limited - waiting ' + Math.ceil(w) + 's');
        await sleep(w); continue;
      }
      if (res.status >= 400 && res.status < 500) return res;
      return res;
    } catch (e) {
      if (e && e.status === 429) {
        const w = (e.body?.retry_after || 30) + Math.random() * 5;
        logRate('Rate limited - waiting ' + Math.ceil(w) + 's');
        await sleep(w); continue;
      }
      if (e && e.status >= 400 && e.status < 500) throw e;
      if (i === maxRetries) throw e;
      logRetry('Retry ' + (i + 1) + '/' + maxRetries);
      await sleep(2 + i * 3);
    }
  }
}

module.exports = { apiReq };