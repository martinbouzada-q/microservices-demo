/**
 * Add-to-Cart AJAX Module
 *
 * Handles AJAX requests for adding products to cart without page navigation.
 * Provides real-time feedback via toast notifications and cart badge updates.
 * Includes debouncing, error handling, and accessibility features.
 */

class CartManager {
  constructor() {
    this.isLoading = false;
    this.debounceDelay = 100; // ms
  }

  /**
   * Initialize cart functionality when DOM is ready
   */
  static initialize() {
    const cart = new CartManager();

    // Intercept Add to Cart form submissions
    document.querySelectorAll('form[action*="/cart"]').forEach(form => {
      form.addEventListener('submit', (e) => {
        // Check if this is a quantity selection form that should add to cart
        const submitBtn = e.submitter;
        if (submitBtn && submitBtn.textContent.includes('Add to Cart')) {
          e.preventDefault();
          cart.handleAddToCart(form);
        }
      });
    });

    // Also handle button clicks directly
    document.querySelectorAll('button.add-to-cart-btn, button[data-action="add-to-cart"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const form = btn.closest('form') || btn.parentElement;
        cart.handleAddToCart(form);
      });
    });
  }

  /**
   * Handle Add to Cart button click
   * @param {HTMLElement} form - The form containing product and quantity
   */
  async handleAddToCart(form) {
    if (this.isLoading) {
      console.warn('Cart operation already in progress');
      return;
    }

    // Extract product ID and quantity
    let productId = form.querySelector('[name="product_id"]')?.value ||
                    form.getAttribute('data-product-id');
    let quantity = parseInt(form.querySelector('[name="quantity"]')?.value || 1);

    if (!productId || quantity <= 0) {
      console.warn('Missing product ID or invalid quantity');
      return;
    }

    const button = form.querySelector('button[type="submit"], button.add-to-cart-btn');

    try {
      await this.addToCart(productId, quantity, button);
    } catch (error) {
      console.error('Add to cart failed:', error);
      this.showToast('error', 'An unexpected error occurred. Please try again.');
      this.setButtonLoading(button, false);
    }
  }

  /**
   * Send add-to-cart request to API
   * @param {string} productId - Product ID
   * @param {number} quantity - Quantity to add
   * @param {HTMLElement} button - Button element to show loading state
   */
  async addToCart(productId, quantity, button) {
    this.setButtonLoading(button, true);

    try {
      const response = await fetch('/api/cart/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId: productId,
          quantity: quantity
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Success: Update badge and show confirmation
        this.updateCartBadge(data.cartSize);
        this.showToast('success', data.message || `Added to cart`);

        // Optional: Scroll to top to see toast
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        // Error response from server
        this.showToast('error', data.error || 'Failed to add item to cart');

        // If error is retryable, offer retry
        if (data.retryable) {
          this.addRetryButton(button, productId, quantity);
        }
      }
    } catch (error) {
      console.error('Network error:', error);
      this.showToast('error', 'Network error. Please check your connection and try again.');

      // Offer retry for network errors
      if (button) {
        this.addRetryButton(button, productId, quantity);
      }
    } finally {
      this.setButtonLoading(button, false);
    }
  }

  /**
   * Update cart badge with new count
   * @param {number} count - New cart item count
   */
  updateCartBadge(count) {
    const badge = document.getElementById('cart-count') ||
                  document.querySelector('[class*="cart-badge"], [class*="cartCount"]');

    if (badge) {
      const oldCount = parseInt(badge.textContent);
      badge.textContent = count;

      // Add animation class if count changed
      if (oldCount !== count) {
        badge.classList.add('cart-badge-updated');
        setTimeout(() => {
          badge.classList.remove('cart-badge-updated');
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
   * Add retry button to a failed operation
   * @param {HTMLElement} button - Original button element
   * @param {string} productId - Product ID
   * @param {number} quantity - Quantity
   */
  addRetryButton(button, productId, quantity) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const retryToast = document.createElement('div');
    retryToast.className = 'toast toast-error';

    const retryBtn = document.createElement('button');
    retryBtn.textContent = 'Retry';
    retryBtn.className = 'toast-retry-btn';
    retryBtn.addEventListener('click', () => {
      retryToast.remove();
      this.addToCart(productId, quantity, button);
    });

    retryToast.appendChild(retryBtn);
    container.appendChild(retryToast);

    // Auto-remove retry toast after 5 seconds
    setTimeout(() => {
      if (retryToast.parentElement) {
        retryToast.remove();
      }
    }, 5000);
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
      const textSpan = button.querySelector('.btn-text') || button.querySelector('span:first-child');
      if (textSpan) {
        textSpan.style.display = 'none';
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
      const textSpan = button.querySelector('.btn-text') || button.querySelector('span:first-child');
      if (textSpan) {
        textSpan.style.display = 'inline';
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
  document.addEventListener('DOMContentLoaded', () => CartManager.initialize());
} else {
  CartManager.initialize();
}
