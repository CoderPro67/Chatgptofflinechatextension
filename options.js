// Options page controller
class OptionsController {
  constructor() {
    this.settings = {};
    this.init();
  }

  async init() {
    await this.loadSettings();
    await this.loadStats();
    this.setupEventListeners();
    this.updateUI();
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(['settings']);
      this.settings = result.settings || {
        autoSave: true,
        darkMode: false,
        exportFormat: 'json'
      };
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  async loadStats() {
    try {
      const conversations = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'getConversations' }, resolve);
      });

      const totalChats = Object.keys(conversations).length;
      let totalMessages = 0;
      let storageSize = 0;

      Object.values(conversations).forEach(conv => {
        totalMessages += conv.messages?.length || 0;
        storageSize += JSON.stringify(conv).length;
      });

      document.getElementById('totalChats').textContent = totalChats;
      document.getElementById('totalMessages').textContent = totalMessages;
      document.getElementById('storageUsed').textContent = this.formatBytes(storageSize);

    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  setupEventListeners() {
    // Toggle switches
    document.getElementById('autoSaveToggle').addEventListener('click', () => {
      this.toggleSetting('autoSave');
    });

    document.getElementById('darkModeToggle').addEventListener('click', () => {
      this.toggleSetting('darkMode');
    });

    // Buttons
    document.getElementById('exportBtn').addEventListener('click', () => {
      this.exportData();
    });

    document.getElementById('importBtn').addEventListener('click', () => {
      document.getElementById('importFile').click();
    });

    document.getElementById('viewOfflineBtn').addEventListener('click', () => {
      this.openOfflineViewer();
    });

    document.getElementById('clearAllBtn').addEventListener('click', () => {
      this.clearAllData();
    });

    // File import
    document.getElementById('importFile').addEventListener('change', (e) => {
      this.importData(e.target.files[0]);
    });
  }

  updateUI() {
    // Update toggle states
    document.getElementById('autoSaveToggle').classList.toggle('active', this.settings.autoSave);
    document.getElementById('darkModeToggle').classList.toggle('active', this.settings.darkMode);
  }

  async toggleSetting(key) {
    this.settings[key] = !this.settings[key];
    await this.saveSettings();
    this.updateUI();
    this.showStatus(`${key} ${this.settings[key] ? 'enabled' : 'disabled'}`, 'success');
  }

  async saveSettings() {
    try {
      await chrome.storage.local.set({ settings: this.settings });
    } catch (error) {
      console.error('Error saving settings:', error);
      this.showStatus('Error saving settings', 'error');
    }
  }

  async exportData() {
    try {
      this.showStatus('Exporting data...', 'success');
      
      const data = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'exportData' }, resolve);
      });

      if (data) {
        this.downloadFile(data, `chatgpt-archive-${new Date().toISOString().split('T')[0]}.json`);
        this.showStatus('Data exported successfully!', 'success');
      } else {
        this.showStatus('Error exporting data', 'error');
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      this.showStatus('Error exporting data', 'error');
    }
  }

  async importData(file) {
    if (!file) return;
    
    try {
      this.showStatus('Importing data...', 'success');
      
      const text = await file.text();
      const result = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ 
          action: 'importData', 
          data: text 
        }, resolve);
      });

      if (result.success) {
        this.showStatus(`Successfully imported ${result.count} conversations`, 'success');
        await this.loadStats(); // Refresh stats
      } else {
        this.showStatus(`Import failed: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Error importing data:', error);
      this.showStatus('Error importing data', 'error');
    }
  }

  openOfflineViewer() {
    const viewerUrl = chrome.runtime.getURL('viewer.html');
    chrome.tabs.create({ url: viewerUrl });
  }

  async clearAllData() {
    const confirmed = confirm(
      'Are you sure you want to delete ALL saved conversations? This cannot be undone.\n\n' +
      'Consider exporting your data first as a backup.'
    );
    
    if (!confirmed) return;
    
    const doubleConfirm = confirm(
      'This will permanently delete all your saved ChatGPT conversations. Are you absolutely sure?'
    );
    
    if (!doubleConfirm) return;
    
    try {
      await chrome.storage.local.set({ conversations: {} });
      this.showStatus('All data cleared successfully', 'success');
      await this.loadStats(); // Refresh stats
    } catch (error) {
      console.error('Error clearing data:', error);
      this.showStatus('Error clearing data', 'error');
    }
  }

  downloadFile(content, filename) {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  showStatus(message, type) {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
    statusEl.style.display = 'block';
    
    setTimeout(() => {
      statusEl.style.display = 'none';
    }, 5000);
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}

// Initialize options page when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new OptionsController();
});