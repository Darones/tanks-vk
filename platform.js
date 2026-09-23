'use strict';
(function(){
  const SAVE_KEY = 'tanks-vk-1';
  const mode = (typeof vkBridge !== 'undefined') ? 'vk' : 'local';
  let vkLang = null;
  let vkReady = false;
  let inited = false;

  async function init(){
    if(mode === 'vk'){
      const timeout = (ms, promise) => Promise.race([
        promise,
        new Promise((_, rej) => setTimeout(() => rej(new Error('vk timeout')), ms))
      ]);
      try{ await timeout(1500, vkBridge.send('VKWebAppInit')); vkReady = true; }catch(e){ console.warn('[Platform] init timeout/fail:', e); }
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

  async function save(dataObj){
    const json = JSON.stringify(dataObj);
    if(json.length > 4000) console.warn('[Platform] Save size', json.length, 'bytes (>4000)');
    if(mode === 'vk'){
      try{ await vkBridge.send('VKWebAppStorageSet', { key: SAVE_KEY, value: json }); }
      catch(e){ console.warn('[Platform] save', e); }
    } else {
      try{ localStorage.setItem(SAVE_KEY, json); }catch(e){}
    }
  }

  async function load(){
    if(mode === 'vk'){
      try{
        const res = await vkBridge.send('VKWebAppStorageGet', { keys: [SAVE_KEY] });
        const v = res && res.keys && res.keys[0] && res.keys[0].value;
        return v ? JSON.parse(v) : null;
      }catch(e){ return null; }
    } else {
      try{ const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; }
      catch(e){ return null; }
    }
  }

  function getLang(){
    if(mode === 'vk' && vkLang) return vkLang;
    return navigator.language || 'ru';
  }

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
    save, load, getLang, onPause, onResume,
    gameplayStart, gameplayStop, rateGame, SAVE_KEY
  };
})();
