// Core reward helpers - single source of truth, injected into questku.js by
// scripts/build.js under a CJS shim. Requirable directly by node:test.
//
// Kept signature-compatible with the legacy in-file versions:
//   getRewardTypes(q)            pure
//   getOrbValue(rewards, premiumType)   premiumType passed in (was closure userPremiumType)
//   getRewardHtml(q, {premiumType, nitroBadge})

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

function getOrbValue(rewards, premiumType) {
    let r = rewards?.[0];
    if (!r) return 0;
    if (premiumType >= 2 && r.premiumOrbQuantity) return r.premiumOrbQuantity;
    return r.orbQuantity || r.amount || 0;
}

function getRewardHtml(q, opts) {
    const premiumType = (opts && opts.premiumType) || 0;
    const nitroBadge = (opts && opts.nitroBadge) || '';
    let rewards = q.config.rewardsConfig?.rewards || [];
    let parts = [];
    for (let r of rewards) {
        let found = false;
        if (r.type === 4 || r.orbQuantity || r.amount || r.premiumOrbQuantity) {
            let val = (premiumType >= 2 && r.premiumOrbQuantity) ? r.premiumOrbQuantity : (r.orbQuantity || r.amount || 0);
            let h = (premiumType >= 2 && r.premiumOrbQuantity) ? val + ' Orbs' : (r.messages?.name || val + ' Orbs');
            if (premiumType >= 2 && r.premiumOrbQuantity) h += ' <img class="qk-nitro-badge" src="' + nitroBadge + '">';
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

module.exports = { getRewardTypes, getOrbValue, getRewardHtml };