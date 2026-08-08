// Questku MAIN-world bridge (isolated world). Routes discordsays POSTs from
// questku.js (page world) to the extension service worker, which runs free of
// page CSP. questku.js dispatches 'qk-ds'; this listens and answers on 'qk-ds-res'.
// Pings are only answered when running as a real extension content script, so a
// stray copy injected into the MAIN world (no chrome.runtime) can't spoof "on".
const hasRuntime = () => typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.sendMessage === 'function';
if (!window.__qkContentBound) {
    window.__qkContentBound = true;
    window.addEventListener('qk-ds', (e) => {
        const d = (e && e.detail) || {};
        if (!d.id) return;
        if (d.type === 'ping') {
            if (hasRuntime()) window.dispatchEvent(new CustomEvent('qk-ds-res', { detail: { id: d.id, pong: true } }));
            return;
        }
        if (d.type !== 'qkDs' || !hasRuntime()) return;
        try {
            chrome.runtime.sendMessage({
                type: 'qkDs',
                appId: d.appId,
                questId: d.questId,
                referrer: d.referrer,
                token: d.token,
                path: d.path,
                body: d.body
            }, (res) => {
                window.dispatchEvent(new CustomEvent('qk-ds-res', {
                    detail: { id: d.id, result: res || { ok: false, status: 0, body: 'no response' } }
                }));
            });
        } catch (err) {
            window.dispatchEvent(new CustomEvent('qk-ds-res', {
                detail: { id: d.id, result: { ok: false, status: 0, body: 'bridge error: ' + (err && err.message || err) } }
            }));
        }
    });
}