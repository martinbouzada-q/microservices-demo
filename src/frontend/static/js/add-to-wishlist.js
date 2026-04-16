/**
 * Add-to-Wishlist AJAX Module
 *
 * Handles AJAX requests for adding/removing products to wishlist without page navigation.
 * Provides real-time feedback via toast notifications, button state changes, and wishlist badge updates.
 * Includes debouncing, error handling, and accessibility features.
 */

class WishlistManager {
  constructor() {
    this.isLoading = false;
    this.debounceDelay = 100; // ms
    this.wishlistItems = new Set(); // Track items in wishlist
  }

  /**
   * Initialize wishlist functionality when DOM is ready
   */
  static initialize() {
    const wishlist = new WishlistManager();

    // Load initial wishlist state from data attribute if available
    wishlist.loadWishlistState();

    // Intercept wishlist form submissions
    document.querySelectorAll('form[action*="/wishlist"]').forEach(form => {
      form.addEventListener('submit', (e) => {
        const submitBtn = e.submitter;
        if (submitBtn && (submitBtn.textContent.includes('Add to Wishlist') || submitBtn.textContent.includes('Remove from Wishlist'))) {
          e.preventDefault();
          const isAdding = submitBtn.textContent.includes('Add to Wishlist');
          wishlist.handleWishlistAction(form, isAdding);
        }
      });
    });

    // Also handle button clicks directly
    document.querySelectorAll('button.add-to-wishlist-btn, button[data-action="add-to-wishlist"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const form = btn.closest('form') || btn.parentElement;
        const isAdding = btn.textContent.includes('Add to Wishlist');
        wishlist.handleWishlistAction(form, isAdding);
      });
    });
  }

  /**
   * Load the current wishlist state (for toggle functionality)
   * This is called on page load to know which items are in the wishlist
   */
  loadWishlistState() {
    // Check if there's a data attribute with wishlist items
    const bodyElement = document.querySelector('body');
    const wishlistData = bodyElement?.getAttribute('data-wishlist-items');

    if (wishlistData) {
      try {
        const items = JSON.parse(wishlistData);
        this.wishlistItems = new Set(items);
      } catch (e) {
        console.warn('Could not parse wishlist data:', e);
      }
    }

    // For now, we'll rely on the button's state being correct
    // In a real app, we might fetch the wishlist via API
  }

  /**
   * Handle Add/Remove from Wishlist button click
   * @param {HTMLElement} form - The form containing product ID
   * @param {boolean} isAdding - Whether we're adding (true) or removing (false)
   */
  async handleWishlistAction(form, isAdding) {
    if (this.isLoading) {
      console.warn('Wishlist operation already in progress');
      return;
    }

    // Extract product ID
    let productId = form.querySelector('[name="product_id"]')?.value ||
                    form.getAttribute('data-product-id');

    if (!productId) {
      console.warn('Missing product ID');
      return;
    }

    const button = form.querySelector('button[type="submit"], button.add-to-wishlist-btn');

    try {
      if (isAdding) {
        await this.addToWishlist(productId, button, form);
      } else {
        await this.removeFromWishlist(productId, button, form);
      }
    } catch (error) {
      console.error('Wishlist action failed:', error);
      this.showToast('error', 'An unexpected error occurred. Please try again.');
      this.setButtonLoading(button, false);
    }
  }

  /**
   * Send add-to-wishlist request to API
   * @param {string} productId - Product ID
   * @param {HTMLElement} button - Button element to show loading state
   * @param {HTMLElement} form - Form element
   */
  async addToWishlist(productId, button, form) {
    this.setButtonLoading(button, true);

    try {
      const response = await fetch('/wishlist/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          product_id: productId
        })
      });

      if (response.ok) {
        // Success: Update button state and show confirmation
        this.updateWishlistButton(button, true); // true = now in wishlist
        this.updateWishlistBadge(1); // increment
        this.showToast('success', 'Added to your wishlist');
        this.wishlistItems.add(productId);
      } else {
        // Error response
        this.showToast('error', 'Failed to add to wishlist');
      }
    } catch (error) {
      console.error('Network error:', error);
      this.showToast('error', 'Network error. Please check your connection and try again.');
    } finally {
      this.setButtonLoading(button, false);
    }
  }

  /**
   * Send remove-from-wishlist request to API
   * @param {string} productId - Product ID
   * @param {HTMLElement} button - Button element to show loading state
   * @param {HTMLElement} form - Form element
   */
  async removeFromWishlist(productId, button, form) {
    this.setButtonLoading(button, true);

    try {
      const response = await fetch('/wishlist/remove', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          product_id: productId
        })
      });

      if (response.ok) {
        // Success: Update button state and show confirmation
        this.updateWishlistButton(button, false); // false = no longer in wishlist
        this.updateWishlistBadge(-1); // decrement
        this.showToast('success', 'Removed from wishlist');
        this.wishlistItems.delete(productId);
      } else {
        // Error response
        this.showToast('error', 'Failed to remove from wishlist');
      }
    } catch (error) {
      console.error('Network error:', error);
      this.showToast('error', 'Network error. Please check your connection and try again.');
    } finally {
      this.setButtonLoading(button, false);
    }
  }

  /**
   * Update wishlist button state and text
   * @param {HTMLElement} button - Button element
   * @param {boolean} inWishlist - Whether item is now in wishlist
   */
  updateWishlistButton(button, inWishlist) {
    if (!button) return;

    const textSpan = button.querySelector('.btn-text') || button;

    if (inWishlist) {
      textSpan.textContent = 'Remove from Wishlist';
      button.classList.add('wishlist-active');
      button.classList.remove('wishlist-inactive');
    } else {
      textSpan.textContent = 'Add to Wishlist';
      button.classList.add('wishlist-inactive');
      button.classList.remove('wishlist-active');
    }
  }

  /**
   * Update wishlist badge with new count
   * @param {number} delta - Change amount (+1 for add, -1 for remove)
   */
  updateWishlistBadge(delta) {
    const badge = document.getElementById('wishlist-count') ||
                  document.querySelector('[class*="wishlist-badge"], [class*="wishlistCount"]');

    if (badge) {
      const oldCount = parseInt(badge.textContent) || 0;
      const newCount = Math.max(0, oldCount + delta);
      badge.textContent = newCount;

      // Add animation class if count changed
      if (oldCount !== newCount) {
        badge.classList.add('wishlist-badge-updated');
        setTimeout(() => {
          badge.classList.remove('wishlist-badge-updated');
        }, 300);
      }
    }
  }

  /**
   * Display toast notification
   * @param {string} type - 'success' or 'error'
   * @param {string} message - Notification message
   * @param {number} duration - Auto-dismiss duration in ms (0 = no auto-dismiss)
   */
  showToast(type, message, duration = 4000) {
    // Create toast container if it doesn't exist
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('aria-atomic', 'true');
      container.setAttribute('role', 'status');
      document.body.appendChild(container);
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');

    // Create message span
    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;
    toast.appendChild(messageSpan);

    // Create close button
    const closeBtn = document.createElement('button');
    closeBtn.setAttribute('aria-label', 'Close notification');
    closeBtn.textContent = '×';
    closeBtn.className = 'toast-close';
    closeBtn.addEventListener('click', () => toast.remove());
    toast.appendChild(closeBtn);

    // Add to container
    container.appendChild(toast);

    // Auto-dismiss
    if (duration > 0) {
      setTimeout(() => {
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 300);
      }, duration);
    }

    return toast;
  }

  /**
   * Set button loading state
   * Shows spinner, disables button
   * @param {HTMLElement} button - Button element
   * @param {boolean} isLoading - Loading state
   */
  setButtonLoading(button, isLoading) {
    this.isLoading = isLoading;

    if (!button) return;

    if (isLoading) {
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');

      // Hide button text, show spinner
      const textSpan = button.querySelector('.btn-text') || button;
      const originalText = textSpan.textContent;
      textSpan.setAttribute('data-original-text', originalText);

      // Store and hide original content
      const content = button.querySelector('span:not(.btn-spinner)');
      if (content) {
        content.style.display = 'none';
      }

      // Show or create spinner
      let spinner = button.querySelector('.btn-spinner');
      if (!spinner) {
        spinner = document.createElement('span');
        spinner.className = 'btn-spinner';
        spinner.innerHTML = '<i class="spinner-icon"></i>';
        button.appendChild(spinner);
      }
      spinner.style.display = 'inline-block';
    } else {
      button.disabled = false;
      button.setAttribute('aria-busy', 'false');

      // Show button text, hide spinner
      const content = button.querySelector('span:not(.btn-spinner)');
      if (content) {
        content.style.display = 'inline';
      }

      const spinner = button.querySelector('.btn-spinner');
      if (spinner) {
        spinner.style.display = 'none';
      }
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => WishlistManager.initialize());
} else {
  WishlistManager.initialize();
}
