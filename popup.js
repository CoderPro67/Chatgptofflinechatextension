// Popup script for handling user interactions
class PopupController {
  constructor() {
    this.init();
  }

  async init() {
    await this.loadStats();
    this.setupEventListeners();
  }

  async loadStats() {
    try {
      const conversations = await this.getConversations();
      const chatCount = Object.keys(conversations).length;
      
      document.getElementById('chatCount').textContent = chatCount;
      
      if (chatCount > 0) {
        const lastChat = Object.values(conversations)
          .sort((a, b) => new Date(b.lastUpdated || b.createdAt) - new Date(a.lastUpdated || a.createdAt))[0];
        
        const lastSavedDate = new Date(lastChat.lastUpdated || lastChat.createdAt);
        document.getElementById('lastSaved').textContent = this.formatDate(lastSavedDate);
      } else {
        document.getElementById('lastSaved').textContent = 'Never';
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      this.setStatus('Error loading data');
    }
  }

  setupEventListeners() {
    document.getElementById('viewOffline').addEventListener('click', () => {
      this.openOfflineViewer();
    });

    document.getElementById('saveNow').addEventListener('click', () => {
      this.saveCurrentChat();
    });

    document.getElementById('exportData').addEventListener('click', () => {
      this.exportData();
    });

    document.getElementById('openOptions').addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
      window.close();
    });
  }

  async getConversations() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getConversations' }, resolve);
    });
  }

  openOfflineViewer() {
    const viewerUrl = chrome.runtime.getURL('viewer.html');
    chrome.tabs.create({ url: viewerUrl });
    window.close();
  }

  async saveCurrentChat() {
    try {
      this.setStatus('Saving current chat...', true);
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url.includes('chat.openai.com') && !tab.url.includes('chatgpt.com')) {
        this.setStatus('Please open a ChatGPT conversation first');
        return;
      }

      // Inject content script to force save
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          console.log('Manual save triggered');
          // Create a new scraper instance to force extraction
          const scraper = {
            extractCurrentConversation() {
              console.log('Extracting conversation...');
              
              const conversationId = window.location.pathname.match(/\/c\/([^\/]+)/)?.[1] || `temp_${Date.now()}`;
              console.log('Conversation ID:', conversationId);
              
              // Simple message extraction - look for actual conversation content
              const messages = [];
              const seenContent = new Set(); // Track seen content to avoid duplicates
              
              // Look for the main conversation container
              const conversationContainer = document.querySelector('main') || document.querySelector('[role="main"]') || document.body;
              
              // Find message elements with better selectors
              const messageElements = conversationContainer.querySelectorAll('[data-message-author-role]');
              
              if (messageElements.length === 0) {
                // Fallback: look for conversation turns
                const turnElements = conversationContainer.querySelectorAll('div[class*="group"][class*="w-full"]');
                turnElements.forEach((element, index) => {
                  const text = element.textContent?.trim();
                  if (text && text.length > 20 && text.length < 10000 && 
                      !seenContent.has(text) &&
                      !text.includes('window.__oai') && 
                      !text.includes('ChatGPT can make mistakes') &&
                      !text.includes('requestAnimationFrame')) {
                    
                    seenContent.add(text);
                    messages.push({
                      id: `msg_${messages.length}`,
                      role: messages.length % 2 === 0 ? 'user' : 'assistant',
                      content: text,
                      html: element.innerHTML,
                      timestamp: new Date().toISOString()
                    });
                  }
                });
              } else {
                messageElements.forEach((element, index) => {
                  try {
                    // Get the actual message content
                    const messageContent = element.querySelector('[class*="markdown"], .prose, [data-message-content]') || element;
                    
                    // Clean the content
                    const clone = messageContent.cloneNode(true);
                    
                    // Remove unwanted elements
                    clone.querySelectorAll('button, svg, script, style, [role="button"], .copy-button').forEach(el => el.remove());
                    
                    const text = clone.textContent?.trim();
                    
                    // Only include if it's unique and looks like actual message content
                    if (text && text.length > 10 && text.length < 10000 && 
                        !seenContent.has(text) &&
                        !text.includes('window.__oai') && 
                        !text.includes('ChatGPT can make mistakes') &&
                        !text.includes('requestAnimationFrame') &&
                        !text.includes('.starburst')) {
                      
                      seenContent.add(text);
                      const role = element.getAttribute('data-message-author-role') || 
                                 (messages.length % 2 === 0 ? 'user' : 'assistant');
                      
                      messages.push({
                        id: `msg_${messages.length}`,
                        role: role,
                        content: text,
                        html: clone.innerHTML,
                        timestamp: new Date().toISOString()
                      });
                    }
                  } catch (error) {
                    console.error('Error processing message:', error);
                  }
                });
              }
              
              console.log('Found messages:', messages.length);
              
              if (messages.length > 0) {
                const conversation = {
                  id: conversationId,
                  title: document.title || 'Untitled Chat',
                  createdAt: new Date().toISOString(),
                  messages: messages,
                  url: window.location.href
                };
                
                console.log('Sending conversation to background:', conversation);
                
                chrome.runtime.sendMessage({
                  action: 'saveConversation',
                  conversation: conversation
                });
              }
            }
          };
          
          scraper.extractCurrentConversation();
        }
      });

      this.setStatus('Chat saved successfully!');
      setTimeout(() => this.loadStats(), 1000);
      
    } catch (error) {
      console.error('Error saving chat:', error);
      this.setStatus('Error saving chat');
    }
  }

  async exportData() {
    try {
      this.setStatus('Exporting data...', true);
      
      const data = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'exportData' }, resolve);
      });

      if (data) {
        this.downloadFile(data, `chatgpt-archive-${new Date().toISOString().split('T')[0]}.json`);
        this.setStatus('Data exported successfully!');
      } else {
        this.setStatus('Error exporting data');
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      this.setStatus('Error exporting data');
    }
  }

  downloadFile(content, filename) {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: true
    });
  }

  setStatus(message, loading = false) {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.classList.toggle('loading', loading);
    
    if (!loading && message !== 'Ready') {
      setTimeout(() => {
        statusEl.textContent = 'Ready';
        statusEl.classList.remove('loading');
      }, 3000);
    }
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

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});