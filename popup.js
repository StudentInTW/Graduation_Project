// 📦 儲存初始化工具與邏輯
function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function initializeStorage() {
  chrome.storage.local.get(
    ["books", "currentBookId", "learningRecords", "knowledgeSessions"],
    (result) => {
      chrome.runtime.lastError &&
        console.error("❌ Error reading storage:", chrome.runtime.lastError);

      let books = result.books || [];
      let currentBookId = result.currentBookId || null;
      const oldRecords = result.learningRecords || [];
      const oldSessions = result.knowledgeSessions || [];

      if (books.length > 0) {
        console.log("✅ Storage already initialized:", books);
        return;
      }

      if (oldRecords.length > 0 || oldSessions.length > 0) {
        const defaultBook = {
          id: generateUUID(),
          title: "未分類書籍",
          author: "系統自動生成",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          records: oldRecords,
          knowledgeSessions: oldSessions,
        };
        books.push(defaultBook);
        currentBookId = defaultBook.id;
        console.log("📦 Migrated old data to default book:", defaultBook);
      }

      chrome.storage.local.set({ books, currentBookId }, () => {
        console.log("✅ Storage initialized:", { books, currentBookId });
        chrome.storage.local.remove(
          ["learningRecords", "knowledgeSessions"],
          () => {
            console.log("🗑️ Cleared old storage keys.");
          }
        );
      });
    }
  );
}

initializeStorage();

// 🌐 popup UI 邏輯
function updateBookList() {
  chrome.storage.local.get(["books"], (result) => {
    const books = result.books || [];
    const select = document.getElementById("bookSelect");
    select.innerHTML = '<option value="">Choose a book...</option>';
    books.forEach((book) => {
      const option = document.createElement("option");
      option.value = book.id;
      option.textContent = `${book.title} (by ${book.author})`;
      select.appendChild(option);
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const newBookBtn = document.getElementById("newBookBtn");
  const existingBookBtn = document.getElementById("existingBookBtn");
  const noRecordBtn = document.getElementById("noRecordBtn");
  const newBookForm = document.getElementById("newBookForm");
  const existingBookList = document.getElementById("existingBookList");
  const noRecordWarning = document.getElementById("noRecordWarning");
  const submitNewBook = document.getElementById("submitNewBook");
  const selectBook = document.getElementById("selectBook");

  updateBookList();

  newBookBtn.addEventListener("click", () => {
    newBookForm.style.display = "block";
    existingBookList.style.display = "none";
    noRecordWarning.style.display = "none";
  });

  submitNewBook.addEventListener("click", () => {
    const title = document.getElementById("bookTitle").value.trim();
    const author = document.getElementById("bookAuthor").value.trim();
    if (title && author) {
      const bookId = generateUUID();
      const newBook = {
        id: bookId,
        title,
        author,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        records: [],
        knowledgeSessions: [],
      };
      chrome.storage.local.get(["books"], (result) => {
        const books = result.books || [];
        books.push(newBook);
        chrome.storage.local.set({ books, currentBookId: bookId }, () => {
          console.log("✅ Added new book:", newBook);
          chrome.runtime.sendMessage({ action: "enableSidebar" });

          chrome.windows.create(
            {
              url: "sidebar.html",
              type: "popup",
              width: 400,
              height: 600,
            },
            () => {
              newBookForm.style.display = "none";
            }
          );
        });
      });
    } else {
      alert("Please enter the book name and the author！");
    }
  });

  existingBookBtn.addEventListener("click", () => {
    existingBookList.style.display = "block";
    newBookForm.style.display = "none";
    noRecordWarning.style.display = "none";
    updateBookList();
  });

  selectBook.addEventListener("click", () => {
    const bookId = document.getElementById("bookSelect").value;
    if (bookId) {
      chrome.storage.local.set({ currentBookId: bookId }, () => {
        console.log("✅ Selected book:", bookId);

        chrome.runtime.sendMessage({ action: "enableSidebar" });
        chrome.windows.create(
          {
            url: "sidebar.html",
            type: "popup",
            width: 400,
            height: 600,
          },
          () => {
            existingBookList.style.display = "none";
          }
        );
      });
    } else {
      alert("Please choose a book!");
    }
  });

  noRecordBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "enableSidebar" });

    chrome.storage.local.set({ currentBookId: null }, () => {
      console.log("✅ Set to no recording mode");
      noRecordWarning.style.display = "block";
      chrome.windows.create(
        {
          url: "sidebar.html",
          type: "popup",
          width: 400,
          height: 600,
        },
        () => {
          noRecordWarning.style.display = "none";
        }
      );
    });
  });

  // 驗證目前頁面合法性
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) {
      console.error("❌ No active tab found.");
      alert("No active tab found. Please select a valid tab.");
      return;
    }
    const url = tabs[0].url;
    if (
      url.startsWith("chrome://") ||
      url.startsWith("edge://") ||
      url.startsWith("devtools://") ||
      url.startsWith("chrome-extension://") ||
      url.includes("extensions")
    ) {
      console.error("❌ Cannot open sidebar for restricted URL:", url);
      alert(
        "Cannot open sidebar on this page (e.g., edge:// or chrome:// pages). Please navigate to a supported page (only archive.org)."
      );
      return;
    }
    chrome.storage.local.set({ openerTabId: tabs[0].id }, () => {
      console.log("✅ Stored openerTabId:", tabs[0].id);
    });
  });
});
