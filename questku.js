(function questku() {

    let wpRequire = webpackChunkdiscord_app.push([[Symbol()], {}, r => r]);
    webpackChunkdiscord_app.pop();
    let Q = {};
    Q.Streaming = Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getStreamerActiveStreamMetadata)?.exports?.A;
    Q.Game = Object.values(wpRequire.c).find(x => x?.exports?.Ay?.getRunningGames)?.exports?.Ay;
    Q.Quest = Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getQuest)?.exports?.A;
    Q.Channel = Object.values(wpRequire.c).find(x => x?.exports?.A?.__proto__?.getAllThreadsForParent)?.exports?.A;
    Q.Guild = Object.values(wpRequire.c).find(x => x?.exports?.Ay?.getSFWDefaultChannel)?.exports?.Ay;
    Q.Flux = Object.values(wpRequire.c).find(x => x?.exports?.h?.__proto__?.flushWaitQueue)?.exports?.h;
    Q.api = Object.values(wpRequire.c).find(x => x?.exports?.Bo?.get)?.exports?.Bo;

    if (!Q.Quest || !Q.api) { console.log('[!] Discord internals not found. Refresh & try again.'); return; }

    let originalProps = {
        getRunningGames: Q.Game?.getRunningGames,
        getGameForPID: Q.Game?.getGameForPID,
        getStreamerActiveStreamMetadata: Q.Streaming?.getStreamerActiveStreamMetadata
    };

    let discordHistory;
    try { discordHistory = Object.values(wpRequire.c).find(m => m?.exports?.default?.listen)?.exports?.default; } catch {}

    let userPremiumType = 0;

    function getUserPremiumType() { return userPremiumType; }

    function getOrbValue(rewards) {
        let r = rewards?.[0];
        if (!r) return 0;
        if (userPremiumType >= 2 && r.premiumOrbQuantity) return r.premiumOrbQuantity;
        return r.orbQuantity || r.amount || 0;
    }

    async function getUserOrbs() {
        try { let r = await Q.api.get({ url: '/users/@me/virtual-currency/balance' }); return r?.body?.totalBalance || r?.body?.balance || 0; } catch { return 0; }
    }

    let isBrowser = !navigator.userAgent.includes('Electron');

    const TASKS = ['WATCH_VIDEO', 'PLAY_ON_DESKTOP', 'STREAM_ON_DESKTOP', 'PLAY_ACTIVITY', 'WATCH_VIDEO_ON_MOBILE', 'PLAY_ON_XBOX', 'PLAY_ON_PLAYSTATION'];
    const TASK_NAMES = { WATCH_VIDEO:'Watch Video', WATCH_VIDEO_ON_MOBILE:'Watch Video', PLAY_ON_DESKTOP:'Play Game', STREAM_ON_DESKTOP:'Stream', PLAY_ACTIVITY:'Activity', PLAY_ON_XBOX:'Play Game', PLAY_ON_PLAYSTATION:'Play Game' };
    const COLORS = { accent: '#545ded', bg: '#313338', panel: '#2b2d31', text: '#dbdee1', muted: '#80848e', border: '#1e1f22', green: '#23a55a', red: '#f23f42', amber: '#f0b232' };

    let set = { autoEnroll: true, maxRetries: 3 };
    let uiState = { sort: 'suggested', filter: {}, progSort: 'order', progFilter: {} };
    let sortLabel = { suggested:'Suggested',recent:'Most Recent',expires:'Expiring Soon',started:'Started',reward:'Highest Reward',name:'Alphabetical (A–Z)' };
    let progSortLabel = { order:'Queue Position', newest:'Newest', oldest:'Oldest', name:'Alphabetical (A–Z)' };
    let progStatusLabels = { pending:'Pending', running:'Running', done:'Done', stopped:'Stopped', paused:'Paused' };
    let st = { allQuests: [], queue: [], running: false, paused: false, completed: 0, failed: 0, stopped: 0, currentTask: null, _cleanups: [] };
    let appCache = {};
    let appFetching = {};
    let debugMode = false;

    const dlog = (fn, msg) => { if (debugMode) console.log('[Questku:' + fn + '] ' + msg); };

    const fmtDur = s => s < 60 ? Math.floor(s) + 's' : Math.floor(s / 60) + 'm ' + Math.floor(s % 60) + 's';
    const pct = (c, t) => t > 0 ? Math.floor(c / t * 100) : 0;
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const sleepSec = s => sleep(s * 1000);

    function getEstimatedDuration(q) {
        let cfg = q.config.taskConfig ?? q.config.taskConfigV2;
        let t = TASKS.find(x => cfg?.tasks?.[x] != null);
        if (!t) return 999999;
        let target = cfg?.tasks?.[t]?.target || 0;
        if (t === 'WATCH_VIDEO' || t === 'WATCH_VIDEO_ON_MOBILE') return target;
        if (t === 'PLAY_ACTIVITY') return target;
        return target * 60;
    }

    let log = {
        _s: null, start() { this._s = Date.now() }, _el() { return this._s ? (Date.now() - this._s) / 1000 : 0 },
        h(m) { console.log('%c[!]%c' + m, 'color:#7289da;font-weight:bold', '') },
        i(m) { console.log('%c[..]%c' + m, 'color:#faa61a', '') },
        e(m) { console.log('%c[!!]%c' + m, 'color:red;font-weight:bold', '') },
        ok(m) { console.log('%c[OK]%c' + m, 'color:#43b581;font-weight:bold', '') },
        dn(n) { console.log('%c[✓]%c' + n + ',%c' + fmtDur(this._el()), 'color:#43b581;font-weight:bold', '', 'color:#95a5a6') },
        gr(t) { console.groupCollapsed('%c[!]%c' + t, 'color:#7289da;font-weight:bold', '') },
        ge() { console.groupEnd() },
        d(fn, m) { if (debugMode) console.log('%c[DBG:' + fn + ']%c ' + m, 'color:#545ded', ''); }
    };

    async function apiReq(method, url, body) {
        for (let i = 0; i <= set.maxRetries; i++) {
            try {
                let res;
                if (method === 'GET') {
                    res = await Q.api.get({ url });
                } else if (method === 'DEL' || method === 'DELETE') {
                    res = await Q.api.del({ url });
                } else {
                    res = await Q.api.post({ url, body });
                }
                if (res.status === 429) {
                    let w = (res.body?.retry_after || 30) + Math.random() * 5;
                    log.i('Rate limited — waiting ' + Math.ceil(w) + 's');
                    await sleepSec(w); continue;
                }
                if (res.status >= 400 && res.status < 500) return res;
                return res;
            } catch (e) {
                if (e?.status === 429) {
                    let w = (e.body?.retry_after || 30) + Math.random() * 5;
                    log.i('Rate limited — waiting ' + Math.ceil(w) + 's');
                    await sleepSec(w); continue;
                }
                if (i === set.maxRetries) throw e;
                log.i('Retry ' + (i + 1) + '/' + set.maxRetries);
                await sleepSec(2 + i * 3);
            }
        }
    }

    async function fetchPremiumType() {
        try { let r = await Q.api.get({ url: '/users/@me' }); if (r?.body && r.body.premium_type !== undefined) userPremiumType = r.body.premium_type; } catch {}
    }

    async function refreshQuests() {
        log.d('refreshQuests', 'start');
        st.allQuests = [...Q.Quest.quests.values()]
            .filter(x => new Date(x.config.expiresAt).getTime() > Date.now())
            .map((q, i) => { q._i = i; q._sel = false; return q; });
        let orb = await getUserOrbs();
        if (D && D.ob) D.ob.textContent = orb;
        await fetchPremiumType();
        renderAllQuests();
        updateAddqBtn();
        fetchAllAppIcons();
        log.d('refreshQuests', 'done, total: ' + st.allQuests.length);
    }

    function getTok() {
        try {
            let k = Object.keys(Q.api).find(k => typeof Q.api[k] === 'string' && Q.api[k].length > 40 && Q.api[k].startsWith('MT'));
            if (k) return Q.api[k];
        } catch {}
        return null;
    }

    async function directPost(url, body) {
        let tok = getTok();
        if (!tok) return null;
        try {
            let r = await window.fetch('https://discord.com' + url, {
                method: 'POST',
                headers: { authorization: tok, 'content-type': 'application/json' },
                body: JSON.stringify(body)
            });
            return { body: await r.json(), status: r.status };
        } catch { return null; }
    }

    async function enrollQuest(q) {
        log.d('enrollQuest', q.id, q.config.messages.questName);
        if (q._enrolling) return true;
        q._enrolling = true;
        try {
            let res = await directPost('/quests/' + q.id + '/enroll', {
                location: 11,
                is_targeted: false,
                metadata_sealed: null
            });
            if (!res || res.status >= 400) res = await apiReq('POST', '/quests/' + q.id + '/enroll', {
                location: 11,
                is_targeted: false,
                metadata_sealed: null
            });
            let ok = res?.status >= 200 && res?.status < 300;

            if (ok) {
                log.ok('Enrolled: ' + q.config.messages.questName);
                if (res?.body?.userStatus) {
                    q.userStatus = res.body.userStatus;
                } else {
                    q.userStatus = { ...(q.userStatus || {}), enrolledAt: new Date().toISOString() };
                }
            } else {
                log.e('Enroll failed: ' + q.config.messages.questName + ' (Code: ' + res?.body?.code + ')');
            }
            return ok;
        } catch (e) {
            log.e('Enroll failed: ' + q.config.messages.questName + ' (Exception: ' + e.message + ')');
            return false;
        }
        finally { delete q._enrolling; }
    }

    let D = null;

    window.questkuKill = function() {
        if (!st) return;
        st.running = false;
        st.paused = false;
        if (st._cleanups) {
            st._cleanups.forEach(fn => { try { fn(); } catch {} });
            st._cleanups = [];
        }
        if (Q && Q.Game) {
            if (originalProps.getRunningGames) Q.Game.getRunningGames = originalProps.getRunningGames;
            if (originalProps.getGameForPID) Q.Game.getGameForPID = originalProps.getGameForPID;
        }
        if (Q && Q.Streaming && originalProps.getStreamerActiveStreamMetadata) {
            Q.Streaming.getStreamerActiveStreamMetadata = originalProps.getStreamerActiveStreamMetadata;
        }
        if (Q && Q.Flux && Q.Game) {
            try { Q.Flux.dispatch({ type: 'RUNNING_GAMES_CHANGE', removed: [], added: [], games: Q.Game.getRunningGames() }); } catch {}
        }
        if (st) {
            st.queue = [];
            st.completed = 0;
            st.failed = 0;
            st.currentTask = null;
            if (st.allQuests) st.allQuests.forEach(q => q._sel = false);
        }
        if (D) {
            if (D.addq) D.addq.disabled = false;
            if (D.pan) { D.pan.remove(); D.pan = null; }
        }
        let styleEl = document.getElementById('questku-style');
        if (styleEl) styleEl.remove();
        D = null;
    };

    let hsState = { current: null, selected: null, busy: false, profile: null };
    const HOUSES = [
        { id: 1, name: 'Bravery', color: '#9b59b6', desc: 'For those who dare to defy the odds and stand up for what they believe in.' },
        { id: 2, name: 'Brilliance', color: '#e74c3c', desc: 'For those who light the way forward with creativity and insight.' },
        { id: 3, name: 'Balance', color: '#1abc9c', desc: 'For those who seek harmony within and around them.' }
    ];
    const BADGES = {
        1: 'data:image/png;base64,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',
        2: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAARgAAAEYCAYAAACHjumMAAAUaklEQVR4nO3dX3ITx9rH8adlqw4+dgpnBZgVxFkB8gowK8BcQd4bzDWc8rgC15ibF7jCrACzAosVYFaAWUFIYV5zyrb6/bXRJED8R5LVmume76dqanpy6iSW1Prp6WdmJGcAEAkBAyAaAgZANAQMgGgIGADREDAAoiFgAERDwACIhoABEA0BAyAaAgZANAQMgGgIGADREDAAoiFgAERDwACIhoABEA0BAyAaAgZANAQMgGgIGADREDAAoiFgAERDwACIhoABEA0BAyAaAgZANAQMgGgIGADREDAAoiFgAERDwACIhoABEA0BAyAaAgZANAQMgGgIGADREDAAoiFgAERDwACIhoABEA0BAyAaAgZANAQMgGgIGADREDAAoiFgcKL9//x2TbuBzfz+9I12wHecNjRMCI9erzdvzi167+f1jxa1zWtb1DYOO9o+attxzn0073dardZHQqh5nDZkyher81+O/vtLz/tOz/yi88cBsmDV2vXOdlrmdlrOdS9N/eudKzY+6p8jQ04bMhEC5fPBf6+b9RZ12LHxVSSx7WjrmrV2Ztv/ek3g5IOASdxe8T+L7rB3XUudZR0uastBWFpt+enW67nif3d0jEQRMAkKoWIHRzc1XNa2YHnbNbMta0+9JGzS47QhAfvFnYXeod303q+Y2YI1064qm83WtL2cKZ7tGmrPaUON7d3/7aZ3vWU1aJd1iD41irecb23NPXr6UoeoKacNNROatf93+OVuw6uVQR1XNf+evvSE5nD9OG2oibAMOjrwa169Fb0w8/pHGJCes496zjan2u4Jy6f60GuCqpXBouGKYRxC0KwTNNUjYCpEsERH0FSMgKlA2WPpeb+qF4ClUEReS6eWcxv0aKqh+Y1JCmeFzHqFmS0YJknN4Na92YdPtzTGhDhtmID+cuiFhh1DlbpaNt1i2TQZBMwEfH5wZ817XxhqwfeXTbMPn63rEBE5bYikf0n/Cw0XtaF+dqw9dYtbEOIhYCKhakmIs9W5h8+faIQxI2DGjF5LsujNREDAjNHnB78t93zvhZ7UeR0iMV69GXPuxk8Pn3UNY6H3AsaBJVE+nHMFDeDxcNpwAeGiub3D/Rfc7ZwX72xrbnrmFhfnXQwBcwH9fssrDRe1IT876svcoC8zOgJmROEUtD842tYTOK9DZMqrL+PaU0ucyh6N3h8Y1t5/7qz4nn+sJ29eh8jccci03L25359tGoai9wiGEcLFesenodE0LXeLkBkOATMEwgWEzHAImAERLvgLITMwAmYAhAv+gZAZCAFzDsIFpyJkzkXAnIFwwbkImTMRMKcgXDAwQuZUBMwJuIgOw/DhOhkuxjuR3kP4Vrj8//DAv9UTM69DYCAhZKbb7lduK/ie3kcohRsXPx/sb2u4qA0Y1s5se2aJGyT/RsB849OD26+4KxoX4Z1t/fTw+Q0NIQRM36cHdwrnj38EDbgQ79z6Tw+fFQYCJgjfROd9L3ztAjAWCpklhUzXGq7xAUNTFzF4NX3n2jNXm96P0fuq2fbu397WrmPA+HXnHj1f0r6xnLbGou+C+Fr35h493dCgkRobMOFiOjs4eqshEFd76temXoTX3IC5fzuEy6I2ILYdLZV+1b5xGhkwLI0waTqrtK6zSoU1TOMCJpw1Ojrw7zUEJsbrrFITbyVoXMBoabStXceAyWvcWSWnrTH4CgZUzbnWjdmHT7c0bITGBEz/RsbQ2F0woDq7qmKuat8ITlsj0NhFXTSp4duIgAmNXW4HQF34BjV89Z7L3979O5t6WW8aUBvu5dyjZyuWuewDJlQvnJZGHU213dXcq5jsA4bqBfWVfxWTdcBQvaDucq9isg4YqhfUnrMncw+fr2qUpWwDJlz3snew/14PcF6HQC15nVHK+Yup9P7LE9e9IBU5XxeTbcDs3b/9XrsFA+ov26t7nbbscM8RUpPrPUpZBsyn+7e39MCuawgkwZu9/unR82UNs6L3YV44NY1U5XjKOruAobmLVOXY7M0uYGjuImHZNXudtmzU65cC3IfZ9qVFDWzvYH9TT/R1DVETXj2PufbMisnngy87+idXNKxeZr9AoHmfj70Htzc0c+5qWAfffZN8+Hnanu9t6gm/rENUxJv92XKtlW/P2KjqfavdorbqZXZlr+Z7PjRR3mu3YDWhNfWS1tRd6+tfXbzpqGYq4ftVy7dXzapn11HPblvDushqmeS0ZaFey6O/dDVZlrT/DtXMZPkTqpaSPpS2tetYnWS0TNIcz4M+iQp9Eq1pWCs/VjElqpnJ8CdULSXNmY7mzLaGtaI5s645U1gGNL/zoE+it9otaqubE6uYUqhmvPcbmlZXdIixcR+8sxW9Ubt2Cs2Zbe06Vj/f9e9S5rQlL1QDnw/2/9CwlvSJtHTWRD/++w/3C33c3tUhLkqN0tnpmeKkqqVU1+qlNNue+fmsvz8VWQRMAvcenVnFlL5Oets0qpkRnV+1lGpcvRzL5d4kpy15NTs9faLzqpgS1cyIBqhaSl+DvL7VyzE9nhxOV+cRMPXtv3xroCqm9PVNQDVzvsGrlpLmy7Z2Hau3LPowTlvSjj/xa9x/+dagVUzp+LFRzZxKz+f63PSljUGqllICy+m/5NCHST5gvn7S17zc/dtQVUypf43Pppn9og1m76w9tTLKtSKqXt5rt2AJUIAO9YFUR05b0hQwhQJmTcMkXKR5l9pjjUFvunW96QobQUrVS3CRx1oX6QdMel8utasq5qr2I2lwNTNy1VJKqXoJvKX/JVROW9JSmzTHWu7W3O/PNu0CmlTNjOOTPLXqpS/5Rq/TljQFjNcuNReqYkoNqGYuXLWUNE/ea7dgidE8cdolK+k/Xp/iHX2Kb2uYnjFUMSU9D4V5v6oX87IOk+fN/nTWKuYePd3Q4YUlWr0cU/W2pOqta4nSnEzX1/t4eq80TNGuPp2uaj8W4buIDw9tU4F7TYfJ0hvqzfS0rYzzu2lTrV6Ci5wUqAOnLVnhk1tvqDUN0zTGKqa0d/+3VW+9Qi/sZR0mw4+5aimlXL0ECtx1VTCFJUrzMF0p3CJwjt1xVjGl1KoZvYnGXrWUUq5ejiV+y4DTlixVMN1U3kSnilDFlOpezfhIVUsp9eolCOGrCqZjidLcS5c+nd5qt6gtZbsxqphSXasZb/Z6uu1WY1QtJc2P99otWNqSPlXttCVLE8hrl76IVUwpNMTr8DWdesFO/frKcQrVm1nvsYbJU8DoZUtTsn94kE3ARK5iSuHmySq/plMv1qlfXzlO/cf5Xo9zXofJ09zQQ0lTsn94kFHATKSKKU26mtGLNJGqpaTeXKEl4ZqGWSBgKqBJ1NEk2tYwF7uz7ZlfY3+6l/qf8puaANd1GI2fUNVS6j+ubKqXYwn/yoBehzRlGDDhjMG6zhgUNkGxqhk/4aqlpHlRaF6saZgNzYslzYuuJUjzKk2aSB1NpG0Ns+HNPurT/uqkPu1L4VP/88GXDY1u6nAM3MvZ9qXVKh5HdtWLEDAVyDFgAk2mdU2mwiowlutGJthL+pHmRKE5saZhVjQnljQnupYgAqZmfEVVTOki36+jv72y7y/JtXoJCJgK5BowgSbUuiZUYRUIF+YdHfj3Gg5tqu2uxrxw7iyaD4Xmw5qG2dF8WNJ86FqCCJga8hVXMXv372zqr7hpQ3Ev5x49W7EK5Fy9BARMBXIOmECTal2TqrAKjFLFUL3Eo7mwpLnQtQQRMDXlk6piqF5iImAqkHvABJpY65pYhVVgmCqG6iUuzYMlzYOuJYiAqTGfRBVD9RIbAVOBJgRMUOVXJg5SxVRZvYzlup0UcKtANdK82fH4t5R3bRDehwpmYvfxnOTsKqa66iXoVzCbSuF5HZ7LeVvQ/+uKJYabHSuSWsDoj63sQrRRnVXFVFm9jOoiFxJWhYCpSHIB42zrp4fPb2iYlJOrmGqrl1F9enD7lSqZpEKegKmIAmZHu1+0pWRztj1zr8plz7BOqmJSq17Ccurzwf5jDVcsLe8UMIvaJynpgFGjt6tG7zUNU7Orxt2NlBp331cxaVUv/V/AfKXhgiVGZ5De6AxSxxLltCXr+0mfHudcMfvw2bqGtReqmMMDfxyI0223mEr18vnBnTXvfWGp4mdLqqMKplAFs6ZhyrpaMt1IYcl0XAlICpVXCEQt615o2LGEqYJZVwVTWKKSDpjwbWwJ/3TsX7zZx5Zr3arqepfchHnR870XmtzzOkxalddBjYNeg3SpgumogtnWMBcbqmbWU6hm6ijhRu6pVMEsqYLpWqKSDphAZ5K8djnZUQP4VgrLkDo5Xr4l2sg9i84gOe2SlfQfH6jRu6ucv2K5cbaq5t4TjXCO5Bu5p0v6FHWQfMCkeGXmEJJpAFehvyR6pWHHMuQTvPL7R3pvpk19mEJ9mDUNs+RpAJ8op0buadR/WVf/pbCE6fVJmwKmo4DZ1jB3NIClX7WsabiqLWsKmCUFTNcSlnzA9CfcHxo2QaMbwP1G7gsNF7VlTx8oP6f+gZJ8wAQ6k7Sj3S/amqGBDeC9B7fvar24oWFTJN/gDfIImAe3NzT57mrYJF19wt1I/RPuPP0K9ZWGHWuSxG8RKOURME35ZrMf+MwbwE1o5J6qwl/IHCe9dunrf8r9oWFTbaicvqd9Fvqv55qGq9oaSdXpzzlUp1kETNC4Psw/ZdEAbloj9xRZ9F+CbAJGp6sLna5e07CxvJZMzlmhtfsTHSZHvbSmNXJPpNPT6zo9XVgGsgmY/iffWw0bzzvbmpueuZVKid1fEr3SsGMwVaK/pl6JlrIJmCDb+5JG4FXNmHM39EnYtRprdCP3RO7D3KNnC5YJva75UIndxNPV56ltA1h9s8farWpDKZPT06W8AoZl0mlq1QDuv04vNFzUhm9ltDwKsgqYgGXSybyWTHVoAKvKvOu9FZp48zrEd/JaHgV6nfPC2aSz+YoawKGRu3e4/yK13ySapJzOHpWyC5j+lz2/1xCn8KpmJtkAVuh3zPtXmmzzOsQpUvutqUHoNc+PJnRXVcw1DXG26A1gGrmD8Rl8udRJsgyYpt6bNKIoDWAaucNJ/dcDTpNlwAQ0ewfntWRyLXdvXDfX0cgdVn7N3ZLmQJ60TCq0TFrTEAO6aAOYRu5ocmzulrINmOPJfrC/qwd4WYcY3K4m/C1N+K4NQYHeoZE7PG/251x7ZmHUUK87zYd8aZm0qZfwpmFozg3+u9k0ci8gsyt3f+S0ZYtT1he2o1OnN047dUoj9+L0/GZ3avpbWQdMQBVzMf6UBnA4U+d7/rEm0LwOMRL3Us3dFcuY5kfeqGLGo2wAa2g0cscj9+olcNqyRxWD+sm/egkaETChijk88Dt6sJd1CFTKZ37m6Ft6zzWDTqNyXQxqwWd83cuPGhMw4bqYzwdfdjS6okOgIvletXuSxgRMEM58cI8SqpTrPUenaVTABFoqdbVUuqYhMFFaGr3R0qhjDdK4gAkNX05bY9K8GrvTbbeY+2npHzUuYAJVMYWqmDUNgYlQ9bKu6qWwhmlkwAR7/BIkJiebX2ocVnMD5ut9NG81BOLK7JcChtHYgAn27v+2atZ7rCEQSeve3KOnGxo0UqMDJlA/pqt+zDUNgbFS3+WN+i4da7DGB0w4q8RtBBg3r7NGTbkd4Cx6XyH8PrL3vVcaAmOh6mVJ1UvXGo6A6dNSqdBSaU1D4EIULusKl8JAwHzr0/3bW3pCrmsIjMRn+vtGo9L7CaWvN0Tud43rYzCad7PtmU7T+y7fImB+QNMXo1Dl0shbAc6j9xF+FC7C8wdHXT05hAzO5RUurj3VaerFdGfRewgn4asdMKimfQXDMAiYMxAyOFfL3frxFxfwNwLmHIQMTkW4nIuAGQAhg38gXAZCwAyIkMFfCJeBETBDIGRAuAyHgBkSIdNghMvQCJgRhJDxPb+hJ4/rZBrAm/3Zcq0VTkUPT+8RjIKL8ZohhAsX0Y1O7w+MKtxWcHTgtzT8RRvy826q7Za5/H90BMwFhRsk9w72N/VEXtchMuHNXs+1Z1a4cfFi9L7AOPB9Mvng+1zGh4AZo/DNeD3f29STelmHSIxXv8WcW1a4dA1jofcCxin0ZQ4PbVPVzDUdIhGqWt7MTV9aZkk0XgRMJPwkSkqa/dMiMREwEYVT2XZwtGmcZaqrd9aeWuEUdDwEzASEBrB5v6on+7IOUTH/tdeyoV5LYYhKcx6TQG+mHkKvZXraVri2ZTIImAkLZ5q89xua6ld0iIlxH5xzq1zuP1kETAWOL847/LLKsik+z3KoUprfqEpYNh0dWKG3wU1DBO7lbPvSKqeeq0PA1ABBM27u5VTbCvos1SNgauQ4aA79qve2oheGpdMQvJZCztnm1LTbIFjqQ/MYdVP2aJyCRkdXDGdwH7yCZW760gZLofohYGounHXq+d6KXqjrOkSfN3vdcq1NzgrVm+YtUhCWT4eHWjo1uqr5Wq1MT9smy6A0EDAJOr4F4fBoxbxbtuzDxn0w57dsemqTS/rTQ8AkLoSNP+wtO++XdfiLthy8885tuenWFqGSNgImI6E5/Pnoy7J5v6gmRcfSCZx3moldZ63uv6f/1aVZmw8CJmMhcHQ2alHDTggdvdgLVn3ovPNmu+bcjsZdnf3ZIVDy5bShYT49uNNpmZvvWQgdP+/NLWqJNa//aVzhE5Y4H/Xv3tG/+6P+Wzv6b338iW+KaxwCBicKIWRDIDxwEgIGQDQEDIBoCBgA0RAwAKIhYABEQ8AAiIaAARANAQMgGgIGQDQEDIBoCBgA0RAwAKIhYABEQ8AAiIaAARANAQMgGgIGQDQEDIBoCBgA0RAwAKIhYABEQ8AAiIaAARANAQMgGgIGQDQEDIBoCBgA0RAwAKIhYABEQ8AAiIaAARANAQMgGgIGQDQEDIBoCBgA0RAwAKIhYABEQ8AAiIaAARANAQMgGgIGQDQEDIBoCBgA0RAwAKIhYABEQ8AAiOb/AaWZrKBqubA/AAAAAElFTkSuQmCC',
        3: 'data:image/png;base64,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'
    };
    const NITRO_BADGE = 'data:image/png;base64,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';
    async function hsFetch() {
        try {
            let r = await apiReq('GET', '/users/@me');
            if (!r?.body) return;
            hsState.profile = r.body;
            hsState.current = null;
            if (r.body.public_flags) {
                if (r.body.public_flags & 64) hsState.current = 1;
                else if (r.body.public_flags & 128) hsState.current = 2;
                else if (r.body.public_flags & 256) hsState.current = 3;
            }
            renderHypeSquad();
            hsUI();
        } catch {}
    }
    async function hsApply() {
        if (hsState.busy || !hsState.selected) return;
        if (hsState.current && hsState.current !== hsState.selected) {
            D.ap.textContent = 'Remove current badge first';
            setTimeout(() => hsUI(), 2000);
            return;
        }
        hsState.busy = true; D.ap.disabled = true; D.ap.textContent = 'Applying...';
        try { 
            let r = await apiReq('POST', '/hypesquad/online', { house_id: hsState.selected }); 
            if (r?.status < 400 || r?.body?.house_id) { 
                hsState.current = r.body?.house_id || hsState.selected;
                hsState.selected = null;
                renderHypeSquad();
                hsUI();
            } else { D.ap.textContent = 'Failed'; } 
        } catch { D.ap.textContent = 'Error'; }
        hsState.busy = false; 
        if (D.ap.textContent === 'Applying...') {
            D.ap.textContent = 'Apply Badge';
        }
        hsUI();
    }
    async function hsRemove() {
        if (hsState.busy) return;
        hsState.busy = true; D.rm.disabled = true; D.rm.textContent = 'Removing...';
        try { 
            let r = await apiReq('DEL', '/hypesquad/online'); 
            if (r?.status < 400 || r?.status === 204) { 
                hsState.current = null; 
                hsState.selected = null; 
                renderHypeSquad();
                hsUI();
            } else { 
                D.rm.textContent = 'Failed'; 
            } 
        } catch { 
            D.rm.textContent = 'Error'; 
        }
        hsState.busy = false; 
        if (D.rm.textContent === 'Removing...') {
            D.rm.textContent = 'Remove Badge';
        }
        hsUI();
    }
    function hsUI() {
        if (!D) return; 
        let s = hsState.selected && HOUSES.find(h => h.id === hsState.selected);
        let hasBadge = !!hsState.current;
        let isCurrent = hsState.selected === hsState.current;

        D.ap.disabled = !s || (hasBadge && !isCurrent) || (isCurrent && hasBadge);
        D.rm.disabled = !hasBadge || !isCurrent;

        if (!s) {
            D.ap.textContent = hasBadge ? 'Remove current badge first' : 'Apply Badge';
        } else if (isCurrent && hasBadge) {
            D.ap.textContent = 'Applied';
        } else {
            D.ap.textContent = 'Apply';
        }

        let desc = document.getElementById('hs-desc');
        if (desc) {
            let dn = desc.querySelector('.hs-dn');
            let dd = desc.querySelector('.hs-dd');
            if (s && dn && dd) {
                dn.textContent = s.name;
                dn.style.color = s.color;
                dd.textContent = s.desc;
                desc.style.display = 'block';
            } else if (desc) {
                desc.style.display = 'none';
            }
        }
    }

    function buildDashboard() {
        if (document.getElementById('questku-panel')) { let o=document.getElementById('questku-panel'); o.remove(); let s=document.getElementById('questku-style'); if(s)s.remove(); }
        let c = document.createElement('style');
        c.id = 'questku-style';
        c.textContent = `
#questku-panel{all:initial;font:12.5px/1.5 Whitney,'Helvetica Neue',Helvetica,Arial,sans-serif;position:fixed;bottom:24px;right:24px;z-index:999999;background:rgba(10,11,13,.7);color:#e8eaed;border:1px solid rgba(255,255,255,.05);border-radius:16px;width:400px;box-shadow:0 24px 80px rgba(0,0,0,.5);user-select:none;overflow:clip;animation:qkIn .3s ease-out;-webkit-backdrop-filter:blur(24px);backdrop-filter:blur(24px)}
@keyframes qkIn{0%{opacity:0;transform:translateY(12px) scale(.97)}100%{opacity:1;transform:translateY(0) scale(1)}}
#questku-panel *{box-sizing:border-box;margin:0;padding:0}
#questku-panel .qk-h{display:flex;align-items:center;gap:8px;padding:14px 12px 10px 16px;border-bottom:1px solid rgba(255,255,255,.05);cursor:move}
#questku-panel .qk-h .qk-l{display:flex;align-items:center;gap:8px;font-weight:600;font-size:14px;color:#f2f3f5}
#questku-panel .qk-h .qk-l svg{flex-shrink:0;display:block}
#questku-panel .qk-h .qk-l .qk-wm{display:inline-flex;gap:0;align-items:baseline}
#questku-panel .qk-h .qk-ob{font-size:10px;padding:2px 7px;border-radius:10px;background:rgba(255,255,255,.05);color:rgba(255,255,255,.45);font-weight:500;margin-left:4px}
#questku-panel .qk-h .qk-nav{margin-left:auto;position:relative;padding:6px 0 0;overflow:clip}
#questku-panel .qk-h .qk-nav-scroll{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;-ms-overflow-style:none;padding:0 2px}
#questku-panel .qk-h .qk-nav-scroll::-webkit-scrollbar{display:none}
#questku-panel .qk-h .qk-nav .qk-nav-tab{border:0;background:0;color:rgba(255,255,255,.35);font-size:11.5px;font-weight:400;cursor:pointer;transition:color .2s cubic-bezier(.4,0,.2,1);font-family:inherit;letter-spacing:.1px;padding:2px 2px 8px;scroll-snap-align:start;flex-shrink:0;line-height:1}
#questku-panel .qk-h .qk-nav .qk-nav-tab:hover{color:rgba(255,255,255,.75)}
#questku-panel .qk-h .qk-nav .qk-nav-tab.act{color:#f2f3f5}
#questku-panel .qk-h .qk-nav-indicator{position:absolute;bottom:0;left:0;height:2px;background:#545ded;border-radius:2px;opacity:1;transition:left .2s cubic-bezier(.4,0,.2,1),width .2s cubic-bezier(.4,0,.2,1);pointer-events:none}
#questku-panel .qk-h .qk-hbtn{border:0;background:0;color:rgba(255,255,255,.2);font-size:16px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:6px;cursor:pointer;transition:all .12s;font-family:inherit}
#questku-panel .qk-h .qk-hbtn:hover{background:rgba(255,255,255,.08);color:#e8eaed}
#questku-panel .qk-body{display:none}
#questku-panel .qk-body.act{display:block;width:100%;left:0}
#questku-panel .hs-c{display:flex;gap:6px;padding:12px 12px 8px}
#questku-panel .hs-d{flex:1;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);padding:16px 4px 12px;cursor:pointer;transition:all .15s;display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center}
#questku-panel .hs-d:hover{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.09);transform:translateY(-1px)}
#questku-panel .hs-d.s{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.14)}
#questku-panel .hs-d.c{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.1)}
#questku-panel .hs-b{width:40px;height:40px;display:flex;align-items:center;justify-content:center}
#questku-panel .hs-n{font-size:10px;font-weight:700;color:#f2f3f5;text-transform:uppercase;letter-spacing:.5px}
#questku-panel .hs-t{display:flex;gap:6px;padding:18px 14px 14px}
#questku-panel .hs-t .hs-btn{flex:1;height:32px;padding:0 14px;border:0;background:rgba(255,255,255,.04);color:rgba(255,255,255,.4);font-size:12px;font-weight:500;border-radius:8px;cursor:pointer;transition:all .12s;font-family:inherit;display:flex;align-items:center;justify-content:center}
#questku-panel .hs-t .hs-btn:hover{background:rgba(255,255,255,.07);color:rgba(255,255,255,.7)}
#questku-panel .hs-t .hs-btn:active{background:rgba(255,255,255,.1);color:#fff;transform:scale(.97)}
#questku-panel .hs-t .hs-btn:disabled{opacity:.3;cursor:not-allowed}
#questku-panel .hs-desc{padding:14px 16px 0;text-align:center;display:none}
#questku-panel .hs-desc .hs-dn{font-size:11px;font-weight:700;color:#545ded;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px}
#questku-panel .hs-desc .hs-dd{font-size:10.5px;color:rgba(255,255,255,.3);line-height:1.5}
#questku-panel .qk-b-hs .qk-empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;padding:0 24px}
#questku-panel .qk-b-hs .qk-empty-title{font-size:14px;font-weight:600;color:rgba(255,255,255,.75);margin-bottom:6px;font-family:inherit}

#questku-panel .qk-b-hs .qk-empty-desc{font-size:11.5px;color:rgba(255,255,255,.35);line-height:1.4;font-family:inherit}
#questku-panel .qk-tl{display:flex;align-items:center;justify-content:space-between;padding:8px 16px;border-bottom:1px solid rgba(255,255,255,.04);width:100%}
#questku-panel .qk-tl-left,#questku-panel .qk-tl-right{display:flex;align-items:center;gap:8px}
#questku-panel .qk-tl label{display:flex;align-items:center;gap:6px;font-size:11.5px;color:rgba(255,255,255,.35);cursor:pointer;transition:color .1s;font-family:inherit;white-space:nowrap}
#questku-panel .qk-tl label:hover{color:rgba(255,255,255,.6)}
#questku-panel .qk-tl input[type=checkbox]{width:14px;height:14px;cursor:pointer;accent-color:#545ded}
#questku-panel .qk-bb{border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.04);color:rgba(255,255,255,.45);font-size:11px;font-weight:500;height:28px;padding:0 12px;border-radius:6px;cursor:pointer;transition:all .12s ease;font-family:inherit;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;gap:3px;box-shadow:0 1px 2px rgba(0,0,0,.08)}
#questku-panel .qk-bb:hover{color:rgba(255,255,255,.8);background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.1)}
#questku-panel .qk-bb:active{color:#fff;background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.2);transform:scale(.97)}
#questku-panel .qk-bb:focus{outline:0}
#qk-sel-toggle,#qk-prog-sel-toggle{min-width:100px}
#qk-sort-btn,#qk-prog-sort-btn{min-width:135px}
#questku-panel .qk-bb.act,#questku-panel .qk-bb.act:hover,#questku-panel .qk-bb.act:active{color:#fff;background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.18);font-weight:600;transform:none;box-shadow:0 1px 2px rgba(0,0,0,.08),inset 0 1px 0 rgba(255,255,255,.06)}
#questku-panel .qk-bb:disabled{opacity:.35;cursor:not-allowed;box-shadow:none}
#questku-panel .qk-tl-dd{position:relative}
#questku-panel .qk-tl-pop{opacity:0;visibility:hidden;transform:scale(.95) translateY(-4px);position:absolute;top:calc(100% + 4px);left:0;z-index:100;min-width:185px;max-height:320px;overflow-y:auto;background:linear-gradient(135deg,rgba(16,17,20,.96),rgba(84,93,237,.045));border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:4px;box-shadow:0 8px 24px rgba(0,0,0,.4);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);transition:opacity .15s ease,transform .15s ease,visibility .15s ease}
#questku-panel .qk-tl-pop.open{opacity:1;visibility:visible;transform:scale(1) translateY(0)}
#questku-panel #qk-filter-pop{right:0;left:auto}
#questku-panel .qk-tl-pop .qk-tl-opt{display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:11px;color:rgba(255,255,255,.5);transition:all .12s ease;font-family:inherit;border:0;background:0;width:100%;text-align:left;white-space:nowrap}
#questku-panel .qk-tl-pop .qk-tl-opt:hover{background:rgba(255,255,255,.08);color:rgba(255,255,255,.8)}
#questku-panel .qk-tl-pop .qk-tl-opt.act{color:#fff;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.15)}
#questku-panel .qk-tl-pop .qk-tl-opt input[type=checkbox],#questku-panel .qk-tl-pop .qk-tl-opt input[type=radio]{position:absolute;opacity:0;width:0;height:0;pointer-events:none}
#questku-panel .qk-tl-pop .qk-tl-opt .cb,#questku-panel .qk-tl-pop .qk-tl-opt .rb{display:inline-flex;width:16px;height:16px;flex-shrink:0;border:1.5px solid rgba(255,255,255,.15);border-radius:4px;transition:all .1s;align-items:center;justify-content:center;background:0}
#questku-panel .qk-tl-pop .qk-tl-opt .rb{border-radius:50%}
#questku-panel .qk-tl-pop .qk-tl-opt input:checked+.cb,#questku-panel .qk-tl-pop .qk-tl-opt input:checked+.rb{border-color:#545ded;background:rgba(84,93,237,.12)}
#questku-panel .qk-tl-pop .qk-tl-opt input:checked+.cb::after{content:'';width:4px;height:8px;border:solid #545ded;border-width:0 2px 2px 0;transform:rotate(45deg);margin-bottom:2px}
#questku-panel .qk-tl-pop .qk-tl-opt input:checked+.rb::after{content:'';width:8px;height:8px;border-radius:50%;background:#545ded}
#questku-panel .qk-tl-pop .qk-tl-hd{padding:5px 10px 2px;font-size:9px;color:rgba(255,255,255,.2);text-transform:uppercase;letter-spacing:.6px;font-weight:600}
#questku-panel .qk-tl-pop .qk-tl-div{height:1px;background:rgba(255,255,255,.04);margin:3px 8px}
#questku-panel .qk-prog-active{font-size:11px;color:rgba(255,255,255,.35);font-weight:500;font-variant-numeric:tabular-nums;white-space:nowrap}
#questku-panel .qk-nitro-badge{height:22px;vertical-align:middle;margin-left:6px}
#questku-panel .qk-rw{display:flex;flex-wrap:wrap;align-items:center;gap:4px}
#questku-panel .qk-rw-item{display:inline-flex;align-items:center;gap:4px}

#questku-panel .qk-rw-plus{color:rgba(255,255,255,.3)}
#questku-panel .qk-tl-pop .qk-tl-clr{padding:6px 10px;border-radius:6px;cursor:pointer;font-size:10.5px;color:rgba(255,255,255,.3);transition:all .12s ease;font-family:inherit;border:0;background:0;width:100%;text-align:center;margin-top:2px}
#questku-panel .qk-tl-pop .qk-tl-clr:hover{color:rgba(255,255,255,.7);background:rgba(255,255,255,.06)}
#questku-panel .qk-tl-pop .qk-tl-clr:disabled{opacity:.3;cursor:not-allowed;pointer-events:none}
#questku-panel .qk-tl-pop .qk-tl-clr:active{background:rgba(255,255,255,.1)}
#questku-panel .qk-list{height:300px;overflow-y:auto;padding:4px 8px}
#questku-panel .qk-list::-webkit-scrollbar{width:4px}
#questku-panel .qk-list::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:2px}
#questku-panel .qk-tl-pop::-webkit-scrollbar{width:4px}
#questku-panel .qk-tl-pop::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:2px}
#questku-panel .qk-cd{margin:6px 0;border-radius:14px;overflow:hidden;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.06);box-shadow:0 2px 8px rgba(0,0,0,.16),0 8px 32px rgba(0,0,0,.1),inset 0 1px 0 rgba(255,255,255,.05);transition:all .2s;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
#questku-panel .qk-cd:hover{background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.09);box-shadow:0 2px 8px rgba(0,0,0,.2),0 12px 40px rgba(0,0,0,.14),inset 0 1px 0 rgba(255,255,255,.06)}
#questku-panel .qk-cd.sel{box-shadow:0 2px 8px rgba(0,0,0,.22),0 8px 32px rgba(0,0,0,.16),inset 0 1px 0 rgba(255,255,255,.05)}
#questku-panel .qk-ban-wrap{position:relative;border-radius:14px 14px 0 0;overflow:hidden;aspect-ratio:16/4.5;isolation:isolate}
#questku-panel .qk-ban{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;transition:opacity .2s ease;z-index:0}
#questku-panel .qk-ban-g{background:linear-gradient(135deg,hsla(0,0%,100%,.03),hsla(0,0%,100%,.06));height:100%}
#questku-panel .qk-ban-vid{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .2s ease-in-out;z-index:1}
#questku-panel .qk-ban-overlay{position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(to top,rgba(10,11,13,.95) 0%,rgba(10,11,13,.88) 10%,rgba(10,11,13,.75) 22%,rgba(10,11,13,.55) 35%,rgba(10,11,13,.32) 48%,rgba(10,11,13,.15) 58%,rgba(10,11,13,.06) 70%,transparent 82% 100%),linear-gradient(to right,rgba(10,11,13,.2) 0%,transparent 12%,transparent 88%,rgba(10,11,13,.2) 100%)}
#questku-panel .qk-game-logo-wrap{position:absolute;bottom:10px;left:12px;z-index:2;pointer-events:none;display:flex;flex-direction:column;align-items:flex-start;gap:2px}
#questku-panel .qk-game-logo{height:26px;width:auto;max-width:120px;object-fit:contain;object-position:left center;display:block}
#questku-panel .qk-promoted{font-size:9.5px;color:rgba(255,255,255,.35);line-height:1;white-space:nowrap;font-weight:400}
#questku-panel .qk-promoted strong{font-weight:600;color:rgba(255,255,255,.55)}
#questku-panel .qk-bd{padding:12px 16px 14px}
#questku-panel .qk-top{display:flex;align-items:center;gap:16px;cursor:pointer}
#questku-panel .qk-top .qk-ico{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;flex-shrink:0;background:rgba(255,255,255,.04);border:2px solid rgba(255,255,255,.1);color:rgba(255,255,255,.5);overflow:hidden}
#questku-panel .qk-top .qk-ico img,#questku-panel .qk-top .qk-ico video{width:100%;height:100%;object-fit:cover;display:block}
#questku-panel .qk-top .qk-ico.done{color:#23a55a;background:rgba(35,165,90,.08);border-color:rgba(35,165,90,.15)}
#questku-panel .qk-top .qk-ico.fail{color:#f23f42;background:rgba(242,63,66,.08);border-color:rgba(242,63,66,.15)}
#questku-panel .qk-top .qk-if{flex:1;min-width:0}
#questku-panel .qk-top .qk-if .qk-nm{font-size:11px;color:#545ded;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:600;line-height:1.3;letter-spacing:.4px;text-transform:uppercase}
#questku-panel .qk-top .qk-if .qk-rw{font-size:16px;color:#f2f3f5;font-weight:700;line-height:1.2;margin-top:2px;display:flex;flex-wrap:wrap;align-items:center;gap:4px}
#questku-panel .qk-top .qk-if .qk-sb{font-size:11px;color:rgba(255,255,255,.3);margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:opacity .18s cubic-bezier(.4,0,.2,1),transform .18s cubic-bezier(.4,0,.2,1)}
#questku-panel .qk-cd[data-qidx] .qk-sb{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
#questku-panel .qk-cd[data-qidx]:hover .qk-sb{opacity:0;transform:translateY(-4px)}
#questku-panel .qk-hp{position:absolute;left:0;right:0;top:44px;display:flex;flex-direction:column;gap:5px;pointer-events:none;opacity:0;transform:translateY(4px);transition:opacity .18s cubic-bezier(.4,0,.2,1),transform .18s cubic-bezier(.4,0,.2,1)}
#questku-panel .qk-cd[data-qidx]:hover .qk-hp{opacity:1;transform:translateY(0)}
#questku-panel .qk-hp-txt{font-size:11px;color:rgba(255,255,255,.6);font-weight:500;white-space:nowrap;line-height:1}
#questku-panel .qk-hp-bar{height:3px;width:100%;background:rgba(255,255,255,.04);border-radius:999px;overflow:hidden}
#questku-panel .qk-hp-fill{height:100%;width:0;border-radius:999px;background:#545ded;transition:width .25s cubic-bezier(.4,0,.2,1)}
#questku-panel .qk-hp-fill.dn{background:#23a55a}
#questku-panel .qk-hp-fill.fl{background:#f23f42}
#questku-panel .qk-if{position:relative}
#questku-panel .qk-top .qk-tg{font-size:10.5px;padding:3px 10px;border-radius:100px;font-weight:600;white-space:nowrap;flex-shrink:0;background:rgba(255,255,255,.04);color:rgba(255,255,255,.35)}
#questku-panel .qk-top .qk-tg.dn{background:rgba(35,165,90,.12);color:#23a55a}
#questku-panel .qk-top .qk-tg.en{background:rgba(84,93,237,.12);color:#545ded}
#questku-panel .qk-top .qk-tg.fl{background:rgba(242,63,66,.12);color:#f23f42}
#questku-panel .qk-top .qk-tg.pn{background:rgba(240,178,50,.12);color:#f0b232}
#questku-panel .qk-top .qk-tg.rd{background:rgba(84,93,237,.12);color:#545ded}
#questku-panel .qk-cd-d{display:none;padding:12px 0 0;font-size:11px;color:rgba(255,255,255,.35)}
#questku-panel .qk-cd-d.op{display:block}
#questku-panel .qk-cd-d .qk-el{display:flex;align-items:center;gap:10px;margin-top:18px;padding-top:16px;border-top:1px solid rgba(255,255,255,.06)}
#questku-panel .qk-cd-d .qk-el .qk-bb{flex:1;height:34px;font-size:12px;font-weight:500;border-radius:6px;border:0;background:rgba(255,255,255,.04);color:rgba(255,255,255,.4);cursor:pointer;transition:all .12s ease;font-family:inherit;display:flex;align-items:center;justify-content:center}
#questku-panel .qk-cd-d .qk-el .qk-bb:hover{background:rgba(255,255,255,.07);color:rgba(255,255,255,.7)}
#questku-panel .qk-cd-d .qk-el .qk-bb:active{background:rgba(255,255,255,.1);color:#fff;transform:scale(.97)}
#questku-panel .qk-cd-d .qk-el .qk-bb.act{color:#fff;background:rgba(255,255,255,.08);font-weight:600}
#questku-panel .qk-pr{height:4px;background:rgba(255,255,255,.04);border-radius:4px;margin:10px 0 0;overflow:hidden}
#questku-panel .qk-pr-f{height:100%;border-radius:2px;background:#545ded;width:0;transition:width .3s ease}
#questku-panel .qk-pr-f.dn{background:#23a55a}
#questku-panel .qk-pr-f.fl{background:#f23f42}
#questku-panel .qk-ft{display:flex;align-items:center;justify-content:center;gap:6px;padding:8px 14px 10px;border-top:1px solid rgba(255,255,255,.04)}
#questku-panel .qk-ft .qk-btn{flex:1;border:0;background:rgba(255,255,255,.04);color:rgba(255,255,255,.2);font-size:12px;font-weight:500;padding:7px 10px;border-radius:8px;cursor:pointer;transition:all .12s;font-family:inherit;text-align:center}
#questku-panel .qk-ft .qk-btn:hover{background:rgba(255,255,255,.07);color:rgba(255,255,255,.5)}
#questku-panel .qk-ft .qk-btn.enabled{color:rgba(255,255,255,.5);background:rgba(255,255,255,.04)}
#questku-panel .qk-ft .qk-btn.enabled:hover{color:rgba(255,255,255,.7);background:rgba(255,255,255,.07)}
#questku-panel .qk-ft .qk-btn:disabled,
#questku-panel .qk-ft .qk-btn:disabled:hover,
#questku-panel .qk-ft .qk-btn:disabled:active{opacity:.25;cursor:not-allowed;transform:none;background:rgba(255,255,255,.04);color:rgba(255,255,255,.2);border-color:transparent;box-shadow:none}
#questku-panel .qk-ft-p{display:flex;align-items:center;gap:6px;padding:8px 14px 10px;border-top:1px solid rgba(255,255,255,.04)}
#questku-panel .qk-ft-p .qk-btn{width:auto;padding:7px 14px;border:0;background:rgba(255,255,255,.04);color:rgba(255,255,255,.4);font-size:12px;font-weight:500;border-radius:8px;cursor:pointer;transition:all .12s;font-family:inherit;text-align:center}
#questku-panel .qk-ft-p .qk-btn:hover{background:rgba(255,255,255,.07);color:rgba(255,255,255,.7)}
#questku-panel .qk-ft-p .qk-btn:disabled,
#questku-panel .qk-ft-p .qk-btn:disabled:hover,
#questku-panel .qk-ft-p .qk-btn:disabled:active{opacity:.25;cursor:not-allowed;transform:none;background:rgba(255,255,255,.04);color:rgba(255,255,255,.2);border-color:transparent;box-shadow:none}
#questku-panel .qk-ft-p .qk-st{margin-left:auto;font-size:10.5px;color:rgba(255,255,255,.2);font-variant-numeric:tabular-nums}
#questku-panel .qk-ft-p .qk-st .dc{color:#23a55a}
#questku-panel .qk-ft-p .qk-st .fc{color:#f23f42}
#questku-panel .qk-badge{border:0;background:rgba(255,255,255,.04);color:rgba(255,255,255,.45);font-size:11px;font-weight:500;height:28px;padding:0 10px;border-radius:6px;font-family:inherit;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.06);box-shadow:0 1px 2px rgba(0,0,0,.12);pointer-events:none}
#questku-panel .qk-empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;padding:0 24px}
#questku-panel .qk-empty-title{font-size:14px;font-weight:600;color:rgba(255,255,255,.75);margin-bottom:6px;font-family:inherit}
#questku-panel .qk-empty-desc{font-size:11.5px;color:rgba(255,255,255,.35);line-height:1.4;font-family:inherit}
`.trim();
        document.head.appendChild(c);

        let p = document.createElement('div');
        p.id = 'questku-panel';
        p.innerHTML =
            '<div class="qk-h"><div class="qk-l"><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAydpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDkuMS1jMDAzIDc5Ljk2OTBhODdmYywgMjAyNS8wMy8wNi0yMDo1MDoxNiAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIDI2LjExIChXaW5kb3dzKSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDoxNjFEODFGNTdGRjYxMUYxOEIwNEI3NDExMkEzM0Y1QSIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDoxNjFEODFGNjdGRjYxMUYxOEIwNEI3NDExMkEzM0Y1QSI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOjE2MUQ4MUYzN0ZGNjExRjE4QjA0Qjc0MTEyQTMzRjVBIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjE2MUQ4MUY0N0ZGNjExRjE4QjA0Qjc0MTEyQTMzRjVBIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+o5PnZAAAEO9JREFUeNp8WguQHMV5/rtnZm/39vbeL51Or0NCQgiVhDiwFBsIRjIGYhBYFgUkMgkuYpvgOFBFqsAlTAI4hrioGMcxxiXLSoJc2LxswDyEbVmUAEUvEEJC6HWnx+lOutPd3r5nuvP/M90zPXsnj6q1u/Po+ft/fP/3/31MSgnm0V+QMFIB4Ph90xEPGmrwO2NQEACuZDCG18qehIKHN+Bv28LzeA7PzxjMwmf6z8olY0U2L5eHmZWKbAXBbEfKbNqWxzI2HJzZKHe1ptnW9pS3GyQv4zVwXQ4VnKM+AeDIYN4EClDDJAyPMlgyh0HPVAYevnPmFHynHclrm8IPFAFGygAWwzlg8oPOOzg5xzGYg1kHB+H6w2fgmqEcLCqWoA0EOBbexfFluDZgngDXgzacumdEwOVHB1EwLrNNNWxvZwb+OLcVXuish3fZuV6oDtQhzQPHhiR0tweK889rC5wsShgooXB4I1OCmhbIC/92KOOFI6Py4i397J69p+GmUgkyHB9w8KolpG85Lklw/MTfDJ+jwfE9/nn1W7oSvEpwf2eGbbmwk/148TT2HBqhUiwzXGTcAud147vRSqgPSOJN0zqCRfgLIMFPouuQZgMxJy6A483DJdb93Cfw4LYTcEfZg0SKBa4GJBwJqYQjbfrfPXXeFJ6u4Xn/k16C38kFaTFdDXzr8gv4d6Y3s03CI6VMXAAdehHTcRH8aF7CYDESvvog7TbgzdsG4LaHt7L3thyDu/C9iZS6X/hCMV+gQNNa84HQvuAy0IgWHsiaKKBU3xP4jjQ68+lRsfR/t7hvvfmB90PbYhnHntyVLXx3EV297xS+42wlEHKyg2Kh1gJ73Ufw5H/sYv89UpFdSbSEpQQCqbSrXEVqQZU1fA1LGSzQt45aGEDoajQXh2Bx5DYpPLH9gHf3L94qb8oW4Pyko+adZBFkEW6xcwcq+lj6B7vYcy8dZt9ynMDPtRvQsLSWlcCWElBrHMIYkNFz9M9/TrkV6PPRogmNhkZE789fL789MAxLa5NsUksw34UNbdKg1drMf3nqmT38V1sH2I0JnNCioPQMzYvI78FYVDACAZmyULAoYxH6GaEspBRhxkUKLV0syqkvbSm9Mjgil6acwF2r5eV0szlIsAzO8s9/gqe3n4JrEuiH3FWBp7WpfNfXtAgEBi0E3ecjEAsXFy04eDaMExX8zEQtZSV6jlzKYbLpsfXFX3/SL2eRqxdKEv0/GlyiHfQQOJrQXE/thgdePAi3J2ogNDMlF+1f2oeZEsRSpte+H2C6DNxC+7kBoaGl1AK50BaTcTDAd9agAnN5MeWJX5Q24uW0r1BmjBKe1SOBafBPJ+QVj++E71qJQCuEFr4WASIt6yBVv0FozYvAHUJBZfC8sop/DnRgq9/qHcHiWBjooFyR5q2vYXDgkHvpM78uP4LoBJgwoaQGr+DDNFycIF+G9Nqt8COPgWWDrNJWoOlQ29qlIPBzSumeGyADhZxvGbzHMuKBFloqykjDhCZ4zQJtOW3NKCGSFWiBTWkGr28u37N9j3elTQhUViiUQz+iQQJv+Ai+uf8MXEi4zD1mmNTAdB182p28QBPDYxJakhzmNjMYHZdwFn+PZPFzXMDIGMDZrIASvmd+F3Ia/Dw7KkFWpO9eLIyTKLj9ONPWFcF9COHsl78p/VsuB04RE28Bc5g9ipMRpg6XoGPDPnYvqt7XQmBCFnOb0BIGYozlJFzQwuCOqy1YtYjBOJKeeze6MH8ag2kNGIio3mwe4MAJ5EQVjK+vObDvmIBn/+DCi++4kEct1iUgdBkOBrRqN1LfU6jZI33i0vd3ujf3LrA35sma6/e7Pu6+fBDuX7eHfY9SNItRAmVONwo4pgJzFDV8x8UMvn+DFQgRR+lJsosmKcH1/biQe35YhMPHBTQQ1guILGLEGDfQrozWntLGt/397cmlaFGPc5SmUJHJTf3sb0n7zEAZnWz8gIUITchvSfOrFnD4z1W2L7yU0QjiVFaNYBHRfRLmdnNYf38KpjZxKBQjQACFSDpOwoDGa5QPThx3ew/3eZ9LokV4K778eJYtPZZl5/s0WWG1RhPNLP2hcJu0cB66x5MreSjUZFmS4X/R58SUT4voxJj5/tdrQLhxNArh2DMyeegZDD7+2FvN0Yp2CW945zhcLwgxWASRYOK2TmAqBkqIAA/dZEFzbZynMPUfIdq7n0rYfdTDAJdQh+7R28NhcU+wIPMZWkTvfAtu+bwD//NKGVrqgmLEdzahNa/4lIqNJHrKwUPuilzOSdmFCtifjLBlNpMxOsy0D3oQQ6ICar8XkWTlQjap2jd9JODRl1zYi/4tKpFbELe/dLYFD93qwPwZHOKVoIQ7b3Tgt7+vYNWFyMJYDMLBYLs0F1Gd8VEx88RxMZ8fGmWzB3Iwm6CTVbNJUY0I4EPhml7uZ8GY9vGlT//Bg1ueKsOBkwKaUgBtGQZYPkJ7Gvwg3bbPg5sfLsLWvd4El+pq4/CXS2zIj5vCyyqOFSGVdIEfP+5dwvcNwSLkF41WleBcGtWUGuSn7SjQinlsgr9v3i/ggV9WoCEVwKJPr1UW1r5Ni8LCGv4JFzl0VoJeg1bE8qWYjRRHAhGnFZoQhhQGx8hpcRE/mWcLUOu2FfIPiFFk7imqLCn7SViI9ejURhbzexeT3mMvu5CwlJVKij4YcUMC0fkU2v/UoAcbXnWroFbCgjkcGtFq0qvSOrAYA2WKMY8Ne/P4qZycx2WUCUOOIyDk7UyNCgbvwm6IIw9OtBdxfE8f1pg4M/l6d1NAGXRlRveWMZi7W6iLIPwKbPMOF9cUWYGONkQkKhPdiqFpiNzGH2pOAhzMxD18tMDabIhujJMpI7WLgMzNaJwYvLuOSsjm0I8bGLxwXw28ubYG7rvBgVwuIHGU9u+/JQG/+V4KNqxNQXsj1uCnPBgajuOvhVK1IDy7pSoeJo2kqtyK+BOCRA0vVaRjyYikcUUhdAaOYIzciEEmMXEBhTLRBQkrL7VhThcHorxf+6IN05Bi5FD4me0c1lzj+OfnTrfg2mUOFusS8kUTToPPFDaENGTqhkHoCSJAIwtCwOG8xYHx0F8NGNVEiisI0y41sbZj0IjBSY2ok2dEeG5gmLI1+EKP54nUydDn+wcEtBJCTWJNaSAfmNTcC5SKRUsICgi3nt2Skn0DY7omlYqvRyjEDTpNCxovTaygL57FYEo98qn3PJje7MI8bIE8g0kpj9rPYFFEzPQ+5Dy3LXdgO+aJN7e4cAVCZiYdcSMdC+O5wL+5VN0LX/sspNig6LnwqNhhp+2OJHy4x5NUkDEwCpFY9aSsQ6Y7PESzWrElzJ7C4YoLLHhrpwdPvlj2NUQBnUn4eI1lFGbm3S4KjtTTDRT15S84MdehI4eWOoGsNWHJiNApS4BRnlJio5ZMXZrts2c3wZ7NCBp4MakNGvhgvJNG15LU8vhU4EutkBLQYCjsg19JwPt7836TKlMbQKGumwnbqeN3w+UOrLragf/b48LyZVZVv4SosgenBwXU1gQcyHdfg5P5HQiyBgT92PZO2M9bU7Ar47DjMgxi1fLQlpDKrYgJoj9/1O/BB/2yipQhucOm60/vSUIaFXsam6BuWSoNSh8W63FRj9ydhM+h63x7TTLI5FXO+PvNZSgXvajQV8LrFk1AKXQPColgh7ODt6XhzNQMfOi6Mu46XryjpmsAD1f+9BuerzETw2nCZRda8NtHUnDrVUixUYt5bKhmMXgFPtOICxgcliqHyCoagkkJa4vX3nAhgy0/M/aq8xPzGQG2XWrYeNd0vsNuTGJy6oDXd/fBjZwZPq8ngKgtounAS++7cMMlFqxYxMHUIwnW1crg0buSWE4KOIqcyG+bY7DOmc79jractAvN4Cc/K8AQ5oaWBlyAKyPkU509ndjoIOtOnWFta++wjtnYy4d5bfBaxoIc+l066vVErLQ6oaTRfb/90xL8/Fs10Ht+vCbwYwJ/NyFMNmXsGFoF8RLHfSJ1r71Rhmc3FqGjmftcKRJe1QYhnQjikhLd/EX2804N7jDQfFMb4Oj8TvY7SkgBlCrurUxpCdOdmF/nUmG+5okirEeze4IZxYtJccw2WnDP0WMS+o7HKUTPLA4dmPRKRRF16BTW6cpQV2hEKNNpNtIz135+HOGZT63D/jzS3dWL+FNAcAoGE1XuJA1qwRQ+Eymz8evadSVY+UAB1r9agU9RONqEUKkoHJRxdyOFfvzHJbj1Gzm476E8VNyoSps7x4Z/f7yOcN1Hrxj6GayUPovY5Vi4xNnY3slPcLyRbcainvSTwVj4zgveK9uPyGvrHYjorKdSuidDWquzo/bLEu4/FYsBje7GGGhDTtRYF2D1CNLm02dwD+Kk8IM5g1VcCYP7sosd6MG4qGBipL0Aaia8gyg0joFOfR/dE9I5yD8QzXBjJHvvY5nFTa38YAW9gG3Hsk/6LQvceRmChXetK7+P/ZcaG3RnIOoQaFj0z3maK7EwwMl/KWgF1pS0A0OwR7ogmpGwVCCqHmkhF2xsWAbfr0OkonzBBYt3tFXzKzss4NqvJB+6dnXqu9lREXSnabW4qYUmBbhoGvtgzTLr0bPZqBsBwug0QxRcVFAzA524orjUNchgSmxIBSNd46d8PwlxKUL3JLhsxkBvzGC1VkcjED5kAipx6c5ICbP09Jn2rhU3p56guiSB8zrUlfC1w4MGFLU27rrKfuwzPfztsayIVWUxmm3UzWZrPGzu+lmYhYkR1DyahOkWetTJNucy2vFqXsJ9vJ677R9q77RtmSOX0yyAlAJ60DZmxZWVf1nt/HVnPTtArWyzoIjqVJpQGMLLcJsJVPXF1HOgEmDY59GwqJu50ixcjNaK1DQEEyK6y+3frP36vIXWdh9AktHgDprXHASJnY3sxONfTdyMmwwDlbIIJ+bmjovumCmmyOhNJloJGfZ0IEbV9WKN3pOImsUx9ovn8mcFfOnW2gevvL5mQ26MtndZ2Geiwas2PHzko/5mzxT+4T/+lXMdutlhv6MsDXZIYBv2aQTEWKzeRpJxVqvdJGi3C0XOIqtVJ0xisbkxAVddn1y78u9SjxRK+EyNnDjOtfc0XgDoaGI7Vv2FfXVXA7yXz8uwi2wGb3BOFxlGf1/vXhrCm02D4N64u2iAqBQp3bL8Zz+fvHPJZxMPE2JJOXF7yac41JkW52gNYtMLcIPt0JrlzvLL5rIf4Z4V8pBJ9n3NDe7QUtLYAIm3SCzJjG2mqE1CCZMSVXOTteO61emr5y10fpYfF+fcvaep+XRM4ZQDvMkWQbkDL+C82RW99t2rrrSua6kTO4s56bNSU7tBASJCnNctGUuVpbopbCJOtK8WJDcsdsYWX5b815v+Jn15cxvfSv1/mGwXNXgUWjs42JQDpjYxOIYZkLiQNcmGN91MLtXTxV9trU+8fbTP++ru/e43RkbgIocarBz8ci6CPhbL1PpPDcBok5AU5Ocl9O2Ew7ILFqWeXbDY+UFthu2n9mKlHKfrpvA02rAKrMXcYetN4+7maBHcmtwaJaoIXSgummf9F/71yLpDR7wvHOkXtw0Py8uLeejUQtuazym89wspL6AWlKXpNzbByo2NfOeMWfbzU7qdX03ptg+REoig1abO4TJVwsf+WsVcRNn98385Qg1e2hfsaucvtzexl/HRlqFB0Yu855JcFi7ErHleuSBbZYXRTilDN3HtBOTSKd5XX88/rqtjuzrarHcbmvj+JHbCCnniU1h2OjCp1s39kbbOSHg6/l+AAQBGyZJVTt7rowAAAABJRU5ErkJggg==" style="width:24px;height:24px;border-radius:6px;display:block"><span class="qk-wm">Quest<span>ku</span></span><span class="qk-ob" id="qk-ob">0</span></div>' +
            '<div class="qk-nav"><div class="qk-nav-scroll" id="qk-nav-scroll"><button class="qk-nav-tab act" data-t="quests">All Quests</button><button class="qk-nav-tab" data-t="prog">Progress</button><button class="qk-nav-tab" data-t="hs">HypeSquad</button></div><div class="qk-nav-indicator" id="qk-nav-ind"></div></div>' +
            '<button class="qk-hbtn" id="qk-min">-</button><button class="qk-hbtn" id="qk-close">x</button></div>' +

            '<div class="qk-body act" id="qk-b-quests">' +
            '<div class="qk-tl"><div class="qk-tl-left"><button class="qk-bb" id="qk-sel-toggle">Select All</button><div class="qk-tl-dd"><button class="qk-bb" id="qk-sort-btn">Sort &#9660;</button><div class="qk-tl-pop" id="qk-sort-pop"><label class="qk-tl-opt"><input type="radio" name="sort" data-sort="suggested" checked><span class="rb"></span>Suggested</label><label class="qk-tl-opt"><input type="radio" name="sort" data-sort="recent"><span class="rb"></span>Most Recent</label><label class="qk-tl-opt"><input type="radio" name="sort" data-sort="expires"><span class="rb"></span>Expiring Soon</label><label class="qk-tl-opt"><input type="radio" name="sort" data-sort="started"><span class="rb"></span>Started</label><label class="qk-tl-opt"><input type="radio" name="sort" data-sort="reward"><span class="rb"></span>Highest Reward</label><label class="qk-tl-opt"><input type="radio" name="sort" data-sort="name"><span class="rb"></span>Alphabetical (A–Z)</label></div></div><div class="qk-tl-dd"><button class="qk-bb" id="qk-filter-btn">Filter &#9660;</button><div class="qk-tl-pop" id="qk-filter-pop"><div class="qk-tl-hd">Reward</div><label class="qk-tl-opt"><input type="checkbox" data-filter="orb"><span class="cb"></span>Orbs</label><label class="qk-tl-opt"><input type="checkbox" data-filter="avatardeco"><span class="cb"></span>Avatar Decoration</label><label class="qk-tl-opt"><input type="checkbox" data-filter="profileeffect"><span class="cb"></span>Profile Effect</label><label class="qk-tl-opt"><input type="checkbox" data-filter="ingame"><span class="cb"></span>In-Game Rewards</label><div class="qk-tl-div"></div><div class="qk-tl-hd">Quest Type</div><label class="qk-tl-opt"><input type="checkbox" data-filter="play"><span class="cb"></span>Play</label><label class="qk-tl-opt"><input type="checkbox" data-filter="watch"><span class="cb"></span>Watch</label><label class="qk-tl-opt"><input type="checkbox" data-filter="stream"><span class="cb"></span>Stream</label><label class="qk-tl-opt"><input type="checkbox" data-filter="activity"><span class="cb"></span>Activity</label><div class="qk-tl-div"></div><div class="qk-tl-hd">Status</div><label class="qk-tl-opt"><input type="checkbox" data-filter="avail"><span class="cb"></span>Available</label><label class="qk-tl-opt"><input type="checkbox" data-filter="prog"><span class="cb"></span>In Progress</label><label class="qk-tl-opt"><input type="checkbox" data-filter="done"><span class="cb"></span>Completed</label><label class="qk-tl-opt"><input type="checkbox" data-filter="expired"><span class="cb"></span>Expired</label><div class="qk-tl-div"></div><button class="qk-tl-clr" id="qk-filter-clear" disabled>Clear</button></div></div></div><div class="qk-tl-right"><button class="qk-bb" id="qk-refresh">&#x21bb;</button></div></div>' +
            '<div class="qk-list" id="qk-ql"></div>' +
            '<div class="qk-ft"><button class="qk-btn" id="qk-addq">Start Queue</button></div></div>' +

            '<div class="qk-body" id="qk-b-prog">' +
            '<div class="qk-tl"><div class="qk-tl-left"><button class="qk-bb" id="qk-prog-sel-toggle" disabled>Select All</button><div class="qk-tl-dd"><button class="qk-bb" id="qk-prog-filter-btn">Filter &#9660;</button><div class="qk-tl-pop" id="qk-prog-filter-pop"><div class="qk-tl-hd">Sort By</div><label class="qk-tl-opt"><input type="radio" name="progsort" data-sort="order" checked><span class="rb"></span>Queue Position</label><label class="qk-tl-opt"><input type="radio" name="progsort" data-sort="newest"><span class="rb"></span>Newest</label><label class="qk-tl-opt"><input type="radio" name="progsort" data-sort="oldest"><span class="rb"></span>Oldest</label><label class="qk-tl-opt"><input type="radio" name="progsort" data-sort="name"><span class="rb"></span>Alphabetical (A–Z)</label><div class="qk-tl-div"></div><div class="qk-tl-hd">Status</div><label class="qk-tl-opt"><input type="checkbox" data-progfilter="running"><span class="cb"></span>Running</label><label class="qk-tl-opt"><input type="checkbox" data-progfilter="pending"><span class="cb"></span>Pending</label><label class="qk-tl-opt"><input type="checkbox" data-progfilter="paused"><span class="cb"></span>Paused</label><label class="qk-tl-opt"><input type="checkbox" data-progfilter="done"><span class="cb"></span>Done</label><label class="qk-tl-opt"><input type="checkbox" data-progfilter="failed"><span class="cb"></span>Failed</label><label class="qk-tl-opt"><input type="checkbox" data-progfilter="stopped"><span class="cb"></span>Stopped</label><div class="qk-tl-div"></div><button class="qk-tl-clr" id="qk-prog-filter-clear" disabled>Clear</button></div></div></div><div class="qk-tl-right"><span class="qk-prog-active" id="qk-prog-active">No Active</span><button class="qk-bb" id="qk-kill">Kill</button><button class="qk-bb" id="qk-prog-refresh">&#x21bb;</button></div></div>' +
            '<div class="qk-list" id="qk-pl"></div>' +
            '<div class="qk-ft qk-ft-p"><button class="qk-btn" id="qk-pause" disabled>Pause</button><button class="qk-btn" id="qk-stopq" disabled>Stop</button>' +
            '<span class="qk-st"><span class="dc" id="qk-dc">0</span> done <span style="color:#80848e">|</span> <span class="fc" id="qk-fc">0</span> failed</span></div></div>' +

            '<div class="qk-body" id="qk-b-hs">' +
            '<div class="hs-c" id="hs-cards"></div>' +
            '<div class="hs-desc" id="hs-desc"><div class="hs-dn"></div><div class="hs-dd"></div></div>' +
            '<div class="hs-t"><button class="hs-btn hs-ap" id="hs-ap" disabled>Apply Badge</button><button class="hs-btn hs-rm" id="hs-rm" disabled>Remove Badge</button></div></div>';

        document.body.appendChild(p);document.body.appendChild(p);
        D = {
            pan: p, ql: document.getElementById('qk-ql'), pl: document.getElementById('qk-pl'),
            tabs: p.querySelectorAll('.qk-nav .qk-nav-tab'), ba: p.querySelector('#qk-b-quests'), bp: p.querySelector('#qk-b-prog'), bh: p.querySelector('#qk-b-hs'),
            addq: document.getElementById('qk-addq'), pause: document.getElementById('qk-pause'),
            stopq: document.getElementById('qk-stopq'), qc: document.getElementById('qk-qc'),
            dc: document.getElementById('qk-dc'), fc: document.getElementById('qk-fc'),
            refresh: document.getElementById('qk-refresh'), ob: document.getElementById('qk-ob'),
            min: document.getElementById('qk-min'), close: document.getElementById('qk-close'),
            ap: document.getElementById('hs-ap'), rm: document.getElementById('hs-rm')
        };


        let navInd = document.getElementById('qk-nav-ind');
        let navEl = document.querySelector('.qk-nav');
        let scrollEl = document.getElementById('qk-nav-scroll');
        let activeTab = null;
        function updateNavInd(tab) {
            if (!navInd || !tab) return;
            let rect = tab.getBoundingClientRect();
            let navRect = navEl.getBoundingClientRect();
            let pad = 6;
            navInd.style.left = (rect.left - navRect.left - pad) + 'px';
            navInd.style.width = (rect.width + pad * 2) + 'px';
        }
        if (scrollEl) {
            scrollEl.addEventListener('wheel', e => {
                e.preventDefault();
                scrollEl.scrollBy({ left: e.deltaY, behavior: 'smooth' });
            }, { passive: false });
        }
        D.tabs.forEach(t => {
            if (t.classList.contains('act')) activeTab = t;
            t.onmouseenter = () => updateNavInd(t);
            t.onmouseleave = () => { if (activeTab) updateNavInd(activeTab); };
            t.onclick = () => {
                if (hidden) { hidden = false; p.querySelectorAll('.qk-body, .qk-tl, .qk-list, .qk-ft').forEach(x => x.style.display = ''); D.min.textContent = '-'; }
                D.tabs.forEach(x => x.classList.remove('act'));
                t.classList.add('act');
                activeTab = t;
                updateNavInd(t);
                D.ba.classList.toggle('act', t.dataset.t === 'quests');
                D.bp.classList.toggle('act', t.dataset.t === 'prog');
                D.bh.classList.toggle('act', t.dataset.t === 'hs');
                if (t.dataset.t === 'hs') {
                    hsState.selected = null;
                    renderHypeSquad();
                } else if (t.dataset.t === 'prog') renderProgress();
                if (scrollEl) {
                    t.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    setTimeout(() => updateNavInd(t), 300);
                }
            };
        });
        if (scrollEl) {
            let st2;
            scrollEl.addEventListener('scroll', () => {
                clearTimeout(st2);
                st2 = setTimeout(() => { if (activeTab) updateNavInd(activeTab); }, 60);
            });
        }
        if (navEl) navEl.onmouseleave = () => { if (activeTab) updateNavInd(activeTab); };
        if (activeTab) setTimeout(() => updateNavInd(activeTab), 10);
        if (scrollEl) setTimeout(() => scrollEl.scrollLeft = 0, 100);

        let ox, oy, dr = false;
        let hdr = p.querySelector('.qk-h');
        hdr.addEventListener('mousedown', e => { dr = true; ox = e.clientX - p.offsetLeft; oy = e.clientY - p.offsetTop; });
        document.addEventListener('mousemove', e => { if (dr) { p.style.left = (e.clientX - ox) + 'px'; p.style.right = 'auto'; p.style.bottom = 'auto'; p.style.top = (e.clientY - oy) + 'px'; } });
        document.addEventListener('mouseup', () => dr = false);


        D.close.onclick = () => { p.remove(); c.remove(); D = null; };
        let hidden = false;
        D.min.onclick = () => { hidden = !hidden; p.querySelectorAll('.qk-body, .qk-tl, .qk-list, .qk-ft').forEach(x => x.style.display = hidden ? 'none' : ''); D.min.textContent = hidden ? '+' : '-'; };


        D.addq.onclick = async () => {
            let unenrolled = st.allQuests.filter(x => x._sel && !x.userStatus?.completedAt && !x.userStatus?.enrolledAt);
            let enrolled = st.allQuests.filter(x => x._sel && !x.userStatus?.completedAt && x.userStatus?.enrolledAt);

            if (unenrolled.length > 0) {
                for (let q of unenrolled) {
                    let ok = await enrollQuest(q);
                    if (!ok) log.e('Enroll failed: ' + q.config.messages.questName);
                }
                await sleep(500);
                renderAllQuests();
                updateAddqBtn();

                // Fallback: force button update if still showing Enroll
                let stillUnenrolled = st.allQuests.filter(x => x._sel && !x.userStatus?.completedAt && !x.userStatus?.enrolledAt);
                let nowEnrolled = st.allQuests.filter(x => x._sel && !x.userStatus?.completedAt && x.userStatus?.enrolledAt);
                if (stillUnenrolled.length === 0 && nowEnrolled.length > 0 && D.addq.textContent.includes('Enroll')) {
                    D.addq.textContent = nowEnrolled.length === 1 ? 'Start Queue' : 'Start Queue (' + nowEnrolled.length + ')';
                    D.addq.disabled = false;
                    D.addq.classList.add('enabled');
                }

                return;
            }

            let sel = enrolled.map(q => ({ q, status: 'pending', pct: 0, curr: 0 }));
            if (sel.length === 0) return;
            sel.sort((a, b) => getEstimatedDuration(a.q) - getEstimatedDuration(b.q));
            
            st.queue = sel;
            st.completed = 0; st.failed = 0;
            D.addq.disabled = true;
            D.addq.classList.remove('enabled');
            st.allQuests.forEach(q => { q._sel = false; });
            renderAllQuests();
            switchTab('prog');
            processQueue();
        };


        D.pause.onclick = () => {
            let runningIdx = st.queue.findIndex(x => x.status === 'running');
            if (runningIdx === -1) return;
            let item = st.queue[runningIdx];
            item._paused = !item._paused;
            D.pause.textContent = item._paused ? 'Resume' : 'Pause';
            renderProgress();
            updateStats();
        };
        D.stopq.onclick = () => {
            let runningIdx = st.queue.findIndex(x => x.status === 'running' || x.status === 'paused');
            if (runningIdx === -1) return;
            let item = st.queue[runningIdx];
            st.running = false;
            st._cleanups.forEach(fn => { try { fn(); } catch {} });
            st._cleanups = [];
            if (Q.Game) {
                if (originalProps.getRunningGames) Q.Game.getRunningGames = originalProps.getRunningGames;
                if (originalProps.getGameForPID) Q.Game.getGameForPID = originalProps.getGameForPID;
            }
            if (Q.Streaming && originalProps.getStreamerActiveStreamMetadata)
                Q.Streaming.getStreamerActiveStreamMetadata = originalProps.getStreamerActiveStreamMetadata;
            if (Q.Flux && Q.Game)
                try { Q.Flux.dispatch({ type: 'RUNNING_GAMES_CHANGE', removed: [], added: [], games: Q.Game.getRunningGames() }); } catch {}
            item._paused = false;
            item.status = 'stopped';
            item.pct = 0;
            st.stopped++;
            renderProgress();
            updateStats();
            processQueue();
        };
        let killBtn = document.getElementById('qk-kill');
        if (killBtn) killBtn.onclick = () => {
            log.h('Kill Questku — stopping all processes');
            window.questkuKill();
            log.h('Questku ready — all clear');
        };
        if (D.refresh) D.refresh.onclick = refreshQuests;
        let progRefresh = document.getElementById('qk-prog-refresh');
        if (progRefresh) progRefresh.onclick = () => { renderProgress(); };
        if (D.ap) D.ap.onclick = hsApply;
        if (D.rm) D.rm.onclick = hsRemove;
        setupToolbar();
        updateSelBtn();



        function setupToolbar() {
            let closeAll = () => p.querySelectorAll('.qk-tl-pop.open').forEach(x => x.classList.remove('open'));
            p.addEventListener('click', (e) => { if (!e.target.closest('.qk-tl-dd')) closeAll(); });
            function isFilterDefault() {
                let keys = Object.keys(uiState.filter);
                return keys.length === 0;
            }

            document.getElementById('qk-sel-toggle').onclick = () => {
                let all = st.allQuests;
                let selectable = all.filter(x => {
                    let cfg = x.config.taskConfig ?? x.config.taskConfigV2;
                    return TASKS.find(y => cfg?.tasks?.[y] != null) && !x.userStatus?.completedAt;
                });
                let allSelected = selectable.length > 0 && selectable.every(x => x._sel);
                let targetState = !allSelected;
                selectable.forEach(q => q._sel = targetState);
                D.ql.querySelectorAll('.qk-cd').forEach(cd => {
                    let i = parseInt(cd.querySelector('.qk-vq')?.dataset?.i);
                    if (i >= 0 && all[i]) {
                        cd.classList.toggle('sel', all[i]._sel);
                        let sBtn = cd.querySelector('.qk-sel-btn');
                        if (sBtn) {
                            sBtn.textContent = all[i]._sel ? 'Deselect' : 'Select';
                            sBtn.classList.toggle('act', all[i]._sel);
                        }
                    }
                });
                document.querySelectorAll('.qk-el .qk-sel-btn').forEach(sBtn => {
                    let i = parseInt(sBtn.dataset.i);
                    if (all[i]) {
                        sBtn.textContent = all[i]._sel ? 'Deselect' : 'Select';
                        sBtn.classList.toggle('act', all[i]._sel);
                    }
                });
                updateSelBtn();
                updateAddqBtn();
            };

            document.getElementById('qk-sort-btn').onclick = (e) => { e.stopPropagation(); let o=document.getElementById('qk-sort-pop').classList.contains('open'); closeAll(); if(!o) document.getElementById('qk-sort-pop').classList.add('open'); };
            document.getElementById('qk-sort-pop').querySelectorAll('input[type=radio]').forEach(rb => {
                rb.onchange = () => {
                    if (!rb.checked) return;
                    let v = rb.dataset.sort;
                    uiState.sort = v;
                    document.getElementById('qk-sort-btn').textContent = sortLabel[v] + ' \u25BC';
                    closeAll();
                    renderAllQuests();
                };
            });

            document.getElementById('qk-filter-btn').onclick = (e) => { e.stopPropagation(); let o=document.getElementById('qk-filter-pop').classList.contains('open'); closeAll(); if(!o) document.getElementById('qk-filter-pop').classList.add('open'); };
            document.getElementById('qk-filter-pop').querySelectorAll('input[type=checkbox]').forEach(cb => {
                cb.onchange = () => {
                    if (cb.checked) uiState.filter[cb.dataset.filter] = true;
                    else delete uiState.filter[cb.dataset.filter];
                    let isDefault = isFilterDefault();
                    document.getElementById('qk-filter-clear').disabled = isDefault;
                    renderAllQuests();
                };
            });
            document.getElementById('qk-filter-clear').onclick = () => {
                uiState.filter = {};
                document.getElementById('qk-filter-pop').querySelectorAll('input[type=checkbox]').forEach(cb => { cb.checked = false; });
                document.getElementById('qk-filter-clear').disabled = true;
                closeAll();
                renderAllQuests();
            };

            function isProgFilterDefault() {
                return Object.keys(uiState.progFilter).length === 0;
            }

            document.getElementById('qk-prog-filter-btn').onclick = (e) => { e.stopPropagation(); let o=document.getElementById('qk-prog-filter-pop').classList.contains('open'); closeAll(); if(!o) document.getElementById('qk-prog-filter-pop').classList.add('open'); };
            document.getElementById('qk-prog-filter-pop').querySelectorAll('input[type=radio]').forEach(rb => {
                rb.onchange = () => {
                    if (!rb.checked) return;
                    uiState.progSort = rb.dataset.sort;
                    closeAll();
                    renderProgress();
                };
            });
            document.getElementById('qk-prog-filter-pop').querySelectorAll('input[type=checkbox]').forEach(cb => {
                cb.onchange = () => {
                    if (cb.checked) uiState.progFilter[cb.dataset.progfilter] = true;
                    else delete uiState.progFilter[cb.dataset.progfilter];
                    let isDefault = isProgFilterDefault();
                    document.getElementById('qk-prog-filter-clear').disabled = isDefault;
                    renderProgress();
                };
            });
            document.getElementById('qk-prog-filter-clear').onclick = () => {
                uiState.progSort = 'order';
                uiState.progFilter = {};
                document.getElementById('qk-prog-filter-pop').querySelectorAll('input[type=radio]').forEach(rb => { rb.checked = rb.dataset.sort === 'order'; });
                document.getElementById('qk-prog-filter-pop').querySelectorAll('input[type=checkbox]').forEach(cb => { cb.checked = false; });
                document.getElementById('qk-prog-filter-clear').disabled = true;
                closeAll();
                renderProgress();
            };
            let selToggle = document.getElementById('qk-prog-sel-toggle');
            if (selToggle) selToggle.onclick = () => {
                let qq = st.queue;
                let allSelected = qq.length > 0 && qq.every(x => x._sel);
                let targetState = !allSelected;
                qq.forEach(item => item._sel = targetState);
                D.pl.querySelectorAll('.qk-cd').forEach(cd => {
                    let i = parseInt(cd.querySelector('.qk-vq')?.dataset?.i);
                    if (i >= 0 && qq[i]) {
                        cd.classList.toggle('sel', qq[i]._sel);
                        let sBtn = cd.querySelector('.qk-sel-btn');
                        if (sBtn) {
                            sBtn.textContent = qq[i]._sel ? 'Deselect' : 'Select';
                            sBtn.classList.toggle('act', qq[i]._sel);
                        }
                    }
                });
                updateProgSelBtn();
                updateStats();
            };
        }

        function switchTab(name) {
            let targetTab;
            D.tabs.forEach(t => {
                const isActive = t.dataset.t === name;
                t.classList.toggle('act', isActive);
                if (isActive) { targetTab = t; activeTab = t; }
                D.ba.classList.toggle('act', name === 'quests');
                D.bp.classList.toggle('act', name === 'prog');
                D.bh.classList.toggle('act', name === 'hs');
            });
            if (targetTab) {
                updateNavInd(targetTab);
                if (scrollEl) {
                    targetTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    setTimeout(() => updateNavInd(targetTab), 300);
                }
            }
        }
    window.QuestkuDebug = { st, D, processQueue, processQuest, enrollQuest };
}

    function buildAssetUrl(questId, path) {
        if (!path || typeof path !== 'string') return null;
        if (path.startsWith('http')) return path;
        if (path.startsWith('quests/') || path.startsWith('assets/')) return 'https://cdn.discordapp.com/' + path;
        return 'https://cdn.discordapp.com/quests/' + questId + '/' + path;
    }

    function getQuestDesc(q) {
        let cfg = q.config.taskConfig ?? q.config.taskConfigV2;
        let t = TASKS.find(x => cfg?.tasks?.[x] != null);
        if (!t) return 'Complete the quest to earn rewards.';
        let game = q.config.application?.name || 'the game';
        let need = t && cfg?.tasks?.[t]?.target ? cfg.tasks[t].target : 0;
        let dur = '';
        if (t === 'WATCH_VIDEO' || t === 'WATCH_VIDEO_ON_MOBILE') {
            let s = Math.floor(need);
            dur = s >= 60 ? Math.floor(s / 60) + ' minute' + (Math.floor(s / 60) > 1 ? 's' : '') : s + ' second' + (s > 1 ? 's' : '');
            return need <= 1 ? 'Watch the official video.' : 'Watch the official video for ' + dur + '.';
        }
        if (t === 'PLAY_ON_DESKTOP' || t === 'PLAY_ON_XBOX' || t === 'PLAY_ON_PLAYSTATION') {
            let m = Math.ceil(need / 60);
            dur = m + ' minute' + (m > 1 ? 's' : '');
            return 'Play <span style="color:#545ded">' + game + '</span> for ' + dur + '.';
        }
        if (t === 'STREAM_ON_DESKTOP') {
            let m = Math.ceil(need / 60);
            dur = m + ' minute' + (m > 1 ? 's' : '');
            return 'Stream <span style="color:#545ded">' + game + '</span> for ' + dur + '.';
        }
        if (t === 'PLAY_ACTIVITY') {
            return 'Complete the activity to earn rewards.';
        }
        return 'Complete the quest to earn rewards.';
    }

    function getGameLogo(q) {
        try {
            let assets = q.config.assets;
            if (assets) {
                let id = q.id;
                for (let k of ['logotypeDark', 'logotype', 'logotypeLight', 'gameTile', 'quest_bar_logo', 'game_logo', 'quest_logo', 'logo']) {
                    let v = assets[k];
                    if (typeof v === 'string' && v.match(/\.(png|webp)$/i)) {
                        let url = buildAssetUrl(id, v);
                        if (url) return { url };
                    }
                }
            }
            let app = q.config.application;
            if (app) {
                if (app.icon) return { url: 'https://cdn.discordapp.com/app-icons/' + app.id + '/' + app.icon + '.png' };
                if (appCache[app.id]) return { url: 'https://cdn.discordapp.com/app-icons/' + app.id + '/' + appCache[app.id] + '.png' };
            }
        } catch {}
        return null;
    }

    async function fetchAppIcon(appId) {
        if (!appId || appCache[appId] || appFetching[appId]) return;
        appFetching[appId] = true;
        try {
            let res = await apiReq('GET', '/applications/public?application_ids=' + appId);
            let icon = res?.body?.[0]?.icon;
            if (icon) appCache[appId] = icon;
        } catch {}
        delete appFetching[appId];
    }

    let appFetchTimer = null;
    function fetchAllAppIcons() {
        if (appFetchTimer) return;
        let ids = [...new Set(st.allQuests.map(q => q.config.application?.id).filter(id => id && !appCache[id] && !appFetching[id]))];
        if (ids.length === 0) return;
        ids.forEach(id => { appFetching[id] = true; });
        let done = 0;
        ids.forEach(id => {
            apiReq('GET', '/applications/public?application_ids=' + id).then(res => {
                let icon = res?.body?.[0]?.icon;
                if (icon) appCache[id] = icon;
            }).catch(() => {}).finally(() => {
                delete appFetching[id];
                done++;
                if (done === ids.length) { renderAllQuests(); if (D?.pl?.children?.length) renderProgress(); }
            });
        });
    }

    function getRewardTypes(q) {
        let types = [];
        let rewards = q.config.rewardsConfig?.rewards || [];
        for (let r of rewards) {
            let t = r.type;
            if (t === 4 || r.orbQuantity || r.amount) { if (!types.includes('orb')) types.push('orb'); }
            if (t === 3 || r.avatarDecoration || r.avatarDecorationDecoration) { if (!types.includes('avatardeco')) types.push('avatardeco'); }
            if (r.profileEffect || r.profileEffectId) { if (!types.includes('profileeffect')) types.push('profileeffect'); }
            let known = t === 3 || t === 4 || r.orbQuantity || r.amount || r.avatarDecoration || r.avatarDecorationDecoration || r.profileEffect || r.profileEffectId;
            if (!known) { if (!types.includes('ingame')) types.push('ingame'); }
        }
        return types;
    }

    function getRewardHtml(q) {
        let rewards = q.config.rewardsConfig?.rewards || [];
        let parts = [];
        for (let r of rewards) {
            let found = false;
            if (r.type === 4 || r.orbQuantity || r.amount || r.premiumOrbQuantity) {
                let val = (userPremiumType >= 2 && r.premiumOrbQuantity) ? r.premiumOrbQuantity : (r.orbQuantity || r.amount || 0);
                let h = r.messages?.name || val + ' Orbs';
                if (userPremiumType >= 2 && r.premiumOrbQuantity) h += ' <img class="qk-nitro-badge" src="' + NITRO_BADGE + '">';
                parts.push('<span class="qk-rw-item">' + h + '</span>'); found = true;
            }
            if (r.type === 3 || r.avatarDecoration || r.avatarDecorationDecoration) {
                let name = r.messages?.name || 'Avatar Decoration';
                parts.push('<span class="qk-rw-item"><span class="qk-rw-label">' + name + '</span></span>'); found = true;
            }
            if (r.profileEffect || r.profileEffectId) {
                let eff = r.profileEffect || r.profileEffectId;
                let name = r.messages?.name || (typeof eff === 'object' ? (eff.name || 'Profile Effect') : 'Profile Effect');
                parts.push('<span class="qk-rw-item"><span class="qk-rw-label">' + name + '</span></span>'); found = true;
            }
            if (!found) parts.push('<span class="qk-rw-item">' + (r.messages?.name || 'In-Game Reward') + '</span>');
        }
        return parts.join('<span class="qk-rw-plus"> + </span>');
    }

    function renderAllQuests() {
        if (!D) return;
        let list = D.ql;
        let all = st.allQuests;
        if (all.length === 0) {
            list.innerHTML = '<div class="qk-empty-state"><div class="qk-empty-title">No quests available</div><div class="qk-empty-desc">There are currently no quests available. Refresh the quest list or check again later.</div></div>';
            return;
        }
        let flt = uiState.filter;
        let statusActive = Object.keys(flt).some(k => k==='avail'||k==='prog'||k==='done'||k==='expired');
        let typeActive = Object.keys(flt).some(k => k==='play'||k==='watch'||k==='stream'||k==='activity');
        let rewardActive = Object.keys(flt).some(k => k==='orb'||k==='avatardeco'||k==='profileeffect'||k==='ingame');
        let filtered = all.filter(q => {
            let cfg = q.config.taskConfig ?? q.config.taskConfigV2;
            let t = TASKS.find(x => cfg?.tasks?.[x] != null);
            let c = !!q.userStatus?.completedAt, e = !!q.userStatus?.enrolledAt, x = new Date(q.config.expiresAt).getTime() < Date.now();
            if (statusActive) {
                let m = (flt.avail && !e && !c && !x) || (flt.prog && e && !c) || (flt.done && c) || (flt.expired && x);
                if (!m) return false;
            }
            if (typeActive) {
                let m = (flt.play && (t==='PLAY_ON_DESKTOP'||t==='PLAY_ON_XBOX'||t==='PLAY_ON_PLAYSTATION')) || (flt.watch && (t==='WATCH_VIDEO'||t==='WATCH_VIDEO_ON_MOBILE')) || (flt.stream && t==='STREAM_ON_DESKTOP') || (flt.activity && t==='PLAY_ACTIVITY');
                if (!m) return false;
            }
            if (rewardActive) {
                let rtypes = getRewardTypes(q);
                let m = (flt.orb && rtypes.includes('orb')) || (flt.avatardeco && rtypes.includes('avatardeco')) || (flt.profileeffect && rtypes.includes('profileeffect')) || (flt.ingame && rtypes.includes('ingame'));
                if (!m) return false;
            }
            return true;
        });
        if (uiState.sort === 'name') filtered.sort((a,b) => a.config.messages.questName.localeCompare(b.config.messages.questName));
        else if (uiState.sort === 'reward') { filtered.sort((a,b) => getOrbValue(b.config.rewardsConfig?.rewards)-getOrbValue(a.config.rewardsConfig?.rewards)); }
        else if (uiState.sort === 'expires') filtered.sort((a,b) => new Date(a.config.expiresAt)-new Date(b.config.expiresAt));
        else if (uiState.sort === 'progress') filtered.sort((a,b) => { let p = q => { let cfg=q.config.taskConfig??q.config.taskConfigV2;let t=TASKS.find(x=>cfg?.tasks?.[x]!=null);let tg=t&&cfg?.tasks?.[t]?.target||1;return (q.userStatus?.progress?.[t]?.value||0)/tg; }; return p(b)-p(a); });
        else if (uiState.sort === 'recent') filtered.sort((a,b) => new Date(b.config.expiresAt)-new Date(a.config.expiresAt));
        else if (uiState.sort === 'started') filtered.sort((a,b) => { let ea=a.userStatus?.enrolledAt||0,eb=b.userStatus?.enrolledAt||0; return new Date(eb)-new Date(ea); });
        if (uiState.sort === 'suggested') filtered.sort((a,b) => { let p=q=>{let cfg=q.config.taskConfig??q.config.taskConfigV2;let tt=TASKS.find(y=>cfg?.tasks?.[y]!=null);let c=!!q.userStatus?.completedAt,e=!!q.userStatus?.enrolledAt,x=new Date(q.config.expiresAt).getTime()<Date.now();if(x)return 4;if(c)return 3;if(!tt)return 2;if(e)return 1;return 0;};let d=p(a)-p(b);if(d)return d;return new Date(b.config.expiresAt)-new Date(a.config.expiresAt);});
        let html = '';
        for (let q of filtered) {
            let enrolled = !!q.userStatus?.enrolledAt;
            let completed = !!q.userStatus?.completedAt;
            let exp = new Date(q.config.expiresAt).getTime() < Date.now();
            let cfg = q.config.taskConfig ?? q.config.taskConfigV2;
            let t = TASKS.find(x => cfg?.tasks?.[x] != null);
            let unsupported = !t;
            let stLabel = unsupported ? 'Unsupported' : completed ? 'Done' : exp ? 'Expired' : enrolled ? 'Enrolled' : 'Not Enrolled';
            let stCls = unsupported ? '' : completed ? 'dn' : exp ? 'fl' : enrolled ? 'en' : 'pn';
            let cb = unsupported || completed ? 'disabled' : (q._sel ? 'checked' : '');
            let taskName = TASK_NAMES[t] || t || 'Quest';
            let need = t && cfg?.tasks?.[t]?.target ? cfg.tasks[t].target : 0;
            let unit = (t === 'WATCH_VIDEO' || t === 'WATCH_VIDEO_ON_MOBILE') ? 's' : 'min';
            let durStr = need ? need + unit : '';
            let icoCls = '';
            let firstReward = q.config.rewardsConfig?.rewards?.[0];
            let rewIconUrl = firstReward?.type === 3 && firstReward.asset ? 'https://cdn.discordapp.com/' + firstReward.asset + '?format=webp&width=64&height=64' : null;
            let appIcon = q.config.application?.id && appCache[q.config.application.id];
            let icoHtml = rewIconUrl ? '<img src="' + rewIconUrl + '" style="width:34px;height:34px;border-radius:8px;display:block">'
                : firstReward?.type === 4
                ? '<img src="https://cdn.discordapp.com/assets/content/fb761d9c206f93cd8c4e7301798abe3f623039a4054f2e7accd019e1bb059fc8.webm?format=webp" style="width:34px;height:34px;border-radius:8px;display:block">'
                : appIcon ? '<img src="https://cdn.discordapp.com/app-icons/' + q.config.application.id + '/' + appIcon + '.png?size=64" style="width:34px;height:34px;border-radius:8px;display:block">'
                : '<img src="https://cdn.discordapp.com/assets/content/fb761d9c206f93cd8c4e7301798abe3f623039a4054f2e7accd019e1bb059fc8.webm?format=webp" style="width:34px;height:34px;border-radius:8px;display:block">';
            let banUrl = q.config.assets?.quest_bar_hero || q.config.assets?.hero;
            let banFull = banUrl ? (banUrl.startsWith('http') ? banUrl : 'https://cdn.discordapp.com/' + banUrl + (banUrl.includes('?') ? '' : '?format=webp&width=1320&height=370')) : '';
            let banVidUrl = q.config.assets?.heroVideo || q.config.assets?.questBarHeroVideo;
            let banVid = banVidUrl ? (banVidUrl.startsWith('http') ? banVidUrl : 'https://cdn.discordapp.com/' + banVidUrl) : null;
            let selCls = q._sel ? ' sel' : '';
            let selText = unsupported ? 'Unsupported' : completed ? 'Done' : q._sel ? 'Deselect' : 'Select';
            let selClsBtn = q._sel ? 'qk-sel-btn qk-bb act' : 'qk-sel-btn qk-bb';
            let selDisabled = unsupported || completed ? ' disabled' : '';
            let logoData = getGameLogo(q);
            let logoUrl = logoData ? logoData.url : null;
            if (!logoData && q.config.application?.id && !appCache[q.config.application.id] && !appFetching[q.config.application.id]) {
                appFetching[q.config.application.id] = true;
                apiReq('GET', '/applications/public?application_ids=' + q.config.application.id).then(res => {
                    let icon = res?.body?.[0]?.icon;
                    if (icon) { appCache[q.config.application.id] = icon; appFetching[q.config.application.id] = false; }
                }).catch(() => { delete appFetching[q.config.application.id]; });
            }
            html += '<div class="qk-cd' + selCls + '">' +
                '<div class="qk-ban-wrap">' +
                (banFull ? '<img class="qk-ban" src="' + banFull + '" loading="lazy" onerror="this.style.display=\'none\'">' : '<div class="qk-ban qk-ban-g"></div>') +
                (banVid ? '<video class="qk-ban-vid" muted loop playsinline src="' + banVid + '"></video>' : '') +
                '<div class="qk-ban-overlay"></div>' +
                (logoUrl ? '<div class="qk-game-logo-wrap"><img class="qk-game-logo" src="' + logoUrl + '" loading="lazy" onerror="this.style.display=\'none\'"><span class="qk-promoted">Promoted by <strong>' + (q.config.messages?.gameTitle || q.config.application?.name || 'Quest') + '</strong></span></div>' : '') +
                '</div>' +
                '<div class="qk-bd"><div class="qk-top">' +
                '<div class="qk-ico ' + icoCls + '">' + icoHtml + '</div>' +
                '<div class="qk-if"><div class="qk-nm">' + q.config.messages.questName + '</div><div class="qk-rw">' + getRewardHtml(q) + '</div><div class="qk-sb">' + getQuestDesc(q) + '</div></div>' +
                '<span class="qk-tg ' + stCls + '">' + stLabel + '</span></div>' +
                '<div class="qk-cd-d"><div class="qk-el">' +
                '<button class="' + selClsBtn + '"' + selDisabled + ' data-i="' + q._i + '">' + selText + '</button>' +
                '<button class="qk-bb qk-vq" data-i="' + q._i + '">View Quest</button>' +
                '</div></div></div></div>';
        }
        if (filtered.length === 0) {
            list.innerHTML = '<div class="qk-empty-state"><div class="qk-empty-title">No quests match your filters</div><div class="qk-empty-desc">Try adjusting your filter to see available quests.</div></div>';
            return;
        }
        list.innerHTML = html;
        list.querySelectorAll('.qk-top').forEach(h => {
            h.onclick = () => {
                let dt = h.parentElement.querySelector('.qk-cd-d');
                if (dt) dt.classList.toggle('op');
            };
        });
        list.querySelectorAll('.qk-el .qk-sel-btn').forEach(btn => {
            btn.onclick = () => {
                if (btn.disabled) return;
                let i = parseInt(btn.dataset.i);
                let q = st.allQuests[i];
                if (!q) return;
                q._sel = !q._sel;
                btn.textContent = q._sel ? 'Deselect' : 'Select';
                btn.classList.toggle('act', q._sel);
                let cd = btn.closest('.qk-cd');
                if (cd) cd.classList.toggle('sel', q._sel);
                updateSelBtn();
                updateAddqBtn();
            };
        });
        list.querySelectorAll('.qk-vq').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                let i = parseInt(btn.dataset.i);
                let q = st.allQuests[i];
                if (q) location.href = '/quests/' + q.id;
            };
        });

        list.querySelectorAll('.qk-cd').forEach(card => {
            let wrap = card.querySelector('.qk-ban-wrap');
            let vid = wrap?.querySelector('.qk-ban-vid');
            if (!vid) return;
            let img = wrap.querySelector('.qk-ban');
            card.addEventListener('mouseenter', () => {
                if (card._pt) clearTimeout(card._pt);
                card._pt = null;
                vid.currentTime = 0;
                vid.play().catch(() => {});
                vid.style.opacity = '1';
                if (img) img.style.opacity = '0';
            });
            card.addEventListener('mouseleave', () => {
                if (card._pt) clearTimeout(card._pt);
                card._pt = setTimeout(() => { vid.pause(); card._pt = null; }, 300);
                vid.style.opacity = '0';
                if (img) img.style.opacity = '1';
            });
        });

        updateAddqBtn();
        updateSelBtn();
        let sb = document.getElementById('qk-sort-btn');
        if (sb) sb.textContent = sortLabel[uiState.sort] + ' \u25BC';
        document.getElementById('qk-sort-pop').querySelectorAll('input[type=radio]').forEach(rb => { rb.checked = rb.dataset.sort === uiState.sort; });
    }

    function updateAddqBtn() {
        if (!D || !D.addq) return;
        let unenrolled = st.allQuests.filter(x => x._sel && !x.userStatus?.completedAt && !x.userStatus?.enrolledAt);
        let enrolled = st.allQuests.filter(x => x._sel && !x.userStatus?.completedAt && x.userStatus?.enrolledAt);
        let hasUnenrolled = unenrolled.length > 0;
        let hasEnrolled = enrolled.length > 0;
        let has = hasUnenrolled || hasEnrolled;
        D.addq.disabled = !has;
        D.addq.classList.toggle('enabled', has);
        if (hasUnenrolled) {
            D.addq.textContent = unenrolled.length === 1 ? 'Enroll' : 'Enroll (' + unenrolled.length + ')';
        } else if (hasEnrolled) {
            D.addq.textContent = enrolled.length === 1 ? 'Start Queue' : 'Start Queue (' + enrolled.length + ')';
        } else {
            D.addq.textContent = 'Start Queue';
        }
    }

    function updateSelBtn() {
        if (!D) return;
        let btn = document.getElementById('qk-sel-toggle');
        if (!btn) return;
        let all = st.allQuests;
        let selectable = all.filter(x => {
            let cfg = x.config.taskConfig ?? x.config.taskConfigV2;
            return TASKS.find(y => cfg?.tasks?.[y] != null) && !x.userStatus?.completedAt;
        });
        let hasSelectable = selectable.length > 0;
        let allSelected = hasSelectable && selectable.every(x => x._sel);
        btn.disabled = !hasSelectable;
        btn.textContent = allSelected ? 'Deselect All' : 'Select All';
    }

    function updateProgSelBtn() {
        if (!D) return;
        let btn = document.getElementById('qk-prog-sel-toggle');
        if (!btn) return;
        let qq = st.queue;
        let selectableItems = qq.filter(x => x.status === 'pending' || x.status === 'running' || x.status === 'paused');
        let selectable = selectableItems.length > 0;
        let allSelected = selectable && selectableItems.every(x => x._sel);
        btn.disabled = !selectable;
        btn.textContent = allSelected ? 'Deselect All' : 'Select All';
    }

    function renderProgress() {
        if (!D) return;
        let list = D.pl;
        let qq = st.queue;
        if (qq.length === 0) {
            list.innerHTML = '<div class="qk-empty-state"><div class="qk-empty-title">No quests in progress</div><div class="qk-empty-desc">Go to All Quests and enroll a quest to begin.</div></div>';
            updateStats();
            return;
        }
        let flt = uiState.progFilter;
        let progStatusActive = Object.keys(flt).some(k => k==='running'||k==='pending'||k==='done'||k==='failed'||k==='paused'||k==='stopped');
        let filtered = qq.filter(item => {
            let s = item.status === 'paused' || (item._paused && st.running && item.status === 'running') ? 'paused' : item.status;
            if (progStatusActive) return flt[s];
            return true;
        });
        if (uiState.progSort === 'name') filtered.sort((a,b) => a.q.config.messages.questName.localeCompare(b.q.config.messages.questName));
        else if (uiState.progSort === 'newest') filtered.sort((a,b) => st.queue.indexOf(b) - st.queue.indexOf(a));
        else if (uiState.progSort === 'oldest') filtered.sort((a,b) => st.queue.indexOf(a) - st.queue.indexOf(b));
        let html = '';
        for (let i = 0; i < filtered.length; i++) {
            let item = filtered[i];
            let q = item.q;
            let idx = qq.indexOf(item);
            let stLabel = item.status === 'done' ? 'Done' : item.status === 'failed' ? 'Failed' : item.status === 'stopped' ? 'Stopped' : (item._paused || item.status === 'paused') && st.running ? 'Paused' : item.status === 'running' ? 'Running' : 'Pending';
            let stCls = item.status === 'done' ? 'dn' : item.status === 'failed' ? 'fl' : item.status === 'stopped' ? 'fl' : (item._paused || item.status === 'paused') && st.running ? 'pn' : item.status === 'running' ? 'rd' : '';
            let p = item.pct || 0;
            let pCls = item.status === 'done' ? 'dn' : item.status === 'failed' || item.status === 'stopped' ? 'fl' : '';
            let cfg = q.config.taskConfig ?? q.config.taskConfigV2;
            let t = TASKS.find(x => cfg?.tasks?.[x] != null);
            let taskName = TASK_NAMES[t] || t || 'Quest';
            let need = t && cfg?.tasks?.[t]?.target ? cfg.tasks[t].target : 0;
            let unit = (t === 'WATCH_VIDEO' || t === 'WATCH_VIDEO_ON_MOBILE') ? 's' : 'min';
            let gameName = (q.config.messages.questName || 'Quest').toUpperCase();
            let selCls = item._sel ? ' sel' : '';
            let selText = item._sel ? 'Deselect' : 'Select';
            let selBtnCls = item._sel ? 'qk-sel-btn qk-bb act' : 'qk-sel-btn qk-bb';
            let icoCls = '';
            let firstReward = q.config.rewardsConfig?.rewards?.[0];
            let rewIconUrl = firstReward?.type === 3 && firstReward.asset ? 'https://cdn.discordapp.com/' + firstReward.asset + '?format=webp&width=64&height=64' : null;
            let appIcon = q.config.application?.id && appCache[q.config.application.id];
            let icoHtml = rewIconUrl ? '<img src="' + rewIconUrl + '" style="width:34px;height:34px;border-radius:8px;display:block">'
                : firstReward?.type === 4
                ? '<img src="https://cdn.discordapp.com/assets/content/fb761d9c206f93cd8c4e7301798abe3f623039a4054f2e7accd019e1bb059fc8.webm?format=webp" style="width:34px;height:34px;border-radius:8px;display:block">'
                : appIcon ? '<img src="https://cdn.discordapp.com/app-icons/' + q.config.application.id + '/' + appIcon + '.png?size=64" style="width:34px;height:34px;border-radius:8px;display:block">'
                : '<img src="https://cdn.discordapp.com/assets/content/fb761d9c206f93cd8c4e7301798abe3f623039a4054f2e7accd019e1bb059fc8.webm?format=webp" style="width:34px;height:34px;border-radius:8px;display:block">';
            let banUrl = q.config.assets?.quest_bar_hero || q.config.assets?.hero;
            let banFull = banUrl ? (banUrl.startsWith('http') ? banUrl : 'https://cdn.discordapp.com/' + banUrl + (banUrl.includes('?') ? '' : '?format=webp&width=1320&height=370')) : '';
            let banVidUrl = q.config.assets?.heroVideo || q.config.assets?.questBarHeroVideo;
            let banVid = banVidUrl ? (banVidUrl.startsWith('http') ? banVidUrl : 'https://cdn.discordapp.com/' + banVidUrl) : null;
            let logoData = getGameLogo(q);
            let logoUrl = logoData ? logoData.url : null;
            let isTerminal = item.status === 'done' || item.status === 'failed' || item.status === 'stopped';
            let selDisabled = isTerminal ? ' disabled' : '';
            let selBtnClsFinal = isTerminal ? 'qk-sel-btn qk-bb' : selBtnCls;
            let selTextFinal = isTerminal ? (item.status === 'done' ? 'Done' : item.status === 'failed' ? 'Failed' : 'Stopped') : selText;
            html += '<div class="qk-cd' + selCls + '" data-qidx="' + idx + '" data-i="' + idx + '" data-curr="' + (item.curr || 0) + '" data-need="' + need + '" data-unit="' + unit + '" data-status="' + item.status + '">' +
                '<div class="qk-ban-wrap">' +
                (banFull ? '<img class="qk-ban" src="' + banFull + '" loading="lazy" onerror="this.style.display=\'none\'">' : '<div class="qk-ban qk-ban-g"></div>') +
                (banVid ? '<video class="qk-ban-vid" muted loop playsinline src="' + banVid + '"></video>' : '') +
                '<div class="qk-ban-overlay"></div>' +
                (logoUrl ? '<div class="qk-game-logo-wrap"><img class="qk-game-logo" src="' + logoUrl + '" loading="lazy" onerror="this.style.display=\'none\'"><span class="qk-promoted">Promoted by <strong>' + (q.config.messages?.gameTitle || q.config.application?.name || 'Quest') + '</strong></span></div>' : '') +
                '</div>' +
                '<div class="qk-bd"><div class="qk-top">' +
                '<div class="qk-ico ' + icoCls + '">' + icoHtml + '</div>' +
                '<div class="qk-if"><div class="qk-nm">' + gameName + '</div><div class="qk-rw">' + getRewardHtml(q) + '</div><div class="qk-sb">' + getQuestDesc(q) + '</div>' +
                '<div class="qk-hp"><div class="qk-hp-txt"></div><div class="qk-hp-bar"><div class="qk-hp-fill ' + pCls + '"></div></div></div>' +
                '</div>' +
                '<span class="qk-tg ' + stCls + '">' + stLabel + '</span></div>' +
                '<div class="qk-cd-d"><div class="qk-el"><button class="' + selBtnClsFinal + '" data-i="' + idx + '"' + selDisabled + '>' + selTextFinal + '</button><button class="qk-bb qk-vq" data-i="' + idx + '">View Quest</button></div></div>' +
                '</div></div>';
        }
        list.innerHTML = html;
        list.querySelectorAll('.qk-cd[data-qidx]').forEach(cd => {
            cd.addEventListener('mouseenter', () => {
                let curr = parseInt(cd.dataset.curr) || 0;
                let need = parseInt(cd.dataset.need) || 0;
                let unit = cd.dataset.unit || 'min';
                let status = cd.dataset.status || 'pending';
                let txt = cd.querySelector('.qk-hp-txt');
                let fill = cd.querySelector('.qk-hp-fill');
                if (txt) {
                    if (status === 'done') txt.textContent = need + ' / ' + need + ' ' + unit;
                    else if (status === 'failed') txt.textContent = 'Failed';
                    else if (status === 'stopped') txt.textContent = 'Stopped';
                    else if (status === 'paused') txt.textContent = curr + ' / ' + need + ' ' + unit + ' (Paused)';
                    else txt.textContent = curr + ' / ' + need + ' ' + unit;
                }
                if (fill) {
                    let pct = need > 0 ? Math.min(100, Math.round(curr / need * 100)) : 0;
                    fill.style.width = pct + '%';
                }
            });
            cd.addEventListener('mouseleave', () => {
                let txt = cd.querySelector('.qk-hp-txt');
                let fill = cd.querySelector('.qk-hp-fill');
                if (txt) txt.textContent = '';
                if (fill) fill.style.width = '0%';
            });
        });
        updateStats();
        updateProgSelBtn();
        list.querySelectorAll('.qk-cd').forEach(card => {
            let wrap = card.querySelector('.qk-ban-wrap');
            let vid = wrap?.querySelector('.qk-ban-vid');
            if (!vid) return;
            let img = wrap.querySelector('.qk-ban');
            card.addEventListener('mouseenter', () => {
                if (card._pt) clearTimeout(card._pt);
                card._pt = null;
                vid.currentTime = 0;
                vid.play().catch(() => {});
                vid.style.opacity = '1';
                if (img) img.style.opacity = '0';
            });
            card.addEventListener('mouseleave', () => {
                if (card._pt) clearTimeout(card._pt);
                card._pt = setTimeout(() => { vid.pause(); card._pt = null; }, 300);
                vid.style.opacity = '0';
                if (img) img.style.opacity = '1';
            });
        });
        list.querySelectorAll('.qk-top').forEach(h => {
            h.onclick = () => {
                let dt = h.parentElement.querySelector('.qk-cd-d');
                if (dt) dt.classList.toggle('op');
            };
        });
        list.querySelectorAll('.qk-el .qk-sel-btn').forEach(btn => {
            btn.onclick = () => {
                if (btn.disabled) return;
                let i = parseInt(btn.dataset.i);
                let item = st.queue[i];
                if (!item) return;
                item._sel = !item._sel;
                btn.textContent = item._sel ? 'Deselect' : 'Select';
                btn.classList.toggle('act', item._sel);
                let cd = btn.closest('.qk-cd');
                if (cd) cd.classList.toggle('sel', item._sel);
                updateProgSelBtn();
                updateStats();
            };
        });
        list.querySelectorAll('.qk-vq').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                let i = parseInt(btn.dataset.i);
                let item = st.queue[i];
                        if (item) {
                            location.href = '/quests/' + item.q.id;
                        }
            };
        });
    }

    function renderHypeSquad() {
        if (!D || !D.bh) return;
        let c = document.getElementById('hs-cards');
        if (!c) return;
        if (!hsState.profile) { hsFetch(); return; }
        if (!hsState.selected && hsState.current) hsState.selected = hsState.current;
        c.innerHTML = '';
        HOUSES.forEach(h => {
            let s = hsState.selected === h.id, cur = hsState.current === h.id;
            let card = document.createElement('div');
            card.className = 'hs-d' + (s ? ' s' : '') + (cur ? ' c' : '');
            card.innerHTML = '<div class="hs-b"><img src="' + BADGES[h.id] + '" alt="" style="width:40px;height:40px;display:block;border-radius:6px"></div><div class="hs-n" style="color:' + h.color + '">' + h.name + '</div>';
            card.onclick = () => { hsState.selected = s ? null : h.id; renderHypeSquad(); hsUI(); };
            c.appendChild(card);
        });
        hsUI();
    }

    function updateStats() {
        if (!D) return;
        let hasRunning = st.queue.some(x => x.status === 'running' || x.status === 'paused');
        let hasSelected = st.queue.some(x => x._sel && (x.status === 'running' || x.status === 'paused' || x.status === 'pending'));
        let qc = st.queue.filter(x => x.status === 'pending' || x.status === 'running').length;
        let ac = document.getElementById('qk-prog-active');
        if (ac) ac.textContent = qc > 0 ? qc + ' Active' : 'No Active';
        D.dc.textContent = st.completed;
        D.fc.textContent = st.failed;
        if (D.pause) {
            D.pause.disabled = !hasRunning || !hasSelected;
            let runningItem = st.queue.find(x => x.status === 'running');
            D.pause.textContent = runningItem?._paused ? 'Resume' : 'Pause';
        }
        if (D.stopq) D.stopq.disabled = !hasRunning || !hasSelected;
    }

    function updateQItem(i, p, status) {
        if (!st.queue[i]) return;
        st.queue[i].pct = p;
        if (status) st.queue[i].status = status;
    }

