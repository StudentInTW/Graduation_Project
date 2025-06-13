document.addEventListener("DOMContentLoaded", () => {
  const bookList = document.getElementById("bookList");
  const detailsContainer = document.getElementById("detailsContainer");
  const recordContainer = document.getElementById("recordContainer");
  const closeModalBtn = document.getElementById("closeModal");
  const bookTitleDetails = document.getElementById("bookTitleDetails");
  const bookAuthorDetails = document.getElementById("bookAuthorDetails");
  const bookUpdatedAt = document.getElementById("bookUpdatedAt");
  const timelineBtn = document.getElementById("timelineViewBtn");
  const knowledgeBtn = document.getElementById("knowledgeViewBtn");
  const exportCSVBtn = document.getElementById("exportCSVBtn");
  const exportPDFBtn = document.getElementById("exportPDFBtn");
  const batchDeleteBtn = document.getElementById("batchDeleteBtn");
  const backToListBtn = document.getElementById("backToListBtn");

  let currentBook = null;
  let currentView = "timeline"; // 當前檢視模式（timeline 或 knowledge）

  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", () => {
      const modal = document.getElementById("fullLogicMapModal");
      const container = document.getElementById("fullLogicMapContainer");
      modal.style.display = "none";
      container.innerHTML = "";
    });
  }

  chrome.storage.local.get(["books"], (result) => {
    const books = (result.books || []).filter(Boolean);
    if (!books.length) {
      bookList.innerHTML = "<p>No books found.</p>";
      return;
    }
    renderBooks(books);
  });

  function renderBooks(books) {
    bookList.innerHTML = "";
    books.forEach((book) => {
      const queryCount = (book.records || []).length;
      const focusCount = (book.knowledgeSessions || []).length;
      const lastUpdated =
        book.updatedAt || book.createdAt || new Date().toISOString();

      const card = document.createElement("div");
      card.classList.add("book-card");
      card.innerHTML = `
        <div class="book-info">
          <h3>📕 ${book.title} by ${book.author}</h3>
          <p>Lastest update: ${new Date(lastUpdated).toLocaleString()}</p>
          <p>Query count: ${queryCount} | Focus count: ${focusCount}</p>
        </div>
        <div class="book-buttons">
          <button class="view-details-btn" data-book-id="${
            book.id
          }">📂 View Details</button>
          <button class="delete-btn" data-book-id="${
            book.id
          }">🗑️ Delete</button>
        </div>
      `;
      bookList.appendChild(card);
    });

    bookList.querySelectorAll(".view-details-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const bookId = btn.dataset.bookId;
        chrome.storage.local.get(["books"], (result) => {
          const books = (result.books || []).filter(Boolean);
          const book = books.find((b) => b.id === bookId);
          if (book) showBookDetails(book);
        });
      });
    });

    bookList.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const bookId = btn.dataset.bookId;
        if (
          confirm("You sure want to delete this book and all of its record?")
        ) {
          const updatedBooks = books.filter((b) => b.id !== bookId);
          chrome.storage.local.set({ books: updatedBooks }, () => {
            console.log("🗑️ Deleted book:", bookId);
            renderBooks(updatedBooks);
            detailsContainer.classList.remove("active");
          });
        }
      });
    });
  }

  function showBookDetails(book) {
    currentBook = book;
    bookTitleDetails.textContent = book.title;
    bookAuthorDetails.textContent = book.author;
    bookUpdatedAt.textContent = new Date(
      book.updatedAt || book.createdAt
    ).toLocaleString();
    detailsContainer.classList.add("active");

    if (currentView === "timeline") {
      renderTimelineView(book);
    } else {
      renderKnowledgeView(book);
    }

    timelineBtn.onclick = () => {
      currentView = "timeline";
      renderTimelineView(book);
    };
    knowledgeBtn.onclick = () => {
      currentView = "knowledge";
      renderKnowledgeView(book);
    };
    exportCSVBtn.onclick = () => exportToCSV(book);
    exportPDFBtn.onclick = () => exportToPDF(book);
    batchDeleteBtn.onclick = () => {
      if (currentView === "timeline") {
        batchDeleteRecords(book);
      } else {
        batchDeleteKnowledgeSessions(book);
      }
    };
    backToListBtn.onclick = () => {
      detailsContainer.classList.remove("active");
      currentView = "timeline"; // 重置檢視模式
    };
  }

  function renderTimelineView(book) {
    recordContainer.innerHTML = "";
    if (!(book.records || []).length) {
      recordContainer.innerHTML = "<p>There's no Timeline record for now。</p>";
      return;
    }
    book.records.forEach((rec, index) => {
      const card = document.createElement("div");
      card.classList.add("timeline-entry");
      card.innerHTML = `
        <div class="record-actions">
          <input type="checkbox" class="record-checkbox" data-type="record" data-index="${index}" />
          <button class="delete-record-btn" data-type="record" data-index="${index}">🗑️ Delete</button>
          <button class="recheck-btn">🔁 Check Again</button>
        </div>
        <p><strong class="entry-type">${rec.type}</strong> - ${
        rec.interaction
      }</p>
        <p class="entry-text">${rec.text}</p>
        <small class="entry-meta">${new Date(
          rec.timestamp
        ).toLocaleString()}</small>
      `;
      card.querySelector(".recheck-btn").addEventListener("click", () => {
        fetch("http://localhost:3000/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: rec.text }),
        })
          .then((res) => res.json())
          .then((data) => {
            const result = document.createElement("div");
            result.innerHTML = `<div class="recheck-result"><strong>Rechecked:</strong><br>${data.explanation}</div>`;
            card.appendChild(result);
          })
          .catch((err) => {
            const error = document.createElement("div");
            error.innerHTML = `<div class="recheck-result">❌ Error: ${err.message}</div>`;
            card.appendChild(error);
          });
      });
      card.querySelector(".delete-record-btn").addEventListener("click", () => {
        deleteRecord(book, index);
      });
      recordContainer.appendChild(card);
    });
  }

  function renderKnowledgeView(book) {
    recordContainer.innerHTML = "";
    if (!(book.knowledgeSessions || []).length) {
      recordContainer.innerHTML = "<p>There's no Knowledge record for now.</p>";
      return;
    }
    book.knowledgeSessions.forEach((session, index) => {
      const card = document.createElement("div");
      card.classList.add("knowledge-card");
      const miniLogicMap = extractMiniLogicMap(session.logicMap);
      card.innerHTML = `
        <div class="record-actions">
          <input type="checkbox" class="record-checkbox" data-type="knowledge" data-index="${index}" />
          <button class="delete-record-btn" data-type="knowledge" data-index="${index}">🗑️ Delete</button>
        </div>
        <div class="knowledge-card-header">
          <h3>${session.rootTopic}</h3>
          <small>📅 ${session.date}</small>
        </div>
        <div class="knowledge-card-preview">
          <div class="mermaid mini-mermaid">${miniLogicMap}</div>
        </div>
        <p class="knowledge-summary">${
          session.summary || "No summary available."
        }</p>
        <button class="view-full-logic-btn" data-index="${index}">📊 View Full Logic Map</button>
      `;
      recordContainer.appendChild(card);
      card.querySelector(".delete-record-btn").addEventListener("click", () => {
        deleteKnowledgeSession(book, index);
      });
    });

    const observer = new MutationObserver(() => {
      if (window.mermaid) {
        mermaid.initialize({
          startOnLoad: true,
          flowchart: {
            curve: "linear",
          },
        });
        mermaid.init(undefined, document.querySelectorAll(".mini-mermaid"));
      }
    });
    observer.observe(recordContainer, { childList: true, subtree: true });

    recordContainer.querySelectorAll(".view-full-logic-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const index = btn.dataset.index;
        const session = book.knowledgeSessions[index];
        openFullLogicMap(session.logicMap);
      });
    });
  }

  function deleteRecord(book, index) {
    if (confirm("You sure want to delete this？")) {
      chrome.storage.local.get(["books"], (result) => {
        const books = (result.books || []).filter(Boolean);
        const bookIndex = books.findIndex((b) => b.id === book.id);
        if (bookIndex !== -1) {
          books[bookIndex].records.splice(index, 1);
          books[bookIndex].updatedAt = new Date().toISOString();
          chrome.storage.local.set({ books }, () => {
            console.log("🗑️ Deleted record at index:", index);
            currentBook = books[bookIndex];
            renderTimelineView(currentBook);
          });
        }
      });
    }
  }

  function deleteKnowledgeSession(book, index) {
    if (confirm("You surely want to delete this?")) {
      chrome.storage.local.get(["books"], (result) => {
        const books = (result.books || []).filter(Boolean);
        const bookIndex = books.findIndex((b) => b.id === book.id);
        if (bookIndex !== -1) {
          books[bookIndex].knowledgeSessions.splice(index, 1);
          books[bookIndex].updatedAt = new Date().toISOString();
          chrome.storage.local.set({ books }, () => {
            console.log("🗑️ Deleted knowledge session at index:", index);
            currentBook = books[bookIndex];
            renderKnowledgeView(currentBook);
          });
        }
      });
    }
  }

  function batchDeleteRecords(book) {
    const checkboxes = document.querySelectorAll(
      '.record-checkbox[data-type="record"]:checked'
    );
    if (checkboxes.length === 0) {
      alert("Please choose at least one to delete!！");
      return;
    }
    if (confirm(`Are you sure to remove ${checkboxes.length} records？`)) {
      const indices = Array.from(checkboxes)
        .map((checkbox) => parseInt(checkbox.dataset.index))
        .sort((a, b) => b - a); // 從大到小排序，避免索引錯位
      chrome.storage.local.get(["books"], (result) => {
        const books = (result.books || []).filter(Boolean);
        const bookIndex = books.findIndex((b) => b.id === book.id);
        if (bookIndex !== -1) {
          indices.forEach((index) => {
            books[bookIndex].records.splice(index, 1);
          });
          books[bookIndex].updatedAt = new Date().toISOString();
          chrome.storage.local.set({ books }, () => {
            console.log("🗑️ Batch deleted records:", indices);
            currentBook = books[bookIndex];
            renderTimelineView(currentBook);
          });
        }
      });
    }
  }

  function batchDeleteKnowledgeSessions(book) {
    const checkboxes = document.querySelectorAll(
      '.record-checkbox[data-type="knowledge"]:checked'
    );
    if (checkboxes.length === 0) {
      alert("Plesase choose one to delete!");
      return;
    }
    if (
      confirm(`Are you sure you want to remove ${checkboxes.length} records?`)
    ) {
      const indices = Array.from(checkboxes)
        .map((checkbox) => parseInt(checkbox.dataset.index))
        .sort((a, b) => b - a); // 從大到小排序，避免索引錯位
      chrome.storage.local.get(["books"], (result) => {
        const books = (result.books || []).filter(Boolean);
        const bookIndex = books.findIndex((b) => b.id === book.id);
        if (bookIndex !== -1) {
          indices.forEach((index) => {
            books[bookIndex].knowledgeSessions.splice(index, 1);
          });
          books[bookIndex].updatedAt = new Date().toISOString();
          chrome.storage.local.set({ books }, () => {
            console.log("🗑️ Batch deleted knowledge sessions:", indices);
            currentBook = books[bookIndex];
            renderKnowledgeView(currentBook);
          });
        }
      });
    }
  }

  function exportToCSV(book) {
    const headers = ["Type", "Text", "Interaction", "Timestamp"];
    const rows = (book.records || []).map((r) => [
      r.type,
      r.text,
      r.interaction,
      r.timestamp,
    ]);
    const csvLines = [headers.join(",")];
    rows.forEach((row) => {
      csvLines.push(row.map((val) => `"${val.replace(/"/g, '""')}"`).join(","));
    });
    const csvContent = csvLines.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${book.title}_records.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function exportToPDF(book) {
    const opt = {
      margin: 0.5,
      filename: `${book.title}_report.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
    };
    html2pdf().from(recordContainer).set(opt).save();
  }

  function extractMiniLogicMap(logicMap) {
    if (!logicMap) return "graph LR;\nA[Empty]";
    const lines = logicMap
      .split("\n")
      .filter(
        (line) =>
          line.trim() &&
          !line.trim().toLowerCase().startsWith("graph") &&
          !line.trim().startsWith("%%")
      );
    const miniLines = lines.slice(0, 3);
    return miniLines.length
      ? `graph LR;\n${miniLines.join("\n")}`
      : "graph LR;\nA[Empty]";
  }

  function openFullLogicMap(logicMap) {
    const modal = document.getElementById("fullLogicMapModal");
    const container = document.getElementById("fullLogicMapContainer");
    container.removeAttribute("data-processed");
    let fixedLogicMap = logicMap.replace(/<br\s*\/?>/gi, "\n");
    fixedLogicMap = decodeHTMLEntities(fixedLogicMap);
    fixedLogicMap = fixedLogicMap.replace("graph TD", "graph LR");
    container.textContent = fixedLogicMap;
    modal.style.display = "block";
    if (window.mermaid) {
      mermaid.initialize({
        startOnLoad: true,
        flowchart: {
          curve: "linear",
        },
      });
      mermaid.init(undefined, container);
    }
  }

  function decodeHTMLEntities(text) {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = text;
    return textarea.value;
  }
});
