(() => {
  if (window.sidebarRegistered) return;
  window.sidebarRegistered = true;

  // 👇 其餘 sidebar.js 的初始化邏輯繼續寫在這裡
  console.log("✅ Sidebar script started");
})();

// 📚 Focused Learning Mode state
let isFocusedMode = false;
let focusedSessionRecords = [];
let focusPageReadings = [];
let focusTimer = null;
let focusModeStartTime = null;
let capturedPages = []; // Already exists in sidebar.js
let isStoppingFocus = false;
const processedBatchTimestamps = new Set();
let currentBook = null;
let fuck = 0;
// Add this utility function at the top of sidebar.js
function deduplicatePages(pages) {
  const seen = new Set();
  return pages.filter((page) => {
    if (seen.has(page)) {
      return false; // Skip duplicates
    }
    seen.add(page);
    return true;
  });
}
async function summarizePagesWithRetry(pages, retries = 3, delay = 1000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch("http://localhost:3000/summarizePages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pages }),
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      const data = await response.json();
      console.log("📩 Received summaries data:", data);
      return data;
    } catch (error) {
      console.error(`❌ Attempt ${attempt}/${retries} failed:`, error);
      if (attempt === retries) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

let remainingSeconds = 25 * 60;
// Helper function to ensure content script is injected with retries
async function ensureContentScriptWithRetry(
  tabId,
  retries = 3,
  delayMs = 1000
) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Fetch tab information
      const tab = await new Promise((resolve, reject) => {
        chrome.tabs.get(tabId, (t) => {
          if (chrome.runtime.lastError || !t) {
            reject(new Error("Tab no longer exists"));
          } else {
            resolve(t);
          }
        });
      });

      // Validate tab and URL
      if (!tab || !tab.url) {
        throw new Error("Tab or tab URL is undefined");
      }

      const url = tab.url;
      if (
        url.startsWith("chrome://") ||
        url.startsWith("edge://") ||
        url.startsWith("devtools://") ||
        url.startsWith("chrome-extension://")
      ) {
        console.log(`🛑 Skipping injection for restricted URL: ${url}`);
        throw new Error(`Cannot access contents of url "${url}".`);
      }

      // Attempt to ensure content script
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { action: "ensureContentScript", tabId },
          (resp) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(resp);
            }
          }
        );

        // chrome.runtime.sendMessage(
        //   { action: "makesureenablesidebarworks", tabId },
        //   (resp) => {
        //     if (chrome.runtime.lastError) {
        //       reject(chrome.runtime.lastError);
        //     } else {
        //       resolve(resp);
        //     }
        //   }
        // );
      });

      console.log("🔍 ensureContentScript response:", response);
      if (
        response &&
        typeof response.status === "string" &&
        response.status.includes("✅")
      ) {
        return true;
      } else {
        throw new Error(
          response?.status || "Unknown ensureContentScript failure"
        );
      }
    } catch (error) {
      console.error(
        `❌ Attempt ${attempt}/${retries} failed to inject content script:`,
        error.message
      );
      if (attempt === retries) {
        // Update UI to inform the user
        const statusDiv = document.getElementById("focus-mode-status");
        if (statusDiv) {
          statusDiv.innerHTML = `<p style="color: red;">Failed to initialize Focus Mode after ${retries} attempts: ${error.message}</p>`;
        } else {
          console.warn(
            "⚠️ focus-mode-status element not found, creating it..."
          );
          const newStatusDiv = document.createElement("div");
          newStatusDiv.id = "focus-mode-status";
          newStatusDiv.innerHTML = `<p style="color: red;">Failed to initialize Focus Mode after ${retries} attempts: ${error.message}</p>`;
          document.body.appendChild(newStatusDiv);
        }
        throw new Error(`Failed to initialize Focus Mode: ${error.message}`);
      }
      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return false;
}

// Store the ID of the tab that opened the sidebar
let targetTabId = null;
// ✅ Start Focused Learning Mode
const TIME_BUFFER_MS = 100; // Treat messages within 100ms as duplicates

// Track highlights for the current session
const sessionId = Date.now().toString(); // Unique ID for the current session
let currentSessionHighlights = []; // Highlights for the current session only

// Track processed messages to avoid duplicates
const processedMessages = new Set();

