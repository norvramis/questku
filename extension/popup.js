const injectBtn = document.getElementById('q-inject');
const ftEl = document.querySelector('.ft');

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
        injectBtn.style.display = 'block';
        ftEl.textContent = 'Click Questku to inject';
    } else {
        injectBtn.style.display = 'none';
        ftEl.textContent = 'Open discord.com in your browser';
    }
}

updateStatus();

injectBtn.addEventListener('click', async () => {
    let tab = await findDiscordTab();
    if (!tab) return;

    injectBtn.disabled = true;
    injectBtn.textContent = 'Questku';

    try {
        await chrome.tabs.update(tab.id, { active: true });
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['questku.js'],
            world: 'MAIN'
        });
        injectBtn.textContent = 'Questku';
        ftEl.textContent = 'Questku injected';
    } catch (e) {
        injectBtn.textContent = 'Questku';
        injectBtn.disabled = false;
        ftEl.textContent = 'Error - refresh Discord';
    }
});
