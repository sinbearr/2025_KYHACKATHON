
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "DEEPFAKE_ALERT") {
    const { url, prob, title } = msg.payload;
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/128.png",
      title: "⚠️ 딥페이크 의심 감지",
      message: `${title || '동영상'} | 평균 확률: ${(prob*100).toFixed(1)}%`
    });
    chrome.action.setBadgeText({ text: "FAKE" });
    chrome.action.setBadgeBackgroundColor({ color: "#c85055" });
    chrome.storage.local.get({ logs: [] }, ({ logs }) => {
      logs.unshift({ ts: Date.now(), url, prob });
      chrome.storage.local.set({ logs: logs.slice(0,50) });
    });
    sendResponse({ ok: true });
  }
});