// Register the sidebar tab with background.js
window.addEventListener("DOMContentLoaded", () => {
  // Register this tab as the sidebar

  chrome.runtime.sendMessage({ action: "registerSidebarTab" }, (response) => {
    console.log(
      "✅ Sidebar tab registration from sidebar.js response:",
      response
    );
  });
  //make sure sidebar works
  chrome.runtime.sendMessage(
    { action: "makesureenablesidebarworks" },
    (resp) => {
      if (chrome.runtime.lastError) {
        // reject(chrome.runtime.lastError);
      } else {
        resolve(resp);
      }
    }
  );
  // 獲取 targetTabId
  chrome.storage.local.get(["openerTabId"], (result) => {
    fuck = 1;
    if (result.openerTabId) {
      targetTabId = result.openerTabId;
      console.log("✅ Set targetTabId to openerTabId:", targetTabId);

      // 確保 content.js 已注入
      chrome.runtime.sendMessage(
        { action: "ensureContentScript", tabId: targetTabId },
        (response) => {
          console.log("🔍 ensureContentScript response:", response);
          if (response && response.status && response.status.includes("✅")) {
            // 重試機制：每隔 500ms 檢查 content.js 是否準備好
            chrome.runtime.sendMessage(
              { action: "registerSidebarTab" },
              (regResponse) => {
                console.log(
                  "✅ Sidebar tab registration response:",
                  regResponse
                );
              }
            );
          } else {
            console.error(
              "❌ Failed to ensure content script:",
              response ? response.status : "No response"
            );
          }
        }
      );
    } else {
      console.error("❌ No openerTabId found.");
    }
  });

  const focusBtn = document.getElementById("toggleFocusMode");

  focusBtn.addEventListener("click", () => {
    if (isFocusedMode) {
      endFocusedLearning();
      focusBtn.querySelector(".original").textContent = "⏱️ Start Focus Mode";
    } else {
      startFocusedLearning();
      focusBtn.querySelector(".original").textContent = "🛑 End Focus Mode";
    }
  });

  // Load highlights for the current session (initially empty)
  renderCurrentSessionHighlights();

  // Dark Mode Toggle
  const toggleDarkModeBtn = document.getElementById("toggleDarkModeBtn");
  if (toggleDarkModeBtn) {
    toggleDarkModeBtn.addEventListener("click", () => {
      document.body.classList.toggle("dark-mode");
    });
  } else {
    console.warn("⚠️ toggleDarkMode button not found.");
  }

  // Review Highlights Button
  const reviewHighlightsBtn = document.getElementById("reviewHighlightsBtn");
  if (reviewHighlightsBtn) {
    reviewHighlightsBtn.addEventListener("click", () => {
      chrome.runtime.getPackageDirectoryEntry((root) => {
        root.getFile(
          "review.html",
          {},
          () => {
            chrome.tabs.create({ url: "review.html" });
          },
          () => {
            console.error("❌ review.html not found in extension directory.");
            alert(
              "Review page not found. Please ensure review.html exists in the extension."
            );
          }
        );
      });
    });
  } else {
    console.warn("⚠️ reviewHighlights button not found.");
  }

  // Clear Highlights Button
  const clearHighlightsBtn = document.getElementById("clearHighlightsBtn");
  clearHighlightsBtn.addEventListener("click", () => {
    // 1️⃣ 清除 Highlight 區塊
    const highlightList = document.getElementById("highlighted-list");
    if (highlightList) highlightList.innerHTML = "";
    currentSessionHighlights = [];
    chrome.storage.local.set({ learningRecords: [] }, () => {
      console.log("✅ All highlights cleared from storage.");
    });

    // 2️⃣ 清除 Mermaid 邏輯圖
    const summaryContainer = document.getElementById("summaryContainer");
    if (summaryContainer) {
      const logicMaps = summaryContainer.querySelectorAll(".logic-map");
      logicMaps.forEach((node) => node.remove());
      console.log("🧼 Cleared all logic maps from summary container.");
    }

    // 3️⃣ 清除 Follow-up 回應
    const followUpResponse = document.getElementById("followUpResponse");
    if (followUpResponse) {
      followUpResponse.innerHTML = "";
      console.log("🧽 Cleared follow-up response.");
    }
  });

  // Follow-Up Question Feature
  const followUpButton = document.getElementById("followUpButton");
  if (followUpButton) {
    followUpButton.addEventListener("click", () => {
      const questionInput = document.getElementById("followUpInput");
      const followUpResponse = document.getElementById("followUpResponse");

      if (!questionInput || !followUpResponse) {
        console.error(
          "❌ followUpInput or followUpResponse element not found."
        );
        return;
      }

      const question = questionInput.value.trim();
      if (!question) {
        alert("Please enter a follow-up question.");
        return;
      }

      // 提取最近 3 筆查詢紀錄作為上下文
      const recentHighlights = currentSessionHighlights.slice(-3); // 取最後 3 筆
      let context = recentHighlights
        .map((highlight, index) => {
          return `Record ${index + 1}:\nType: ${highlight.type}\nText: "${
            highlight.text
          }"\nExplanation: ${highlight.explanation}`;
        })
        .join("\n\n");

      if (!context) {
        context = "No recent highlights available.";
      }

      fetch("http://localhost:3000/followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, context }),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.error) {
            throw new Error(data.error);
          }
          followUpResponse.innerHTML = `<p><strong>Q:</strong> ${question}</p><p><strong>A:</strong> ${data.answer}</p>`;
          questionInput.value = "";

          // 儲存 Follow-up 紀錄
          const followUpRecord = {
            type: "Follow-up",
            text: question,
            explanation: data.answer,
            interaction: "follow-up",
            timestamp: new Date().toISOString(),
          };
          // currentSessionHighlights.push(followUpRecord);

          if (currentBook) {
            chrome.storage.local.get(["books"], (result) => {
              const books = result.books || [];
              const bookIndex = books.findIndex(
                (book) => book.id === currentBook.id
              );
              if (bookIndex !== -1) {
                books[bookIndex].records.push(followUpRecord);
                books[bookIndex].updatedAt = new Date().toISOString();
                chrome.storage.local.set({ books }, () => {
                  console.log(
                    "✅ Saved follow-up record to book:",
                    currentBook.title
                  );
                });
              }
            });
          }
          renderCurrentSessionHighlights();
        })
        .catch((error) => {
          console.error("❌ Error processing follow-up question:", error);
          followUpResponse.innerHTML = `<p><strong>Error:</strong> ${error.message}</p>`;
        });
    });
  } else {
    console.warn("⚠️ followUpButton not found.");
  }

  // 載入時檢查 currentBookId 並顯示書籍資訊
  chrome.storage.local.get(
    ["currentBookId", "books", "openerTabId"],
    (result) => {
      fuck = 1;
      const currentBookId = result.currentBookId;
      const books = result.books || [];
      targetTabId = result.openerTabId;

      const currentBookInfo = document.getElementById("currentBookInfo");
      const noRecordModeWarning = document.getElementById(
        "noRecordModeWarning"
      );

      if (currentBookId) {
        currentBook = books.find((book) => book.id === currentBookId);
        if (currentBook) {
          currentBookInfo.textContent = `You are reading ：${currentBook.title} by ${currentBook.author}`;
          noRecordModeWarning.style.display = "none"; // 確保警告隱藏
        } else {
          currentBookInfo.textContent =
            "⚠️ Book not found, please choose another one！";
          noRecordModeWarning.style.display = "none";
        }
      } else {
        currentBookInfo.textContent = "No recording modeyyy";
        noRecordModeWarning.style.display = "block"; // 顯示警告
      }
    }
  );
});

