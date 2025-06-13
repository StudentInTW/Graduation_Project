// learningStorage.js

// ✅ 儲存學習紀錄（可供 highlight, expand, follow-up 使用）
function saveLearningRecord({
  text,
  type,
  explanation,
  clickedExpand = false,
  submittedFollowUp = false,
  focusMode = false,
}) {
  const record = {
    text,
    type,
    explanation,
    timestamp: new Date().toISOString(),
    actions: {
      clickedExpand,
      submittedFollowUp,
    },
    mode: {
      focusMode,
    },
  };

  chrome.storage.local.get({ learningRecords: [] }, (result) => {
    const updated = result.learningRecords;
    updated.push(record);
    chrome.storage.local.set({ learningRecords: updated }, () => {
      console.log("📚 Learning record saved:", record);
    });
  });
}

// ✅ 可選：讀取所有紀錄（for Timeline / Review）
function getAllLearningRecords(callback) {
  chrome.storage.local.get({ learningRecords: [] }, (result) => {
    callback(result.learningRecords);
  });
}

// ✅ 可選：清除所有紀錄（for debug/reset）
function clearLearningRecords() {
  chrome.storage.local.set({ learningRecords: [] }, () => {
    console.log("🗑️ All learning records cleared.");
  });
}

// export to global (if needed)
window.saveLearningRecord = saveLearningRecord;
window.getAllLearningRecords = getAllLearningRecords;
window.clearLearningRecords = clearLearningRecords;
