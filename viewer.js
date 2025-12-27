// Offline viewer controller
class ChatGPTViewer {
  constructor() {
    this.conversations = {};
    this.currentConversationId = null;
    this.searchQuery = '';
    this.isDarkMode = false;
    this.init();
  }

  async init() {
    await this.loadConversations();
    this.setupEventListeners();
    this.loadTheme();
    this.renderConversationList();
  }

  async loadConversations() {
    try {
      this.conversations = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'getConversations' }, resolve);
      });
    } catch (error) {
      console.error('Error loading conversations:', error);
      this.conversations = {};
    }
  }

  setupEventListeners() {
    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', () => {
      this.toggleTheme();
    });

    // Search toggle
    document.getElementById('searchToggle').addEventListener('click', () => {
      this.toggleSearch();
    });

    // Search input
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase();
      this.renderConversationList();
    });

    // Clear search
    document.getElementById('clearSearch').addEventListener('click', () => {
      searchInput.value = '';
      this.searchQuery = '';
      this.renderConversationList();
      this.toggleSearch();
    });

    // Export/Import
    document.getElementById('exportBtn').addEventListener('click', () => {
      this.exportData();
    });

    document.getElementById('importBtn').addEventListener('click', () => {
      document.getElementById('importFile').click();
    });

    document.getElementById('importFile').addEventListener('change', (e) => {
      this.importData(e.target.files[0]);
    });

    // Delete chat
    document.getElementById('deleteChat').addEventListener('click', () => {
      this.deleteCurrentChat();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        this.toggleSearch();
        document.getElementById('searchInput').focus();
      }
      
      if (e.key === 'Escape') {
        if (document.getElementById('searchContainer').style.display !== 'none') {
          this.toggleSearch();
        }
      }
    });
  }

  loadTheme() {
    const savedTheme = localStorage.getItem('chatgpt-archive-theme');
    this.isDarkMode = savedTheme === 'dark';
    this.applyTheme();
  }

  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
    this.applyTheme();
    localStorage.setItem('chatgpt-archive-theme', this.isDarkMode ? 'dark' : 'light');
  }

  applyTheme() {
    document.body.className = this.isDarkMode ? 'dark-mode' : 'light-mode';
    document.getElementById('themeToggle').textContent = this.isDarkMode ? '☀️' : '🌙';
  }

  toggleSearch() {
    const searchContainer = document.getElementById('searchContainer');
    const isVisible = searchContainer.style.display !== 'none';
    
    searchContainer.style.display = isVisible ? 'none' : 'block';
    
    if (!isVisible) {
      document.getElementById('searchInput').focus();
    }
  }

  renderConversationList() {
    const listContainer = document.getElementById('conversationList');
    const conversations = Object.values(this.conversations);
    
    if (conversations.length === 0) {
      listContainer.innerHTML = '<div class="loading">No conversations saved yet</div>';
      return;
    }

    // Filter conversations based on search
    const filteredConversations = conversations.filter(conv => {
      if (!this.searchQuery) return true;
      
      const titleMatch = conv.title.toLowerCase().includes(this.searchQuery);
      const contentMatch = conv.messages.some(msg => 
        msg.content.toLowerCase().includes(this.searchQuery)
      );
      
      return titleMatch || contentMatch;
    });

    // Sort by last updated
    filteredConversations.sort((a, b) => {
      const dateA = new Date(a.lastUpdated || a.createdAt);
      const dateB = new Date(b.lastUpdated || b.createdAt);
      return dateB - dateA;
    });

    listContainer.innerHTML = '';

    filteredConversations.forEach(conversation => {
      const item = this.createConversationItem(conversation);
      listContainer.appendChild(item);
    });

    if (filteredConversations.length === 0) {
      listContainer.innerHTML = '<div class="loading">No conversations match your search</div>';
    }
  }

  createConversationItem(conversation) {
    const template = document.getElementById('conversationItemTemplate');
    const item = template.content.cloneNode(true);
    
    const container = item.querySelector('.conversation-item');
    container.dataset.id = conversation.id;
    
    const title = item.querySelector('.conversation-title');
    title.textContent = conversation.title;
    
    const date = item.querySelector('.conversation-date');
    const conversationDate = new Date(conversation.lastUpdated || conversation.createdAt);
    date.textContent = this.formatDate(conversationDate);
    
    container.addEventListener('click', () => {
      this.selectConversation(conversation.id);
    });
    
    if (conversation.id === this.currentConversationId) {
      container.classList.add('active');
    }
    
    return item;
  }

  selectConversation(conversationId) {
    this.currentConversationId = conversationId;
    
    // Update active state in sidebar
    document.querySelectorAll('.conversation-item').forEach(item => {
      item.classList.toggle('active', item.dataset.id === conversationId);
    });
    
    this.renderConversation(conversationId);
  }

  renderConversation(conversationId) {
    const conversation = this.conversations[conversationId];
    if (!conversation) return;
    
    // Update header
    document.getElementById('chatTitle').textContent = conversation.title;
    document.getElementById('deleteChat').style.display = 'block';
    
    // Render messages
    const container = document.getElementById('chatContainer');
    container.innerHTML = '';
    
    conversation.messages.forEach(message => {
      const messageElement = this.createMessageElement(message);
      container.appendChild(messageElement);
    });
    
    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
  }

  createMessageElement(message) {
    const template = document.getElementById('messageTemplate');
    const element = template.content.cloneNode(true);
    
    const messageDiv = element.querySelector('.message');
    messageDiv.dataset.role = message.role;
    
    const messageText = element.querySelector('.message-text');
    
    // Use HTML if available and clean, otherwise process the text content
    if (message.html && message.html.length > 0 && !message.html.includes('window.__oai')) {
      // Clean the HTML
      let cleanHtml = message.html
        .replace(/window\.__oai[\s\S]*?;/g, '')
        .replace(/requestAnimationFrame[\s\S]*?\)\)/g, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '');
      
      messageText.innerHTML = cleanHtml;
    } else {
      // Process content for better display
      const processedContent = this.processMessageContent(message.content);
      messageText.innerHTML = processedContent;
    }
    
    return element;
  }

  processMessageContent(content) {
    // Clean up the content first
    let processed = content
      // Remove script/style content
      .replace(/window\.__oai[\s\S]*?;/g, '')
      .replace(/requestAnimationFrame[\s\S]*?\)\)/g, '')
      .replace(/\.starburst[\s\S]*?}/g, '')
      // Basic markdown-like processing
      .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Line breaks
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
    
    // Wrap in paragraphs if not already formatted
    if (!processed.includes('<') && processed.length > 0) {
      processed = '<p>' + processed + '</p>';
    }
    
    return processed;
  }

  async exportData() {
    try {
      const data = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'exportData' }, resolve);
      });

      if (data) {
        this.downloadFile(data, `chatgpt-archive-${new Date().toISOString().split('T')[0]}.json`);
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Error exporting data');
    }
  }

  async importData(file) {
    if (!file) return;
    
    try {
      const text = await file.text();
      const result = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ 
          action: 'importData', 
          data: text 
        }, resolve);
      });

      if (result.success) {
        alert(`Successfully imported ${result.count} conversations`);
        await this.loadConversations();
        this.renderConversationList();
      } else {
        alert(`Import failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Error importing data:', error);
      alert('Error importing data');
    }
  }

  async deleteCurrentChat() {
    if (!this.currentConversationId) return;
    
    const conversation = this.conversations[this.currentConversationId];
    if (!confirm(`Delete "${conversation.title}"? This cannot be undone.`)) {
      return;
    }
    
    try {
      chrome.runtime.sendMessage({
        action: 'deleteConversation',
        id: this.currentConversationId
      });
      
      delete this.conversations[this.currentConversationId];
      this.currentConversationId = null;
      
      // Reset UI
      document.getElementById('chatTitle').textContent = 'Select a conversation';
      document.getElementById('deleteChat').style.display = 'none';
      document.getElementById('chatContainer').innerHTML = `
        <div class="welcome-screen">
          <div class="welcome-content">
            <h2>ChatGPT Archive</h2>
            <p>Your conversations are saved locally and available offline.</p>
            <p>Select a conversation from the sidebar to start browsing.</p>
          </div>
        </div>
      `;
      
      this.renderConversationList();
      
    } catch (error) {
      console.error('Error deleting conversation:', error);
      alert('Error deleting conversation');
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

  formatDate(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString();
  }
}

// Initialize viewer when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new ChatGPTViewer();
});