// content.js (Patch A: 민감도↑ + PNG 전송 + 고해상도 + 보수적 스코어링)

const CFG = {
  endpoint_frame: "http://127.0.0.1:8000/predict_frame",
  endpoint_batch: "http://127.0.0.1:8000/predict_frames",
  // 해상도↑: 입 디테일 보존
  width: 512, height: 512,
  // 배치 설정
  batchSize: 24,            // 24장씩 모아서 전송
  batchIntervalMs: 300,     // 0.3초마다 캡처 → 약 7.2초마다 전송
  // 히스테리시스 완화(민감도↑)
  thOn: 0.45,
  thOff: 0.40
};

function createOverlayBadge(video){
  const wrap = document.createElement('div');
  wrap.className = 'dfg-badge';
  wrap.textContent = '분석 대기';
  Object.assign(wrap.style, {
    position:'absolute', zIndex: 2147483647,
    top: (video.getBoundingClientRect().top + window.scrollY + 12) + 'px',
    left: (video.getBoundingClientRect().left + window.scrollX + 12) + 'px'
  });
  document.body.appendChild(wrap);
  const ro = new ResizeObserver(()=>positionBadge(video, wrap));
  ro.observe(document.body);
  window.addEventListener('scroll', ()=>positionBadge(video, wrap), { passive:true });
  return wrap;
}
function positionBadge(video, badge){
  const r = video.getBoundingClientRect();
  badge.style.top  = (r.top + window.scrollY + 12)+'px';
  badge.style.left = (r.left + window.scrollX + 12)+'px';
}
function ensureModal(){
  let modal = document.querySelector('.dfg-modal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.className='dfg-modal';
  modal.innerHTML = `
    <div class="dfg-modal-inner">
      <h3>⚠️ 딥페이크 의심 감지</h3>
      <p>현재 재생 중인 영상에서 딥페이크 의심 신호가 감지되었습니다.</p>
      <button id="dfgClose">확인</button>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector('#dfgClose').onclick = ()=> modal.style.display='none';
  return modal;
}

// Uint8Array → base64
function u8ToB64(u8){
  let s = ""; for (let i=0;i<u8.length;i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}

async function analyzeVideo(video){
  const badge = createOverlayBadge(video);
  const canvas = document.createElement('canvas');
  canvas.width = CFG.width; canvas.height = CFG.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  let alerted = false;
  let frameBuffer = [];
  let batchTimer = null;

  async function tickBatch(){
    if (video.paused || video.ended) return;
    try {
      // 캡처 → PNG (압축 artefact 최소화)
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(res => canvas.toBlob(res, 'image/png')); // <-- PNG
      const ab = await blob.arrayBuffer();
      frameBuffer.push(new Uint8Array(ab));

      if (frameBuffer.length >= CFG.batchSize){
        // 배치 전송
        const base64s = frameBuffer.map(u8ToB64);
        frameBuffer = [];
        const res = await fetch(CFG.endpoint_batch, {
          method:'POST',
          headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify({ frames: base64s })
        });
        const js = await res.json();

        // 서버가 probs를 제공하면 사용 (프레임별 확률)
        const probs = Array.isArray(js.probs) ? js.probs : [];
        const avg   = (js.fake_prob_avg !== undefined)
          ? js.fake_prob_avg
          : (probs.length ? probs.reduce((a,b)=>a+b,0)/probs.length : 0);

        // 보수적 스코어링: 평균 / 상위 25% 평균 / 피크 중 최댓값
        const sortedDesc = probs.slice().sort((a,b)=>b-a);
        const topK = sortedDesc.slice(0, Math.max(1, Math.floor(probs.length * 0.25)));
        const topMean = topK.length ? topK.reduce((a,b)=>a+b,0)/topK.length : avg;
        const peak = probs.length ? Math.max(...probs) : (js.fake_prob_peak ?? avg);
        const score = Math.max(avg, topMean, peak);

        // 한 프레임이라도 0.65↑면 그 배치는 FAKE로 간주 (민감)
        let batchDecision = (peak >= 0.65 || score >= CFG.thOn) ? "FAKE"
                            : (score <= CFG.thOff ? "REAL" : "REAL");

        // 배지 업데이트
        badge.textContent = `${batchDecision} | avg=${avg.toFixed(3)} | peak=${peak.toFixed(3)}`;
        badge.style.background = batchDecision==='FAKE' ? '#c85055' : '#2e8f59';
        badge.style.color = '#fff';

        // 경고 트리거
        if (batchDecision === "FAKE" && !alerted) {
          alerted = true;
          ensureModal().style.display='block';
          chrome.runtime.sendMessage({
            type: "DEEPFAKE_ALERT",
            payload: { url: location.href, prob: score, title: document.title?.slice(0,60) || 'Video' }
          });
        }
        if (batchDecision === "REAL") alerted = false;

        // 디버깅 로그 (필요시 DevTools 콘솔에서 확인)
        console.debug("[DFG] batch avg:", avg.toFixed(3),
                      "peak:", peak.toFixed(3),
                      "topMean:", topMean.toFixed(3),
                      "score:", score.toFixed(3));
      }
    } catch(e){
      console.error("batch tick error", e);
      badge.textContent = '분석 오류';
      badge.style.background = '#666';
      badge.style.color = '#fff';
    }
  }

  const start = () => {
    if (batchTimer) return;
    batchTimer = setInterval(tickBatch, CFG.batchIntervalMs);
  };
  const stop = () => { clearInterval(batchTimer); batchTimer = null; frameBuffer = []; };

  video.addEventListener('play', start);
  video.addEventListener('pause', stop);
  video.addEventListener('ended', stop);
  if (!video.paused) start();
}

function scanVideos(){
  const vids = Array.from(document.querySelectorAll('video'))
    .filter(v => !v.dataset.dfgHooked);
  vids.forEach(v => { v.dataset.dfgHooked = "1"; analyzeVideo(v); });
}
scanVideos();
const mo = new MutationObserver(()=>scanVideos());
mo.observe(document.documentElement, { childList:true, subtree:true });