function renderCurrentSessionHighlights() {
  let highlightList = document.getElementById("highlighted-list");
  if (!highlightList) {
    console.log("⚠️ highlightList element not found, creating it...");
    highlightList = document.createElement("div");
    highlightList.id = "highlighted-list";
    document.body.appendChild(highlightList);
  }

  const parentElement = highlightList.parentElement;
  if (parentElement) {
    parentElement.style.display = "block";
    parentElement.style.minHeight = "200px";
    parentElement.style.width = "100%";
    console.log("✅ Parent element styles set:", parentElement);
  }

  highlightList.style.display = "block";
  highlightList.innerHTML = "";
  console.log(
    "🔄 Rendering currentSessionHighlights:",
    currentSessionHighlights
  );

  currentSessionHighlights.forEach((record, index) => {
    let existingEntry = Array.from(highlightList.children).find(
      (item) => item.dataset.text === record.text
    );

    if (!existingEntry) {
      console.log(`📌 Rendering highlight ${index + 1}: ${record.text}`);
      let highlightItem = document.createElement("div");
      highlightItem.classList.add("highlight-item");
      highlightItem.dataset.text = record.text;
      highlightItem.style.display = "block";

      // Create inner HTML
      highlightItem.innerHTML = `
        <span class="highlight-label">${record.type}</span>
        <p class="highlight-text">${record.text}</p>
        <div class="highlight-explanation">
          ${record.explanation || "⏳ Fetching..."}</div>
          ${
            record.expandedExplanation
              ? `<div style="margin-top: 6px;"><strong>Expanded:</strong> ${record.expandedExplanation}</div>`
              : ""
          }
        </div>
        <div class="highlight-buttons">
          <button class="listen-btn">🔊 Listen</button>
          <button class="expand-btn">🔍 Expand</button>
        </div>
      `;

      highlightList.appendChild(highlightItem);

      // 🔊 Listen button
      const listenButton = highlightItem.querySelector(".listen-btn");
      listenButton.addEventListener("click", () => {
        const explanationText = highlightItem.querySelector(
          ".highlight-explanation"
        ).innerText;
        handleTTS(explanationText);
      });

      // 🔍 Expand button
      const expandButton = highlightItem.querySelector(".expand-btn");
      expandButton.addEventListener("click", async () => {
        const expandedExplanation = await expandExplanation(record.text);

        // ✅ 可選：僅儲存，不顯示
        chrome.storage.local.get(["learningRecords"], (result) => {
          let records = result.learningRecords || [];
          const recordIndex = records.findIndex(
            (r) => r.text === record.text && r.sessionId === sessionId
          );
          if (recordIndex !== -1) {
            records[recordIndex].expandedExplanation = expandedExplanation;
            chrome.storage.local.set({ learningRecords: records }, () => {
              console.log("✅ Stored expanded explanation (not displayed).");
            });
          }
        });

        const sessionRecordIndex = currentSessionHighlights.findIndex(
          (r) => r.text === record.text
        );
        if (sessionRecordIndex !== -1) {
          currentSessionHighlights[sessionRecordIndex].expandedExplanation =
            expandedExplanation;
        }
      });
    } else {
      console.log(`⚠️ Highlight already exists in UI: ${record.text}`);
    }
  });

  console.log(
    "✅ Finished rendering. UI children:",
    highlightList.children.length
  );
}

