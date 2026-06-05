chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'GOMEGA_CAPTURE_SCREENSHOT') return false;

  const windowId = sender.tab?.windowId;
  chrome.tabs.captureVisibleTab(windowId, { format: 'jpeg', quality: 78 }, (dataUrl) => {
    if (chrome.runtime.lastError) {
      sendResponse({ ok: false, error: chrome.runtime.lastError.message });
      return;
    }
    sendResponse({ ok: true, screenshot: dataUrl });
  });

  return true;
});
