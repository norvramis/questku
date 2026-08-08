// Questku runtime probe — verifikasi 2 perubahan yang paling baru tanpa refactor.
//
// CARA PAKAI:
//   1. Buka Discord Web atau Desktop + DevTools (Ctrl+Shift+I)
//   2. Buka halaman detail quest (quest-home#<questId>) — biar container .contentSection_* ada
//   3. Console: ketik `allow pasting`, Enter
//   4. Paste seluruh isi file ini, Enter
//   5. Kirim outputnya (mesti ada "[Questku Probe]" di console)
//
// Yang dicek:
//   - getDesktopSuperProperties(): discovery webpack match atau ke-fallback btoa?
//   - findClaimButton(qid): container .contentSection_* ketemu? tombol claim ketemu?
//   - findTransitionTo(): cache & discovery si transition SPA masih jalan?

(() => {
    const out = [];
    const log = (k, v) => out.push(k + ': ' + v);

    try {
        if (!location.hostname.endsWith('discord.com')) { log('host', 'BUKAN discord.com - stop'); console.log('[Questku Probe]', out.join('\n')); return; }

        let wpRequire = webpackChunkdiscord_app.push([[Symbol()], {}, r => r]);
        webpackChunkdiscord_app.pop();

        const SuperProps = Object.values(wpRequire.c).find(x => x?.exports?.getSuperProperties)?.exports;
        const DeviceInfo = Object.values(wpRequire.c).find(x => x?.exports?.getDeviceInfo)?.exports;
        log('SuperProps.getSuperProperties exists', !!SuperProps?.getSuperProperties);
        log('DeviceInfo.getSuperProperties exists', !!DeviceInfo?.getSuperProperties);

        let sp = '';
        try { if (SuperProps?.getSuperProperties) sp = SuperProps.getSuperProperties(); } catch (e) { log('SP call SuperProps', e.message); }
        if (!sp) { try { if (DeviceInfo?.getSuperProperties) sp = DeviceInfo.getSuperProperties(); } catch (e) { log('SP call DeviceInfo', e.message); } }
        // Mirrors questku.getDesktopSuperProperties(): getSuperProperties() returns an OBJECT in
        // current builds, so we base64 it (unless it's already a valid base64 JSON string).
        if (sp && typeof sp === 'object') sp = btoa(JSON.stringify(sp));
        log('SP resolved', sp ? 'YES (' + sp.length + ' chars)' : 'NO — pakai fallback btoa (build version palsu)');

        if (sp) {
            try {
                const d = JSON.parse(atob(sp));
                log('SP client_version', d.client_version || 'n/a');
                log('SP client_build_number', d.client_build_number ?? 'n/a');
                log('SP browser', d.browser || 'n/a');
            } catch (e) { log('SP decode', e.message); }
        }

        // findClaimButton(qid) probe — harus jalan di halaman detail quest
        const hash = location.hash;
        log('location.hash', hash || '(tdak ada - apakah di detail quest?)');
        const container = document.querySelector('.contentSection_b6bcee, .contentSection__955a3, [class*="contentSection"]');
        log('container .contentSection_* found', !!container);
        if (container) {
            const visibleBtns = [...container.querySelectorAll('button')].filter(b => b.offsetParent !== null && !b.closest('#questku-panel'));
            log('buttons in container', visibleBtns.length);
            const claimBtn = visibleBtns.find(b => /claim/i.test((b.textContent || '').trim()));
            log('claim button found', !!claimBtn, claimBtn ? ('text="' + claimBtn.textContent.trim() + '"') : '');
        }

        // findTransitionTo probe (cache-able SPA transition)
        const trans = Object.values(Object.values(wpRequire.c)).reduce((a, m) => {
            if (a) return a;
            for (const v of Object.values(m?.exports || {})) {
                if (v && typeof v === 'function' && v.toString().includes('transitionTo - Transitioning to')) return v;
            }
            return a;
        }, null);
        log('findTransitionTo found', !!trans);

        log('isDesktop (Electron UA)', !!navigator.userAgent.includes('Electron'));
    } catch (e) {
        log('probe error', e && e.message || String(e));
    }

    console.log('[Questku Probe]\n' + out.join('\n'));
})();