// ✅ Update Countdown Display
function updateCountdownUI() {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  document.getElementById("timerDisplay").textContent = `${minutes}:${
    seconds < 10 ? "0" : ""
  }${seconds}`;
}

async function startFocusedLearning() {
  console.log("🔍 Starting Focus Mode with targetTabId:", targetTabId);
  if (isFocusedMode) {
    console.log("⚠️ Focus Mode already active");
    return;
  }

  if (!targetTabId) {
    console.error("❌ No target tab identified for focus mode.");
    alert(
      "No suitable tab found for focus mode. Please open archive.org and try again."
    );
    updateFocusButtonLabel("⏱️ Start Focus Mode");

    return;
  }

  try {
    // Get tab info
    let tab = await new Promise((resolve, reject) => {
      chrome.tabs.get(targetTabId, (resultTab) => {
        if (chrome.runtime.lastError || !resultTab) {
          reject(new Error("Tab no longer exists"));
        } else {
          resolve(resultTab);
        }
      });
    });

    if (!tab || !tab.url) throw new Error("Tab or tab URL is undefined");

    const url = tab.url;
    if (
      url.startsWith("chrome://") ||
      url.startsWith("edge://") ||
      url.startsWith("devtools://") ||
      url.startsWith("chrome-extension://") ||
      url.includes("extensions")
    ) {
      alert(
        "Focus mode cannot be started on this page. Please use archive.org."
      );
      updateFocusButtonLabel("⏱️ Start Focus Mode");
      return;
    }

    // Wait until tab is fully loaded, with a maximum of 20 retries (10 seconds)
    let retries = 20;
    while (tab.status !== "complete" && retries-- > 0) {
      await new Promise((res) => setTimeout(res, 500));
      tab = await new Promise((resolve, reject) => {
        chrome.tabs.get(targetTabId, (uTab) => {
          if (chrome.runtime.lastError || !uTab)
            reject(new Error("Tab no longer exists during load check"));
          else resolve(uTab);
        });
      });
    }

    // Inject content script and check if it's alive
    await ensureContentScriptWithRetry(targetTabId, 3, 1000);
    const pingResponse = await pingContentScriptWithRetry(targetTabId, 3, 1000);
    console.log("🔍 Ping response:", pingResponse);
    if (!pingResponse || pingResponse.status !== "✅ Content script alive")
      throw new Error("Content script not responsive");

    // Start focus monitor
    const response = await sendStartFocusMonitorWithRetry(targetTabId, 3, 2000);
    if (
      !response ||
      (!response.status.startsWith("✅") && !response.status.startsWith("⚠️"))
    ) {
      throw new Error("Failed to start focus monitoring");
    }

    // Initialize focus mode state
    isFocusedMode = true;
    focusedSessionRecords = [];
    focusPageReadings = [];
    focusModeStartTime = Date.now();
    remainingSeconds = 25 * 60;

    document.getElementById("focusTimer").style.display = "block";
    updateFocusButtonLabel("🛑 End Focus Mode");

    if (focusTimer) {
      clearInterval(focusTimer);
      focusTimer = null;
    }

    focusTimer = setInterval(() => {
      remainingSeconds--;
      updateCountdownUI();
      if (remainingSeconds <= 0) {
        clearInterval(focusTimer);
        focusTimer = null;
        endFocusedLearning();
        updateFocusButtonLabel("⏱️ Start Focus Mode");
      }
    }, 1000);
  } catch (error) {
    console.error("❌ Failed to start Focus Mode:", {
      message: error.message,
      stack: error.stack,
      step: error.step || "unknown",
      targetTabId,
    });
    isFocusedMode = false;
    clearInterval(focusTimer);

    updateFocusButtonLabel("⏱️ Start Focus Mode");

    const statusDiv =
      document.getElementById("focus-mode-status") ||
      (() => {
        const el = document.createElement("div");
        el.id = "focus-mode-status";
        document.body.appendChild(el);
        return el;
      })();
    statusDiv.innerHTML = `<p style="color: red;">Failed to start Focus Mode: ${error.message}</p>`;
  }
}

function toggleDarkMode() {
  document.body.classList.toggle("dark-mode");
}

