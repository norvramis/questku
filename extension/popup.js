const statusEl = document.getElementById('q-status');
const injectBtn = document.getElementById('q-inject');
const ftEl = document.getElementById('q-ft');

function findDiscordTab() {
    return new Promise(resolve => {
        chrome.tabs.query({}, tabs => {
            resolve(tabs.find(t => t.url && t.url.includes('discord.com')));
        });
    });
}

async function updateStatus() {
    let tab = await findDiscordTab();
    if (tab) {
        statusEl.textContent = 'Status: Discord detected';
        statusEl.className = 'status ok';
        injectBtn.disabled = false;
        ftEl.textContent = 'Click Questku to inject';
    } else {
        statusEl.textContent = 'Status: Open Discord first';
        statusEl.className = 'status';
        injectBtn.disabled = true;
        ftEl.textContent = 'Open discord.com in your browser';
    }
}

updateStatus();

injectBtn.addEventListener('click', async () => {
    let tab = await findDiscordTab();
    if (!tab) return;

    injectBtn.disabled = true;
    injectBtn.textContent = 'Questku';
    statusEl.textContent = 'Status: Injecting...';
    statusEl.className = 'status';

    try {
        await chrome.tabs.update(tab.id, { active: true });
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['questku.js'],
            world: 'MAIN'
        });
        statusEl.textContent = 'Status: Questku running';
        statusEl.className = 'status ok';
        injectBtn.textContent = 'Questku';
        ftEl.textContent = 'Dashboard should appear on Discord';
    } catch (e) {
        statusEl.textContent = 'Status: Error - ' + e.message;
        statusEl.className = 'status err';
        injectBtn.textContent = 'Questku';
        injectBtn.disabled = false;
    }
});
