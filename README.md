﻿# Graduation_Project
Overview

This Chrome extension enhances the reading experience on archive.org by allowing users to highlight text on webpages and display the highlighted content in a dedicated sidebar. Designed for researchers, students, and avid readers, the extension provides a seamless way to annotate and organize key information from archived texts.

It's required that you use your own api key to activate the backend process 
Features

Text Highlighting: Select and highlight words or paragraphs directly on archive.org pages with customizable annotations.
Sidebar Display: View all highlights in a clean, organized sidebar, including explanations and metadata (e.g., timestamps).
Clear Highlights: Easily reset all highlights with a single click, maintaining a clutter-free workspace.
Persistent Storage: Highlights are saved locally using Chrome's storage API, ensuring your annotations are preserved across sessions.
Non-Intrusive Design: The extension avoids creating unnecessary windows, focusing on efficient tab management for the sidebar.

Installation

Clone or download this repository.
Open Chrome and navigate to chrome://extensions/.
Enable "Developer mode" in the top-right corner.
Click "Load unpacked" and select the downloaded repository folder.

The extension will appear in your Chrome toolbar, ready for use on archive.org.
Usage
Open Sidebar: Click the extension icon to open the sidebar.
Highlight Text: Select text on an archive.org page, and the extension will prompt you to highlight it with optional explanations.
View Highlights: Check the sidebar to see all highlighted text, organized chronologically.
Clear Highlights: Use the "Clear Highlights" button in the sidebar to reset your annotations.

Development

This project is built using JavaScript and Chrome's Web Extensions API. Key components include:
background.js: Manages communication between the content script, sidebar, and Chrome APIs, ensuring stable highlight processing.
content.js: Injects into archive.org pages to handle text selection and highlight logic.
sidebar.js: Renders the sidebar UI and manages highlight display and clearing.

Prerequisites
Chrome browser (latest version recommended)
Basic knowledge of JavaScript and Chrome Extensions
Contributing
Contributions are welcome! Please fork the repository, create a new branch, and submit a pull request with your changes. Ensure your code follows the existing style and includes appropriate logging for debugging.
License
This project is licensed under the MIT License. See the LICENSE file for details.

Acknowledgments

Built with inspiration from tools for digital annotation and research.
Thanks to the open-source community for Chrome Extension development resources.