// Ping content script to verify responsiveness
async function pingContentScriptWithRetry(tabId, retries = 3, delayMs = 1000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(
          tabId,
          { action: "pingContentScript" },
          (resp) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(resp);
            }
          }
        );
      });
      console.log(`✅ Ping attempt ${attempt}/${retries} succeeded:`, response);
      return response;
    } catch (error) {
      console.error(
        `❌ Ping attempt ${attempt}/${retries} failed:`,
        error.message
      );
      if (attempt === retries) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

// Send startFocusMonitor with retries
async function sendStartFocusMonitorWithRetry(
  tabId,
  retries = 3,
  delayMs = 2000
) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(
          tabId,
          { action: "startFocusMonitor" },
          (resp) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(resp);
            }
          }
        );
      });
      console.log(
        `✅ StartFocusMonitor attempt ${attempt}/${retries} succeeded:`,
        response
      );
      return response;
    } catch (error) {
      console.error(
        `❌ StartFocusMonitor attempt ${attempt}/${retries} failed:`,
        error.message
      );
      if (attempt === retries) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

// function renderCapturedPages(pages) {
//   const summaryReportDiv = document.getElementById("summaryContainer");
//   if (!summaryReportDiv) {
//     console.error("❌ focusSummaryReport element not found!");
//     return;
//   }

//   if (pages.length === 0) {
//     summaryReportDiv.innerHTML += "<p>No pages captured.</p>";
//     return;
//   }

//   const ul = document.createElement("ul");
//   pages.forEach((page, index) => {
//     const li = document.createElement("li");
//     li.textContent = `Page ${index + 1}: ${page.slice(0, 50)}...`;
//     ul.appendChild(li);
//   });
//   summaryReportDiv.appendChild(ul);
// }

function updateFocusButtonLabel(text) {
  const btn = document.getElementById("toggleFocusMode");
  if (!btn) return;
  const original = btn.querySelector(".original");
  if (original) {
    original.textContent = text;
  } else {
    btn.textContent = text;
  }
}

async function endFocusedLearning() {
  if (isStoppingFocus) {
    console.log("⚠️ endFocusedLearning already in progress, skipping.");
    return;
  }

  isStoppingFocus = true;
  clearInterval(focusTimer);
  isFocusedMode = false;
  document.getElementById("focusTimer").style.display = "none";
  updateFocusButtonLabel("⏱️ Start Focus Mode");

  try {
    if (!targetTabId) {
      console.error("❌ No target tab identified to stop focus mode.");
      return;
    }

    chrome.tabs.get(targetTabId, (tab) => {
      if (chrome.runtime.lastError || !tab) {
        console.error(
          "❌ Target tab no longer exists:",
          chrome.runtime.lastError?.message
        );
        return;
      }

      const url = tab.url;
      if (
        url.startsWith("chrome://") ||
        url.startsWith("edge://") ||
        url.startsWith("devtools://") ||
        url.startsWith("chrome-extension://")
      ) {
        console.error("❌ Cannot stop focus mode on restricted URL:", url);
        return;
      }

      chrome.runtime.sendMessage(
        { action: "ensureContentScript", tabId: targetTabId },
        (response) => {
          if (
            chrome.runtime.lastError ||
            !response ||
            response.status.includes("❌")
          ) {
            console.error(
              "❌ Error ensuring content script for stop:",
              chrome.runtime.lastError || response?.error
            );
            return;
          }

          chrome.tabs.sendMessage(
            targetTabId,
            { action: "stopFocusMonitor" },
            (response) => {
              if (chrome.runtime.lastError) {
                console.warn(
                  "⚠️ stopFocusMonitor failed:",
                  chrome.runtime.lastError.message
                );
              } else {
                console.log("✅ stopFocusMonitor response:", response);
              }

              if (focusPageReadings.length === 0) {
                alert("⚠️ No pages were captured.");
                return;
              }

              const uniquePages = [];
              const seenUrls = new Set();
              focusPageReadings.forEach((page) => {
                const baseUrl = page.pageUrl.split("?")[0];
                if (!seenUrls.has(baseUrl)) {
                  seenUrls.add(baseUrl);
                  uniquePages.push(page.text.replace(/\n+/g, " ").trim());
                }
              });

              summarizePagesWithRetry(uniquePages).then(
                ({ summaries, logicMap }) => {
                  if (currentBook) {
                    const session = {
                      date: new Date().toISOString().split("T")[0],
                      rootTopic: uniquePages[0]?.slice(0, 20) || "Untitled",
                      logicMap,
                      summary: summaries.join("\n"),
                      preview: summaries[0]?.slice(0, 50) || "No preview",
                    };

                    chrome.storage.local.get(["books"], (result) => {
                      const updatedBooks = result.books || [];
                      const bookIndex = updatedBooks.findIndex(
                        (book) => book.id === currentBook.id
                      );
                      if (bookIndex !== -1) {
                        updatedBooks[bookIndex].knowledgeSessions.push(session);
                        updatedBooks[bookIndex].updatedAt =
                          new Date().toISOString();
                        chrome.storage.local.set(
                          { books: updatedBooks },
                          () => {
                            console.log(
                              "✅ Saved Focus Mode session to book:",
                              currentBook.title
                            );
                            renderFocusKnowledgeSummary(summaries, logicMap);
                          }
                        );
                      }
                    });
                  } else {
                    const win = window.open("", "_blank");
                    win.document.write(`
                  <html>
                    <head><title>Focus Summary</title></head>
                    <body>
                      <h2>Focus Mode Summary</h2>
                      ${summaries.map((s) => `<p>📄 ${s}</p>`).join("")}
                      <h3>Logic Map</h3>
                      <div class="mermaid">${logicMap}</div>
                      <script src="mermaid.min.js"></script>
                      <script>mermaid.initialize({ startOnLoad: true });</script>
                    </body>
                  </html>`);
                  }

                  chrome.storage.local.set({ focusedSessionRecords }, () => {
                    console.log("📊 Highlight records saved.");
                  });

                  // Reset internal state
                  focusedSessionRecords = [];
                  focusPageReadings = [];
                  processedMessages.clear();
                  processedBatchTimestamps.clear();
                  capturedPages = [];

                  renderCurrentSessionHighlights();
                  document.getElementById("highlighted-list").style.display =
                    "block";
                }
              );
            }
          );
        }
      );
    });
  } finally {
    clearInterval(focusTimer);
    focusTimer = null;
    isStoppingFocus = false;
  }
}

// Utility function to save a highlight record using chrome.storage.local
function saveHighlight(record) {
  chrome.storage.local.get(["learningRecords"], (result) => {
    let records = result.learningRecords || [];
    records.push(record);
    chrome.storage.local.set({ learningRecords: records }, () => {
      console.log("✅ Highlight saved:", record.text);
    });
  });
}

// 🎓 Save Learning Record to chrome.storage.local
function saveLearningRecord(record) {
  focusedSessionRecords.push(record);
}

// 🎤 Web Speech API TTS Handler
let isSpeaking = false;
const synth = window.speechSynthesis;

function handleTTS(text) {
  if (isSpeaking) {
    synth.cancel();
    isSpeaking = false;
    console.log("🔇 Speech stopped.");
  } else {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US"; // Set desired language
    utterance.rate = 1; // Set speech speed
    utterance.pitch = 1; // Set pitch

    utterance.onstart = () => {
      console.log("🔊 Speaking started.");
      isSpeaking = true;
    };
    utterance.onend = () => {
      console.log("✅ Speaking finished.");
      isSpeaking = false;
    };
    utterance.onerror = (event) => {
      console.error("❌ Speech error:", event.error);
      isSpeaking = false;
    };

    synth.speak(utterance);
  }
}

async function expandExplanation(highlightText) {
  try {
    const response = await fetch("http://localhost:3000/expand", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "Paragraph", // 根據上下文設置類型
        context: `Text: "${highlightText}"`,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const data = await response.json();
    console.log("✅ Expanded explanation received:", data);
    return data.expanded || "No additional explanation available.";
  } catch (error) {
    console.error("❌ Failed to fetch expanded explanation:", error);
    return "Failed to fetch additional explanation.";
  }
}

function renderFocusKnowledgeSummary(summaries, logicMap) {
  const summaryContainer = document.getElementById("summaryContainer");
  if (!summaryContainer) {
    console.error("❌ summaryContainer element not found!");
    return;
  }

  // 移除 summaryContainer 中所有既有 logic-map
  const oldMaps = summaryContainer.querySelectorAll(".logic-map");
  oldMaps.forEach((el) => el.remove());

  if (logicMap) {
    const logicMapDiv = document.createElement("div");
    logicMapDiv.classList.add("logic-map");
    logicMapDiv.innerHTML = `
      <h3>Logic Map</h3>
      <div class="mermaid">${logicMap}</div>
    `;
    summaryContainer.appendChild(logicMapDiv);

    // ✅ Mermaid 初始化與渲染
    if (window.mermaid) {
      console.log("✅ Initializing Mermaid inside renderFocusKnowledgeSummary");
      mermaid.initialize({
        startOnLoad: true,
        theme: "default",
        flowchart: {
          layout: "LR",
          nodeSpacing: 100,
          rankSpacing: 100,
        },
      });
      mermaid.init(undefined, logicMapDiv.querySelectorAll(".mermaid"));
    } else {
      console.warn("⚠️ Mermaid.js not available during render.");
    }
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("📩 Sidebar received message:", message);

  if (fuck == 1 && message.action === "updateSidebar") {
    const highlightList = document.getElementById("highlighted-list");
    if (!highlightList) {
      console.error("❌ highlighted-list element not found!");
      sendResponse({
        status: "❌ Failed to update sidebar: missing highlighted-list",
      });
      return true;
    }

    const record = {
      text: message.text,
      type: message.type,
      explanation: message.explanation,
      metadata: message.metadata,
      timestamp: new Date().toISOString(),
      sessionId: sessionId,
      interaction: "highlight",
    };

    // ⭐ 檢查 currentBook 是否存在，若存在則存進書籍的 records
    if (currentBook) {
      chrome.storage.local.get(["books"], (result) => {
        const updatedBooks = result.books || [];
        const bookIndex = updatedBooks.findIndex(
          (book) => book.id === currentBook.id
        );
        if (bookIndex !== -1) {
          updatedBooks[bookIndex].records.push(record);
          updatedBooks[bookIndex].updatedAt = new Date().toISOString();
          chrome.storage.local.set({ books: updatedBooks }, () => {
            console.log("✅ Highlight saved to book:", currentBook.title);
          });
        }
      });
    } else {
      console.log("⚠️ No recording mode: highlight not saved");
    }

    // 🔄 更新 UI
    if (!currentSessionHighlights.some((h) => h.text === record.text)) {
      currentSessionHighlights.push(record);
      renderCurrentSessionHighlights();
    } else {
      console.warn(" ⚠️ Current Highlight already in session");
    }

    sendResponse({ status: "✅ Sidebar updated" });
    return true;
  } else if (message.action === "focusedPageReadBatch" && isFocusedMode) {
    const batchMessages = message.messages || [];
    console.log(
      `📩 Received batch of ${batchMessages.length} focusedPageRead messages`
    );
    batchMessages.forEach((msg) => {
      const timestampMs = new Date(msg.timestamp).getTime();
      const baseUrl = msg.pageUrl.split("?")[0]; // Normalize URL
      const messageKey = `${baseUrl}-${Math.floor(
        timestampMs / TIME_BUFFER_MS
      )}`;

      if (processedMessages.has(messageKey)) {
        console.log("⚠️ Skipped duplicate page read in batch:", baseUrl);
        return;
      }
      processedMessages.add(messageKey);
      console.log("📚 Captured page read:", msg.text.slice(0, 50));
      focusPageReadings.push({
        text: msg.text,
        pageUrl: msg.pageUrl,
        timestamp: msg.timestamp,
      });

      // Log the page read as an interaction
      saveLearningRecord({
        type: "Page Read",
        text: msg.text.slice(0, 50) + "...",
        timestamp: msg.timestamp,
        interaction: "page-read",
      });
    });
    sendResponse({ status: "✅ Processed focusedPageRead batch" });
    return true;
  } else if (
    message.action === "storeFocusCapturedTextBatch" &&
    isFocusedMode
  ) {
    const batchTimestamp = message.timestamp;
    if (processedBatchTimestamps.has(batchTimestamp)) {
      console.log(
        "⚠️ Skipped duplicate storeFocusCapturedTextBatch:",
        batchTimestamp
      );
      sendResponse({
        status: "⚠️ Skipped duplicate storeFocusCapturedTextBatch",
      });
      return true;
    }
    processedBatchTimestamps.add(batchTimestamp);

    console.log(
      `🧠 Received captured focus text: ${message.pages.length} pages`
    );

    const uniqueNewPages = deduplicatePages(message.pages);
    const combinedPages = deduplicatePages(
      capturedPages.concat(uniqueNewPages)
    );
    capturedPages = combinedPages;
    console.log(`🧠 Updated captured pages: ${capturedPages.length}`);

    // ✅ 補進去 focusPageReadings
    message.pages.forEach((page) => {
      focusPageReadings.push({
        text: page.text || "",
        pageUrl: page.pageUrl || "",
        timestamp: page.timestamp || new Date().toISOString(),
      });
    });

    // renderCapturedPages(capturedPages);

    sendResponse({ status: "✅ Processed storeFocusCapturedTextBatch" });
    return true;
  }

  sendResponse({ status: "✅ Sidebar updated" });
  return true; // Indicate async response
});

function deduplicatePages(pages) {
  const seenUrls = new Set();
  return pages.filter((page, index) => {
    const baseUrl = page.pageUrl ? page.pageUrl.split("?")[0] : `text-${index}`;
    if (seenUrls.has(baseUrl)) return false;
    seenUrls.add(baseUrl);
    return true;
  });
}

// expand and some other functions
document.getElementById("highlighted-list").addEventListener("click", (e) => {
  if (e.target && e.target.matches(".expand-btn")) {
    console.log("✅ Expand button clicked");

    // Locate the parent highlight item
    const highlightItem = e.target.closest(".highlight-item");
    if (!highlightItem) return;

    // Retrieve text and type
    const highlightText =
      highlightItem.querySelector(".highlight-text")?.textContent || "";
    const highlightType =
      highlightItem.querySelector(".highlight-label")?.textContent || "Word";

    console.log("🔍 Highlighted text:", highlightText);
    console.log("📌 Highlight type:", highlightType);

    // ✅ Send to /expand for all highlight types
    console.log("📤 Sending request to /expand...");
    fetch("http://localhost:3000/expand", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: highlightType,
        context: `Text: "${highlightText}"`,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        console.log("✅ Received Expanded Details:", data.expanded);
        let extraDetails = highlightItem.querySelector(".extra-details");
        if (!extraDetails) {
          extraDetails = document.createElement("div");
          extraDetails.classList.add("extra-details");
          highlightItem.appendChild(extraDetails);
        }
        extraDetails.innerHTML = `<strong>Expanded Details:</strong><br>${data.expanded}`;
        saveLearningRecord({
          type: highlightType,
          text: highlightText,
          timestamp: new Date().toISOString(),
          interaction: "expand",
        });
      })
      .catch((error) => {
        console.error("❌ Error expanding details:", error);
      });

    // Function to request and render Logic Map
    function generateLogicMap(text) {
      fetch("http://localhost:3000/logicMap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paragraph: text }),
      })
        .then((response) => response.json())
        .then((data) => {
          console.log("✅ Logic Map Received:", data);
          renderLogicMap(data.logicMap, highlightItem);
        })
        .catch((error) => console.error("❌ Logic Map Error:", error));
    }
    // Render Logic Map using Mermaid.js
    function renderLogicMap(logicMap, highlightItem) {
      console.log("📊 Rendering Logic Map...", logicMap);

      if (!logicMap || typeof logicMap !== "string") {
        console.error("❌ Invalid Logic Map format", logicMap);
        return;
      }

      function ensureMermaidLoaded(callback) {
        if (window.mermaid) {
          console.log("✅ Mermaid.js is already loaded.");
          mermaid.initialize({
            startOnLoad: true,
            theme: "default",
            fontSize: 200, // 🟢 Mermaid 內建的節點字體大小
            flowchart: {
              nodeSpacing: 100, // 節點之間的間距
              rankSpacing: 100, // 不同層的垂直距離
              useMaxWidth: false, // 可以讓圖不自動壓縮
            },
          });

          callback();
        } else {
          console.warn("❌ Mermaid.js is not loaded! Loading manually...");

          // Check if Mermaid script is already in the DOM
          if (
            document.querySelector(
              "script[src='https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.2.4/mermaid.min.js']"
            )
          ) {
            console.log(
              "✅ Mermaid.js script already exists, forcing initialization..."
            );
            let checkReady = setInterval(() => {
              if (window.mermaid) {
                clearInterval(checkReady);
                console.log("✅ Mermaid.js is now available.");
                mermaid.initialize({ startOnLoad: true });
                callback();
              }
            }, 500);
            return;
          }

          // Load Mermaid.js from a reliable CDN
          const mermaidScript = document.createElement("script");
          mermaidScript.src =
            "https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.2.4/mermaid.min.js";
          mermaidScript.async = true;
          mermaidScript.onload = () => {
            console.log("✅ Mermaid.js loaded successfully. Initializing...");
            setTimeout(() => {
              if (window.mermaid) {
                mermaid.initialize({ startOnLoad: true });
                callback();
              } else {
                console.error("❌ Mermaid.js failed to initialize.");
              }
            }, 500);
          };
          mermaidScript.onerror = () =>
            console.error("❌ Failed to load Mermaid.js!");

          document.head.appendChild(mermaidScript);
        }
      }

      ensureMermaidLoaded(() => {
        const container = document.createElement("div");
        container.classList.add("logic-map-container");
        highlightItem.appendChild(container);

        const mermaidDiv = document.createElement("div");
        mermaidDiv.classList.add("mermaid");
        mermaidDiv.textContent = logicMap;
        container.appendChild(mermaidDiv);

        // Ensure Mermaid initializes AFTER the element is added
        // Ensure Mermaid initializes AFTER the element is added
        setTimeout(() => {
          try {
            mermaid.init(undefined, mermaidDiv);
            console.log("✅ Mermaid initialized successfully.");
          } catch (error) {
            console.error("❌ Mermaid failed to render:", error);
          }
        }, 1000); // Adding a slight delay ensures the script is fully loaded
      });
    }

    // ✅ If the highlight is a paragraph, add "Mind Map" and "Logic Map" buttons
    if (highlightType === "Paragraph") {
      console.log("📌 Paragraph detected: Adding Logic Map buttons...");
      const buttonsContainer =
        highlightItem.querySelector(".highlight-buttons");

      if (!highlightItem.querySelector(".logic-map-btn")) {
        const logicMapButton = document.createElement("button");
        logicMapButton.textContent = "📊 Logic Map";
        logicMapButton.classList.add("logic-map-btn");
        logicMapButton.addEventListener("click", () =>
          generateLogicMap(highlightText)
        );
        buttonsContainer.appendChild(logicMapButton);
      }
    }
  }
});

// mermaid check
document.addEventListener("DOMContentLoaded", function () {
  if (window.mermaid) {
    console.log("✅ Mermaid.js is ready.");
    mermaid.initialize({
      startOnLoad: true,
      flowchart: { curve: "linear" },
    });
  } else {
    console.error("❌ Mermaid.js failed to initialize.");
  }
});
