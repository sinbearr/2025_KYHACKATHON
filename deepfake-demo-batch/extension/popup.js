
const el = id => document.getElementById(id);
function load(){
  chrome.storage.local.get({ cfg: { thOn:0.48, thOff:0.42, batchSize:20, batchIntervalMs:400 }, logs:[] }, ({cfg, logs})=>{
    el('thOn').value = cfg.thOn; el('thOff').value = cfg.thOff;
    el('batchSize').value = cfg.batchSize; el('batchIntervalMs').value = cfg.batchIntervalMs;
    const ul = el('logs'); ul.innerHTML = '';
    logs.slice(0,10).forEach(x=>{
      const li = document.createElement('li');
      const d = new Date(x.ts).toLocaleString();
      li.textContent = `[${d}] ${(x.prob*100).toFixed(1)}% - ${x.url}`;
      ul.appendChild(li);
    });
  });
}
el('save').onclick = ()=>{
  const cfg = {
    thOn: Number(el('thOn').value),
    thOff: Number(el('thOff').value),
    batchSize: Number(el('batchSize').value),
    batchIntervalMs: Number(el('batchIntervalMs').value)
  };
  chrome.storage.local.set({ cfg }, load);
};
document.addEventListener('DOMContentLoaded', load);
