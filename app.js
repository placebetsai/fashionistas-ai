// Fashionistas.ai - AI-Powered Fashion Reselling
// AR Try-On, Closet Listing, Auto-Marketplace

class Fashionistas {
  constructor() {
    this.user = null;
    this.listings = [];
    this.marketplaces = ['poshmark', 'ebay', 'depop'];
  }

  async init() {
    console.log('[Fashionistas] Initializing...');
    this.setupEventListeners();
    await this.checkAuth();
    console.log('[Fashionistas] Ready!');
  }

  setupEventListeners() {
    // Start selling button
    const startBtn = document.querySelector('a[href="#start"]');
    if (startBtn) {
      startBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.showSignupModal();
      });
    }
  }

  async checkAuth() {
    const token = localStorage.getItem('fi_token');
    if (token) {
      try {
        const response = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          this.user = await response.json();
          this.updateUIForUser();
        }
      } catch (error) {
        console.log('[Fashionistas] Not authenticated');
      }
    }
  }

  updateUIForUser() {
    if (this.user) {
      const nav = document.querySelector('.nav-links');
      if (nav) {
        nav.innerHTML = `
          <a href="/dashboard">Dashboard</a>
          <a href="/closet">My Closet</a>
          <span class="user-name">${this.user.name}</span>
        `;
      }
    }
  }

  showSignupModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h2>Start Your Fashion Empire</h2>
        <p>Upload clothes, AI lists them everywhere. No inventory needed.</p>
        <form id="signup-form">
          <input type="text" placeholder="Your name" required>
          <input type="email" placeholder="Email address" required>
          <input type="password" placeholder="Password" required>
          <button type="submit" class="btn-primary">Start Selling Free</button>
        </form>
        <p class="login-link">Already have an account? <a href="/login">Log in</a></p>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('signup-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      await this.signup({
        name: formData.get('name'),
        email: formData.get('email'),
        password: formData.get('password')
      });
      modal.remove();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  async signup(data) {
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await response.json();
      if (result.token) {
        localStorage.setItem('fi_token', result.token);
        this.user = result.user;
        this.updateUIForUser();
        this.showNotification('Welcome to Fashionistas.ai! Start uploading clothes.');
      }
    } catch (error) {
      this.showNotification('Error creating account', 'error');
    }
  }

  // Create listing from uploaded photo
  async createListing(photos) {
    if (!this.user) {
      this.showSignupModal();
      return;
    }

    this.showNotification('AI is analyzing your clothes...');

    try {
      const formData = new FormData();
      photos.forEach(photo => formData.append('photos', photo));

      const response = await fetch('/api/listings/create', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('fi_token')}`
        },
        body: formData
      });
      const listing = await response.json();
      if (listing.id) {
        this.showNotification('Listing created! Review and post.');
        return listing;
      }
    } catch (error) {
      this.showNotification('Error creating listing', 'error');
    }
  }

  // Post listing to marketplace
  async postToMarketplace(listingId, marketplace) {
    this.showNotification(`Posting to ${marketplace}...`);

    try {
      const response = await fetch(`/api/listings/${listingId}/post`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('fi_token')}`
        },
        body: JSON.stringify({ marketplace })
      });
      const result = await response.json();
      if (result.success) {
        this.showNotification(`Posted to ${marketplace}!`);
      }
    } catch (error) {
      this.showNotification(`Error posting to ${marketplace}`, 'error');
    }
  }

  // Generate AR try-on
  async generateARTryOn(listingId, modelId) {
    this.showNotification('Generating AR try-on...');

    try {
      const response = await fetch(`/api/listings/${listingId}/ar-tryon`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('fi_token')}`
        },
        body: JSON.stringify({ model_id: modelId })
      });
      const result = await response.json();
      if (result.ar_image_url) {
        this.showNotification('AR try-on generated!');
        return result.ar_image_url;
      }
    } catch (error) {
      this.showNotification('Error generating AR try-on', 'error');
    }
  }

  showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.fashionistas = new Fashionistas();
  window.fashionistas.init();
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Fashionistas;
}
