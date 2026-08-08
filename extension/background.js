// Questku extension relay — routes the ACHIEVEMENT bypass from the page (content.js)
// to the localhost `relay.ps1` server, which is the only transport that can set the
// `Referer` header discordsays.com needs.
//
// The page itself can't reach 127.0.0.1 (Chrome Private Network Access blocks it), but
// extension contexts can fetch loopback, so the service worker is the bridge. The relay
// still validates host/path and does the forwards.
const NUM = /^\d+$/;

function validParams(appId, questId, referrer) {
    if (!NUM.test(String(appId)) || !NUM.test(String(questId))) return false;
    try {
        const u = new URL(referrer);
        return u.protocol === 'https:' && u.hostname === appId + '.discordsays.com';
    } catch { return false; }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.type !== 'qkDs') return;
    (async () => {
        if (!validParams(msg.appId, msg.questId, msg.referrer)) return { ok: false, status: 0, body: 'invalid params' };
        if (msg.path !== '/.proxy/acf/authorize' && msg.path !== '/.proxy/acf/quest/progress') return { ok: false, status: 0, body: 'path not allowed' };
        const url = 'https://' + msg.appId + '.discordsays.com' + msg.path;
        const headers = {
            'X-Auth-Token': msg.token || '',
            'X-Discord-Quest-ID': msg.questId,
            'Referer': msg.referrer
        };
        try {
            // Extension contexts can fetch loopback even though the page can't (PNA).
            const relay = await fetch('http://127.0.0.1:43210/proxy', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ url, headers, body: msg.body || {} }),
                redirect: 'error'
            });
            let data;
            try { data = await relay.json(); }
            catch { return { ok: false, status: 0, body: 'relay returned non-JSON' }; }
            return (data && typeof data.ok === 'boolean') ? data : { ok: false, status: 0, body: 'relay down' };
        } catch (e) {
            return { ok: false, status: 0, body: 'relay unreachable: ' + String(e && e.message || e) };
        }
    })().then(sendResponse);
    return true;
});