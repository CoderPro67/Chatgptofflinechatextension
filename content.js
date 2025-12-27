// Content script for scraping ChatGPT conversations
class ChatGPTScraper {
  constructor() {
    this.observer = null;
    this.currentConversation = null;
    this.isProcessing = false;
    this.init();
  }

  init() {
    this.setupObserver();
    this.extractCurrentConversation();
  }

  setupObserver() {
    this.observer = new MutationObserver((mutations) => {
      if (this.isProcessing) return;
      
      const hasNewMessages = mutations.some(mutation => 
        mutation.addedNodes.length > 0 && 
        Array.from(mutation.addedNodes).some(node => 
          node.nodeType === Node.ELEMENT_NODE && 
          (node.matches?.('[data-message-author-role]') || 
           node.querySelector?.('[data-message-author-role]'))
        )
      );

      if (hasNewMessages) {
        this.debounce(() => this.extractCurrentConversation(), 1000);
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  debounce(func, wait) {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(func, wait);
  }

  extractCurrentConversation() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const conversationId = this.getConversationId();
      const title = this.getConversationTitle();
      const messages = this.extractMessages();

      if (conversationId && messages.length > 0) {
        const conversation = {
          id: conversationId,
          title: title || 'Untitled Chat',
          createdAt: new Date().toISOString(),
          messages: messages,
          url: window.location.href
        };

        this.saveConversation(conversation);
      }
    } catch (error) {
      console.error('Error extracting conversation:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  getConversationId() {
    const urlMatch = window.location.pathname.match(/\/c\/([^\/]+)/);
    return urlMatch ? urlMatch[1] : `temp_${Date.now()}`;
  }

  getConversationTitle() {
    // Try multiple selectors for title
    const titleSelectors = [
      'h1',
      '[data-testid="conversation-title"]',
      '.text-xl',
      '.font-semibold',
      'title',
      'h2',
      '.text-lg'
    ];

    for (const selector of titleSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const text = element.textContent?.trim();
        if (text && text.length > 3 && text.length < 100 && 
            !text.includes('ChatGPT') && 
            !text.includes('New chat')) {
          console.log(`Found title: ${text}`);
          return text;
        }
      }
    }

    // Fallback: use URL or timestamp
    const urlTitle = window.location.pathname.split('/').pop();
    return urlTitle && urlTitle.length > 10 ? 
           `Chat ${urlTitle.substring(0, 8)}` : 
           `Chat ${new Date().toLocaleDateString()}`;
  }

  extractMessages() {
    const messages = [];
    
    // Updated selectors for current ChatGPT UI
    const messageSelectors = [
      '[data-message-author-role]',
      '[data-testid*="conversation-turn"]',
      '.group.w-full.text-token-text-primary',
      '.group.w-full',
      'div[class*="group"][class*="w-full"]'
    ];

    let messageElements = [];
    for (const selector of messageSelectors) {
      messageElements = document.querySelectorAll(selector);
      if (messageElements.length > 0) {
        console.log(`Found ${messageElements.length} messages with selector: ${selector}`);
        break;
      }
    }

    if (messageElements.length === 0) {
      // Fallback: look for any div containing user/assistant content
      const allDivs = document.querySelectorAll('div');
      messageElements = Array.from(allDivs).filter(div => {
        const text = div.textContent;
        return text && text.length > 10 && (
          div.querySelector('pre') || // Has code
          text.includes('You:') ||
          text.includes('ChatGPT:') ||
          div.closest('[role="presentation"]')
        );
      });
      console.log(`Fallback found ${messageElements.length} potential messages`);
    }

    messageElements.forEach((element, index) => {
      try {
        const role = this.getMessageRole(element, index);
        const content = this.getMessageContent(element);
        
        if (role && content && content.length > 5) {
          messages.push({
            id: `msg_${index}`,
            role: role,
            content: content,
            html: element.innerHTML,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error('Error extracting message:', error);
      }
    });

    console.log(`Extracted ${messages.length} messages total`);
    return messages;
  }

  getMessageRole(element, index) {
    // Check data attribute first
    const roleAttr = element.getAttribute('data-message-author-role');
    if (roleAttr) return roleAttr;

    // Look for role indicators in the element or its content
    const text = element.textContent.toLowerCase();
    
    // Check for user indicators
    if (element.querySelector('img[alt*="user"]') || 
        text.includes('you:') ||
        element.closest('[data-testid*="user"]')) {
      return 'user';
    }
    
    // Check for assistant indicators
    if (element.querySelector('svg') || // ChatGPT icon
        element.querySelector('.markdown') ||
        element.querySelector('pre code') ||
        text.includes('chatgpt:') ||
        element.closest('[data-testid*="assistant"]')) {
      return 'assistant';
    }

    // Fallback: alternate between user and assistant based on position
    return index % 2 === 0 ? 'user' : 'assistant';
  }

  getMessageContent(element) {
    // Try multiple approaches to get clean content
    const contentSelectors = [
      '.markdown',
      '[data-message-content]',
      '.prose',
      'div[class*="markdown"]',
      'div[class*="prose"]'
    ];
    
    let contentElement = null;
    for (const selector of contentSelectors) {
      contentElement = element.querySelector(selector);
      if (contentElement) break;
    }
    
    if (!contentElement) {
      contentElement = element;
    }

    // Remove unwanted elements
    const clone = contentElement.cloneNode(true);
    const unwantedSelectors = [
      'button',
      '.sr-only',
      '[aria-hidden="true"]',
      '.copy-button',
      'svg',
      '[role="button"]',
      'script',
      'style',
      'noscript'
    ];

    unwantedSelectors.forEach(selector => {
      clone.querySelectorAll(selector).forEach(el => el.remove());
    });

    let content = clone.textContent?.trim() || '';
    
    // Filter out unwanted content
    if (content.length < 5 || 
        content.includes('Copy code') ||
        content.includes('Regenerate') ||
        content.includes('window.__oai') ||
        content.includes('requestAnimationFrame') ||
        content.includes('.starburst') ||
        content.includes('ChatGPT can make mistakes') ||
        content.match(/^\d+\s*\/\s*\d+$/)) {
      return '';
    }

    return content;
  }

  async saveConversation(conversation) {
    try {
      console.log('Saving conversation:', conversation);
      
      // Send to background script for storage
      chrome.runtime.sendMessage({
        action: 'saveConversation',
        conversation: conversation
      });

      // Update extension badge
      chrome.runtime.sendMessage({
        action: 'updateBadge',
        text: '✓'
      });

      console.log('Conversation saved successfully');

    } catch (error) {
      console.error('Error saving conversation:', error);
    }
  }
}

// Initialize scraper when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new ChatGPTScraper());
} else {
  new ChatGPTScraper();
}