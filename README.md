# ChatGPT Offline Archive - Firefox Extension

A Firefox extension that automatically saves your ChatGPT conversations and lets you browse them offline with the **exact same UI** as the original ChatGPT interface.

## 🚀 Features

- **Automatic Saving**: Captures conversations as you chat on ChatGPT
- **Identical UI**: Offline viewer replicates ChatGPT's layout, fonts, and styling
- **Local Storage**: All data stays on your device - no cloud uploads
- **Full-Text Search**: Find conversations and messages instantly
- **Dark/Light Mode**: Theme support matching ChatGPT
- **Export/Import**: Backup and restore your conversation archive
- **Offline Access**: Browse conversations without internet connection
- **Privacy First**: Zero tracking, no external network calls

## 📦 Installation

### Method 1: Load as Temporary Extension (Development)

1. **Download the extension files**:
   ```bash
   git clone <repository-url>
   cd chatgptofffline
   ```

2. **Open Firefox**:
   - Navigate to `about:debugging`
   - Click "This Firefox"
   - Click "Load Temporary Add-on"
   - Select the `manifest.json` file from the extension folder

### Method 2: Package as XPI (Recommended)

1. **Create the XPI package**:
   ```bash
   # In the extension directory
   zip -r chatgpt-archive.xpi manifest.json *.js *.html *.css
   ```

2. **Install the XPI**:
   - Open Firefox
   - Navigate to `about:addons`
   - Click the gear icon → "Install Add-on From File"
   - Select the `chatgpt-archive.xpi` file

## 🎯 Usage

### Automatic Saving
1. Install the extension
2. Visit [chat.openai.com](https://chat.openai.com)
3. Start or continue any conversation
4. The extension automatically detects and saves messages
5. Look for the ✓ badge on the extension icon when saved

### Viewing Offline Archive
1. Click the extension icon in the toolbar
2. Click "View Offline Archive" 
3. Browse your conversations with the same ChatGPT UI
4. Use search (press `/`) to find specific conversations or messages

### Export/Import Data
- **Export**: Extension popup → "Export All Data" or Settings page
- **Import**: Settings page → "Import Data" → select JSON file
- **Format**: Standard JSON with full conversation history

## 🔧 Extension Components

### Core Files
- `manifest.json` - Extension configuration and permissions
- `content.js` - Scrapes conversations from ChatGPT pages
- `background.js` - Handles data storage and extension events
- `popup.html/js` - Quick access popup interface
- `viewer.html/js/css` - Offline ChatGPT UI replica
- `options.html/js` - Settings and data management page

### Key Features Implementation

#### Content Scraping
- Uses `MutationObserver` to detect new messages
- Semantic selectors for resilience to UI changes
- Extracts markdown, code blocks, and formatting
- Preserves message roles (user/assistant)

#### Local Storage
- IndexedDB-like storage using `chrome.storage.local`
- Conversation metadata and full message history
- Efficient search indexing
- Export/import functionality

#### UI Replication
- CSS variables for theme switching
- Responsive design matching ChatGPT
- Code syntax highlighting
- Markdown rendering
- Keyboard shortcuts (`/` for search, `Esc` to close)

## 🛡️ Privacy & Security

- **Local Only**: All data stored locally using browser storage APIs
- **No Network Calls**: Extension never sends data to external servers
- **No Tracking**: Zero analytics or user behavior monitoring
- **Open Source**: Full code transparency
- **Secure Storage**: Uses browser's built-in storage encryption

## ⚙️ Settings

Access via extension popup → "Settings" or right-click extension icon → "Options":

- **Auto-save**: Toggle automatic conversation saving
- **Dark Mode**: Default theme for offline viewer
- **Export Format**: JSON backup format
- **Clear Data**: Remove all saved conversations

## 🔍 Troubleshooting

### Extension Not Saving Conversations
1. Check if you're on `chat.openai.com`
2. Refresh the ChatGPT page
3. Look for the extension badge indicator
4. Try manual save from popup

### Offline Viewer Not Loading
1. Ensure conversations are saved first
2. Check browser console for errors
3. Try refreshing the viewer page
4. Verify extension permissions

### Import/Export Issues
1. Ensure JSON file is valid format
2. Check file size limits
3. Try smaller batches for large archives
4. Verify file permissions

## 🚧 Future Enhancements

- **Multi-Account Support**: Handle multiple ChatGPT accounts
- **Conversation Tags**: Manual categorization system
- **Advanced Search**: Filters by date, length, topics
- **HTML Export**: Static HTML files for sharing
- **Encrypted Backups**: Password-protected archives
- **Sync Options**: Optional cloud backup integration

## 📋 Technical Requirements

- **Firefox**: Version 88+ (Manifest V3 support)
- **Permissions**: 
  - `activeTab` - Access current ChatGPT tab
  - `storage` - Local data persistence
  - `scripting` - Content script injection
  - `tabs` - Tab management for viewer
- **Storage**: ~1MB per 100 conversations (varies by length)

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature-name`
3. Make changes and test thoroughly
4. Submit pull request with detailed description

### Development Setup
```bash
# Clone repository
git clone <repo-url>
cd chatgptofffline

# Load in Firefox for testing
# about:debugging → Load Temporary Add-on → manifest.json

# Package for distribution
zip -r chatgpt-archive.xpi manifest.json *.js *.html *.css
```

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

- **Issues**: Report bugs via GitHub Issues
- **Feature Requests**: Submit enhancement proposals
- **Documentation**: Check README and inline code comments

---

**Note**: This extension is not affiliated with OpenAI. It's an independent tool for personal conversation archiving.