(() => {
  // Prevent script execution on Chrome internal pages
  if (
    window.location.protocol === "chrome:" ||
    window.location.protocol === "devtools:" ||
    window.location.protocol === "chrome-extension:"
  ) {
    console.warn("⚠️ Content script blocked on internal Chrome pages.");
    return;
  }

  console.log("✅ Content script running on", window.location.href);

  let selectionTimeout;
  let lastSelectedText = "";
  let capturedPages = [];
  let isMonitoring = false;
  const DEBOUNCE_MS = 500;
  let lastSent = 0;
  const seenPageContents = new Set();
  let enableHighlightClassification = false;
  // 檢查擴展上下文是否有效
  function isExtensionContextValid() {
    return chrome && chrome.runtime && chrome.runtime.id;
  }

  // 合併事件監聽器，確保只註冊一次
  function registerMessageListener() {
    if (window.messageListenerRegistered) {
      console.log("⚠️ Message listener already registered, skipping...");
      return;
    }

    console.log("📌 Registering content.js message listener...");
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      console.log("📩 Content.js received message:", msg.action);

      if (msg.action === "enableHighlight") {
        enableHighlightClassification = true;
        console.log("✅ Enabled highlight classification");
        sendResponse({ status: "✅ Highlight enabled" });
        return true;
      }

      if (msg.action === "disableHighlight") {
        enableHighlightClassification = false;
        console.log("⚫️ Disabled highlight classification");
        sendResponse({ status: "✅ Highlight disabled" });
        return true;
      }

      if (msg.action === "pingContentScript") {
        console.log("✅ Content script received ping");
        sendResponse({ status: "✅ Content script alive" });
        return true;
      } else if (msg.action === "startFocusMonitor") {
        console.log("startFocusMonitor");
        if (!isMonitoring) {
          capturedPages = [];
          seenPageContents.clear();
          isMonitoring = true;
          monitorArchiveOrgPages();
          sendResponse({ status: "✅ Started focus monitoring" });
        } else {
          sendResponse({ status: "⚡ Focus monitoring already started" });
        }
        return true;
      } else if (msg.action === "stopFocusMonitor") {
        console.log("✅ Received stopFocusMonitor message");
        if (!isMonitoring) {
          sendResponse({ status: "⚡ Focus monitoring not active" });
          return true;
        }

        const now = Date.now();
        if (now - lastSent < DEBOUNCE_MS) {
          console.log("⚡ Debounced stopFocusMonitor call");
          sendResponse({ status: "⚡ Debounced stop request" });
          return true;
        }
        lastSent = now;

        isMonitoring = false;
        console.log(
          "📕 Stopped focus monitor. Captured:",
          capturedPages.length,
          "pages"
        );

        if (capturedPages.length > 0) {
          if (isExtensionContextValid()) {
            chrome.runtime.sendMessage({
              action: "storeFocusCapturedText",
              pages: capturedPages.map((p) => p.text),
            });
          } else {
            console.error(
              "❌ Cannot send captured pages: Extension context invalidated."
            );
          }
        } else {
          console.log("⚡ No pages captured to send");
        }

        capturedPages = [];
        seenPageContents.clear();
        sendResponse({ status: "✅ Stopped focus monitoring" });
        return true;
      }
    });

    console.log("✅ Message listener registered");
    window.messageListenerRegistered = true;
  }

  // 初始化監聽器
  registerMessageListener();

  function handleSelection() {
    if (!enableHighlightClassification) {
      // console.log("⚠️ Highlight classification disabled, skipping...");
      return;
    }
    clearTimeout(selectionTimeout);

    selectionTimeout = setTimeout(() => {
      let selectedText = extractSelectedBRText();

      if (selectedText.length > 0 && selectedText !== lastSelectedText) {
        lastSelectedText = selectedText;
        console.log("✅ Final selection detected!");
        console.log("📝 Extracted text:", selectedText);

        classifyTextWithGPT(selectedText);
      }
    }, 1000);
  }

  if (!window.selectionListenerAdded) {
    console.log("🔍 Selection change detected.");
    document.addEventListener("selectionchange", handleSelection);
    window.selectionListenerAdded = true;
  }

  async function classifyTextWithGPT(text) {
    const trimmedText = text.trim();

    try {
      const response = await fetch("http://localhost:3000/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmedText }),
      });

      if (!response.ok) {
        throw new Error(`HTTP Error! Status: ${response.status}`);
      }

      const data = await response.json();
      console.log("✅ GPT Classification:", data);

      if (!isExtensionContextValid()) {
        console.error(
          "❌ Extension context invalidated. Please reload the extension."
        );
        alert(
          "Extension context invalidated. Please reload the extension from chrome://extensions/."
        );
        return;
      }

      try {
        const highlightResponse = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(
            {
              action: "highlight",
              text: trimmedText,
              type: data.type,
              explanation: data.explanation || "⏳ Fetching additional info...",
              metadata: { timestamp: new Date().toISOString() },
            },
            (response) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(response);
              }
            }
          );
        });

        if (
          highlightResponse.status.includes("⚠️") ||
          highlightResponse.status.includes("❌")
        ) {
          console.warn("⚠️ Highlight failed:", highlightResponse.status);
          alert(
            "Highlight failed: " +
              highlightResponse.status +
              "\nPlease try again or reopen the sidebar."
          );
        }
      } catch (err) {
        console.error("❌ Failed to send highlight message:", err);
        alert(
          "Failed to highlight text. Please try again or reopen the sidebar."
        );
      }
    } catch (error) {
      console.error("❌ GPT classification fetch error!!!:", error);
      if (isExtensionContextValid()) {
        const errorResponse = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(
            {
              action: "highlight",
              text: trimmedText,
              type: "Unknown",
              explanation: "⚠️ Failed to classify the text.",
              metadata: {
                confidence: null,
                processingStatus: "error",
                timestamp: new Date().toISOString(),
              },
            },
            (response) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(response);
              }
            }
          );
        });

        if (
          errorResponse.status.includes("⚠️") ||
          errorResponse.status.includes("❌")
        ) {
          // console.warn("⚠️ Highlight failed:", errorResponse.status);
          // alert(errorResponse.status);
        }
      } else {
        console.error(
          "❌ Cannot send error message: Extension context invalidated."
        );
        alert(
          "Extension context invalidated. Please reload the extension from chrome://extensions/."
        );
      }
    }
  }

  function extractSelectedBRText() {
    let selection = window.getSelection();
    if (!selection.rangeCount || selection.toString().trim() === "") return "";

    let range = selection.getRangeAt(0);
    let container = range.commonAncestorContainer;
    let parentElement =
      container.nodeType === 3 ? container.parentElement : container;

    if (!parentElement) return "";

    if (parentElement.classList.contains("BRwordElement")) {
      return parentElement.textContent.trim();
    }

    let selectedElements = parentElement.querySelectorAll(".BRwordElement");

    let words = Array.from(selectedElements)
      .filter((el) => selection.containsNode(el, true))
      .map((span) => span.textContent.trim());

    return words.join(" ");
  }

  function monitorArchiveOrgPages() {
    if (!isMonitoring) return;

    const pageText = document.body.innerText || "";
    if (pageText) {
      const normalizedText = pageText.replace(/\s+/g, " ").trim();

      if (!seenPageContents.has(normalizedText)) {
        seenPageContents.add(normalizedText);

        capturedPages.push({
          text: normalizedText,
          url: window.location.href,
        });

        if (isExtensionContextValid()) {
          chrome.runtime.sendMessage({
            action: "focusedPageRead",
            text: normalizedText,
            pageUrl: window.location.href,
            timestamp: new Date().toISOString(),
          });
        } else {
          console.error(
            "❌ Cannot send focused page read: Extension context invalidated."
          );
        }
      }
    }

    setTimeout(monitorArchiveOrgPages, 5000);
  }
})();
