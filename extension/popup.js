const stxt = document.getElementById('stxt');
const dot = document.getElementById('dot');
const bQ = document.getElementById('b-q');
const bON = document.getElementById('b-on');
const bOFF = document.getElementById('b-off');
const bK = document.getElementById('b-kill');
const phaseRow = document.getElementById('phase-row');

let phase = 'off';
let tabId = null;

async function findDiscordTab() {
    return new Promise(r => {
        chrome.tabs.query({}, tabs => {
            r(tabs.find(t => t.url && t.url.startsWith('https://discord.com/') && !t.url.includes('/hc/')));
        });
    });
}

async function checkPanel(id) {
    try {
        let r = await chrome.scripting.executeScript({
            target: { tabId }, func: pid => !!document.getElementById(pid), args: [id]
        });
        return r?.[0]?.result === true;
    } catch { return false; }
}

async function exec(fn) {
    try { await chrome.scripting.executeScript({ target: { tabId }, func: fn, world: 'MAIN' }); } catch {}
}

async function execFile(file) {
    try { await chrome.scripting.executeScript({ target: { tabId }, files: [file], world: 'MAIN' }); } catch {}
}

function setPhase(p, qPanel) {
    phase = p;
    bON.className = 'pk-btn pk-s' + (p === 'on' ? ' act' : '');
    bOFF.className = 'pk-btn pk-s' + (p === 'off' ? ' act' : '');
    bK.className = 'pk-btn pk-s';
    bON.disabled = p === 'on';
    bOFF.disabled = p === 'off' || p === 'kill';
    bK.disabled = p !== 'on' || !qPanel;
    bQ.disabled = p !== 'on' || !!qPanel;
    if (p === 'on') { stxt.textContent = 'Ready'; dot.className = 'dot dot-on'; }
    else if (p === 'off') { stxt.textContent = 'Standby'; dot.className = 'dot dot-off'; }
    else { stxt.textContent = 'Killed'; dot.className = 'dot dot-off'; }
}

async function refreshState() {
    stxt.textContent = 'Connecting...';
    bQ.disabled = true;
    bON.disabled = true; bOFF.disabled = true; bK.disabled = true;
    let tab = await findDiscordTab();
    if (!tab) {
        tabId = null;
        stxt.textContent = 'Discord not found';
        dot.className = 'dot dot-err';
        bQ.className = 'pk-btn';
        bQ.disabled = false;
        bQ.textContent = 'Open Discord';
        bQ.onclick = () => { chrome.tabs.create({ url: 'https://discord.com/app' }); window.close(); };
        bON.disabled = true; bOFF.disabled = true; bK.disabled = true;
        bON.onclick = bOFF.onclick = bK.onclick = null;
        phaseRow.className = 'row';
        return;
    }
    tabId = tab.id;

    let qPanel = await checkPanel('questku-panel');
    let target = qPanel ? 'on' : 'off';
    if (phase === 'kill') target = 'kill';
    setPhase(target, qPanel);
    phaseRow.className = 'row show';

    bQ.textContent = 'Questku';
    bQ.onclick = async () => {
        bQ.disabled = true; bQ.textContent = 'Opening...';
        await chrome.tabs.update(tabId, { active: true });
        await execFile('questku.js');
        await exec(() => {
            try {
                let h = Object.values(webpackChunkdiscord_app.push([[Symbol()], {}, r => r]));
                webpackChunkdiscord_app.pop();
                let r = Object.values(h).find(m => m?.exports?.default?.push && !m?.exports?.default?.transitionToRouter)?.exports?.default;
                if (r) r.push('/quests');
            } catch {}
        });
        window.close();
    };

    bON.onclick = async () => {
        setPhase('on', await checkPanel('questku-panel'));
    };

    bOFF.onclick = async () => {
        bOFF.disabled = true;
        await exec(() => { if (window.questkuKill) window.questkuKill(); });
        setPhase('off', false);
    };

    bK.onclick = async () => {
        bK.disabled = true;
        await exec(() => { if (window.questkuKill) window.questkuKill(); });
        setPhase('kill', false);
    };
}

refreshState();
