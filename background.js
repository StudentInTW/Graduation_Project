// ⚡ Initialization
const processedMessages = new Set();
const TIME_BUFFER_MS = 100;
const focusedPageReadBuffer = [];
const storeFocusCapturedBuffer = [];
let isForwardingFocusedRead = false;
let isForwardingCapturedText = false;
let hasInjected = {};
let sidebarTabId = null;
let sidebarEnabled = false;
let copy_sidebarid = false;

chrome.storage.local.get(["sidebarEnabled"], (result) => {
  sidebarEnabled = result.sidebarEnabled;
  console.log("🔄 Initial sidebarEnabled state:", sidebarEnabled);
});

function always_make_sure_sidebarEnabled_is_true() {
  if (!sidebarEnabled) {
    sidebarEnabled = true;
    chrome.storage.local.set({ sidebarEnabled: true }, () => {
      console.log("🔄 Restored sidebarEnabled to true");
      console.log("\nI'm from background.js\n");
    });
  }
}

// ✅ Flush utility
function flushFocusedPageReads() {
  if (sidebarTabId && focusedPageReadBuffer.length > 0) {
    console.log(
      `📤 Flushing ${focusedPageReadBuffer.length} focusedPageReads to sidebar`
    );
    chrome.tabs.sendMessage(
      sidebarTabId,
      {
        action: "focusedPageReadBatch",
        messages: focusedPageReadBuffer,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            "❌ Error flushing focusedPageReads:",
            chrome.runtime.lastError.message
          );
          // sidebarTabId = null;
        }
      }
    );
    // Clear after send
    focusedPageReadBuffer.length = 0;

    // 🧹 清理掉老的 messageKey（加這段）
    processedMessages.clear();
  }
}

function flushStoreCapturedTexts() {
  if (sidebarTabId && storeFocusCapturedBuffer.length > 0) {
    const combinedPages = storeFocusCapturedBuffer.reduce(
      (acc, msg) => acc.concat(msg.pages || []),
      []
    );
    console.log(
      `📤 Flushing ${combinedPages.length} storeFocusCapturedText pages to sidebar`
    );
    chrome.tabs.sendMessage(
      sidebarTabId,
      {
        action: "storeFocusCapturedTextBatch",
        pages: combinedPages,
        timestamp: new Date().toISOString(),
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            "❌ Error flushing storeFocusCapturedText:",
            chrome.runtime.lastError.message
          );
          // sidebarTabId = null;
        }
      }
    );
    storeFocusCapturedBuffer.length = 0;
  }
}

chrome.alarms.create("keepAlive", { periodInMinutes: 4.9 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "keepAlive") {
    console.log("💓 Keep-alive ping");
    // 什麼都不用做，只要觸發這個事件就可以防止掛掉
  }
});

function ensureSidebar() {
  return new Promise((resolve) => {
    console.log("🔍 Checking sidebar, current sidebarTabId:", sidebarTabId);

    // Step 1: Check if sidebarTabId exists and is valid
    if (sidebarTabId) {
      chrome.tabs.get(sidebarTabId, (tab) => {
        if (chrome.runtime.lastError || !tab) {
          console.log(
            "⚠️ Sidebar tab not found, error:",
            chrome.runtime.lastError?.message
          );
          sidebarTabId = null; // Reset invalid sidebarTabId
          recoverSidebarTabId(resolve); // Try to recover
        } else {
          console.log("✅ Sidebar tab exists:", sidebarTabId);
          resolve(sidebarTabId);
        }
      });
    } else {
      // Step 2: No sidebarTabId, try to recover
      console.log("⚠️ sidebarTabId is null, attempting to recover...");
      recoverSidebarTabId(resolve);
    }
  });
}

function recoverSidebarTabId(resolve) {
  // Check all windows for an existing sidebar tab
  chrome.windows.getAll({ populate: true }, (windows) => {
    const sidebarTab = windows
      .flatMap((win) => win.tabs || [])
      .find((tab) => tab.url?.includes("sidebar.html"));

    if (sidebarTab) {
      sidebarTabId = sidebarTab.id;
      console.log("✅ Recovered sidebarTabId from existing tab:", sidebarTabId);
      resolve(sidebarTabId);
    } else {
      console.log("⚠️ No sidebar tab found in any window.");
      resolve(null);
    }
  });
}

// chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
//   if (tabId === sidebarTabId) {
//     console.log("⚠️ Sidebar tab closed:", tabId);
//     sidebarTabId = null;
//     sidebarEnabled = false;
//     chrome.storage.local.set({ sidebarEnabled: false }, () => {
//       console.log("🔄 Updated sidebarEnabled to false");
//       // 通知 content.js 禁用高亮
//       chrome.storage.local.get(["openerTabId"], (result) => {
//         const targetTabId = result.openerTabId;
//         if (targetTabId) {
//           chrome.tabs.sendMessage(
//             targetTabId,
//             { action: "disableHighlight" },
//             (response) => {
//               if (chrome.runtime.lastError) {
//                 console.error(
//                   "❌ Failed to sync disableHighlight to content.js:",
//                   chrome.runtime.lastError.message
//                 );
//               } else {
//                 console.log(
//                   "✅ Synced disableHighlight to content.js:",
//                   response
//                 );
//               }
//             }
//           );
//         }
//       });
//     });
//   }
// });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("📩 Background received message:", message);

  if (message.action === "registerSidebarTab") {
    sidebarTabId = sender.tab.id;
    console.log(
      "register sidebar tab is called from background.js line 180\n "
    );
    console.log(
      "message.action === 'registerSidebarTab' ✅ Sidebar tab registered from backgound.js: ",
      sidebarTabId
    );

    // 檢查 sidebarEnabled 並同步到 content.js
    if (sidebarEnabled) {
      chrome.storage.local.get(["openerTabId"], (result) => {
        const targetTabId = result.openerTabId;
        if (targetTabId) {
          chrome.tabs.sendMessage(
            targetTabId,
            { action: "enableHighlight" },
            (response) => {
              if (chrome.runtime.lastError) {
                console.error(
                  "❌ Failed to sync enableHighlight to content.js:",
                  chrome.runtime.lastError.message
                );
              } else {
                console.log(
                  "✅ Synced enableHighlight to content.js:",
                  response
                );
              }
            }
          );
        } else {
          console.warn("⚠️ No openerTabId found, cannot sync enableHighlight.");
        }
      });
    } else {
      console.log("⚠️ Sidebar not enabled, skipping highlight sync.");
    }

    sendResponse({ status: "success" });
    return true;
  }

  if (message.action === "ensureContentScript") {
    always_make_sure_sidebarEnabled_is_true();
    const tabId = message.tabId;
    if (!tabId) {
      console.error("❌ No tabId provided for ensureContentScript");
      sendResponse({ status: "❌ Failed: No tabId provided" });
      return true;
    }

    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError || !tab) {
        console.error(
          `❌ Tab no longer exists for injection: ${tabId}`,
          chrome.runtime.lastError?.message
        );
        sendResponse({ status: `❌ Failed: Tab not found` });
        return true;
      }

      const url = tab.url || "";
      if (
        url.startsWith("chrome://") ||
        url.startsWith("devtools://") ||
        url.startsWith("chrome-extension://") ||
        url.includes("extensions")
      ) {
        console.warn("🛑 Cannot inject into restricted URL:", url);
        sendResponse({ status: `❌ Restricted URL` });
        return true;
      }

      // 只在 archive.org 上注入，避免不必要的嘗試
      if (!url.includes("archive.org")) {
        console.warn("🛑 Injection skipped: Not an archive.org page:", url);
        sendResponse({ status: `❌ Skipped: Not an archive.org page` });
        return true;
      }

      if (hasInjected[tabId]) {
        console.log("🔍 Content.js already injected in tab:", tabId);
        sendResponse({ status: "✅ Content script already injected" });
        return true;
      }

      chrome.scripting
        .executeScript({
          target: { tabId: tabId },
          files: ["content.js"],
        })
        .then(() => {
          console.log(
            "✅ Injected content.js in tab via ensureContentScript:",
            tabId
          );
          hasInjected[tabId] = true;
          sendResponse({ status: "✅ Content script injected" });
        })
        .catch((error) => {
          console.error("❌ Injection error in ensureContentScript:", error);
          sendResponse({ status: `❌ Failed: ${error.message}` });
        });

      return true;
    });

    return true;
  }

  if (message.action === "enableSidebar") {
    always_make_sure_sidebarEnabled_is_true();

    console.log("✅ Sidebar interaction enabled from background.js");
    sendResponse({
      status: "✅ Sidebar enabled I'm opened from background.js",
    });
    return true;
  }

  if (message.action === "pingBackground") {
    always_make_sure_sidebarEnabled_is_true();
    console.log("✅ Background received ping");
    sendResponse({ status: "✅ Background alive" });
    return true;
  }

  console.log("🔍 Processing highlight, sidebarEnabled:", sidebarEnabled);
  if (message.action === "highlight") {
    if (!sidebarEnabled) {
      console.log("⚠️ Sidebar not enabled. Skipping highlight display.");
      sendResponse({ status: "⚠️ Sidebar not enabled" });
      return true;
    }

    ensureSidebar().then((tabId) => {
      if (!tabId) {
        console.error("❌ No valid sidebarTabId available.");
        sendResponse({
          status: "❌ No sidebar available. Please reopen the sidebar.",
        });
        return;
      }

      chrome.tabs.sendMessage(
        tabId, // Use the verified tabId from ensureSidebar
        {
          action: "updateSidebar",
          text: message.text,
          type: message.type,
          explanation: message.explanation,
          metadata: message.metadata,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error(
              "❌ Error forwarding highlight to sidebar:",
              chrome.runtime.lastError.message
            );
            sidebarTabId = null; // Reset to ensure next check
            sendResponse({
              status: `❌ Failed to forward highlight: ${chrome.runtime.lastError.message}.`,
            });
          } else {
            console.log("✅ Highlight forwarded to sidebar:", response);
            sendResponse({ status: "✅ Highlight forwarded to sidebar" });
          }
        }
      );
    });

    return true; // Async response
  }

  if (message.action === "focusedPageRead") {
    const timestampMs = new Date(message.timestamp).getTime();
    const baseUrl = message.pageUrl.split("?")[0];
    const messageKey = `${baseUrl}-${Math.floor(timestampMs / TIME_BUFFER_MS)}`;

    if (processedMessages.has(messageKey)) {
      console.log("⚠️ Skipped duplicate focusedPageRead:", message.pageUrl);
      sendResponse({ status: "⚠️ Skipped duplicate" });
      return true;
    }
    processedMessages.add(messageKey);
    focusedPageReadBuffer.push(message);

    if (!isForwardingFocusedRead) {
      isForwardingFocusedRead = true;
      setTimeout(() => {
        flushFocusedPageReads();
        isForwardingFocusedRead = false;
      }, 300);
    }
    sendResponse({ status: "✅ Buffered focusedPageRead" });
    return true;
  }

  if (message.action === "storeFocusCapturedText") {
    const pagesContent = JSON.stringify(message.pages);
    const messageKey = `${pagesContent}-${Math.floor(
      Date.now() / TIME_BUFFER_MS
    )}`;

    if (processedMessages.has(messageKey)) {
      console.log("⚠️ Skipped duplicate storeFocusCapturedText");
      sendResponse({ status: "⚠️ Skipped duplicate" });
      return true;
    }
    processedMessages.add(messageKey);
    storeFocusCapturedBuffer.push(message);

    if (!isForwardingCapturedText) {
      isForwardingCapturedText = true;
      setTimeout(() => {
        flushStoreCapturedTexts();
        isForwardingCapturedText = false;
      }, 500);
    }
    sendResponse({ status: "✅ Buffered storeFocusCapturedText" });
    return true;
  }

  if (message.action === "makesureenablesidebarworks") {
    always_make_sure_sidebarEnabled_is_true();
  }
});

chrome.webNavigation.onCommitted.addListener((details) => {
  const url = details.url;
  if (
    url.startsWith("chrome://") ||
    url.startsWith("devtools://") ||
    url.startsWith("chrome-extension://") ||
    url.includes("extensions")
  ) {
    console.log("🛑 Skipping injection for restricted URL:", url);
    return;
  }

  chrome.tabs.get(details.tabId, (tab) => {
    if (chrome.runtime.lastError || !tab) {
      console.warn("⚠️ Tab no longer exists for injection:", details.tabId);
      return;
    }

    if (!hasInjected[details.tabId]) {
      chrome.scripting
        .executeScript({
          target: { tabId: details.tabId },
          files: ["content.js"],
        })
        .then(() => {
          console.log("✅ Injected content.js in tab:", details.tabId);
          hasInjected[details.tabId] = true;
        })
        .catch((error) => console.error("❌ Injection error:", error));
    } else {
      console.log("🔍 Content.js already injected in tab:", details.tabId);
    }
  });
  sidebarEnabled = true;
});
