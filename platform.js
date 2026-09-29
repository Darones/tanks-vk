'use strict';
(function(){
  const withTimeout = (ms, promise, tag) => Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout:' + tag)), ms))
  ]);
  const SAVE_KEY = 'tanks-vk-1';
  let mode = (typeof vkBridge !== 'undefined') ? 'vk' : 'local';
  let vkLang = null;
  let vkReady = false;
  let inited = false;

  async function init(){
    if(mode === 'vk'){
      const timeout = (ms, promise) => Promise.race([
        promise,
        new Promise((_, rej) => setTimeout(() => rej(new Error('vk timeout')), ms))
      ]);
      try{ await timeout(1500, vkBridge.send('VKWebAppInit')); vkReady = true; }catch(e){ console.warn('[Platform] init timeout/fail:', e); mode = 'local'; }
      try{
        const lp = await timeout(1500, vkBridge.send('VKWebAppGetLaunchParams'));
        if(lp && lp.vk_language) vkLang = lp.vk_language;
      }catch(e){}
    }
    inited = true;
    return true;
  }

  function adsAvailable(){ return mode === 'vk' && inited && vkReady; }

  async function showRewarded(cb){
    if(mode !== 'vk' || !inited){ cb && cb(false); return; }
    try{
      const res = await vkBridge.send('VKWebAppShowNativeAds', { ad_format: 'reward' });
      cb && cb(!!(res && res.result));
    }catch(e){
      const code = (e && e.error_data && e.error_data.error_code) || (e && e.code);
      if(code === 3003) console.warn('[Platform] Ads 3003 — блок не активирован (нужна публикация)');
      else console.warn('[Platform] rewarded error:', e);
      cb && cb(false);
    }
  }

  async function showInterstitial(cb){
    if(mode !== 'vk' || !inited){ cb && cb(); return; }
    try{
      await vkBridge.send('VKWebAppShowNativeAds', { ad_format: 'interstitial' });
    }catch(e){
      const code = (e && e.error_data && e.error_data.error_code) || (e && e.code);
      if(code === 3003) console.warn('[Platform] Ads 3003 — блок не активирован');
      else console.warn('[Platform] interstitial error:', e);
    }
    cb && cb();
  }

  function showOrderBox(itemData, cb){
    cb = cb || function(){};
    if(!(window.vkBridge && typeof isVK === 'function' && isVK())){
      cb(false, {error:'not_vk'}); return;
    }
    const itemId = (typeof itemData === 'string')
      ? itemData
      : (itemData && itemData.id);
    if(!itemId){ cb(false, {error:'missing_item_id'}); return; }
    vkBridge.send('VKWebAppShowOrderBox', { type: 'item', item: itemId })
      .then(res => cb(true, res))
      .catch(err => cb(false, err));
  }

  async function save(dataObj, onResult){
    const json = JSON.stringify(dataObj);
    if(json.length > 4000) console.warn('[Platform] Save size', json.length, 'bytes (>4000)');
    if(mode === 'vk'){
      let ok = false;
      for(let attempt = 1; attempt <= 3 && !ok; attempt++){
        try{
          await withTimeout(3000,
            vkBridge.send('VKWebAppStorageSet', { key: SAVE_KEY, value: json }),
            'save#' + attempt);
          ok = true;
        }catch(e){
          console.warn('[Platform] save attempt', attempt, 'failed:', e);
        }
      }
      if(onResult) onResult(ok);
    } else {
      try{ localStorage.setItem(SAVE_KEY, json); if(onResult) onResult(true); }
      catch(e){ if(onResult) onResult(false); }
    }
  }

  async function load(){
    if(mode === 'vk'){
      try{
        const res = await withTimeout(1500,
          vkBridge.send('VKWebAppStorageGet', { keys: [SAVE_KEY] }),
          'load');
        const v = res && res.keys && res.keys[0] && res.keys[0].value;
        return v ? JSON.parse(v) : null;
      }catch(e){ console.warn('[Platform] load failed:', e); return null; }
    } else {
      try{ const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; }
      catch(e){ return null; }
    }
  }

  function getLang(){
    if(mode === 'vk' && vkLang) return vkLang;
    return navigator.language || 'ru';
  }

  function isVK(){ return mode === 'vk'; }
  function isOK(){ return mode === 'ok'; }

  function onPause(cb){
    document.addEventListener('visibilitychange', ()=>{ if(document.hidden) cb && cb(); });
    if(mode === 'vk'){ try{ vkBridge.subscribe(ev => { if(ev.detail.type === 'VKWebAppViewHide') cb && cb(); }); }catch(e){} }
  }
  function onResume(cb){
    document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) cb && cb(); });
    if(mode === 'vk'){ try{ vkBridge.subscribe(ev => { if(ev.detail.type === 'VKWebAppViewRestore') cb && cb(); }); }catch(e){} }
  }

  function gameplayStart(){ if(mode === 'android'){ /* stub для ЭТАПА 6 */ } }
  function gameplayStop(){ if(mode === 'android'){ /* stub для ЭТАПА 6 */ } }
  function rateGame(){ if(mode === 'android'){ console.log('[Android] rateGame stub'); } }

  window.Platform = {
    mode, init, adsAvailable, showRewarded, showInterstitial,
    save, load, getLang, isVK, isOK, onPause, onResume,
    gameplayStart, gameplayStop, rateGame, SAVE_KEY
  };
  window.Platform.showOrderBox = showOrderBox;
})();
