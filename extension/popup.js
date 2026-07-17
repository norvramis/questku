const btn = document.getElementById('qk-action');
const stEl = document.getElementById('qk-status');

async function findDiscordTab() {
  return new Promise(r => {
    chrome.tabs.query({}, tabs => {
      r(tabs.find(t => t.url && t.url.includes('discord.com')));
    });
  });
}

async function checkDashboardActive(tabId) {
  try {
    let results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => typeof D !== 'undefined' && D !== null && !!document.getElementById('questku-panel')
    });
    return results?.[0]?.result === true;
  } catch {
    return false;
  }
}

function setState(label, btnText, btnClass, btnAction) {
  stEl.textContent = label;
  btn.textContent = btnText;
  btn.className = 'qk-bb ' + btnClass;
  btn.disabled = false;
  btn.onclick = btnAction;
}

async function updateUI() {
  let tab = await findDiscordTab();

  if (!tab) {
    setState('Discord not detected', 'Open Discord', '', () => {
      chrome.tabs.create({ url: 'https://discord.com/app' });
      window.close();
    });
    return;
  }

  let active = await checkDashboardActive(tab.id);

  if (active) {
    setState('Questku is running', 'Focus Dashboard', 'act', () => {
      chrome.tabs.update(tab.id, { active: true });
      window.close();
    });
  } else {
    setState('Discord detected', 'Open Dashboard', 'act', async () => {
      btn.disabled = true;
      btn.textContent = 'Opening...';
      try {
        await chrome.tabs.update(tab.id, { active: true });
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['questku.js'],
          world: 'MAIN'
        });
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            try {
              let h = Object.values(webpackChunkdiscord_app.push([[Symbol()], {}, r => r]));
              webpackChunkdiscord_app.pop();
              let router = Object.values(h).find(m => m?.exports?.default?.push && !m?.exports?.default?.transitionToRouter)?.exports?.default;
              if (router) router.push('/quests');
            } catch {}
          },
          world: 'MAIN'
        });
        window.close();
      } catch {
        btn.disabled = false;
        btn.textContent = 'Open Dashboard';
        stEl.textContent = 'Error - try again';
      }
    });
  }
}

updateUI();
