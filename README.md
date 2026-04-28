
# 📖 Archive.org Highlighter (Graduation Project)
**A Chrome Extension for seamless text annotation and organization on archive.org.**

> **⚠️ Important Note**: You must configure your own API Key to activate the backend processing for this extension to work fully.

## 📝 Overview
This Chrome extension enhances the reading experience on [archive.org](https://archive.org) by allowing users to highlight text directly on webpages and display the annotated content in a dedicated sidebar. Designed for researchers, students, and avid readers, it provides a seamless way to annotate and organize key information from archived texts without cluttering the reading space.

## ✨ Features
* **🖍️ Text Highlighting**: Select and highlight words or paragraphs directly on archive.org pages with customizable annotations.
* **📑 Sidebar Display**: View all highlights in a clean, organized sidebar, including your explanations and metadata (e.g., timestamps).
* **💾 Persistent Storage**: Highlights are saved locally using Chrome's `chrome.storage` API, ensuring your annotations are preserved across browsing sessions.
* **🧹 Clear Highlights**: Easily reset all highlights with a single click, maintaining a clutter-free workspace.
* **⚡ Non-Intrusive Design**: The extension avoids creating unnecessary popup windows, focusing instead on efficient tab management for the sidebar UI.

## 📂 Project Architecture
This project is built using JavaScript and Chrome's Web Extensions API. The logic is cleanly separated into three main components:


```text
├── 核心設定與管理
│   ├── manifest.json        # Chrome 擴充功能核心權限與註冊檔
│   ├── package.json         # NPM 專案依賴與腳本設定
│   └── .gitignore           # Git 忽略規則 (排除 node_modules 等)
│
├── 背景與網頁腳本 (Extension Core)
│   ├── background.js        # Service Worker: 負責跨元件通訊與 API 狀態管理
│   ├── content.js           # 注入網頁的腳本: 處理 DOM 選取、反白邏輯與浮動 UI
│   └── learningStorage.js   # 狀態管理模組: 處理 highlight 資料的儲存與讀取
│
├── 使用者介面 (User Interfaces)
│   ├── sidebar.html / .js   # 側邊欄視圖: 顯示與管理所有標註內容
│   ├── popup.html / .js     # 彈出視窗視圖: 擴充功能選單與快捷操作
│   ├── review.html / .js    # 複習視圖: 專屬的標註回顧與學習頁面
│   └── styles.css           # 專案共用樣式表
│
├── 外部函式庫 (Libraries)
│   ├── d3.min.js            # 處理資料視覺化與統計圖表
│   └── mermaid.min.js       # 渲染流程圖與心智圖
│
├── 後端服務 (Backend Service)
│   └── server.js            # 本地 Node.js 伺服器 (用於處理 API 請求或資料庫溝通)
│
└── icons/                   # 擴充功能各尺寸圖示集
```

## 🚀 Installation & Setup

### Prerequisites
* Google Chrome (latest version recommended)
* Basic knowledge of JavaScript and Chrome Extensions

### Local Installation
1. Clone or download this repository to your local machine.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable the **"Developer mode"** toggle in the top-right corner.
4. Click **"Load unpacked"** and select the downloaded repository folder.
5. The extension icon will appear in your Chrome toolbar, ready for use.

## 🖱️ Usage Guide
1. **Open Sidebar**: Click the extension icon in your toolbar to launch the sidebar.
2. **Highlight Text**: Select any text on an archive.org page. The extension will prompt you to highlight it and add optional explanations.
3. **View Annotations**: Check the sidebar to see all highlighted texts organized chronologically.
4. **Clear Data**: Use the "Clear Highlights" button inside the sidebar to reset your workspace.

## 🤝 Contributing
Contributions are always welcome!
1. Fork the repository.
2. Create a new feature branch.
3. Commit your changes. (Please ensure your code follows the existing style and includes appropriate logging for debugging).
4. Submit a Pull Request.

## 📄 License & Acknowledgments
* **License**: This project is licensed under the MIT License. See the `LICENSE` file for details.
* **Acknowledgments**: Built with inspiration from digital annotation research tools. Special thanks to the open-source community for Chrome Extension development resources.