async function processQueue() {
        log.d('processQueue', 'start, queue length: ' + st.queue.length);
        if (st.running) return;
        st.running = true;
        renderProgress();

        for (let i = 0; i < st.queue.length; i++) {
            if (!st.running) break;
            let item = st.queue[i];

            if (item.status === 'done' || item.status === 'failed' || item.status === 'stopped') {
                continue;
            }

            if (item._paused || item.status === 'paused') {
                item.status = 'paused';
                renderProgress();
                while (item._paused && st.running) {
                    await sleep(500);
                }
                if (!st.running) break;
                item.status = 'running';
            }

            item.status = 'running';
            renderProgress();

            log.d('processQueue', 'item ' + i + ': ' + item.q.config.messages.questName);

            if (set.autoEnroll && !item.q.userStatus?.enrolledAt) {
                log.i('Enrolling: ' + item.q.config.messages.questName);
                let ok = await enrollQuest(item.q);
                if (!ok) { log.e('Enroll failed: ' + item.q.config.messages.questName); item.status = 'failed'; st.failed++; renderProgress(); continue; }
            }

            try {
                await processQuest(item);
            }
            catch (e) { log.e('Quest error: ' + (e.message || e)); if (st.running) item.status = 'failed'; }

            if (item.status === 'done') { st.completed++; }
            else if (item.status === 'failed') st.failed++;
            else if (item.status === 'stopped') st.stopped++;
            renderProgress();
        }

        st.running = false;
        D.addq.disabled = false;
        renderProgress();
        if (st.completed > 0) log.ok('Done. ' + st.completed + ' completed, ' + st.failed + ' failed, ' + st.stopped + ' stopped.');
        log.d('processQueue', 'done');
    }

    async function setFakeGame(q, pid, appId, exe) {
        let fake = {
            cmdLine: 'C:\\Program Files\\' + q.config.application.name + '\\' + exe, exeName: exe,
            exePath: 'c:/program files/' + q.config.application.name.toLowerCase() + '/' + exe,
            hidden: false, isLauncher: false, id: appId, name: q.config.application.name,
            pid: pid, pidPath: [pid], processName: q.config.application.name, start: Date.now()
        };
        let realGames = Q.Game.getRunningGames();
        let realGet = Q.Game.getRunningGames;
        let realPidGet = Q.Game.getGameForPID;
        Q.Game.getRunningGames = () => [fake, ...realGames];
        Q.Game.getGameForPID = p => p === pid ? fake : (realPidGet?.(p) || realGames.find(x => x.pid === p));
        Q.Flux.dispatch({ type: 'RUNNING_GAMES_CHANGE', removed: [], added: [fake], games: [fake, ...realGames] });
        return { fake, realGames, realGet, realPidGet };
    }

    function updateProgTick(item) {
        let idx = st.queue.indexOf(item);
        let cd = D.pl.querySelector('[data-qidx="' + idx + '"]');
        if (!cd) return;
        cd.dataset.curr = item.curr || 0;
        cd.dataset.status = item.status;
        let stLabel = item.status === 'done' ? 'Done' : item.status === 'failed' ? 'Failed' : item.status === 'stopped' ? 'Stopped' : (item._paused || item.status === 'paused') && st.running ? 'Paused' : item.status === 'running' ? 'Running' : 'Pending';
        let stCls = item.status === 'done' ? 'dn' : item.status === 'failed' ? 'fl' : item.status === 'stopped' ? 'fl' : (item._paused || item.status === 'paused') && st.running ? 'pn' : item.status === 'running' ? 'rd' : '';
        let tg = cd.querySelector('.qk-tg');
        if (tg) { tg.textContent = stLabel; tg.className = 'qk-tg' + (stCls ? ' ' + stCls : ''); }
        let ico = cd.querySelector('.qk-ico');
        if (ico) { ico.className = 'qk-ico' + (item.status === 'done' ? ' done' : item.status === 'failed' || item.status === 'stopped' ? ' fail' : ''); }
    }

    async function processQuest(item) {
        const q = item.q;
        const pid = Math.floor(Math.random() * 30000) + 1000;
        const appId = q.config.application.id;
        const appName = q.config.application.name;
        const qName = q.config.messages.questName;
        const cfg = q.config.taskConfig ?? q.config.taskConfigV2;
        const t = TASKS.find(x => cfg.tasks[x] != null);
        const need = cfg.tasks[t].target;
        let done = q.userStatus?.progress?.[t]?.value ?? 0;
        const tName = TASK_NAMES[t] || t;
        const unit = (t === 'WATCH_VIDEO' || t === 'WATCH_VIDEO_ON_MOBILE') ? 's' : 'min';

        log.start();
        log.gr(tName + ' — ' + qName + ' — app: ' + appName);
        log.i(tName + ' (' + need + ' ' + unit + ')');

        function finish(ok) {
            if (ok) { log.dn(qName); item.status = 'done'; item.pct = 100; item.curr = need; }
            else { item.status = 'failed'; item.curr = 0; }
            log.ge();
        }

        if (t === 'WATCH_VIDEO' || t === 'WATCH_VIDEO_ON_MOBILE') {
            let completed = false;
            for (let ts = done + 7; ts < need; ts += 7) {
                if (!st.running) { finish(false); return; }
                for (let w = 0; w < 14 && st.running; w++) { await sleep(500); if (item._paused) { while (item._paused && st.running) await sleep(500); } }
                if (!st.running) { finish(false); return; }
                let res = await apiReq('POST', '/quests/' + q.id + '/video-progress', { timestamp: Math.min(need, ts + Math.random()) });
                completed = res?.body?.completed_at != null;
                let val = Math.min(need, ts);
                log.i('[ ' + pct(val, need) + '% ] ' + fmtDur(log._el()));
                item.pct = pct(val, need);
                item.curr = val;
                updateProgTick(item);
                if (completed) break;
            }
            if (!completed && st.running) {
                let res = await apiReq('POST', '/quests/' + q.id + '/video-progress', { timestamp: need });
                completed = res?.body?.completed_at != null;
            }
            finish(completed);
        }
        else if (t === 'PLAY_ON_DESKTOP' || t === 'PLAY_ON_XBOX' || t === 'PLAY_ON_PLAYSTATION') {
            try {
                let d = await Q.api.get({ url: '/applications/public?application_ids=' + appId });
                let app = d.body[0];
                let exe = app.executables?.find(x => x.os === 'win32')?.name?.replace('>', '') || appName.replace(/[\\/:*?"<>|]/g, '');
                let g = await setFakeGame(q, pid, appId, exe);
                log.i(exe + ' (PID ' + pid + ')');

                await new Promise(resolve => {
                    let hb = function (data) {
                        if (!st.running) return;
                        if (item._paused) { updateProgTick(item); return; }
                        let p = Math.floor(data?.userStatus?.progress?.[t]?.value || 0);
                        log.i('[ ' + pct(p, need) + '% ] ' + fmtDur(log._el()));
                        item.pct = pct(p, need);
                        item.curr = p;
                        updateProgTick(item);
                        if (p >= need) {
                            Q.Game.getRunningGames = g.realGet;
                            Q.Game.getGameForPID = g.realPidGet;
                            Q.Flux.dispatch({ type: 'RUNNING_GAMES_CHANGE', removed: [g.fake], added: [], games: g.realGet() });
                            Q.Flux.unsubscribe('QUESTS_SEND_HEARTBEAT_SUCCESS', hb);
                            clearInt(); finish(true); resolve();
                        }
                    };
                    Q.Flux.subscribe('QUESTS_SEND_HEARTBEAT_SUCCESS', hb);
                    let int = setInterval(() => { try { if (!st.running) { clearInterval(int); Q.Flux.unsubscribe('QUESTS_SEND_HEARTBEAT_SUCCESS', hb); Q.Game.getRunningGames = g.realGet; Q.Game.getGameForPID = g.realPidGet; Q.Flux.dispatch({ type:'RUNNING_GAMES_CHANGE', removed:[g.fake], added:[], games:g.realGet() }); finish(false); resolve(); } if (item._paused) return; } catch(e) { finish(false); resolve(); } }, 1000);
                    let clearInt = () => clearInterval(int);
                    st._cleanups.push(() => { clearInterval(int); Q.Flux.unsubscribe('QUESTS_SEND_HEARTBEAT_SUCCESS', hb); Q.Game.getRunningGames = g.realGet; Q.Game.getGameForPID = g.realPidGet; Q.Flux.dispatch({ type:'RUNNING_GAMES_CHANGE', removed:[g.fake], added:[], games:g.realGet() }); finish(false); resolve(); });
                });
            } catch (e) { log.e('API error: ' + e.message); finish(false); }
        }
        else if (t === 'STREAM_ON_DESKTOP') {
            let realStream = Q.Streaming.getStreamerActiveStreamMetadata;
            Q.Streaming.getStreamerActiveStreamMetadata = () => ({ id: appId, pid, sourceName: null });
            log.i('PID ' + pid);

            await new Promise(resolve => {
                let hb = function (data) {
                    if (!st.running) return;
                    if (item._paused) { updateProgTick(item); return; }
                    let p = Math.floor(data?.userStatus?.progress?.STREAM_ON_DESKTOP?.value || 0);
                    log.i('[ ' + pct(p, need) + '% ] ' + fmtDur(log._el()));
                    item.pct = pct(p, need);
                    item.curr = p;
                    updateProgTick(item);
                    if (p >= need) {
                        Q.Streaming.getStreamerActiveStreamMetadata = realStream;
                        Q.Flux.unsubscribe('QUESTS_SEND_HEARTBEAT_SUCCESS', hb);
                        clearInt(); finish(true); resolve();
                    }
                };
                Q.Flux.subscribe('QUESTS_SEND_HEARTBEAT_SUCCESS', hb);
                let int = setInterval(() => { try { if (!st.running) { clearInterval(int); Q.Flux.unsubscribe('QUESTS_SEND_HEARTBEAT_SUCCESS', hb); Q.Streaming.getStreamerActiveStreamMetadata = realStream; finish(false); resolve(); } if (item._paused) return; } catch(e) { finish(false); resolve(); } }, 1000);
                let clearInt = () => clearInterval(int);
                st._cleanups.push(() => { clearInterval(int); Q.Flux.unsubscribe('QUESTS_SEND_HEARTBEAT_SUCCESS', hb); Q.Streaming.getStreamerActiveStreamMetadata = realStream; finish(false); resolve(); });
            });
        }
        else if (t === 'PLAY_ACTIVITY') {
            let cid = Q.Channel?.getSortedPrivateChannels()?.[0]?.id ||
                Object.values(Q.Guild?.getAllGuilds?.() || {}).find(x => x?.VOCAL?.length > 0)?.VOCAL[0]?.channel?.id;
            if (!cid) { log.e('No channel found for activity.'); finish(false); return; }
            while (st.running) {
                if (item._paused) { while (item._paused && st.running) await sleep(500); }
                if (!st.running) break;
                let res = await directPost('/quests/' + q.id + '/heartbeat', { stream_key: 'call:' + cid + ':1', terminal: false }) || await apiReq('POST', '/quests/' + q.id + '/heartbeat', { stream_key: 'call:' + cid + ':1', terminal: false });
                let p = res?.body?.progress?.[t]?.value || 0;
                log.i('[ ' + pct(p, need) + '% ] ' + fmtDur(log._el()));
                item.pct = pct(p, need);
                item.curr = p;
                updateProgTick(item);
                for (let w = 0; w < 40 && st.running && !item._paused; w++) { await sleep(500); }
                if (item._paused) { while (item._paused && st.running) await sleep(500); }
                if (p >= need && st.running) { await directPost('/quests/' + q.id + '/heartbeat', { stream_key: 'call:' + cid + ':1', terminal: true }) || await apiReq('POST', '/quests/' + q.id + '/heartbeat', { stream_key: 'call:' + cid + ':1', terminal: true }); break; }
            }
            finish(st.running);
        }
    }

    window.startDemo = () => {
        let baseQuest = st.allQuests[0];
        if (!baseQuest) {
            baseQuest = {
                id: "demo-quest-id",
                config: {
                    application: { id: "1138210344448561214", name: "Roblox" },
                    messages: { questName: "Play Roblox for 15 minutes" },
                    taskConfig: { tasks: { PLAY_ON_DESKTOP: { target: 15 } } },
                    rewardsConfig: { rewards: [{ orbQuantity: 100 }] },
                    expiresAt: new Date(Date.now() + 86400000).toISOString(),
                    assets: {
                        quest_bar_hero: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Roblox_Logo_2022.svg/640px-Roblox_Logo_2022.svg.png",
                        game_logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Roblox_player_icon_black.svg/240px-Roblox_player_icon_black.svg.png"
                    }
                },
                userStatus: {
                    enrolledAt: new Date().toISOString(),
                    completedAt: null
                }
            };
        }
        let fakeQuest = JSON.parse(JSON.stringify(baseQuest));
        fakeQuest.id = fakeQuest.id + "-demo";
        let cfg = fakeQuest.config.taskConfig ?? fakeQuest.config.taskConfigV2;
        let t = TASKS.find(x => cfg?.tasks?.[x] != null);
        let need = t && cfg?.tasks?.[t]?.target ? cfg.tasks[t].target : 15;
        let currVal = Math.floor(need * 0.53);
        st.queue = [{
            q: fakeQuest,
            status: 'running',
            pct: 53,
            curr: currVal
        }];
        st.running = true;
        renderProgress();
        log.ok("Demo mode activated! Progress tab mock loaded.");
    };

    buildDashboard();
    refreshQuests();
})();
