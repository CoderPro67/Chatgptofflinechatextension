// Background script for handling storage and extension events
class ChatGPTArchiveBackground {
  constructor() {
    this.setupMessageListener();
    this.setupInstallListener();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.action) {
        case 'saveConversation':
          this.saveConversation(message.conversation);
          break;
        case 'getConversations':
          this.getConversations().then(sendResponse);
          return true; // Keep message channel open for async response
        case 'deleteConversation':
          this.deleteConversation(message.id);
          break;
        case 'exportData':
          this.exportData().then(sendResponse);
          return true;
        case 'importData':
          this.importData(message.data).then(sendResponse);
          return true;
        case 'updateBadge':
          this.updateBadge(message.text, sender.tab?.id);
          break;
      }
    });
  }

  setupInstallListener() {
    chrome.runtime.onInstalled.addListener(() => {
      // Initialize storage
      this.initializeStorage();
    });
  }

  async initializeStorage() {
    const result = await chrome.storage.local.get(['conversations', 'settings']);
    
    if (!result.conversations) {
      await chrome.storage.local.set({ conversations: {} });
    }
    
    if (!result.settings) {
      await chrome.storage.local.set({
        settings: {
          autoSave: true,
          darkMode: false,
          exportFormat: 'json'
        }
      });
    }
  }

  async saveConversation(conversation) {
    try {
      const result = await chrome.storage.local.get(['conversations']);
      const conversations = result.conversations || {};
      
      // Check if conversation already exists and merge/deduplicate messages
      if (conversations[conversation.id]) {
        const existing = conversations[conversation.id];
        const existingContent = new Set(existing.messages.map(m => m.content));
        
        // Only add new unique messages
        const newMessages = conversation.messages.filter(msg => 
          !existingContent.has(msg.content)
        );
        
        if (newMessages.length > 0) {
          existing.messages = [...existing.messages, ...newMessages];
          existing.lastUpdated = new Date().toISOString();
          conversations[conversation.id] = existing;
        }
      } else {
        conversations[conversation.id] = {
          ...conversation,
          lastUpdated: new Date().toISOString()
        };
      }

      await chrome.storage.local.set({ conversations });
      console.log('Conversation saved:', conversation.id);
      
    } catch (error) {
      console.error('Error saving conversation:', error);
    }
  }

  async getConversations() {
    try {
      const result = await chrome.storage.local.get(['conversations']);
      return result.conversations || {};
    } catch (error) {
      console.error('Error getting conversations:', error);
      return {};
    }
  }

  async deleteConversation(id) {
    try {
      const result = await chrome.storage.local.get(['conversations']);
      const conversations = result.conversations || {};
      
      delete conversations[id];
      await chrome.storage.local.set({ conversations });
      
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  }

  async exportData() {
    try {
      const conversations = await this.getConversations();
      const exportData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        conversations: conversations
      };
      
      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('Error exporting data:', error);
      return null;
    }
  }

  async importData(jsonData) {
    try {
      const data = JSON.parse(jsonData);
      
      if (data.conversations) {
        await chrome.storage.local.set({ conversations: data.conversations });
        return { success: true, count: Object.keys(data.conversations).length };
      }
      
      return { success: false, error: 'Invalid data format' };
    } catch (error) {
      console.error('Error importing data:', error);
      return { success: false, error: error.message };
    }
  }

  updateBadge(text, tabId) {
    if (tabId) {
      chrome.action.setBadgeText({ text, tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#10a37f', tabId });
      
      // Clear badge after 3 seconds
      setTimeout(() => {
        chrome.action.setBadgeText({ text: '', tabId });
      }, 3000);
    }
  }
}

// Initialize background script
new ChatGPTArchiveBackground();