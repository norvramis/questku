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

    let isBrowser = !navigator.userAgent.includes('Electron');

    const TASKS = ['WATCH_VIDEO', 'PLAY_ON_DESKTOP', 'STREAM_ON_DESKTOP', 'PLAY_ACTIVITY', 'WATCH_VIDEO_ON_MOBILE'];
    const TASK_NAMES = { WATCH_VIDEO: 'Watch Video', WATCH_VIDEO_ON_MOBILE: 'Watch Video', PLAY_ON_DESKTOP: 'Play Game', STREAM_ON_DESKTOP: 'Stream', PLAY_ACTIVITY: 'Activity' };
    const COLORS = { accent: '#545ded', bg: '#313338', panel: '#2b2d31', text: '#dbdee1', muted: '#80848e', border: '#1e1f22', green: '#23a55a', red: '#f23f42', amber: '#f0b232' };

    let set = { autoEnroll: true, autoClaim: true, maxRetries: 3 };
    let st = { allQuests: [], queue: [], running: false, paused: false, completed: 0, failed: 0, currentTask: null };

    const fmtDur = s => s < 60 ? Math.floor(s) + 's' : Math.floor(s / 60) + 'm ' + Math.floor(s % 60) + 's';
    const pct = (c, t) => t > 0 ? Math.floor(c / t * 100) : 0;
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const sleepSec = s => sleep(s * 1000);

    let log = {
        _s: null, start() { this._s = Date.now() }, _el() { return this._s ? (Date.now() - this._s) / 1000 : 0 },
        h(m) { console.log('%c[!]%c' + m, 'color:#7289da;font-weight:bold', '') },
        i(m) { console.log('%c[..]%c' + m, 'color:#faa61a', '') },
        e(m) { console.log('%c[!!]%c' + m, 'color:red;font-weight:bold', '') },
        ok(m) { console.log('%c[OK]%c' + m, 'color:#43b581;font-weight:bold', '') },
        dn(n) { console.log('%c[✓]%c' + n + ',%c' + fmtDur(this._el()), 'color:#43b581;font-weight:bold', '', 'color:#95a5a6') },
        gr(t) { console.groupCollapsed('%c[!]%c' + t, 'color:#7289da;font-weight:bold', '') },
        ge() { console.groupEnd() }
    };

    async function apiReq(method, url, body) {
        for (let i = 0; i <= set.maxRetries; i++) {
            try {
                let res = method === 'GET' ? await Q.api.get({ url }) : await Q.api.post({ url, body });
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

    function refreshQuests() {
        st.allQuests = [...Q.Quest.quests.values()]
            .filter(x => new Date(x.config.expiresAt).getTime() > Date.now() &&
                TASKS.find(y => Object.keys((x.config.taskConfig ?? x.config.taskConfigV2).tasks).includes(y)))
            .map((q, i) => { q._i = i; q._sel = false; return q; });
        if (D) { D.selall.checked = false; }
        renderAllQuests();
        updateAddqBtn();
    }

    function getTok() {
        try {
            let k = Object.keys(Q.api).find(k => typeof Q.api[k] === 'string' && Q.api[k].length > 40 && Q.api[k].startsWith('MT'));
            if (k) return Q.api[k];
        } catch {}
        return null;
    }

    async function enrollQuest(q) {
        if (q._enrolling) return true;
        q._enrolling = true;
        try {
            let ok = false;
            if (isBrowser) {
                let tok = getTok();
                if (tok) {
                    let r = await window.fetch('https://discord.com/api/v9/quests/' + q.id + '/enroll', {
                        method: 'POST',
                        headers: { authorization: tok, 'content-type': 'application/json' },
                        body: JSON.stringify({ location: 59, is_targeted: false, metadata_sealed: null, traffic_metadata_sealed: null })
                    });
                    let d = await r.json();
                    ok = !!d?.userStatus?.enrolledAt;
                }
            } else {
                let res = await apiReq('POST', '/quests/' + q.id + '/enroll', {
                    location: 59, is_targeted: false, metadata_sealed: null, traffic_metadata_sealed: null
                });
                ok = !!res?.body?.userStatus?.enrolledAt;
            }
            if (ok) refreshQuests();
            return ok;
        } catch { return false; }
        finally { delete q._enrolling; }
    }

    async function claimQuest(q) {
        try {
            let res = await apiReq('POST', '/quests/' + q.id + '/claim', {});
            return res.status === 200 || res.body?.rewardGranted;
        } catch { return false; }
    }

    let D = null;

    function buildDashboard() {
        if (document.getElementById('questku-panel')) { let o=document.getElementById('questku-panel'); o.remove(); let s=document.getElementById('questku-style'); if(s)s.remove(); }
        let c = document.createElement('style');
        c.id = 'questku-style';
        c.textContent = `
#questku-panel{all:initial;font:12.5px/1.5 Whitney,'Helvetica Neue',Helvetica,Arial,sans-serif;position:fixed;bottom:24px;right:24px;z-index:999999;background:rgba(15,16,18,.6);color:#e8eaed;border:1px solid rgba(255,255,255,.05);border-radius:16px;width:400px;box-shadow:0 24px 80px rgba(0,0,0,.5);user-select:none;overflow:hidden;animation:qkIn .3s ease-out;-webkit-backdrop-filter:blur(24px);backdrop-filter:blur(24px)}
@keyframes qkIn{0%{opacity:0;transform:translateY(12px) scale(.97)}100%{opacity:1;transform:translateY(0) scale(1)}}
#questku-panel *{box-sizing:border-box;margin:0;padding:0}
#questku-panel .qk-h{display:flex;align-items:center;gap:8px;padding:14px 12px 10px 16px;border-bottom:1px solid rgba(255,255,255,.05);cursor:move}
#questku-panel .qk-h .qk-l{display:flex;align-items:center;gap:8px;font-weight:600;font-size:14px;color:#f2f3f5}
#questku-panel .qk-h .qk-l svg{flex-shrink:0;display:block}
#questku-panel .qk-h .qk-l span{color:#5865f2}
#questku-panel .qk-h .qk-ob{font-size:10px;padding:2px 7px;border-radius:10px;background:rgba(255,255,255,.05);color:rgba(255,255,255,.45);font-weight:500;margin-left:4px}
#questku-panel .qk-h .qk-tabs{display:flex;gap:2px;background:rgba(255,255,255,.04);border-radius:8px;padding:2px;margin-left:auto;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
#questku-panel .qk-h .qk-tab{border:0;background:0;color:rgba(255,255,255,.3);font-size:11px;font-weight:500;padding:5px 10px;border-radius:6px;cursor:pointer;transition:all .12s;font-family:inherit}
#questku-panel .qk-h .qk-tab:hover{color:#e8eaed;background:rgba(255,255,255,.06)}
#questku-panel .qk-h .qk-tab.act{background:rgba(255,255,255,.08);color:#e8eaed}
#questku-panel .qk-h .qk-hbtn{border:0;background:0;color:rgba(255,255,255,.2);font-size:16px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:6px;cursor:pointer;transition:all .12s;font-family:inherit}
#questku-panel .qk-h .qk-hbtn:hover{background:rgba(255,255,255,.08);color:#e8eaed}
#questku-panel .qk-body{display:none}
#questku-panel .qk-body.act{display:block}
#questku-panel .qk-tl{display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid rgba(255,255,255,.04)}
#questku-panel .qk-tl label{display:flex;align-items:center;gap:6px;font-size:11.5px;color:rgba(255,255,255,.35);cursor:pointer;transition:color .1s;font-family:inherit;white-space:nowrap}
#questku-panel .qk-tl label:hover{color:rgba(255,255,255,.6)}
#questku-panel .qk-tl input[type=checkbox]{width:14px;height:14px;cursor:pointer;accent-color:#5865f2}
#questku-panel .qk-tl .qk-ac{border:0;background:rgba(255,255,255,.04);color:rgba(255,255,255,.35);font-size:11px;font-weight:500;padding:4px 12px;border-radius:6px;cursor:pointer;transition:all .12s;font-family:inherit;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);margin-left:auto}
#questku-panel .qk-tl .qk-ac:hover{color:rgba(255,255,255,.7);background:rgba(255,255,255,.07)}
#questku-panel .qk-tl .qk-rf{border:0;background:rgba(255,255,255,.04);color:rgba(255,255,255,.35);font-size:13px;padding:4px 8px;border-radius:6px;cursor:pointer;transition:all .12s;font-family:inherit}
#questku-panel .qk-list{height:300px;overflow-y:auto;padding:4px 8px}
#questku-panel .qk-list::-webkit-scrollbar{width:4px}
#questku-panel .qk-list::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:2px}
#questku-panel .qk-cd{margin:3px 0;border-radius:10px;overflow:hidden;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.04);transition:all .15s;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
#questku-panel .qk-cd:hover{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.07);transform:translateY(-1px)}
#questku-panel .qk-ch{display:flex;align-items:center;gap:10px;padding:8px 10px;cursor:pointer}
#questku-panel .qk-ch .qk-ck{width:14px;height:14px;accent-color:#5865f2;cursor:pointer;flex-shrink:0}
#questku-panel .qk-ch .qk-ico{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);color:rgba(255,255,255,.5);overflow:hidden}
#questku-panel .qk-ch .qk-ico img{width:100%;height:100%;object-fit:cover;display:block}
#questku-panel .qk-ch .qk-ico.done{color:#23a55a;background:rgba(35,165,90,.08);border-color:rgba(35,165,90,.15)}
#questku-panel .qk-ch .qk-ico.fail{color:#f23f42;background:rgba(242,63,66,.08);border-color:rgba(242,63,66,.15)}
#questku-panel .qk-ch .qk-if .qk-nm{font-size:12.5px;color:#f2f3f5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500}
#questku-panel .qk-ch .qk-if .qk-sb{font-size:10.5px;color:rgba(255,255,255,.35);margin-top:1px}
#questku-panel .qk-ch .qk-tg{font-size:10.5px;padding:2px 7px;border-radius:4px;font-weight:500;white-space:nowrap;flex-shrink:0;background:rgba(255,255,255,.04);color:rgba(255,255,255,.35)}
#questku-panel .qk-ch .qk-tg.dn{background:rgba(35,165,90,.1);color:#23a55a}
#questku-panel .qk-ch .qk-tg.en{background:rgba(88,101,242,.1);color:#5865f2}
#questku-panel .qk-ch .qk-tg.fl{background:rgba(242,63,66,.1);color:#f23f42}
#questku-panel .qk-ch .qk-tg.pn{background:rgba(240,178,50,.1);color:#f0b232}
#questku-panel .qk-ch .qk-tg.rd{background:rgba(88,101,242,.1);color:#5865f2}
#questku-panel .qk-cd-d{display:none;padding:0 10px 8px 32px;font-size:11px;color:rgba(255,255,255,.35)}
#questku-panel .qk-cd-d.op{display:block}
#questku-panel .qk-cd-d>div{padding:2px 0}
#questku-panel .qk-cd-d .qk-el{display:flex;align-items:center;gap:6px;margin-top:4px;padding-top:4px;border-top:1px solid rgba(255,255,255,.04)}
#questku-panel .qk-cd-d .qk-el input{accent-color:#5865f2;width:14px;height:14px}
#questku-panel .qk-cd-d .qk-el label{font-size:11px;color:rgba(255,255,255,.3);cursor:pointer;font-family:inherit}
#questku-panel .qk-pr{height:3px;background:rgba(255,255,255,.04);border-radius:2px;margin:0 10px 8px;overflow:hidden}
#questku-panel .qk-pr-f{height:100%;border-radius:2px;background:#5865f2;width:0;transition:width .3s ease}
#questku-panel .qk-pr-f.dn{background:#23a55a}
#questku-panel .qk-pr-f.fl{background:#f23f42}
#questku-panel .qk-ft{display:flex;align-items:center;justify-content:center;gap:6px;padding:8px 14px 10px;border-top:1px solid rgba(255,255,255,.04)}
#questku-panel .qk-ft .qk-btn{flex:1;border:0;background:rgba(255,255,255,.04);color:rgba(255,255,255,.2);font-size:12px;font-weight:500;padding:7px 10px;border-radius:8px;cursor:pointer;transition:all .12s;font-family:inherit;text-align:center}
#questku-panel .qk-ft .qk-btn:hover{background:rgba(255,255,255,.07);color:rgba(255,255,255,.5)}
#questku-panel .qk-ft .qk-btn.enabled{color:#5865f2;background:rgba(88,101,242,.1)}
#questku-panel .qk-ft .qk-btn.enabled:hover{background:rgba(88,101,242,.18);color:#7c8aff}
#questku-panel .qk-ft .qk-btn:disabled{opacity:.25;cursor:not-allowed}
#questku-panel .qk-ft-p{display:flex;align-items:center;gap:6px;padding:8px 14px 10px;border-top:1px solid rgba(255,255,255,.04)}
#questku-panel .qk-ft-p .qk-btn{width:auto;padding:7px 14px;border:0;background:rgba(255,255,255,.04);color:rgba(255,255,255,.4);font-size:12px;font-weight:500;border-radius:8px;cursor:pointer;transition:all .12s;font-family:inherit;text-align:center}
#questku-panel .qk-ft-p .qk-btn:hover{background:rgba(255,255,255,.07);color:rgba(255,255,255,.7)}
#questku-panel .qk-ft-p .qk-st{margin-left:auto;font-size:10.5px;color:rgba(255,255,255,.2);font-variant-numeric:tabular-nums}
#questku-panel .qk-ft-p .qk-st .dc{color:#23a55a}
#questku-panel .qk-ft-p .qk-st .fc{color:#f23f42}
`.trim();
        document.head.appendChild(c);

        let p = document.createElement('div');
        p.id = 'questku-panel';
        p.innerHTML =
            '<div class="qk-h"><div class="qk-l"><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAydpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDkuMS1jMDAzIDc5Ljk2OTBhODdmYywgMjAyNS8wMy8wNi0yMDo1MDoxNiAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIDI2LjExIChXaW5kb3dzKSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDoxNjFEODFGNTdGRjYxMUYxOEIwNEI3NDExMkEzM0Y1QSIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDoxNjFEODFGNjdGRjYxMUYxOEIwNEI3NDExMkEzM0Y1QSI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOjE2MUQ4MUYzN0ZGNjExRjE4QjA0Qjc0MTEyQTMzRjVBIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjE2MUQ4MUY0N0ZGNjExRjE4QjA0Qjc0MTEyQTMzRjVBIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+o5PnZAAAEO9JREFUeNp8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" style="width:24px;height:24px;border-radius:6px;display:block">Quest<span>ku</span><span class="qk-ob" id="qk-ob">0</span></div>' +
            '<div class="qk-tabs"><button class="qk-tab act" data-t="quests">All Quests</button><button class="qk-tab" data-t="prog">Progress</button></div>' +
            '<button class="qk-hbtn" id="qk-min">-</button><button class="qk-hbtn" id="qk-close">x</button></div>' +

            '<div class="qk-body act" id="qk-b-quests">' +
            '<div class="qk-tl"><label><input type="checkbox" id="qk-selall"> Select All</label><button class="qk-ac" id="qk-enroll">Enroll</button><button class="qk-rf" id="qk-refresh">&#x21bb;</button></div>' +
            '<div class="qk-list" id="qk-ql"></div>' +
            '<div class="qk-ft"><button class="qk-btn" id="qk-addq">Start Queue</button></div></div>' +

            '<div class="qk-body" id="qk-b-prog">' +
            '<div class="qk-tl"><span style="font-size:11.5px;color:#80848e">Queue: <span id="qk-qc">0</span> quests</span></div>' +
            '<div class="qk-list" id="qk-pl"></div>' +
            '<div class="qk-ft qk-ft-p"><button class="qk-btn" id="qk-pause">Pause</button><button class="qk-btn" id="qk-stopq">Stop</button>' +
            '<span class="qk-st"><span class="dc" id="qk-dc">0</span> done <span style="color:#80848e">|</span> <span class="fc" id="qk-fc">0</span> failed</span></div></div>';

        document.body.appendChild(p);document.body.appendChild(p);
        D = {
            pan: p, ql: document.getElementById('qk-ql'), pl: document.getElementById('qk-pl'),
            tabs: p.querySelectorAll('.qk-tab'), ba: p.querySelector('#qk-b-quests'), bp: p.querySelector('#qk-b-prog'),
            selall: document.getElementById('qk-selall'), enroll: document.getElementById('qk-enroll'),
            addq: document.getElementById('qk-addq'), pause: document.getElementById('qk-pause'),
            stopq: document.getElementById('qk-stopq'), qc: document.getElementById('qk-qc'),
            dc: document.getElementById('qk-dc'), fc: document.getElementById('qk-fc'),
            refresh: document.getElementById('qk-refresh'), ob: document.getElementById('qk-ob'),
            min: document.getElementById('qk-min'), close: document.getElementById('qk-close')
        };


        D.tabs.forEach(t => t.onclick = () => {
            D.tabs.forEach(x => x.classList.remove('act'));
            t.classList.add('act');
            D.ba.classList.toggle('act', t.dataset.t === 'quests');
            D.bp.classList.toggle('act', t.dataset.t === 'prog');
            if (t.dataset.t === 'prog') renderProgress();
        });


        let ox, oy, dr = false;
        let hdr = p.querySelector('.qk-h');
        hdr.addEventListener('mousedown', e => { dr = true; ox = e.clientX - p.offsetLeft; oy = e.clientY - p.offsetTop; });
        document.addEventListener('mousemove', e => { if (dr) { p.style.left = (e.clientX - ox) + 'px'; p.style.right = 'auto'; p.style.bottom = 'auto'; p.style.top = (e.clientY - oy) + 'px'; } });
        document.addEventListener('mouseup', () => dr = false);


        D.close.onclick = () => { p.remove(); c.remove(); D = null; };
        let hidden = false;
        D.min.onclick = () => { hidden = !hidden; p.querySelectorAll('.qk-body, .qk-tl, .qk-list, .qk-ft').forEach(x => x.style.display = hidden ? 'none' : ''); D.min.textContent = hidden ? '+' : '-'; };


        D.selall.onchange = () => {
            D.ql.querySelectorAll('input[type=checkbox]:not(#qk-selall)').forEach(cb => {
                cb.checked = D.selall.checked;
                let i = parseInt(cb.dataset.i);
                if (st.allQuests[i]) st.allQuests[i]._sel = cb.checked;
            });
            updateAddqBtn();
        };


        D.enroll.onclick = async () => {
            D.enroll.disabled = true;
            D.enroll.textContent = 'Enrolling...';
            let sel = st.allQuests.filter(x => x._sel && !x.userStatus?.enrolledAt);
            for (let q of sel) {
                let ok = await enrollQuest(q);
                if (ok) log.i('Enrolled: ' + q.config.messages.questName);
                else log.e('Enroll failed: ' + q.config.messages.questName);
            }
            D.enroll.disabled = false;
            D.enroll.textContent = 'Enroll Selected';
            refreshQuests();
        };


        D.addq.onclick = () => {
            let sel = st.allQuests.filter(x => x._sel && !x.userStatus?.completedAt).map(q => ({ q, status: 'pending', pct: 0 }));
            if (sel.length === 0) return;
            st.queue = sel;
            st.completed = 0; st.failed = 0;
            D.addq.disabled = true;
            D.addq.classList.remove('enabled');
            switchTab('prog');
            processQueue();
        };


        D.pause.onclick = () => { st.paused = !st.paused; D.pause.textContent = st.paused ? 'Resume' : 'Pause'; renderProgress(); };
        D.stopq.onclick = () => { st.running = false; st.paused = false; st.queue = []; st.completed = 0; st.failed = 0; D.addq.disabled = false; D.pause.textContent = 'Pause'; renderProgress(); };
        if (D.refresh) D.refresh.onclick = refreshQuests;

        function switchTab(name) {
            D.tabs.forEach(t => {
                t.classList.toggle('act', t.dataset.t === name);
                D.ba.classList.toggle('act', name === 'quests');
                D.bp.classList.toggle('act', name === 'prog');
            });
        }
    }

    function renderAllQuests() {
        if (!D) return;
        let list = D.ql;
        let all = st.allQuests;
        if (all.length === 0) { list.innerHTML = '<div class="qk-em">No quests available</div>'; return; }
        let html = '';
        let totalOrbs = 0;
        for (let q of all) {
            let enrolled = !!q.userStatus?.enrolledAt;
            let completed = !!q.userStatus?.completedAt;
            let exp = new Date(q.config.expiresAt).getTime() < Date.now();
            let stLabel = completed ? 'Done' : exp ? 'Expired' : enrolled ? 'Enrolled' : 'Not Enrolled';
            let stCls = completed ? 'dn' : exp ? 'fl' : enrolled ? 'en' : 'pn';
            let cb = completed ? 'checked disabled' : (q._sel ? 'checked' : '');
            let cfg = q.config.taskConfig ?? q.config.taskConfigV2;
            let t = TASKS.find(x => cfg?.tasks?.[x] != null);
            let taskName = TASK_NAMES[t] || t || 'Quest';
            let need = t && cfg?.tasks?.[t]?.target ? cfg.tasks[t].target : 0;
            let unit = (t === 'WATCH_VIDEO' || t === 'WATCH_VIDEO_ON_MOBILE') ? 's' : 'min';
            let durStr = need ? need + unit : '';
            let orb = 0;
            try { let r = q.config.rewardsConfig?.rewards; if (r?.length) orb = r[0].orbQuantity || r[0].amount || 0; } catch {}
            totalOrbs += orb;
            let icoCls = completed ? 'done' : exp ? 'fail' : '';
            let ico = (q.config.messages.questName || 'Q')[0].toUpperCase();
            let icoUrl = q.config.application.icon ? 'https://cdn.discordapp.com/app-icons/' + q.config.application.id + '/' + q.config.application.icon + '.png?size=32' : '';
            let icoHtml = icoUrl ? '<img src="' + icoUrl + '" loading="lazy" onerror="this.style.display=\'none\';this.parentElement.textContent=\'' + ico + '\'">' : ico;
            html += '<div class="qk-cd"><div class="qk-ch">' +
                '<input type="checkbox" class="qk-ck" ' + cb + ' data-i="' + q._i + '">' +
                '<div class="qk-ico ' + icoCls + '">' + icoHtml + '</div>' +
                '<div class="qk-if"><div class="qk-nm">' + q.config.messages.questName + '</div><div class="qk-sb">' + taskName + (durStr ? ' · ' + durStr : '') + ' · ' + (orb || 0) + ' orbs</div></div>' +
                '<span class="qk-tg ' + stCls + '">' + stLabel + '</span></div>' +
                '<div class="qk-cd-d"><div>Game: ' + q.config.application.name + '</div>' +
                (durStr ? '<div>Duration: ' + durStr + '</div>' : '') +
                '<div>Reward: ' + (orb || 0) + ' orbs</div>' +
                '<div>Expires: ' + new Date(q.config.expiresAt).toLocaleDateString() + '</div>' +
                '<div class="qk-el"><input type="checkbox" class="qk-ck" ' + (q._sel ? 'checked' : '') + ' data-i="' + q._i + '"><label>Selected for queue</label></div></div></div>';
        }
        if (D.ob) D.ob.textContent = totalOrbs;
        list.innerHTML = html;
        list.querySelectorAll('.qk-ch').forEach(h => {
            h.onclick = (e) => {
                if (e.target.type === 'checkbox') return;
                let dt = h.parentElement.querySelector('.qk-cd-d');
                if (dt) dt.classList.toggle('op');
            };
        });
        list.querySelectorAll('.qk-ch input.qk-ck').forEach(cb => {
            cb.onchange = () => {
                let i = parseInt(cb.dataset.i);
                if (st.allQuests[i]) st.allQuests[i]._sel = cb.checked;
                D.selall.checked = st.allQuests.every(x => x._sel);
                list.querySelectorAll('.qk-el input[data-i="' + i + '"]').forEach(x => x.checked = cb.checked);
                updateAddqBtn();
            };
        });
        updateAddqBtn();
    }

    function updateAddqBtn() {
        if (!D || !D.addq) return;
        let has = st.allQuests.some(x => x._sel && !x.userStatus?.completedAt);
        D.addq.disabled = !has;
        D.addq.classList.toggle('enabled', has);
    }

    function renderProgress() {
        if (!D) return;
        let list = D.pl;
        let qq = st.queue;
        if (qq.length === 0) { list.innerHTML = ''; updateStats(); return; }
        let html = '';
        for (let i = 0; i < qq.length; i++) {
            let item = qq[i];
            let q = item.q;
            let isRunning = st.running && i === 0;
            let isPaused = st.paused && i === 0 && st.running;
            let stLabel = item.status === 'done' ? 'Done' : item.status === 'failed' ? 'Failed' : isRunning && isPaused ? 'Paused' : isRunning ? 'Running' : 'Pending';
            let stCls = item.status === 'done' ? 'dn' : item.status === 'failed' ? 'fl' : isRunning && isPaused ? 'pn' : isRunning ? 'rd' : '';
            let p = item.pct || 0;
            let pCls = item.status === 'done' ? 'dn' : item.status === 'failed' ? 'fl' : '';
            let cfg = q.config.taskConfig ?? q.config.taskConfigV2;
            let t = TASKS.find(x => cfg?.tasks?.[x] != null);
            let taskName = TASK_NAMES[t] || t || 'Quest';
            let need = t && cfg?.tasks?.[t]?.target ? cfg.tasks[t].target : 0;
            let unit = (t === 'WATCH_VIDEO' || t === 'WATCH_VIDEO_ON_MOBILE') ? 's' : 'min';
            let icoCls = item.status === 'done' ? 'done' : item.status === 'failed' ? 'fail' : '';
            let ico = (q.config.messages.questName || 'Q')[0].toUpperCase();
            let icoUrl = q.config.application.icon ? 'https://cdn.discordapp.com/app-icons/' + q.config.application.id + '/' + q.config.application.icon + '.png?size=32' : '';
            let icoHtml = icoUrl ? '<img src="' + icoUrl + '" loading="lazy" onerror="this.style.display=\'none\';this.parentElement.textContent=\'' + ico + '\'">' : ico;
            html += '<div class="qk-cd"><div class="qk-ch">' +
                '<div class="qk-ico ' + icoCls + '">' + icoHtml + '</div>' +
                '<div class="qk-if"><div class="qk-nm">' + q.config.messages.questName + '</div><div class="qk-sb">' + taskName + (need ? ' · ' + need + unit : '') + '</div></div>' +
                '<span class="qk-tg ' + stCls + '">' + stLabel + '</span></div>' +
                '<div class="qk-pr"><div class="qk-pr-f ' + pCls + '" style="width:' + p + '%"></div></div>' +
                '<div class="qk-cd-d op"><div style="padding:0 10px 8px;font-size:11px;color:rgba(255,255,255,.25)">' + p + '% complete</div></div></div>';
        }
        list.innerHTML = html;
        updateStats();
    }

    function updateStats() {
        if (!D) return;
        D.qc.textContent = st.queue.filter(x => x.status === 'pending' || x.status === 'running').length;
        D.dc.textContent = st.completed;
        D.fc.textContent = st.failed;
    }

    function updateQItem(i, p, status) {
        if (!st.queue[i]) return;
        st.queue[i].pct = p;
        if (status) st.queue[i].status = status;
    }

    async function processQueue() {
        if (st.running) return;
        st.running = true;
        renderProgress();

        for (let i = 0; i < st.queue.length; i++) {
            if (!st.running) break;
            let item = st.queue[i];


            while (st.paused && st.running) await sleep(500);
            if (!st.running) break;

            item.status = 'running';
            renderProgress();


            if (set.autoEnroll && !item.q.userStatus?.enrolledAt) {
                log.i('Enrolling: ' + item.q.config.messages.questName);
                let ok = await enrollQuest(item.q);
                if (!ok) { log.e('Enroll failed: ' + item.q.config.messages.questName); item.status = 'failed'; st.failed++; renderProgress(); continue; }
            }


            try { await processQuest(item); }
            catch (e) { log.e('Quest error: ' + (e.message || e)); item.status = 'failed'; }


            if (set.autoClaim && item.status === 'done') {
                let ok = await claimQuest(item.q);
                if (ok) log.i('Claimed: ' + item.q.config.messages.questName);
                else log.e('Claim failed: ' + item.q.config.messages.questName);
            }

            if (item.status === 'done') st.completed++;
            else if (item.status === 'failed') st.failed++;
            renderProgress();
        }

        st.running = false;
        D.addq.disabled = false;
        renderProgress();
        if (st.completed > 0) log.ok('Done. ' + st.completed + ' completed, ' + st.failed + ' failed.');
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
            if (ok) { log.dn(qName); item.status = 'done'; item.pct = 100; }
            else { item.status = 'failed'; }
            log.ge();
        }

        if (t === 'WATCH_VIDEO' || t === 'WATCH_VIDEO_ON_MOBILE') {
            let completed = false;
            for (let ts = done + 7; ts < need; ts += 7) {
                if (!st.running || st.paused) { while (st.paused && st.running) await sleep(500); if (!st.running) { finish(false); return; } }
                await sleep(7000);
                let res = await apiReq('POST', '/quests/' + q.id + '/video-progress', { timestamp: Math.min(need, ts + Math.random()) });
                completed = res?.body?.completed_at != null;
                let val = Math.min(need, ts);
                log.i('[ ' + pct(val, need) + '% ] ' + fmtDur(log._el()));
                item.pct = pct(val, need);
                renderProgress();
                if (completed) break;
            }
            if (!completed && st.running) {
                let res = await apiReq('POST', '/quests/' + q.id + '/video-progress', { timestamp: need });
                completed = res?.body?.completed_at != null;
            }
            finish(completed);
        }
        else if (t === 'PLAY_ON_DESKTOP') {
            try {
                let d = await Q.api.get({ url: '/applications/public?application_ids=' + appId });
                let app = d.body[0];
                let exe = app.executables?.find(x => x.os === 'win32')?.name?.replace('>', '') || appName.replace(/[\\/:*?"<>|]/g, '');
                let g = await setFakeGame(q, pid, appId, exe);
                log.i(exe + ' (PID ' + pid + ')');

                await new Promise(resolve => {
                    let hb = function (data) {
                        let p = Math.floor(data?.userStatus?.progress?.PLAY_ON_DESKTOP?.value || 0);
                        log.i('[ ' + pct(p, need) + '% ] ' + fmtDur(log._el()));
                        item.pct = pct(p, need);
                        renderProgress();
                        if (p >= need) {
                            Q.Game.getRunningGames = g.realGet;
                            Q.Game.getGameForPID = g.realPidGet;
                            Q.Flux.dispatch({ type: 'RUNNING_GAMES_CHANGE', removed: [g.fake], added: [], games: g.realGet() });
                            Q.Flux.unsubscribe('QUESTS_SEND_HEARTBEAT_SUCCESS', hb);
                            clearInt(); finish(true); resolve();
                        }
                    };
                    Q.Flux.subscribe('QUESTS_SEND_HEARTBEAT_SUCCESS', hb);
                    let int = setInterval(() => { if (!st.running) { clearInterval(int); Q.Flux.unsubscribe('QUESTS_SEND_HEARTBEAT_SUCCESS', hb); Q.Game.getRunningGames = g.realGet; Q.Game.getGameForPID = g.realPidGet; Q.Flux.dispatch({ type:'RUNNING_GAMES_CHANGE', removed:[g.fake], added:[], games:g.realGet() }); finish(false); resolve(); } }, 1000);
                    let clearInt = () => clearInterval(int);
                });
            } catch (e) { log.e('API error: ' + e.message); finish(false); }
        }
        else if (t === 'STREAM_ON_DESKTOP') {
            let realStream = Q.Streaming.getStreamerActiveStreamMetadata;
            Q.Streaming.getStreamerActiveStreamMetadata = () => ({ id: appId, pid, sourceName: null });
            log.i('PID ' + pid);

            await new Promise(resolve => {
                let hb = function (data) {
                    let p = Math.floor(data?.userStatus?.progress?.STREAM_ON_DESKTOP?.value || 0);
                    log.i('[ ' + pct(p, need) + '% ] ' + fmtDur(log._el()));
                    item.pct = pct(p, need);
                    renderProgress();
                    if (p >= need) {
                        Q.Streaming.getStreamerActiveStreamMetadata = realStream;
                        Q.Flux.unsubscribe('QUESTS_SEND_HEARTBEAT_SUCCESS', hb);
                        clearInt(); finish(true); resolve();
                    }
                };
                Q.Flux.subscribe('QUESTS_SEND_HEARTBEAT_SUCCESS', hb);
                let int = setInterval(() => { if (!st.running) { clearInterval(int); Q.Flux.unsubscribe('QUESTS_SEND_HEARTBEAT_SUCCESS', hb); Q.Streaming.getStreamerActiveStreamMetadata = realStream; finish(false); resolve(); } }, 1000);
                let clearInt = () => clearInterval(int);
            });
        }
        else if (t === 'PLAY_ACTIVITY') {
            let cid = Q.Channel?.getSortedPrivateChannels()?.[0]?.id ||
                Object.values(Q.Guild?.getAllGuilds?.() || {}).find(x => x?.VOCAL?.length > 0)?.VOCAL[0]?.channel?.id;
            if (!cid) { log.e('No channel found for activity.'); finish(false); return; }
            while (st.running) {
                if (st.paused) { while (st.paused && st.running) await sleep(500); if (!st.running) break; }
                let res = await apiReq('POST', '/quests/' + q.id + '/heartbeat', { stream_key: 'call:' + cid + ':1', terminal: false });
                let p = res?.body?.progress?.PLAY_ACTIVITY?.value || 0;
                log.i('[ ' + pct(p, need) + '% ] ' + fmtDur(log._el()));
                item.pct = pct(p, need);
                renderProgress();
                await sleep(20000);
                if (p >= need) { await apiReq('POST', '/quests/' + q.id + '/heartbeat', { stream_key: 'call:' + cid + ':1', terminal: true }); break; }
            }
            finish(st.running);
        }
    }

    buildDashboard();
    refreshQuests();
})();
