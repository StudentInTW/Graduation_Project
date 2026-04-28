
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
├── background.js   # Manages communication between content script, sidebar, and Chrome APIs
├── content.js      # Injected into archive.org to handle text selection and highlight logic
├── sidebar.js      # Renders the UI and manages the display/clearing of highlight data
└── manifest.json   # Chrome extension configuration and permissions
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
