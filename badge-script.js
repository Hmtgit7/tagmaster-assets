/**
 * Tagmaster Badge Injection Script
 * For Shopify stores - Dynamically injects product badges based on store configuration
 */
(function() {
  // Configuration
  const CONFIG = {
    debug: false,  // Enable for console logging
    apiEndpoint: 'https://tagmaster.shopyfi.in/apps/tagify/badges',  // Endpoint to fetch badge data
    scanInterval: 1500,  // Milliseconds between scans
    maxScans: 20,  // Maximum number of scans to perform
    badgeZIndex: 999,  // Z-index for badges
    badgeClassPrefix: 'tm-badge',  // Prefix for badge classes
    containerClass: 'tm-badge-container'  // Class for containers
  };

  /**
   * Utility module with helper functions
   */
  const Utils = {
    /**
     * Log messages when debug is enabled
     * @param {string} message - Message to log
     * @param {string} type - Log type (log, info, warn, error)
     * @param {*} data - Optional data to log
     */
    log: function(message, type = 'log', data = null) {
      if (!CONFIG.debug) return;
      
      const logger = console[type] || console.log;
      const prefix = '🏷️ Tagmaster: ';
      
      if (data) {
        logger(prefix + message, data);
      } else {
        logger(prefix + message);
      }
    },

    /**
     * Get the current shop domain using multiple methods
     * @returns {string} Shop domain
     */
    getShopDomain: function() {
      // Try Shopify object first
      if (typeof Shopify !== 'undefined' && Shopify?.shop) {
        return Shopify.shop;
      }

      // Try meta tags
      const shopTag = document.querySelector('meta[property="og:url"]');
      if (shopTag) {
        try {
          const url = new URL(shopTag.getAttribute('content'));
          return url.hostname;
        } catch (e) {
          this.log(`Error parsing URL: ${e.message}`, 'error');
        }
      }

      // Fallback to current hostname
      return window.location.hostname;
    },

    /**
     * Fetch data from API
     * @param {string} url - API endpoint
     * @param {Function} callback - Callback function for results
     */
    fetchData: function(url, callback) {
      fetch(url)
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          this.log('Data received successfully', 'info', data);
          callback(data);
        })
        .catch(error => {
          this.log(`Error fetching data: ${error.message}`, 'error');
          callback(null);
        });
    },

    /**
     * Convert hex color to RGB
     * @param {string} hex - Hex color code
     * @returns {object} RGB values
     */
    hexToRgb: function(hex) {
      // Remove # if present
      hex = hex.replace(/^#/, '');
      
      // Handle shorthand hex
      if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      }
      
      // Parse hex values
      const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      
      if (result) {
        return {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        };
      }
      
      return { r: 0, g: 0, b: 0 }; // Default to black if parsing fails
    },

    /**
     * Calculate discount percentage
     * @param {number|string} compareAtPrice - Original price
     * @param {number|string} price - Current price
     * @returns {number} Discount percentage
     */
    calculateDiscount: function(compareAtPrice, price) {
      if (!compareAtPrice || !price || parseFloat(compareAtPrice) <= parseFloat(price)) {
        return 0;
      }
      return Math.round(((parseFloat(compareAtPrice) - parseFloat(price)) / parseFloat(compareAtPrice)) * 100);
    },

    /**
     * Parse money values from various formats
     * @param {number|string} amount - Money amount
     * @returns {number} Parsed amount in dollars
     */
    parseMoney: function(amount) {
      if (!amount) return 0;
      
      // Handle string values with currency symbols
      if (typeof amount === 'string') {
        amount = amount.replace(/[^\d.]/g, '');
      }
      
      // Convert from cents to dollars
      return parseFloat(amount) / 100;
    }
  };

  /**
   * Badge Manager - Handles all badge-related operations
   */
  const BadgeManager = {
    // State management
    state: {
      shopDomain: '',
      badges: [],
      processedElements: new Set(),
      pageType: 'unknown',
      isProcessing: false,
      initialized: false,
      scanCount: 0,
      appliedBadges: 0
    },

    /**
     * Initialize the badge application
     */
    init: function() {
      if (this.state.initialized) return;
      
      Utils.log('Initializing BadgeManager...');
      
      // Get shop domain
      this.state.shopDomain = Utils.getShopDomain();
      Utils.log(`Shop domain: ${this.state.shopDomain}`);
      
      // Detect page type
      this.detectPageType();
      Utils.log(`Page type detected: ${this.state.pageType}`);
      
      // Inject base styles
      this.injectBaseStyles();
      
      // Fetch badge configurations
      this.fetchBadges();
      
      // Mark as initialized
      this.state.initialized = true;
    },

    /**
     * Detect the current page type
     */
    detectPageType: function() {
      // Try different methods to detect page type
      if (typeof meta !== 'undefined' && meta?.page?.pageType) {
        this.state.pageType = meta.page.pageType;
        return;
      }
      
      if (typeof Shopify !== 'undefined' && Shopify?.template) {
        this.state.pageType = Shopify.template;
        return;
      }
      
      // Check URL pattern as fallback
      const path = window.location.pathname;
      if (path.includes('/products/')) {
        this.state.pageType = 'product';
      } else if (path.includes('/collections/')) {
        this.state.pageType = 'collection';
      } else {
        this.state.pageType = 'other';
      }
    },

    /**
     * Inject base CSS styles for badges
     */
    injectBaseStyles: function() {
      // Don't inject styles twice
      if (document.getElementById(`${CONFIG.badgeClassPrefix}-styles`)) return;
      
      const style = document.createElement('style');
      style.id = `${CONFIG.badgeClassPrefix}-styles`;
      style.textContent = `
        /* Badge Container */
        .${CONFIG.containerClass} {
          position: relative !important;
          overflow: visible !important;
          min-height: 20px; /* Ensure container has height */
          display: block; /* Ensure container is block-level */
        }
        
        /* Base Badge Styles with better positioning */
        .${CONFIG.badgeClassPrefix} {
          position: absolute !important; /* Ensure absolute positioning */
          z-index: ${CONFIG.badgeZIndex} !important; /* Higher z-index to appear above other elements */
          display: block !important;
          box-sizing: border-box !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-weight: 700;
          text-align: center;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          pointer-events: none; /* Let clicks pass through to product */
          max-width: 90%; /* Prevent badges from being too wide */
        }
        
        /* Make links clickable */
        .${CONFIG.badgeClassPrefix} a {
          pointer-events: auto;
        }
        
        /* More precise badge positions */
        .${CONFIG.badgeClassPrefix}-pos-1 {
          top: 10px !important;
          left: 10px !important;
          right: auto !important;
          bottom: auto !important;
          transform: none !important;
        }
        
        .${CONFIG.badgeClassPrefix}-pos-2 {
          top: 10px !important;
          left: 50% !important;
          right: auto !important;
          bottom: auto !important;
          transform: translateX(-50%) !important;
          margin-left: 0 !important;
        }
        
        .${CONFIG.badgeClassPrefix}-pos-3 {
          top: 10px !important;
          right: 10px !important;
          left: auto !important;
          bottom: auto !important;
          transform: none !important;
        }
        
        .${CONFIG.badgeClassPrefix}-pos-4 {
          top: 50% !important;
          left: 10px !important;
          right: auto !important;
          bottom: auto !important;
          transform: translateY(-50%) !important;
          margin-top: 0 !important;
        }
        
        .${CONFIG.badgeClassPrefix}-pos-5 {
          top: 50% !important;
          left: 50% !important;
          right: auto !important;
          bottom: auto !important;
          transform: translate(-50%, -50%) !important;
          margin: 0 !important;
        }
        
        .${CONFIG.badgeClassPrefix}-pos-6 {
          top: 50% !important;
          right: 10px !important;
          left: auto !important;
          bottom: auto !important;
          transform: translateY(-50%) !important;
          margin-top: 0 !important;
        }
        
        .${CONFIG.badgeClassPrefix}-pos-7 {
          bottom: 10px !important;
          left: 10px !important;
          top: auto !important;
          right: auto !important;
          transform: none !important;
        }
        
        .${CONFIG.badgeClassPrefix}-pos-8 {
          bottom: 10px !important;
          left: 50% !important;
          top: auto !important;
          right: auto !important;
          transform: translateX(-50%) !important;
          margin-left: 0 !important;
        }
        
        .${CONFIG.badgeClassPrefix}-pos-9 {
          bottom: 10px !important;
          right: 10px !important;
          left: auto !important;
          top: auto !important;
          transform: none !important;
        }
        
        /* Badge Shapes */
        .${CONFIG.badgeClassPrefix}-standard {
          border-radius: 4px !important;
          padding: 5px 10px !important;
        }
        
        /* Improved circle badge styles */
        .${CONFIG.badgeClassPrefix}-circle {
          border-radius: 50% !important;
          width: 45px !important;
          height: 45px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          padding: 0 !important;
          text-align: center !important;
        }
        
        /* Stacked Badges */
        .${CONFIG.badgeClassPrefix}-pos-1.${CONFIG.badgeClassPrefix}-stacked-1 { top: 60px !important; }
        .${CONFIG.badgeClassPrefix}-pos-2.${CONFIG.badgeClassPrefix}-stacked-1 { top: 60px !important; }
        .${CONFIG.badgeClassPrefix}-pos-3.${CONFIG.badgeClassPrefix}-stacked-1 { top: 60px !important; }
        .${CONFIG.badgeClassPrefix}-pos-7.${CONFIG.badgeClassPrefix}-stacked-1 { bottom: 60px !important; }
        .${CONFIG.badgeClassPrefix}-pos-8.${CONFIG.badgeClassPrefix}-stacked-1 { bottom: 60px !important; }
        .${CONFIG.badgeClassPrefix}-pos-9.${CONFIG.badgeClassPrefix}-stacked-1 { bottom: 60px !important; }
        
        /* Animations */
        .${CONFIG.badgeClassPrefix}-animate-pulse {
          animation: ${CONFIG.badgeClassPrefix}-pulse 2s infinite;
        }
        
        @keyframes ${CONFIG.badgeClassPrefix}-pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
        
        .${CONFIG.badgeClassPrefix}-animate-bounce {
          animation: ${CONFIG.badgeClassPrefix}-bounce 1s infinite;
        }
        
        @keyframes ${CONFIG.badgeClassPrefix}-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        
        .${CONFIG.badgeClassPrefix}-animate-shake {
          animation: ${CONFIG.badgeClassPrefix}-shake 0.8s ease-in-out infinite;
        }
        
        @keyframes ${CONFIG.badgeClassPrefix}-shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-3px); }
          40%, 80% { transform: translateX(3px); }
        }
        
        /* Responsive Styles */
        @media (max-width: 768px) {
          .${CONFIG.badgeClassPrefix} {
            font-size: 12px !important;
            padding: 3px 8px !important;
          }
          
          .${CONFIG.badgeClassPrefix}-circle {
            width: 35px !important;
            height: 35px !important;
          }
          
          .${CONFIG.badgeClassPrefix}-pos-1 { top: 5px !important; left: 5px !important; }
          .${CONFIG.badgeClassPrefix}-pos-2 { top: 5px !important; }
          .${CONFIG.badgeClassPrefix}-pos-3 { top: 5px !important; right: 5px !important; }
          .${CONFIG.badgeClassPrefix}-pos-4 { left: 5px !important; }
          .${CONFIG.badgeClassPrefix}-pos-6 { right: 5px !important; }
          .${CONFIG.badgeClassPrefix}-pos-7 { bottom: 5px !important; left: 5px !important; }
          .${CONFIG.badgeClassPrefix}-pos-8 { bottom: 5px !important; }
          .${CONFIG.badgeClassPrefix}-pos-9 { bottom: 5px !important; right: 5px !important; }
        }
      `;
      
      document.head.appendChild(style);
      Utils.log('Base styles injected');
    },

    /**
     * Fetch badge configurations from the API
     */
    fetchBadges: function() {
      const url = `${CONFIG.apiEndpoint}?shop=${this.state.shopDomain}`;
      Utils.log(`Fetching badges from ${url}`);
      
      Utils.fetchData(url, (data) => {
        // Use optional chaining to check data structure
        if (!data?.badges?.length) {
          Utils.log('No badges found or invalid data format', 'warn');
          return;
        }
        
        // Filter active badges
        this.state.badges = data.badges.filter(badge => badge.active === true);
        Utils.log(`Loaded ${this.state.badges.length} active badges`, 'info', this.state.badges);
        
        if (this.state.badges.length === 0) return;
        
        // Process based on page type
        if (this.state.pageType === 'product') {
          this.processProductPage();
        }
        
        // Start scanning for products
        this.scanForProducts();
        
        // Set scan interval with limit
        let scanCount = 0;
        const scanInterval = setInterval(() => {
          scanCount++;
          if (scanCount >= CONFIG.maxScans) {
            clearInterval(scanInterval);
            Utils.log('Reached maximum scan count, stopping interval');
            return;
          }
          this.scanForProducts();
        }, CONFIG.scanInterval);
        
        // Set up mutation observer for dynamic content
        this.setupMutationObserver();
      });
    },

    /**
     * Set up mutation observer to detect newly added products
     */
    setupMutationObserver: function() {
      if (!window.MutationObserver) return;
      
      const observer = new MutationObserver((mutations) => {
        let shouldScan = false;
        
        for (const mutation of mutations) {
          if (mutation.type === 'childList' && mutation.addedNodes.length) {
            for (let i = 0; i < mutation.addedNodes.length; i++) {
              const node = mutation.addedNodes[i];
              
              // Skip non-element nodes
              if (node.nodeType !== Node.ELEMENT_NODE) continue;
              
              // Check if this looks like a product element
              const hasProductLink = node.querySelector('a[href*="/products/"]');
              const isProductCard = node.classList && (
                node.classList.contains('product') ||
                node.classList.contains('product-card') ||
                node.classList.contains('product-item') ||
                node.classList.contains('grid__item')
              );
              
              if (hasProductLink || isProductCard) {
                shouldScan = true;
                break;
              }
            }
          }
        }
        
        if (shouldScan) {
          Utils.log('New product elements detected, scanning page');
          this.scanForProducts();
        }
      });
      
      // Start observing the document
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      Utils.log('Mutation observer set up');
    },

    /**
     * Process product page
     */
    processProductPage: function() {
      Utils.log('Processing product page');
      
      // Try to get product data
      const productData = this.getProductData();
      if (!productData) {
        Utils.log('No product data found on product page', 'warn');
        return;
      }
      
      Utils.log('Product data found', 'info', productData);
      
      // Find image container
      const imageContainer = this.findProductImageContainer();
      if (!imageContainer) {
        Utils.log('Could not find product image container', 'warn');
        return;
      }
      
      // Apply badges
      this.applyBadgesToElement(productData, imageContainer);
    },

    /**
     * Get product data using multiple methods
     * Restructured based on senior feedback
     */
    getProductData: function() {
      // Define data sources in a structured way
      const dataSources = [
        () => meta?.product,
        () => window.product,
        () => ShopifyAnalytics?.meta?.product,
        () => this.findProductJsonInScripts(),
        () => {
          const handle = this.extractProductHandleFromUrl(window.location.pathname);
          return handle ? { handle, pending: true } : null;
        }
      ];

      // Try each method in sequence until one returns data
      for (const source of dataSources) {
        try {
          const data = source();
          if (data) return data;
        } catch (e) {
          // Log but continue to next method if current one fails
          Utils.log(`Error getting product data: ${e.message}`, 'error');
        }
      }
      
      return null;
    },
    
    /**
     * Find product JSON data in script tags
     */
    findProductJsonInScripts: function() {
      const jsonScriptSelectors = [
        'script[type="application/json"][data-product-json]',
        'script[id*="ProductJson-"]',
        'script[data-product-json]'
      ];
      
      for (const selector of jsonScriptSelectors) {
        const scripts = document.querySelectorAll(selector);
        for (const script of scripts) {
          try {
            const json = JSON.parse(script.textContent);
            if (json && (json.id || json.handle)) {
              return json;
            }
          } catch (e) {
            // Log parsing errors but continue trying
            Utils.log(`Error parsing JSON from script: ${e.message}`, 'error');
          }
        }
      }
      
      return null;
    },

    /**
     * Find product image container on a product page
     */
    findProductImageContainer: function() {
      // Try theme-specific selectors for product images
      const selectors = [
        // Dawn theme
        '.product__media-wrapper',
        '.product__media-container',
        '.product-single__media-wrapper',
        '.product__image-wrapper',
        '.product-featured-img',
        // Debut theme
        '.product-single__media',
        '.product-featured-media-wrapper',
        '.product-single__photos',
        // Brooklyn theme
        '.product-single__photo-wrapper',
        // General selectors
        '.product-images',
        '.product-image',
        '.product-gallery',
        '.product__slides',
        '[class*="product-media"]',
        '[class*="product-image"]',
        // Fallbacks
        '.product__photo',
        '.featured-image-wrapper'
      ];
      
      for (const selector of selectors) {
        const container = document.querySelector(selector);
        if (container) {
          return container;
        }
      }
      
      // If no container found by selector, find largest product image
      const productImages = document.querySelectorAll(
        'img[src*="/products/"], ' +
        'img[srcset*="/products/"], ' +
        'img[src*="/cdn.shopify.com/s/files/"], ' +
        'img[src*="/cdn/shop/"]'
      );
      
      if (productImages.length > 0) {
        // Find the largest image (likely the main product image)
        let largest = productImages[0];
        let largestArea = 0;
        
        for (const img of productImages) {
          if (img.complete && img.width && img.height) {
            const area = img.width * img.height;
            if (area > largestArea) {
              largestArea = area;
              largest = img;
            }
          }
        }
        
        // Get parent with position relative or absolute
        let element = largest.parentElement;
        let container = null;
        let depth = 0;
        
        while (element && depth < 5) {
          const computedStyle = window.getComputedStyle(element);
          if (computedStyle.position === 'relative' || computedStyle.position === 'absolute') {
            container = element;
            break;
          }
          element = element.parentElement;
          depth++;
        }
        
        // If no suitable container found, use image's parent and make it relative
        if (!container) {
          container = largest.parentElement;
          container.style.position = 'relative';
        }
        
        return container;
      }
      
      // Last resort - get the main product section
      return document.querySelector('.product-section') || document.querySelector('main');
    },

    /**
     * Scan for product elements on the page
     */
    scanForProducts: function() {
      if (this.state.isProcessing || this.state.badges.length === 0) return;
      
      this.state.isProcessing = true;
      this.state.scanCount++;
      
      Utils.log(`Scanning for products (scan #${this.state.scanCount})`);
      
      // Handle many different theme structures to find products
      
      // 1. First try with product links
      const productLinks = document.querySelectorAll('a[href*="/products/"]:not([data-tm-processed])');
      
      let processedCount = 0;
      
      if (productLinks.length > 0) {
        Utils.log(`Found ${productLinks.length} unprocessed product links`);
        
        for (let i = 0; i < productLinks.length; i++) {
          const link = productLinks[i];
          
          // Mark as processed
          link.setAttribute('data-tm-processed', 'true');
          
          // Extract product handle
          const handle = this.extractProductHandleFromUrl(link.href);
          if (!handle) continue;
          
          // Find product container
          const container = this.findProductContainer(link);
          if (!container) continue;
          
          // Skip if already processed
          if (this.state.processedElements.has(container)) continue;
          
          // Mark as processed
          this.state.processedElements.add(container);
          processedCount++;
          
          // Fetch product data
          this.fetchProductData(handle, (productData) => {
            if (productData) {
              // Apply badges
              this.applyBadgesToElement(productData, container);
            }
          });
        }
      }
      
      // 2. Try with product images (for themes that don't use standard product links)
      if (processedCount === 0) {
        const productImages = document.querySelectorAll(
          'img[src*="/products/"]:not([data-tm-processed]), ' +
          'img[srcset*="/products/"]:not([data-tm-processed]), ' +
          'img[src*="/cdn.shopify.com/s/files/"]:not([data-tm-processed]), ' +
          'img[src*="/cdn/shop/products/"]:not([data-tm-processed])'
        );
        
        if (productImages.length > 0) {
          Utils.log(`Found ${productImages.length} unprocessed product images`);
          
          for (let i = 0; i < productImages.length; i++) {
            const img = productImages[i];
            
            // Mark as processed
            img.setAttribute('data-tm-processed', 'true');
            
            // Find closest product link
            const link = img.closest('a[href*="/products/"]');
            if (!link) continue;
            
            // Extract product handle
            const handle = this.extractProductHandleFromUrl(link.href);
            if (!handle) continue;
            
            // Find container (using image's parent as fallback)
            const container = this.findProductContainer(link) || img.parentElement;
            if (!container) continue;
            
            // Skip if already processed
            if (this.state.processedElements.has(container)) continue;
            
            // Mark as processed
            this.state.processedElements.add(container);
            processedCount++;
            
            // Set container position to relative
            if (window.getComputedStyle(container).position === 'static') {
              container.style.position = 'relative';
            }
            
            // Fetch product data
            this.fetchProductData(handle, (productData) => {
              if (productData) {
                // Apply badges
                this.applyBadgesToElement(productData, container);
              }
            });
          }
        }
      }
      
      // 3. Try with product grid items (for themes with unique structures)
      if (processedCount === 0) {
        const productGridItems = document.querySelectorAll(
          '.grid__item:not([data-tm-processed]), ' +
          '.product-card:not([data-tm-processed]), ' +
          '.product-item:not([data-tm-processed]), ' +
          '[class*="productCard"]:not([data-tm-processed]), ' +
          '[class*="product-card"]:not([data-tm-processed])'
        );
        
        if (productGridItems.length > 0) {
          Utils.log(`Found ${productGridItems.length} unprocessed product grid items`);
          
          for (let i = 0; i < productGridItems.length; i++) {
            const gridItem = productGridItems[i];
            
            // Mark as processed
            gridItem.setAttribute('data-tm-processed', 'true');
            
            // Find product link
            const link = gridItem.querySelector('a[href*="/products/"]');
            if (!link) continue;
            
            // Extract product handle
            const handle = this.extractProductHandleFromUrl(link.href);
            if (!handle) continue;
            
            // Skip if already processed
            if (this.state.processedElements.has(gridItem)) continue;
            
            // Mark as processed
            this.state.processedElements.add(gridItem);
            processedCount++;
            
            // Prepare container for badges
            this.prepareContainer(gridItem);
            
            // Fetch product data
            this.fetchProductData(handle, (productData) => {
              if (productData) {
                // Apply badges
                this.applyBadgesToElement(productData, gridItem);
              }
            });
          }
        }
      }
      
      Utils.log(`Processed ${processedCount} new product elements`);
      this.state.isProcessing = false;
    },

    /**
     * Find product container from product link
     */
    findProductContainer: function(link) {
      if (!link) return null;
      
      // First try common selectors for product cards
      const selectors = [
        '.product-card',
        '.grid__item',
        '.product-item',
        '.card',
        '.product',
        '.card-wrapper',
        '.product-single__media-wrapper',
        '.product__media',
        '[class*="product-card"]',
        '[class*="product-grid__card"]'
      ];
      
      // Try to find container using selectors
      for (const selector of selectors) {
        const container = link.closest(selector);
        if (container) return container;
      }
      
      // Find the closest element containing product image
      let element = link.parentElement;
      let imageContainer = null;
      let depth = 0;
      
      while (element && depth < 5) {
        const hasProductImage = element.querySelector('img[src*="/products/"], img[srcset*="/products/"], img[src*="/cdn.shopify.com/"]');
        
        if (hasProductImage) {
          imageContainer = element;
          break;
        }
        
        element = element.parentElement;
        depth++;
      }
      
      if (imageContainer) return imageContainer;
      
      // Fallback to direct parent of product image if link contains an image
      const productImage = link.querySelector('img');
      if (productImage) {
        return link;
      }
      
      // Last resort fallback
      return link.parentElement;
    },

    /**
     * Extract product handle from URL
     */
    extractProductHandleFromUrl: function(url) {
      if (!url) return null;
      
      const parts = url.split('/products/');
      if (parts.length < 2) return null;
      
      // Get handle and remove query params and hash
      let handle = parts[1].split('?')[0].split('#')[0];
      
      // Remove trailing slash
      if (handle.endsWith('/')) {
        handle = handle.slice(0, -1);
      }
      
      // Remove variant ID if present
      handle = handle.split('?')[0];
      
      return handle;
    },

    /**
     * Fetch product data for a handle
     */
    fetchProductData: function(handle, callback) {
      if (!handle) {
        callback(null);
        return;
      }
      
      // Use product.js endpoint to get data
      const url = `/products/${handle}.js`;
      
      fetch(url)
        .then(response => {
          if (!response.ok) throw new Error('Product not found');
          return response.json();
        })
        .then(product => {
          callback(product);
        })
        .catch(error => {
          Utils.log(`Error fetching product data for ${handle}: ${error.message}`, 'error');
          callback(null);
        });
    },

    /**
     * Apply badges to a product element
     */
    applyBadgesToElement: function(product, container) {
      if (!product || !container) return;
      
      // Get product tags
      const productTags = Array.isArray(product.tags) ? product.tags : 
                         (typeof product.tags === 'string' ? product.tags.split(', ') : []);
      
      Utils.log(`Applying badges to product: ${product.title || product.handle}`, 'info', {
        productId: product.id,
        tags: productTags
      });
      
      // Prepare container for badges
      this.prepareContainer(container);
      
      // Track position counts for stacking
      const positionCounts = {};
      
      // Check each badge
      this.state.badges.forEach(badge => {
        if (this.shouldApplyBadge(badge, product, productTags)) {
          // Get position
          const position = badge.position || 3;
          
          // Track how many badges at this position
          positionCounts[position] = (positionCounts[position] || 0) + 1;
          
          // Create and add badge
          this.createBadge(container, badge, product, position, positionCounts[position] - 1);
        }
      });
    },

    /**
     * Prepare container for badges
     */
    prepareContainer: function(container) {
      if (!container) return container;
      
      // Skip if already prepared
      if (container.classList.contains(CONFIG.containerClass)) {
        return container;
      }
      
      // Ensure container has position relative
      const computedStyle = window.getComputedStyle(container);
      if (computedStyle.position === 'static' || computedStyle.position === '') {
        container.style.position = 'relative';
      }
      
      // Make sure container has sufficient size
      if (container.offsetWidth === 0 || container.offsetHeight === 0) {
        // Try to find a better container
        const parent = container.parentElement;
        if (parent && (parent.offsetWidth > 0 && parent.offsetHeight > 0)) {
          container = this.prepareContainer(parent);
        }
      }
      
      // Add container class
      container.classList.add(CONFIG.containerClass);
      
      return container;
    },

    /**
     * Create a badge and add it to the container
     */
    createBadge: function(container, badge, product, position, stackIndex) {
      // Create unique ID
      const badgeId = `${CONFIG.badgeClassPrefix}-${product.id || Date.now()}-${badge.id}`;
      
      // Skip if badge already exists
      if (document.getElementById(badgeId)) {
        return;
      }
      
      // Create badge element
      const badgeElement = document.createElement('div');
      badgeElement.id = badgeId;
      badgeElement.className = `${CONFIG.badgeClassPrefix} ${CONFIG.badgeClassPrefix}-pos-${position}`;
      
      // Add shape class
      if (badge.shape) {
        badgeElement.classList.add(`${CONFIG.badgeClassPrefix}-${badge.shape}`);
      } else {
        badgeElement.classList.add(`${CONFIG.badgeClassPrefix}-standard`);
      }
      
      // Add animation class
      if (badge.animation && badge.animation !== 'none') {
        badgeElement.classList.add(`${CONFIG.badgeClassPrefix}-animate-${badge.animation}`);
      }
      
      // Add stacked class if needed
      if (stackIndex > 0) {
        badgeElement.classList.add(`${CONFIG.badgeClassPrefix}-stacked-${stackIndex}`);
      }
      
      // Apply styles
      Object.assign(badgeElement.style, {
        backgroundColor: badge.backgroundColor || '#6366f1',
        color: badge.textColor || '#FFFFFF',
        fontSize: `${badge.fontSize || 14}px`,
        position: 'absolute', // Ensure absolute positioning
        zIndex: badge.zIndex || CONFIG.badgeZIndex
      });
      
      // Apply border if specified
      if (badge.borderWidth && badge.borderColor) {
        badgeElement.style.border = `${badge.borderWidth}px solid ${badge.borderColor}`;
      }
      
      // Apply border radius (if not circle)
      if (badge.shape !== 'circle' && badge.borderRadius) {
        badgeElement.style.borderRadius = `${badge.borderRadius}px`;
      }
      
      // Apply padding if specified (and not circle)
      if (badge.padding && badge.shape !== 'circle') {
        badgeElement.style.padding = badge.padding;
      }
      
      // Process badge text
      const badgeText = this.processBadgeText(badge.text || badge.name || 'SALE', product);
      badgeElement.textContent = badgeText;
      
      // Add link if specified
      if (badge.link) {
        const linkElement = document.createElement('a');
        linkElement.href = badge.link;
        linkElement.style.color = badge.textColor || '#FFFFFF';
        linkElement.style.textDecoration = 'none';
        linkElement.textContent = badgeText;
        
        // Replace text with link
        badgeElement.textContent = '';
        badgeElement.appendChild(linkElement);
      }
      
      // Add to container and ensure it's within bounds
      container.appendChild(badgeElement);
      
      // Adjust position if badge is outside bounds of container
      const containerRect = container.getBoundingClientRect();
      const badgeRect = badgeElement.getBoundingClientRect();
      
      // If badge is wider than container, scale it down
      if (badgeRect.width > containerRect.width * 0.9) {
        badgeElement.style.transform = `scale(${containerRect.width * 0.9 / badgeRect.width})`;
        badgeElement.style.transformOrigin = 'center';
      }
      
      Utils.log(`Added badge "${badgeText}" to product ${product.title || product.handle}`);
      this.state.appliedBadges++;
      
      return badgeElement;
    },

    /**
     * Process badge text with variable replacements
     */
    processBadgeText: function(text, product) {
      if (!text) return 'SALE';
      
      // Replace discount percentage
      if (text.includes('[DISCOUNT_PERCENT]') && product.compare_at_price) {
        const comparePrice = Utils.parseMoney(product.compare_at_price);
        const price = Utils.parseMoney(product.price);
        const discountPercent = Utils.calculateDiscount(comparePrice, price);
        text = text.replace(/\[DISCOUNT_PERCENT\]/g, discountPercent);
      }
      
      // Replace discount amount
      if (text.includes('[DISCOUNT_AMOUNT]') && product.compare_at_price) {
        const comparePrice = Utils.parseMoney(product.compare_at_price);
        const price = Utils.parseMoney(product.price);
        const discountAmount = (comparePrice - price).toFixed(2);
        text = text.replace(/\[DISCOUNT_AMOUNT\]/g, discountAmount);
      }
      
      // Replace inventory/stock
      if (text.includes('[STOCK]')) {
        const inventory = this.getProductInventory(product);
        text = text.replace(/\[STOCK\]/g, inventory);
      }
      
      // Replace currency symbol
      if (text.includes('[CURRENCY]')) {
        const currencySymbol = this.getCurrencySymbol();
        text = text.replace(/\[CURRENCY\]/g, currencySymbol);
      }
      
      return text;
    },

    /**
     * Get product inventory
     */
    getProductInventory: function(product) {
      if (product.inventory_quantity !== undefined) {
        return product.inventory_quantity;
      }
      
      if (product.variants && product.variants.length > 0) {
        let total = 0;
        for (let i = 0; i < product.variants.length; i++) {
          const variant = product.variants[i];
          if (variant.inventory_quantity !== undefined) {
            total += variant.inventory_quantity;
          }
        }
        return total;
      }
      
      return 0;
    },
    
    /**
     * Get currency symbol
     */
    getCurrencySymbol: function() {
      // Try to get from Shopify
      if (typeof Shopify !== 'undefined' && Shopify?.currency?.active) {
        return Shopify.currency.active;
      }
      
      // Try to get from money format
      if (typeof theme !== 'undefined' && theme?.moneyFormat) {
        const match = theme.moneyFormat.match(/\{\{\s*?amount_with_currency.*?\}\}/);
        if (match) {
          return 'INR'; // With currency symbol
        }
      }
      
      return '₹'; // Default fallback for Indian Rupee
    },
    
    /**
     * Check if a badge should be applied to a product
     */
    shouldApplyBadge: function(badge, product, productTags) {
      // Check page type
      if (badge.pageType && badge.pageType !== 'all' && badge.pageType !== this.state.pageType) {
        return false;
      }
      
      // Check included products
      if (badge.includedProducts && badge.includedProducts.length > 0) {
        let found = false;
        for (const item of badge.includedProducts) {
          if (item.id === product.id || item.id === product.id?.toString()) {
            found = true;
            break;
          }
        }
        if (!found) return false;
      }
      
      // Check excluded products
      if (badge.excludedProducts && badge.excludedProducts.length > 0) {
        for (const item of badge.excludedProducts) {
          if (item.id === product.id || item.id === product.id?.toString()) {
            return false;
          }
        }
      }
      
      // Check included collections (if product has collection data)
      if (badge.includedCollections && badge.includedCollections.length > 0 && product.collections) {
        let found = false;
        const productCollections = Array.isArray(product.collections) ? product.collections : [product.collections];
        
        for (const collection of productCollections) {
          const collectionId = typeof collection === 'object' ? collection.id : collection;
          if (badge.includedCollections.includes(collectionId) || 
              badge.includedCollections.includes(collectionId?.toString())) {
            found = true;
            break;
          }
        }
        
        if (!found) return false;
      }
      
      // Check excluded collections (if product has collection data)
      if (badge.excludedCollections && badge.excludedCollections.length > 0 && product.collections) {
        const productCollections = Array.isArray(product.collections) ? product.collections : [product.collections];
        
        for (const collection of productCollections) {
          const collectionId = typeof collection === 'object' ? collection.id : collection;
          if (badge.excludedCollections.includes(collectionId) || 
              badge.excludedCollections.includes(collectionId?.toString())) {
            return false;
          }
        }
      }
      
      // Check included tags
      if (badge.includedTags && badge.includedTags.length > 0) {
        let found = false;
        for (const tag of productTags) {
          if (badge.includedTags.includes(tag)) {
            found = true;
            break;
          }
        }
        if (!found) return false;
      }
      
      // Check excluded tags
      if (badge.excludedTags && badge.excludedTags.length > 0) {
        for (const tag of productTags) {
          if (badge.excludedTags.includes(tag)) {
            return false;
          }
        }
      }
      
      // Check date range
      const now = new Date();
      
      if (badge.startDate && new Date(badge.startDate) > now) {
        return false;
      }
      
      if (badge.endDate && new Date(badge.endDate) < now) {
        return false;
      }
      
      // Check inventory
      if (badge.inventoryMin !== null || badge.inventoryMax !== null) {
        const inventory = this.getProductInventory(product);
        
        if (badge.inventoryMin !== null && inventory < badge.inventoryMin) {
          return false;
        }
        
        if (badge.inventoryMax !== null && inventory > badge.inventoryMax) {
          return false;
        }
      }
      
      // Check price
      if (badge.priceMin !== null || badge.priceMax !== null) {
        const price = Utils.parseMoney(product.price);
        
        if (badge.priceMin !== null && price < badge.priceMin) {
          return false;
        }
        
        if (badge.priceMax !== null && price > badge.priceMax) {
          return false;
        }
      }
      
      // Check discount
      if (badge.minDiscountPercent !== null) {
        if (!product.compare_at_price) {
          return false;
        }
        
        const comparePrice = Utils.parseMoney(product.compare_at_price);
        const price = Utils.parseMoney(product.price);
        const discountPercent = Utils.calculateDiscount(comparePrice, price);
        
        if (discountPercent < badge.minDiscountPercent) {
          return false;
        }
      }
      
      return true;
    }
  };

  // Initialize on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      BadgeManager.init();
    });
  } else {
    BadgeManager.init();
  }
})();

// /**
//  * Tagmaster Badge Injection Script
//  * Reliably adds product badges to Shopify stores
//  */
// (function() {
//   // Configuration
//   const CONFIG = {
//     debug: false,
//     apiEndpoint: 'https://tagmaster.shopyfi.in/apps/tagify/badges',
//     badgePrefix: 'tm-badge',
//     containerClass: 'tm-badge-container',
//     scanInterval: 1500,
//     maxScans: 20,
//     badgeZIndex: 1000
//   };

//   // Utility functions
//   const utils = {
//     log: function(message, type = 'log', data = null) {
//       if (!CONFIG.debug) return;
//       const logger = console[type] || console.log;
//       const prefix = '🏷️ Tagmaster: ';
//       if (data) {
//         logger(prefix + message, data);
//       } else {
//         logger(prefix + message);
//       }
//     },

//     getShopDomain: function() {
//       // Try different methods to get the shop domain
//       if (typeof Shopify !== 'undefined' && Shopify.shop) {
//         return Shopify.shop;
//       }

//       // Try to extract from meta tags
//       const shopTag = document.querySelector('meta[property="og:url"]');
//       if (shopTag) {
//         try {
//           const url = new URL(shopTag.getAttribute('content'));
//           return url.hostname;
//         } catch (e) {
//           // Ignore URL parsing errors
//         }
//       }

//       // Fallback to current hostname
//       return window.location.hostname;
//     },

//     fetchData: function(url, callback) {
//       fetch(url)
//         .then(response => {
//           if (!response.ok) {
//             throw new Error(`HTTP error! Status: ${response.status}`);
//           }
//           return response.json();
//         })
//         .then(data => {
//           this.log('Data received successfully', 'info', data);
//           callback(data);
//         })
//         .catch(error => {
//           this.log(`Error fetching data: ${error.message}`, 'error');
//           callback(null);
//         });
//     },

//     hexToRgb: function(hex) {
//       // Remove # if present
//       hex = hex.replace(/^#/, '');
      
//       // Handle shorthand hex
//       if (hex.length === 3) {
//         hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
//       }
      
//       // Parse hex values
//       const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      
//       if (result) {
//         return {
//           r: parseInt(result[1], 16),
//           g: parseInt(result[2], 16),
//           b: parseInt(result[3], 16)
//         };
//       }
      
//       return { r: 0, g: 0, b: 0 }; // Default to black
//     },

//     calculateDiscount: function(compareAtPrice, price) {
//       if (!compareAtPrice || !price || parseFloat(compareAtPrice) <= parseFloat(price)) {
//         return 0;
//       }
//       return Math.round(((parseFloat(compareAtPrice) - parseFloat(price)) / parseFloat(compareAtPrice)) * 100);
//     },

//     parseMoney: function(amount) {
//       if (!amount) return 0;
      
//       // Handle string values
//       if (typeof amount === 'string') {
//         amount = amount.replace(/[^\d.]/g, '');
//       }
      
//       // Handle Shopify money format (cents)
//       return parseFloat(amount) / 100;
//     }
//   };

//   // Badge Manager
//   const BadgeManager = {
//     state: {
//       shopDomain: '',
//       badges: [],
//       processedElements: new Set(),
//       pageType: 'unknown',
//       isProcessing: false,
//       initialized: false,
//       scanCount: 0,
//       appliedBadges: 0
//     },

//     /**
//      * Initialize the badge application
//      */
//     init: function() {
//       if (this.state.initialized) return;
      
//       utils.log('Initializing BadgeManager...');
      
//       // Get shop domain
//       this.state.shopDomain = utils.getShopDomain();
//       utils.log(`Shop domain: ${this.state.shopDomain}`);
      
//       // Detect page type
//       this.detectPageType();
//       utils.log(`Page type detected: ${this.state.pageType}`);
      
//       // Inject base styles
//       this.injectBaseStyles();
      
//       // Fetch badge configurations
//       this.fetchBadges();
      
//       // Mark as initialized
//       this.state.initialized = true;
//     },

//     /**
//      * Detect the current page type
//      */
//     detectPageType: function() {
//       // Check meta.page (common in many themes)
//       if (typeof meta !== 'undefined' && meta.page && meta.page.pageType) {
//         this.state.pageType = meta.page.pageType;
//         return;
//       }
      
//       // Check Shopify object
//       if (typeof Shopify !== 'undefined' && Shopify.template) {
//         this.state.pageType = Shopify.template;
//         return;
//       }
      
//       // Check URL pattern
//       const path = window.location.pathname;
//       if (path.includes('/products/')) {
//         this.state.pageType = 'product';
//       } else if (path.includes('/collections/')) {
//         this.state.pageType = 'collection';
//       } else {
//         this.state.pageType = 'other';
//       }
//     },

//     /**
//      * Inject base CSS styles for badges
//      */
//     injectBaseStyles: function() {
//       // Don't inject styles twice
//       if (document.getElementById(`${CONFIG.badgePrefix}-styles`)) return;
      
//       const style = document.createElement('style');
//       style.id = `${CONFIG.badgePrefix}-styles`;
//       style.textContent = `
//         /* Badge Container */
//         .${CONFIG.containerClass} {
//           position: relative !important;
//           overflow: visible !important;
//         }
        
//         /* Base Badge Styles */
//         .${CONFIG.badgePrefix} {
//           position: absolute;
//           z-index: ${CONFIG.badgeZIndex};
//           display: block;
//           font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
//           font-weight: 700;
//           text-align: center;
//           box-sizing: border-box;
//           box-shadow: 0 2px 4px rgba(0,0,0,0.2);
//           transition: all 0.3s ease;
//         }
        
//         /* Badge Positions */
//         .${CONFIG.badgePrefix}-pos-1 {
//           top: 10px;
//           left: 10px;
//         }
        
//         .${CONFIG.badgePrefix}-pos-2 {
//           top: 10px;
//           left: 50%;
//           transform: translateX(-50%);
//         }
        
//         .${CONFIG.badgePrefix}-pos-3 {
//           top: 10px;
//           right: 10px;
//         }
        
//         .${CONFIG.badgePrefix}-pos-4 {
//           top: 50%;
//           left: 10px;
//           transform: translateY(-50%);
//         }
        
//         .${CONFIG.badgePrefix}-pos-5 {
//           top: 50%;
//           left: 50%;
//           transform: translate(-50%, -50%);
//         }
        
//         .${CONFIG.badgePrefix}-pos-6 {
//           top: 50%;
//           right: 10px;
//           transform: translateY(-50%);
//         }
        
//         .${CONFIG.badgePrefix}-pos-7 {
//           bottom: 10px;
//           left: 10px;
//         }
        
//         .${CONFIG.badgePrefix}-pos-8 {
//           bottom: 10px;
//           left: 50%;
//           transform: translateX(-50%);
//         }
        
//         .${CONFIG.badgePrefix}-pos-9 {
//           bottom: 10px;
//           right: 10px;
//         }
        
//         /* Badge Shapes */
//         .${CONFIG.badgePrefix}-standard {
//           border-radius: 4px;
//           padding: 5px 10px;
//         }
        
//         .${CONFIG.badgePrefix}-circle {
//           border-radius: 50%;
//           width: 45px;
//           height: 45px;
//           display: flex;
//           align-items: center;
//           justify-content: center;
//           padding: 0;
//         }
        
//         /* Stacked Badges */
//         .${CONFIG.badgePrefix}-pos-1.${CONFIG.badgePrefix}-stacked-1 { top: 50px; }
//         .${CONFIG.badgePrefix}-pos-2.${CONFIG.badgePrefix}-stacked-1 { top: 50px; }
//         .${CONFIG.badgePrefix}-pos-3.${CONFIG.badgePrefix}-stacked-1 { top: 50px; }
//         .${CONFIG.badgePrefix}-pos-7.${CONFIG.badgePrefix}-stacked-1 { bottom: 50px; }
//         .${CONFIG.badgePrefix}-pos-8.${CONFIG.badgePrefix}-stacked-1 { bottom: 50px; }
//         .${CONFIG.badgePrefix}-pos-9.${CONFIG.badgePrefix}-stacked-1 { bottom: 50px; }
        
//         /* Animations */
//         .${CONFIG.badgePrefix}-animate-pulse {
//           animation: ${CONFIG.badgePrefix}-pulse 2s infinite;
//         }
        
//         @keyframes ${CONFIG.badgePrefix}-pulse {
//           0% { transform: scale(1); }
//           50% { transform: scale(1.1); }
//           100% { transform: scale(1); }
//         }
        
//         .${CONFIG.badgePrefix}-animate-bounce {
//           animation: ${CONFIG.badgePrefix}-bounce 1s infinite;
//         }
        
//         @keyframes ${CONFIG.badgePrefix}-bounce {
//           0%, 100% { transform: translateY(0); }
//           50% { transform: translateY(-5px); }
//         }
        
//         .${CONFIG.badgePrefix}-animate-shake {
//           animation: ${CONFIG.badgePrefix}-shake 0.8s ease-in-out infinite;
//         }
        
//         @keyframes ${CONFIG.badgePrefix}-shake {
//           0%, 100% { transform: translateX(0); }
//           20%, 60% { transform: translateX(-3px); }
//           40%, 80% { transform: translateX(3px); }
//         }
        
//         /* Responsive Styles */
//         @media (max-width: 768px) {
//           .${CONFIG.badgePrefix} {
//             font-size: 12px !important;
//             padding: 3px 8px !important;
//           }
          
//           .${CONFIG.badgePrefix}-circle {
//             width: 35px !important;
//             height: 35px !important;
//           }
          
//           .${CONFIG.badgePrefix}-pos-1 { top: 5px; left: 5px; }
//           .${CONFIG.badgePrefix}-pos-2 { top: 5px; }
//           .${CONFIG.badgePrefix}-pos-3 { top: 5px; right: 5px; }
//           .${CONFIG.badgePrefix}-pos-4 { left: 5px; }
//           .${CONFIG.badgePrefix}-pos-6 { right: 5px; }
//           .${CONFIG.badgePrefix}-pos-7 { bottom: 5px; left: 5px; }
//           .${CONFIG.badgePrefix}-pos-8 { bottom: 5px; }
//           .${CONFIG.badgePrefix}-pos-9 { bottom: 5px; right: 5px; }
//         }
//       `;
      
//       document.head.appendChild(style);
//       utils.log('Base styles injected');
//     },

//     /**
//      * Fetch badge configurations from the API
//      */
//     fetchBadges: function() {
//       const url = `${CONFIG.apiEndpoint}?shop=${this.state.shopDomain}`;
//       utils.log(`Fetching badges from ${url}`);
      
//       utils.fetchData(url, (data) => {
//         if (!data || !data.badges || data.badges.length === 0) {
//           utils.log('No badges found or invalid data format', 'warn');
//           return;
//         }
        
//         // Filter active badges
//         this.state.badges = data.badges.filter(badge => badge.active === true);
//         utils.log(`Loaded ${this.state.badges.length} active badges`, 'info', this.state.badges);
        
//         if (this.state.badges.length === 0) return;
        
//         // Process based on page type
//         if (this.state.pageType === 'product') {
//           this.processProductPage();
//         }
        
//         // Start scanning for products
//         this.scanForProducts();
        
//         // Set scan interval
//         let scanCount = 0;
//         const scanInterval = setInterval(() => {
//           scanCount++;
//           if (scanCount >= CONFIG.maxScans) {
//             clearInterval(scanInterval);
//             utils.log('Reached maximum scan count, stopping interval');
//             return;
//           }
//           this.scanForProducts();
//         }, CONFIG.scanInterval);
        
//         // Set up mutation observer for dynamic content
//         this.setupMutationObserver();
//       });
//     },

//     /**
//      * Set up mutation observer to detect newly added products
//      */
//     setupMutationObserver: function() {
//       if (!window.MutationObserver) return;
      
//       const observer = new MutationObserver((mutations) => {
//         let shouldScan = false;
        
//         for (const mutation of mutations) {
//           if (mutation.type === 'childList' && mutation.addedNodes.length) {
//             for (let i = 0; i < mutation.addedNodes.length; i++) {
//               const node = mutation.addedNodes[i];
              
//               // Skip non-element nodes
//               if (node.nodeType !== Node.ELEMENT_NODE) continue;
              
//               // Check if this looks like a product element
//               const hasProductLink = node.querySelector('a[href*="/products/"]');
//               const isProductCard = node.classList && (
//                 node.classList.contains('product') ||
//                 node.classList.contains('product-card') ||
//                 node.classList.contains('product-item') ||
//                 node.classList.contains('grid__item')
//               );
              
//               if (hasProductLink || isProductCard) {
//                 shouldScan = true;
//                 break;
//               }
//             }
//           }
//         }
        
//         if (shouldScan) {
//           utils.log('New product elements detected, scanning page');
//           this.scanForProducts();
//         }
//       });
      
//       // Start observing the document
//       observer.observe(document.body, {
//         childList: true,
//         subtree: true
//       });
      
//       utils.log('Mutation observer set up');
//     },

//     /**
//      * Process product page
//      */
//     processProductPage: function() {
//       utils.log('Processing product page');
      
//       // Try to get product data
//       const productData = this.getProductData();
//       if (!productData) {
//         utils.log('No product data found on product page', 'warn');
//         return;
//       }
      
//       utils.log('Product data found', 'info', productData);
      
//       // Find image container
//       const imageContainer = this.findProductImageContainer();
//       if (!imageContainer) {
//         utils.log('Could not find product image container', 'warn');
//         return;
//       }
      
//       // Apply badges
//       this.applyBadgesToElement(productData, imageContainer);
//     },

//     /**
//      * Get product data on product page
//      */
//     getProductData: function() {
//       // Try different methods to access product data
      
//       // Method 1: Check meta.product
//       if (typeof meta !== 'undefined' && meta.product) {
//         return meta.product;
//       }
      
//       // Method 2: Check window.product
//       if (window.product) {
//         return window.product;
//       }
      
//       // Method 3: Check ShopifyAnalytics
//       if (
//         typeof ShopifyAnalytics !== 'undefined' &&
//         ShopifyAnalytics.meta &&
//         ShopifyAnalytics.meta.product
//       ) {
//         return ShopifyAnalytics.meta.product;
//       }
      
//       // Method 4: Look for product JSON in script tags
//       const jsonScriptSelectors = [
//         'script[type="application/json"][data-product-json]',
//         'script[id*="ProductJson-"]',
//         'script[data-product-json]'
//       ];
      
//       for (const selector of jsonScriptSelectors) {
//         const scripts = document.querySelectorAll(selector);
//         for (const script of scripts) {
//           try {
//             const json = JSON.parse(script.textContent);
//             if (json && (json.id || json.handle)) {
//               return json;
//             }
//           } catch (e) {
//             // Ignore parsing errors
//           }
//         }
//       }
      
//       // Method 5: Extract handle from URL and fetch product data
//       const handle = this.extractProductHandleFromUrl(window.location.pathname);
//       if (handle) {
//         // Return placeholder with handle (we'll have to fetch data asynchronously)
//         return { handle: handle, pending: true };
//       }
      
//       return null;
//     },

//     /**
//      * Find product image container on a product page
//      */
//     findProductImageContainer: function() {
//       // Try common selectors for product image containers
//       const selectors = [
//         // Dawn theme selectors
//         '.product__media-wrapper',
//         '.product__media-container',
//         '.product-single__media-wrapper',
//         '.product__image-wrapper',
//         // Debut theme selectors
//         '.product-single__media',
//         '.product-featured-media-wrapper',
//         '.product-single__photos',
//         // Generic selectors
//         '.product-images',
//         '.product-image',
//         '.product__slides',
//         '.product-gallery',
//         // Very generic fallbacks
//         '[class*="product-media"]',
//         '[class*="product-image"]'
//       ];
      
//       for (const selector of selectors) {
//         const container = document.querySelector(selector);
//         if (container) {
//           return container;
//         }
//       }
      
//       // Try to find a product image and use its container
//       const productImages = document.querySelectorAll(
//         'img[src*="/products/"], ' +
//         'img[srcset*="/products/"], ' +
//         'img[src*="/cdn.shopify.com/s/files/"], ' +
//         'img[src*="/cdn/shop/products/"]'
//       );
      
//       if (productImages.length > 0) {
//         // Find the largest image (likely the main product image)
//         let largest = productImages[0];
//         let largestArea = 0;
        
//         for (const img of productImages) {
//           if (img.complete && img.width && img.height) {
//             const area = img.width * img.height;
//             if (area > largestArea) {
//               largestArea = area;
//               largest = img;
//             }
//           }
//         }
        
//         // Get parent container with product-related classes
//         let container = largest.parentElement;
//         while (container && container !== document.body) {
//           if (
//             container.classList.contains('product-image') ||
//             container.classList.contains('product-media') ||
//             container.classList.contains('product__media') ||
//             container.classList.contains('product-gallery')
//           ) {
//             return container;
//           }
//           container = container.parentElement;
//         }
        
//         // If no suitable container found, use image's parent
//         return largest.parentElement;
//       }
      
//       return null;
//     },

//     /**
//      * Scan for product elements on the page
//      */
//     scanForProducts: function() {
//       if (this.state.isProcessing || this.state.badges.length === 0) return;
      
//       this.state.isProcessing = true;
//       this.state.scanCount++;
      
//       utils.log(`Scanning for products (scan #${this.state.scanCount})`);
      
//       // Find product links that haven't been processed
//       const productLinks = document.querySelectorAll('a[href*="/products/"]:not([data-tm-processed])');
      
//       if (productLinks.length === 0) {
//         this.state.isProcessing = false;
//         return;
//       }
      
//       utils.log(`Found ${productLinks.length} unprocessed product links`);
      
//       // Process each product link
//       for (let i = 0; i < productLinks.length; i++) {
//         const link = productLinks[i];
        
//         // Mark as processed
//         link.setAttribute('data-tm-processed', 'true');
        
//         // Extract product handle
//         const handle = this.extractProductHandleFromUrl(link.href);
//         if (!handle) continue;
        
//         // Find product container
//         const container = this.findProductContainer(link);
//         if (!container) continue;
        
//         // Skip if already processed
//         if (this.state.processedElements.has(container)) continue;
        
//         // Mark as processed
//         this.state.processedElements.add(container);
        
//         // Fetch product data
//         this.fetchProductData(handle, (productData) => {
//           if (productData) {
//             // Apply badges
//             this.applyBadgesToElement(productData, container);
//           }
//         });
//       }
      
//       this.state.isProcessing = false;
//     },

//     /**
//      * Find product container from product link
//      */
//     findProductContainer: function(link) {
//       if (!link) return null;
      
//       // Try common selectors for product cards
//       const selectors = [
//         '.product-card',
//         '.grid__item',
//         '.product-item',
//         '.card',
//         '.product',
//         '.product-wrapper',
//         '.collection-item',
//         '[class*="product-card"]'
//       ];
      
//       // Try to find container using selectors
//       for (const selector of selectors) {
//         const container = link.closest(selector);
//         if (container) return container;
//       }
      
//       // Walk up the DOM to find a suitable container
//       let element = link.parentElement;
//       let depth = 0;
      
//       while (element && depth < 4) {
//         // Check if element has product information
//         const hasImage = element.querySelector('img');
//         const hasPrice = element.querySelector('.price') || 
//                          element.querySelector('[class*="price"]');
        
//         if (hasImage && hasPrice) {
//           return element;
//         }
        
//         element = element.parentElement;
//         depth++;
//       }
      
//       // Fallback to parent element
//       return link.parentElement;
//     },

//     /**
//      * Extract product handle from URL
//      */
//     extractProductHandleFromUrl: function(url) {
//       if (!url) return null;
      
//       const parts = url.split('/products/');
//       if (parts.length < 2) return null;
      
//       // Get handle and remove query params and hash
//       let handle = parts[1].split('?')[0].split('#')[0];
      
//       // Remove trailing slash
//       if (handle.endsWith('/')) {
//         handle = handle.slice(0, -1);
//       }
      
//       return handle;
//     },

//     /**
//      * Fetch product data for a handle
//      */
//     fetchProductData: function(handle, callback) {
//       if (!handle) {
//         callback(null);
//         return;
//       }
      
//       // Use product.js endpoint to get data
//       const url = `/products/${handle}.js`;
      
//       fetch(url)
//         .then(response => {
//           if (!response.ok) throw new Error('Product not found');
//           return response.json();
//         })
//         .then(product => {
//           callback(product);
//         })
//         .catch(error => {
//           utils.log(`Error fetching product data for ${handle}: ${error.message}`, 'error');
//           callback(null);
//         });
//     },

//     /**
//      * Apply badges to a product element
//      */
//     applyBadgesToElement: function(product, container) {
//       if (!product || !container) return;
      
//       // Get product tags
//       const productTags = Array.isArray(product.tags) ? product.tags : 
//                          (typeof product.tags === 'string' ? product.tags.split(', ') : []);
      
//       utils.log(`Applying badges to product: ${product.title || product.handle}`, 'info', {
//         productId: product.id,
//         tags: productTags
//       });
      
//       // Prepare container for badges
//       this.prepareContainer(container);
      
//       // Track position counts for stacking
//       const positionCounts = {};
      
//       // Check each badge
//       this.state.badges.forEach(badge => {
//         if (this.shouldApplyBadge(badge, product, productTags)) {
//           // Get position
//           const position = badge.position || 3;
          
//           // Track how many badges at this position
//           positionCounts[position] = (positionCounts[position] || 0) + 1;
          
//           // Create and add badge
//           this.createBadge(container, badge, product, position, positionCounts[position] - 1);
//         }
//       });
//     },

//     /**
//      * Prepare container for badges
//      */
//     prepareContainer: function(container) {
//       if (!container) return container;
      
//       // Skip if already prepared
//       if (container.classList.contains(CONFIG.containerClass)) {
//         return container;
//       }
      
//       // Make sure container has position relative
//       const computedStyle = window.getComputedStyle(container);
//       if (computedStyle.position === 'static') {
//         container.style.position = 'relative';
//       }
      
//       // Add container class
//       container.classList.add(CONFIG.containerClass);
      
//       return container;
//     },

//     /**
//      * Create a badge and add it to the container
//      */
//     createBadge: function(container, badge, product, position, stackIndex) {
//       // Create unique ID
//       const badgeId = `${CONFIG.badgePrefix}-${product.id || Date.now()}-${badge.id}`;
      
//       // Skip if badge already exists
//       if (document.getElementById(badgeId)) {
//         return;
//       }
      
//       // Create element
//       const badgeElement = document.createElement('div');
//       badgeElement.id = badgeId;
//       badgeElement.className = `${CONFIG.badgePrefix} ${CONFIG.badgePrefix}-pos-${position}`;
      
//       // Add shape class
//       if (badge.shape) {
//         badgeElement.classList.add(`${CONFIG.badgePrefix}-${badge.shape}`);
//       } else {
//         badgeElement.classList.add(`${CONFIG.badgePrefix}-standard`);
//       }
      
//       // Add animation class
//       if (badge.animation && badge.animation !== 'none') {
//         badgeElement.classList.add(`${CONFIG.badgePrefix}-animate-${badge.animation}`);
//       }
      
//       // Add stacked class if needed
//       if (stackIndex > 0) {
//         badgeElement.classList.add(`${CONFIG.badgePrefix}-stacked-${stackIndex}`);
//       }
      
//       // Apply styles
//       Object.assign(badgeElement.style, {
//         backgroundColor: badge.backgroundColor || '#6366f1',
//         color: badge.textColor || '#FFFFFF',
//         fontSize: `${badge.fontSize || 14}px`
//       });
      
//       // Apply border if specified
//       if (badge.borderWidth && badge.borderColor) {
//         badgeElement.style.border = `${badge.borderWidth}px solid ${badge.borderColor}`;
//       }
      
//       // Apply border radius (if not circle)
//       if (badge.shape !== 'circle' && badge.borderRadius) {
//         badgeElement.style.borderRadius = `${badge.borderRadius}px`;
//       }
      
//       // Apply padding if specified (and not circle)
//       if (badge.padding && badge.shape !== 'circle') {
//         badgeElement.style.padding = badge.padding;
//       }
      
//       // Process badge text
//       const badgeText = this.processBadgeText(badge.text || badge.name || 'SALE', product);
//       badgeElement.textContent = badgeText;
      
//       // Add link if specified
//       if (badge.link) {
//         const linkElement = document.createElement('a');
//         linkElement.href = badge.link;
//         linkElement.style.color = badge.textColor || '#FFFFFF';
//         linkElement.style.textDecoration = 'none';
//         linkElement.textContent = badgeText;
        
//         // Replace text with link
//         badgeElement.textContent = '';
//         badgeElement.appendChild(linkElement);
//       }
      
//       // Add to container
//       container.appendChild(badgeElement);
      
//       utils.log(`Added "${badgeText}" badge to product ${product.title || product.handle}`);
//       this.state.appliedBadges++;
      
//       return badgeElement;
//     },

//     /**
//      * Process badge text with variable replacements
//      */
//     processBadgeText: function(text, product) {
//       if (!text) return 'SALE';
      
//       // Replace discount percentage
//       if (text.includes('[DISCOUNT_PERCENT]') && product.compare_at_price) {
//         const comparePrice = utils.parseMoney(product.compare_at_price);
//         const price = utils.parseMoney(product.price);
//         const discountPercent = utils.calculateDiscount(comparePrice, price);
//         text = text.replace(/\[DISCOUNT_PERCENT\]/g, discountPercent);
//       }
      
//       // Replace discount amount
//       if (text.includes('[DISCOUNT_AMOUNT]') && product.compare_at_price) {
//         const comparePrice = utils.parseMoney(product.compare_at_price);
//         const price = utils.parseMoney(product.price);
//         const discountAmount = (comparePrice - price).toFixed(2);
//         text = text.replace(/\[DISCOUNT_AMOUNT\]/g, discountAmount);
//       }
      
//       // Replace inventory/stock
//       if (text.includes('[STOCK]')) {
//         const inventory = this.getProductInventory(product);
//         text = text.replace(/\[STOCK\]/g, inventory);
//       }
      
//       // Replace currency symbol
//       if (text.includes('[CURRENCY]')) {
//         const currencySymbol = this.getCurrencySymbol();
//         text = text.replace(/\[CURRENCY\]/g, currencySymbol);
//       }
      
//       return text;
//     },

//     /**
//      * Get product inventory
//      */
//     getProductInventory: function(product) {
//       if (product.inventory_quantity !== undefined) {
//         return product.inventory_quantity;
//       }
      
//       if (product.variants && product.variants.length > 0) {
//         let total = 0;
//         for (let i = 0; i < product.variants.length; i++) {
//           const variant = product.variants[i];
//           if (variant.inventory_quantity !== undefined) {
//             total += variant.inventory_quantity;
//           }
//         }
//         return total;
//       }
      
//       return 0;
//     },
    
//     /**
//      * Get currency symbol
//      */
//     getCurrencySymbol: function() {
//       // Try to get from Shopify
//       if (typeof Shopify !== 'undefined' && Shopify.currency) {
//         if (Shopify.currency.active) {
//           return Shopify.currency.active;
//         }
//       }
      
//       // Try to get from money format
//       if (typeof theme !== 'undefined' && theme.moneyFormat) {
//         const match = theme.moneyFormat.match(/\{\{\s*?amount_with_currency.*?\}\}/);
//         if (match) {
//           return 'INR'; // With currency symbol
//         }
//       }
      
//       return '; // Default fallback
//     },
    
//     /**
//      * Check if a badge should be applied to a product
//      */
//     shouldApplyBadge: function(badge, product, productTags) {
//       // Check page type
//       if (badge.pageType && badge.pageType !== 'all' && badge.pageType !== this.state.pageType) {
//         return false;
//       }
      
//       // Check included products
//       if (badge.includedProducts && badge.includedProducts.length > 0) {
//         let found = false;
//         for (const item of badge.includedProducts) {
//           if (item.id === product.id || item.id === product.id.toString()) {
//             found = true;
//             break;
//           }
//         }
//         if (!found) return false;
//       }
      
//       // Check excluded products
//       if (badge.excludedProducts && badge.excludedProducts.length > 0) {
//         for (const item of badge.excludedProducts) {
//           if (item.id === product.id || item.id === product.id.toString()) {
//             return false;
//           }
//         }
//       }
      
//       // Check included collections (if product has collection data)
//       if (badge.includedCollections && badge.includedCollections.length > 0 && product.collections) {
//         let found = false;
//         const productCollections = Array.isArray(product.collections) ? product.collections : [product.collections];
        
//         for (const collection of productCollections) {
//           const collectionId = typeof collection === 'object' ? collection.id : collection;
//           if (badge.includedCollections.includes(collectionId) || badge.includedCollections.includes(collectionId.toString())) {
//             found = true;
//             break;
//           }
//         }
        
//         if (!found) return false;
//       }
      
//       // Check excluded collections (if product has collection data)
//       if (badge.excludedCollections && badge.excludedCollections.length > 0 && product.collections) {
//         const productCollections = Array.isArray(product.collections) ? product.collections : [product.collections];
        
//         for (const collection of productCollections) {
//           const collectionId = typeof collection === 'object' ? collection.id : collection;
//           if (badge.excludedCollections.includes(collectionId) || badge.excludedCollections.includes(collectionId.toString())) {
//             return false;
//           }
//         }
//       }
      
//       // Check included tags
//       if (badge.includedTags && badge.includedTags.length > 0) {
//         let found = false;
//         for (const tag of productTags) {
//           if (badge.includedTags.includes(tag)) {
//             found = true;
//             break;
//           }
//         }
//         if (!found) return false;
//       }
      
//       // Check excluded tags
//       if (badge.excludedTags && badge.excludedTags.length > 0) {
//         for (const tag of productTags) {
//           if (badge.excludedTags.includes(tag)) {
//             return false;
//           }
//         }
//       }
      
//       // Check date range
//       const now = new Date();
      
//       if (badge.startDate && new Date(badge.startDate) > now) {
//         return false;
//       }
      
//       if (badge.endDate && new Date(badge.endDate) < now) {
//         return false;
//       }
      
//       // Check inventory
//       if (badge.inventoryMin !== null || badge.inventoryMax !== null) {
//         const inventory = this.getProductInventory(product);
        
//         if (badge.inventoryMin !== null && inventory < badge.inventoryMin) {
//           return false;
//         }
        
//         if (badge.inventoryMax !== null && inventory > badge.inventoryMax) {
//           return false;
//         }
//       }
      
//       // Check price
//       if (badge.priceMin !== null || badge.priceMax !== null) {
//         const price = utils.parseMoney(product.price);
        
//         if (badge.priceMin !== null && price < badge.priceMin) {
//           return false;
//         }
        
//         if (badge.priceMax !== null && price > badge.priceMax) {
//           return false;
//         }
//       }
      
//       // Check discount
//       if (badge.minDiscountPercent !== null) {
//         if (!product.compare_at_price) {
//           return false;
//         }
        
//         const comparePrice = utils.parseMoney(product.compare_at_price);
//         const price = utils.parseMoney(product.price);
//         const discountPercent = utils.calculateDiscount(comparePrice, price);
        
//         if (discountPercent < badge.minDiscountPercent) {
//           return false;
//         }
//       }
      
//       return true;
//     }



// // /**
// //  * Improved Tagify Badge Script
// //  * 
// //  * This script reliably injects badges onto Shopify product elements
// //  * based on product conditions, tags, inventory, pricing, and discounts.
// //  */
// // (function () {
// //     // Configuration
// //     const CONFIG = {
// //         debug: true,                          // Enable console logging for debugging
// //         badgeEndpoint: 'https://tagmaster.shopyfi.in/apps/tagify/badges', // API endpoint for badge data
// //         scanInterval: 1500,                   // Interval between scans (ms)
// //         badgeZIndex: 999,                     // Z-index for badges
// //         badgePrefix: 'tm-badge',              // Class prefix for badges
// //         containerClass: 'tm-badge-container'  // Container class
// //     };

// //     // Utility functions
// //     const utils = {
// //         // Log messages to console when debug is enabled
// //         log: function (message, type = 'log', data = null) {
// //             if (!CONFIG.debug) return;

// //             const logger = console[type] || console.log;
// //             const prefix = '🏷️ Tagmaster: ';

// //             if (data) {
// //                 logger(prefix + message, data);
// //             } else {
// //                 logger(prefix + message);
// //             }
// //         },

// //         // Get the current shop domain
// //         getShopDomain: function () {
// //             // Try different ways to get shop domain
// //             if (Shopify && Shopify.shop) {
// //                 return Shopify.shop;
// //             }

// //             // Try to extract from meta tags
// //             const shopTag = document.querySelector('meta[property="og:url"]');
// //             if (shopTag) {
// //                 try {
// //                     const url = new URL(shopTag.getAttribute('content'));
// //                     return url.hostname;
// //                 } catch (e) {
// //                     // Ignore URL parsing errors
// //                 }
// //             }

// //             // Fallback to current hostname
// //             return window.location.hostname;
// //         },

// //         // Calculate discount percentage
// //         calculateDiscount: function (compareAtPrice, price) {
// //             if (!compareAtPrice || !price || parseFloat(compareAtPrice) <= parseFloat(price)) {
// //                 return 0;
// //             }

// //             return Math.round(((parseFloat(compareAtPrice) - parseFloat(price)) / parseFloat(compareAtPrice)) * 100);
// //         },

// //         // Parse money amount from Shopify format (cents) to dollars
// //         parseMoney: function (amount) {
// //             if (!amount) return 0;

// //             // Handle string values
// //             if (typeof amount === 'string') {
// //                 amount = amount.replace(/[^\d.]/g, '');
// //             }

// //             return parseFloat(amount) / 100;
// //         },

// //         // Make an HTTP request
// //         fetchData: function (url, callback) {
// //             this.log(`Fetching data from: ${url}`);

// //             fetch(url)
// //                 .then(response => {
// //                     if (!response.ok) {
// //                         throw new Error(`HTTP error! Status: ${response.status}`);
// //                     }
// //                     return response.json();
// //                 })
// //                 .then(data => {
// //                     this.log('Data received successfully', 'info', data);
// //                     callback(data);
// //                 })
// //                 .catch(error => {
// //                     this.log(`Error fetching data: ${error.message}`, 'error');
// //                     callback(null);
// //                 });
// //         }
// //     };

// //     // Main badge application
// //     const TagifyBadges = {
// //         // State management
// //         state: {
// //             shopDomain: '',
// //             badges: [],
// //             processedElements: new Set(),
// //             pageType: 'unknown',
// //             isProcessing: false,
// //             initialized: false,
// //             scanCount: 0,
// //             appliedBadges: 0
// //         },

// //         /**
// //          * Initialize the badge application
// //          */
// //         init: function () {
// //             if (this.state.initialized) return;

// //             utils.log('Initializing TagifyBadges...');

// //             // Set shop domain
// //             this.state.shopDomain = utils.getShopDomain();
// //             utils.log(`Shop domain: ${this.state.shopDomain}`);

// //             // Detect page type
// //             this.detectPageType();
// //             utils.log(`Page type detected: ${this.state.pageType}`);

// //             // Add base styles
// //             this.injectBaseStyles();
// //             utils.log('Base styles injected');

// //             // Fetch badge configurations
// //             this.fetchBadges();

// //             // Mark as initialized
// //             this.state.initialized = true;
// //         },

// //         /**
// //          * Detect the current page type
// //          */
// //         detectPageType: function () {
// //             // Check meta.page (common in many themes)
// //             if (typeof meta !== 'undefined' && meta.page && meta.page.pageType) {
// //                 this.state.pageType = meta.page.pageType;
// //                 return;
// //             }

// //             // Check Shopify object
// //             if (typeof Shopify !== 'undefined') {
// //                 if (Shopify.template) {
// //                     this.state.pageType = Shopify.template;
// //                     return;
// //                 }
// //             }

// //             // Check URL pattern
// //             const path = window.location.pathname;
// //             if (path.includes('/products/')) {
// //                 this.state.pageType = 'product';
// //             } else if (path.includes('/collections/')) {
// //                 this.state.pageType = 'collection';
// //             } else {
// //                 this.state.pageType = 'other';
// //             }
// //         },

// //         /**
// //          * Inject base CSS styles for badges
// //          */
// //         injectBaseStyles: function () {
// //             // Check if styles are already injected
// //             if (document.getElementById(`${CONFIG.badgePrefix}-styles`)) return;

// //             const style = document.createElement('style');
// //             style.id = `${CONFIG.badgePrefix}-styles`;
// //             style.innerHTML = `
// //           /* Badge container */
// //           .${CONFIG.containerClass} {
// //             position: relative !important;
// //             overflow: visible !important;
// //           }
          
// //           /* Base badge styles */
// //           .${CONFIG.badgePrefix} {
// //             position: absolute;
// //             z-index: ${CONFIG.badgeZIndex};
// //             display: inline-block;
// //             font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
// //             font-weight: 700;
// //             line-height: 1.2;
// //             text-align: center;
// //             text-transform: uppercase;
// //             letter-spacing: 0.5px;
// //             box-shadow: 0 2px 4px rgba(0,0,0,0.2);
// //             white-space: nowrap;
// //             animation: ${CONFIG.badgePrefix}-appear 300ms forwards;
// //             box-sizing: content-box;
// //           }
          
// //           /* Appearance animation */
// //           @keyframes ${CONFIG.badgePrefix}-appear {
// //             0% { opacity: 0; transform: scale(0.8); }
// //             100% { opacity: 1; transform: scale(1); }
// //           }
          
// //           /* Badge shapes */
// //           .${CONFIG.badgePrefix}-standard {
// //             border-radius: 4px;
// //             padding: 5px 10px;
// //           }
          
// //           .${CONFIG.badgePrefix}-circle {
// //             border-radius: 50%;
// //             padding: 0;
// //             min-width: 40px;
// //             min-height: 40px;
// //             display: flex;
// //             align-items: center;
// //             justify-content: center;
// //           }
          
// //           .${CONFIG.badgePrefix}-ribbon {
// //             clip-path: polygon(0 0, 100% 0, 100% 70%, 50% 100%, 0 70%);
// //             padding: 5px 12px;
// //           }
          
// //           .${CONFIG.badgePrefix}-star {
// //             clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
// //             padding: 15px;
// //             display: flex;
// //             align-items: center;
// //             justify-content: center;
// //           }
          
// //           .${CONFIG.badgePrefix}-sale {
// //             clip-path: polygon(0% 0%, 100% 0%, 100% 70%, 85% 100%, 0% 100%);
// //             padding: 5px 15px 5px 10px;
// //           }
          
// //           .${CONFIG.badgePrefix}-new {
// //             clip-path: polygon(15% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 30%);
// //             padding: 5px 10px 5px 15px;
// //           }
          
// //           .${CONFIG.badgePrefix}-popular {
// //             transform: rotate(-5deg);
// //             padding: 5px 10px;
// //             border-radius: 4px;
// //           }
          
// //           .${CONFIG.badgePrefix}-premium,
// //           .${CONFIG.badgePrefix}-limited,
// //           .${CONFIG.badgePrefix}-verified {
// //             padding: 5px 10px;
// //             border-radius: 4px;
// //           }
          
// //           /* Position classes */
// //           .${CONFIG.badgePrefix}-pos-1 {
// //             top: 10px;
// //             left: 10px;
// //           }
          
// //           .${CONFIG.badgePrefix}-pos-2 {
// //             top: 10px;
// //             left: 50%;
// //             transform: translateX(-50%);
// //           }
          
// //           .${CONFIG.badgePrefix}-pos-3 {
// //             top: 10px;
// //             right: 10px;
// //           }
          
// //           .${CONFIG.badgePrefix}-pos-4 {
// //             top: 50%;
// //             left: 10px;
// //             transform: translateY(-50%);
// //           }
          
// //           .${CONFIG.badgePrefix}-pos-5 {
// //             top: 50%;
// //             left: 50%;
// //             transform: translate(-50%, -50%);
// //           }
          
// //           .${CONFIG.badgePrefix}-pos-6 {
// //             top: 50%;
// //             right: 10px;
// //             transform: translateY(-50%);
// //           }
          
// //           .${CONFIG.badgePrefix}-pos-7 {
// //             bottom: 10px;
// //             left: 10px;
// //           }
          
// //           .${CONFIG.badgePrefix}-pos-8 {
// //             bottom: 10px;
// //             left: 50%;
// //             transform: translateX(-50%);
// //           }
          
// //           .${CONFIG.badgePrefix}-pos-9 {
// //             bottom: 10px;
// //             right: 10px;
// //           }
          
// //           /* Stacked badges */
// //           .${CONFIG.badgePrefix}-pos-1.${CONFIG.badgePrefix}-stacked-1 { top: 50px; }
// //           .${CONFIG.badgePrefix}-pos-1.${CONFIG.badgePrefix}-stacked-2 { top: 90px; }
// //           .${CONFIG.badgePrefix}-pos-2.${CONFIG.badgePrefix}-stacked-1 { top: 50px; }
// //           .${CONFIG.badgePrefix}-pos-2.${CONFIG.badgePrefix}-stacked-2 { top: 90px; }
// //           .${CONFIG.badgePrefix}-pos-3.${CONFIG.badgePrefix}-stacked-1 { top: 50px; }
// //           .${CONFIG.badgePrefix}-pos-3.${CONFIG.badgePrefix}-stacked-2 { top: 90px; }
// //           .${CONFIG.badgePrefix}-pos-7.${CONFIG.badgePrefix}-stacked-1 { bottom: 50px; }
// //           .${CONFIG.badgePrefix}-pos-7.${CONFIG.badgePrefix}-stacked-2 { bottom: 90px; }
// //           .${CONFIG.badgePrefix}-pos-8.${CONFIG.badgePrefix}-stacked-1 { bottom: 50px; }
// //           .${CONFIG.badgePrefix}-pos-8.${CONFIG.badgePrefix}-stacked-2 { bottom: 90px; }
// //           .${CONFIG.badgePrefix}-pos-9.${CONFIG.badgePrefix}-stacked-1 { bottom: 50px; }
// //           .${CONFIG.badgePrefix}-pos-9.${CONFIG.badgePrefix}-stacked-2 { bottom: 90px; }
          
// //           /* Animations */
// //           .${CONFIG.badgePrefix}-animate-pulse {
// //             animation: ${CONFIG.badgePrefix}-pulse 2s infinite;
// //           }
          
// //           @keyframes ${CONFIG.badgePrefix}-pulse {
// //             0% { transform: scale(1); }
// //             50% { transform: scale(1.1); }
// //             100% { transform: scale(1); }
// //           }
          
// //           .${CONFIG.badgePrefix}-animate-bounce {
// //             animation: ${CONFIG.badgePrefix}-bounce 1s infinite;
// //           }
          
// //           @keyframes ${CONFIG.badgePrefix}-bounce {
// //             0%, 100% { transform: translateY(0); }
// //             50% { transform: translateY(-10px); }
// //           }
          
// //           .${CONFIG.badgePrefix}-animate-shake {
// //             animation: ${CONFIG.badgePrefix}-shake 0.82s cubic-bezier(.36,.07,.19,.97) infinite;
// //           }
          
// //           @keyframes ${CONFIG.badgePrefix}-shake {
// //             10%, 90% { transform: translate3d(-1px, 0, 0); }
// //             20%, 80% { transform: translate3d(2px, 0, 0); }
// //             30%, 50%, 70% { transform: translate3d(-3px, 0, 0); }
// //             40%, 60% { transform: translate3d(3px, 0, 0); }
// //           }
          
// //           .${CONFIG.badgePrefix}-animate-spin {
// //             animation: ${CONFIG.badgePrefix}-spin 2s linear infinite;
// //           }
          
// //           @keyframes ${CONFIG.badgePrefix}-spin {
// //             from { transform: rotate(0deg); }
// //             to { transform: rotate(360deg); }
// //           }
          
// //           .${CONFIG.badgePrefix}-animate-fade-in {
// //             animation: ${CONFIG.badgePrefix}-fade 1.5s ease-in-out infinite alternate;
// //           }
          
// //           @keyframes ${CONFIG.badgePrefix}-fade {
// //             from { opacity: 0.5; }
// //             to { opacity: 1; }
// //           }
          
// //           /* Responsive styles */
// //           @media (max-width: 768px) {
// //             .${CONFIG.badgePrefix} {
// //               font-size: 11px !important;
// //               padding: 3px 6px !important;
// //             }
            
// //             .${CONFIG.badgePrefix}-circle {
// //               min-width: 30px !important;
// //               min-height: 30px !important;
// //             }
// //           }
// //         `;

// //             document.head.appendChild(style);
// //         },

// //         /**
// //          * Fetch badge configurations from server
// //          */
// //         fetchBadges: function () {
// //             const url = `${CONFIG.badgeEndpoint}?shop=${this.state.shopDomain}`;
// //             utils.log(`Fetching badges from ${url}`);

// //             utils.fetchData(url, (data) => {
// //                 if (!data || !data.badges || data.badges.length === 0) {
// //                     utils.log('No badges found or invalid data format', 'warn');
// //                     return;
// //                 }

// //                 // Filter active badges
// //                 this.state.badges = data.badges.filter(badge => badge.active === true);
// //                 utils.log(`Loaded ${this.state.badges.length} active badges`, 'info', this.state.badges);

// //                 if (this.state.badges.length === 0) return;

// //                 // Start processing based on page type
// //                 if (this.state.pageType === 'product') {
// //                     this.processProductPage();
// //                 }

// //                 // Process all pages
// //                 this.scanForProducts();

// //                 // Set up interval for scanning
// //                 setInterval(() => this.scanForProducts(), CONFIG.scanInterval);

// //                 // Set up mutation observer for dynamic content
// //                 this.setupMutationObserver();
// //             });
// //         },

// //         /**
// //          * Set up mutation observer to detect newly added product elements
// //          */
// //         setupMutationObserver: function () {
// //             if (!window.MutationObserver) return;

// //             const observer = new MutationObserver((mutations) => {
// //                 let shouldScan = false;

// //                 mutations.forEach(mutation => {
// //                     if (mutation.type === 'childList' && mutation.addedNodes.length) {
// //                         for (let i = 0; i < mutation.addedNodes.length; i++) {
// //                             const node = mutation.addedNodes[i];

// //                             // Skip non-element nodes
// //                             if (node.nodeType !== Node.ELEMENT_NODE) continue;

// //                             // Check if this is likely a product element
// //                             const hasProductLink = node.tagName === 'A' && node.href && node.href.includes('/products/');
// //                             const containsProductLink = !!node.querySelector('a[href*="/products/"]');
// //                             const hasProductClasses = node.classList && (
// //                                 node.classList.contains('product') ||
// //                                 node.classList.contains('product-card') ||
// //                                 node.classList.contains('product-item') ||
// //                                 node.classList.contains('grid__item')
// //                             );

// //                             if (hasProductLink || containsProductLink || hasProductClasses) {
// //                                 shouldScan = true;
// //                                 break;
// //                             }
// //                         }
// //                     }
// //                 });

// //                 if (shouldScan) {
// //                     utils.log('New potential product elements detected');
// //                     this.scanForProducts();
// //                 }
// //             });

// //             // Start observing the document with the configured parameters
// //             observer.observe(document.body, {
// //                 childList: true,
// //                 subtree: true
// //             });

// //             utils.log('Mutation observer configured');
// //         },

// //         /**
// //          * Process product page
// //          */
// //         processProductPage: function () {
// //             utils.log('Processing product page');

// //             // Try to get product data
// //             const productData = this.getProductData();
// //             if (!productData) {
// //                 utils.log('No product data found on product page', 'warn');
// //                 return;
// //             }

// //             utils.log('Product data found', 'info', productData);

// //             // Find primary product image container
// //             const imageContainer = this.findProductImageContainer();
// //             if (!imageContainer) {
// //                 utils.log('Could not find primary product image container', 'warn');
// //                 return;
// //             }

// //             // Apply badges
// //             this.applyBadgesToElement(productData, imageContainer);
// //         },

// //         /**
// //          * Get product data on a product page
// //          */
// //         getProductData: function () {
// //             // Try multiple methods to get product data

// //             // Method 1: Check meta.product
// //             if (typeof meta !== 'undefined' && meta.product) {
// //                 return meta.product;
// //             }

// //             // Method 2: Check window.product
// //             if (window.product) {
// //                 return window.product;
// //             }

// //             // Method 3: Check ShopifyAnalytics
// //             if (
// //                 typeof ShopifyAnalytics !== 'undefined' &&
// //                 ShopifyAnalytics.meta &&
// //                 ShopifyAnalytics.meta.product
// //             ) {
// //                 return ShopifyAnalytics.meta.product;
// //             }

// //             // Method 4: Look for product JSON in script tags
// //             const jsonScriptSelectors = [
// //                 'script[type="application/json"][data-product-json]',
// //                 'script[id*="ProductJson-"]',
// //                 'script[data-product-json]'
// //             ];

// //             for (const selector of jsonScriptSelectors) {
// //                 const scripts = document.querySelectorAll(selector);
// //                 for (const script of scripts) {
// //                     try {
// //                         const json = JSON.parse(script.textContent);
// //                         if (json && (json.id || json.handle)) {
// //                             return json;
// //                         }
// //                     } catch (e) {
// //                         // Ignore parsing errors
// //                     }
// //                 }
// //             }

// //             // Method 5: Get product handle from URL and fetch product data
// //             const handle = this.extractProductHandleFromUrl(window.location.pathname);
// //             if (handle) {
// //                 // We'll need to fetch the product data asynchronously
// //                 // For now, return a placeholder with the handle
// //                 return { handle: handle, pending: true };
// //             }

// //             return null;
// //         },

// //         /**
// //          * Find product image container on product page
// //          */
// //         findProductImageContainer: function () {
// //             // Try selectors for common themes
// //             const selectors = [
// //                 // Dawn theme
// //                 '.product__media-wrapper',
// //                 '.product__media-container',
// //                 '.product-single__media-wrapper',
// //                 '.product__image-wrapper',
// //                 // Debut theme
// //                 '.product-single__media',
// //                 '.product-featured-media-wrapper',
// //                 '.product-single__photos',
// //                 // Brooklyn theme
// //                 '.product-single__photo-wrapper',
// //                 // Other themes
// //                 '.featured-img-container',
// //                 '.product__slides',
// //                 '.product-single__photo-container',
// //                 // Generic fallbacks
// //                 '.product-images',
// //                 '.product-image',
// //                 '.product-gallery',
// //                 '.product-media',
// //                 '[class*="product-media"]',
// //                 '[class*="product-image"]'
// //             ];

// //             for (const selector of selectors) {
// //                 const container = document.querySelector(selector);
// //                 if (container) {
// //                     return container;
// //                 }
// //             }

// //             // Try to find a product image first, then get its container
// //             const productImages = document.querySelectorAll(
// //                 'img[src*="/products/"], ' +
// //                 'img[srcset*="/products/"], ' +
// //                 'img[src*="/cdn.shopify.com/s/files/"], ' +
// //                 'img[src*="/cdn/shop/products/"]'
// //             );

// //             if (productImages.length > 0) {
// //                 // Find the largest image
// //                 let largest = productImages[0];
// //                 let largestArea = 0;

// //                 for (const img of productImages) {
// //                     if (img.complete && img.width && img.height) {
// //                         const area = img.width * img.height;
// //                         if (area > largestArea) {
// //                             largestArea = area;
// //                             largest = img;
// //                         }
// //                     }
// //                 }

// //                 // Get parent container (if any)
// //                 let container = largest.parentElement;
// //                 while (container && container !== document.body) {
// //                     if (
// //                         container.classList.contains('product-image') ||
// //                         container.classList.contains('product-media') ||
// //                         container.classList.contains('product-photo') ||
// //                         container.classList.contains('product__media')
// //                     ) {
// //                         return container;
// //                     }
// //                     container = container.parentElement;
// //                 }

// //                 // If no suitable container found, use image's direct parent
// //                 return largest.parentElement;
// //             }

// //             return null;
// //         },

// //         /**
// //          * Scan for product elements on the page
// //          */
// //         scanForProducts: function () {
// //             if (this.state.isProcessing || this.state.badges.length === 0) return;

// //             this.state.isProcessing = true;
// //             this.state.scanCount++;

// //             utils.log(`Scanning for products (scan #${this.state.scanCount})`);

// //             // Find product links
// //             const productLinks = document.querySelectorAll('a[href*="/products/"]:not([data-tm-processed])');

// //             if (productLinks.length === 0) {
// //                 this.state.isProcessing = false;
// //                 return;
// //             }

// //             utils.log(`Found ${productLinks.length} unprocessed product links`);

// //             // Process each product link
// //             for (let i = 0; i < productLinks.length; i++) {
// //                 const link = productLinks[i];

// //                 // Mark as processed
// //                 link.setAttribute('data-tm-processed', 'true');

// //                 // Extract product handle
// //                 const handle = this.extractProductHandleFromUrl(link.href);
// //                 if (!handle) continue;

// //                 // Find product container
// //                 const container = this.findProductContainer(link);
// //                 if (!container) continue;

// //                 // Skip if already processed
// //                 if (this.state.processedElements.has(container)) continue;

// //                 // Mark as processed
// //                 this.state.processedElements.add(container);

// //                 // Fetch product data
// //                 this.fetchProductData(handle, (productData) => {
// //                     if (productData) {
// //                         // Apply badges
// //                         this.applyBadgesToElement(productData, container);
// //                     }
// //                 });
// //             }

// //             this.state.isProcessing = false;
// //         },

// //         /**
// //          * Find product container from a product link
// //          */
// //         findProductContainer: function (link) {
// //             if (!link) return null;

// //             // Common selectors for product cards/containers
// //             const selectors = [
// //                 '.product-card',
// //                 '.grid__item',
// //                 '.product-item',
// //                 '.card',
// //                 '.product',
// //                 '.card-wrapper',
// //                 '[class*="product-card"]',
// //                 '[class*="product-item"]'
// //             ];

// //             // Try to find container using selectors
// //             for (const selector of selectors) {
// //                 const container = link.closest(selector);
// //                 if (container) return container;
// //             }

// //             // Walk up the DOM tree to find a suitable container
// //             let element = link.parentElement;
// //             let depth = 0;

// //             while (element && depth < 4) {
// //                 // Check if this element contains product information
// //                 const hasImage = element.querySelector('img');
// //                 const hasPrice = element.querySelector('.price') || element.querySelector('[class*="price"]');

// //                 if (hasImage && hasPrice) {
// //                     return element;
// //                 }

// //                 element = element.parentElement;
// //                 depth++;
// //             }

// //             // Fallback to parent or grandparent
// //             return link.parentElement || link;
// //         },

// //         /**
// //          * Extract product handle from URL
// //          */
// //         extractProductHandleFromUrl: function (url) {
// //             if (!url) return null;

// //             const parts = url.split('/products/');
// //             if (parts.length < 2) return null;

// //             // Get handle and remove query parameters and hash
// //             let handle = parts[1].split('?')[0].split('#')[0];

// //             // Remove trailing slash if present
// //             if (handle.endsWith('/')) {
// //                 handle = handle.slice(0, -1);
// //             }

// //             return handle;
// //         },

// //         /**
// //          * Fetch product data from Shopify
// //          */
// //         fetchProductData: function (handle, callback) {
// //             if (!handle) {
// //                 callback(null);
// //                 return;
// //             }

// //             // Use product.js endpoint
// //             const url = `/products/${handle}.js`;

// //             fetch(url)
// //                 .then(response => {
// //                     if (!response.ok) throw new Error('Product not found');
// //                     return response.json();
// //                 })
// //                 .then(product => {
// //                     callback(product);
// //                 })
// //                 .catch(error => {
// //                     utils.log(`Error fetching product data for ${handle}: ${error.message}`, 'error');
// //                     callback(null);
// //                 });
// //         },

// //         /**
// //          * Apply badges to a product element
// //          */
// //         applyBadgesToElement: function (product, container) {
// //             if (!product || !container) return;

// //             // Get product tags
// //             const productTags = this.getProductTags(product);

// //             utils.log(`Applying badges to product: ${product.title || product.handle}`, 'info', {
// //                 productId: product.id,
// //                 tags: productTags
// //             });

// //             // Prepare container for badges
// //             this.prepareContainer(container);

// //             // Track position counts for stacking
// //             const positionCounts = {};

// //             // Check each badge
// //             this.state.badges.forEach(badge => {
// //                 if (this.shouldApplyBadge(badge, product, productTags)) {
// //                     // Get position
// //                     const position = parseInt(badge.position || 3);

// //                     // Track how many badges at this position
// //                     positionCounts[position] = (positionCounts[position] || 0) + 1;

// //                     // Create and add badge
// //                     this.createBadge(container, badge, product, position, positionCounts[position] - 1);
// //                 }
// //             });
// //         },

// //         /**
// //          * Prepare container for badges
// //          */
// //         prepareContainer: function (container) {
// //             if (!container) return container;

// //             // Skip if already prepared
// //             if (container.classList.contains(CONFIG.containerClass)) {
// //                 return container;
// //             }

// //             // Make sure container has position relative
// //             const computedStyle = window.getComputedStyle(container);
// //             if (computedStyle.position === 'static') {
// //                 container.style.position = 'relative';
// //             }

// //             // Add container class
// //             container.classList.add(CONFIG.containerClass);

// //             return container;
// //         },

// //         /**
// //          * Create a badge element and add it to the container
// //          */
// //         createBadge: function (container, badge, product, position, stackIndex) {
// //             // Create unique ID
// //             const badgeId = `${CONFIG.badgePrefix}-${product.id || 'handle'}-${badge.id}`;

// //             // Skip if badge already exists
// //             if (document.getElementById(badgeId)) {
// //                 return;
// //             }

// //             // Create element
// //             const badgeElement = document.createElement('div');
// //             badgeElement.id = badgeId;
// //             badgeElement.className = `${CONFIG.badgePrefix} ${CONFIG.badgePrefix}-pos-${position}`;

// //             // Add shape class
// //             if (badge.shape) {
// //                 badgeElement.classList.add(`${CONFIG.badgePrefix}-${badge.shape}`);
// //             } else {
// //                 badgeElement.classList.add(`${CONFIG.badgePrefix}-standard`);
// //             }

// //             // Add animation class
// //             if (badge.animation && badge.animation !== 'none') {
// //                 badgeElement.classList.add(`${CONFIG.badgePrefix}-animate-${badge.animation}`);
// //             }

// //             // Add stacked class if needed
// //             if (stackIndex > 0) {
// //                 badgeElement.classList.add(`${CONFIG.badgePrefix}-stacked-${stackIndex}`);
// //             }

// //             // Apply styles
// //             Object.assign(badgeElement.style, {
// //                 backgroundColor: badge.backgroundColor || '#6366f1',
// //                 color: badge.textColor || '#FFFFFF',
// //                 fontSize: `${badge.fontSize || 14}px`
// //             });

// //             // Apply border if specified
// //             if (badge.borderWidth && badge.borderColor) {
// //                 badgeElement.style.border = `${badge.borderWidth}px solid ${badge.borderColor}`;
// //             }

// //             // Apply border radius if not a shape with specific radius
// //             if (!['circle', 'star', 'ribbon', 'sale', 'new'].includes(badge.shape)) {
// //                 badgeElement.style.borderRadius = `${badge.borderRadius || 4}px`;
// //             }

// //             // Apply custom padding if specified
// //             if (badge.padding) {
// //                 badgeElement.style.padding = badge.padding;
// //             }

// //             // Process badge text
// //             const badgeText = this.processBadgeText(badge.text || badge.name || 'SALE', product);
// //             badgeElement.textContent = badgeText;

// //             // Add to container
// //             container.appendChild(badgeElement);

// //             utils.log(`Added badge "${badgeText}" to product ${product.title || product.handle}`);
// //             this.state.appliedBadges++;

// //             return badgeElement;
// //         },

// //         /**
// //          * Process badge text with variable replacements
// //          */
// //         processBadgeText: function (text, product) {
// //             if (!text) return 'SALE';

// //             // Replace discount percentage
// //             if (text.includes('[DISCOUNT_PERCENT]') && product.compare_at_price) {
// //                 const comparePrice = utils.parseMoney(product.compare_at_price);
// //                 const price = utils.parseMoney(product.price);
// //                 const discountPercent = utils.calculateDiscount(comparePrice, price);
// //                 text = text.replace(/\[DISCOUNT_PERCENT\]/g, discountPercent);
// //             }

// //             // Replace discount amount
// //             if (text.includes('[DISCOUNT_AMOUNT]') && product.compare_at_price) {
// //                 const comparePrice = utils.parseMoney(product.compare_at_price);
// //                 const price = utils.parseMoney(product.price);
// //                 const discountAmount = (comparePrice - price).toFixed(2);
// //                 text = text.replace(/\[DISCOUNT_AMOUNT\]/g, discountAmount);
// //             }

// //             // Replace inventory/stock
// //             if (text.includes('[STOCK]')) {
// //                 const inventory = this.getProductInventory(product);
// //                 text = text.replace(/\[STOCK\]/g, inventory);
// //             }

// //             // Replace currency symbol
// //             if (text.includes('[CURRENCY]')) {
// //                 const currencySymbol = this.getCurrencySymbol();
// //                 text = text.replace(/\[CURRENCY\]/g, currencySymbol);
// //             }

// //             return text;
// //         },

// //         /**
// //          * Get currency symbol
// //          */
// //         getCurrencySymbol: function () {
// //             // Try to get currency from Shopify
// //             if (typeof Shopify !== 'undefined' && Shopify.currency) {
// //                 if (Shopify.currency.active) {
// //                     return Shopify.currency.active;
// //                 }
// //             }

// //             // Try to get from money format
// //             if (typeof theme !== 'undefined' && theme.moneyFormat) {
// //                 const match = theme.moneyFormat.match(/\{\{\s*?amount_with_currency.*?\}\}/);
// //                 if (match) {
// //                     return 'INR'; // With currency symbol
// //                 }
// //             }

// //             // Default
// //             return 'INR';
// //         },

// //         /**
// //          * Get product inventory quantity
// //          */
// //         getProductInventory: function (product) {
// //             if (product.inventory_quantity !== undefined) {
// //                 return product.inventory_quantity;
// //             }

// //             if (product.variants && product.variants.length > 0) {
// //                 let total = 0;
// //                 for (let i = 0; i < product.variants.length; i++) {
// //                     const variant = product.variants[i];
// //                     if (variant.inventory_quantity !== undefined) {
// //                         total += variant.inventory_quantity;
// //                     }
// //                 }
// //                 return total;
// //             }

// //             return 0;
// //         },

// //         /**
// //          * Get normalized product tags array
// //          */
// //         getProductTags: function (product) {
// //             if (!product.tags) return [];

// //             // Handle array tags
// //             if (Array.isArray(product.tags)) {
// //                 return product.tags;
// //             }

// //             // Handle string tags
// //             if (typeof product.tags === 'string') {
// //                 return product.tags.split(', ');
// //             }

// //             return [];
// //         },

// //         /**
// //          * Check if a badge should be applied to a product
// //          */
// //         shouldApplyBadge: function (badge, product, productTags) {
// //             // Check page type
// //             if (badge.pageType && badge.pageType !== 'all' && badge.pageType !== this.state.pageType) {
// //                 return false;
// //             }

// //             // Check included tags
// //             if (badge.includedTags && badge.includedTags.length > 0) {
// //                 const badgeTags = badge.includedTags.map(tag => tag.toLowerCase());
// //                 const normalizedProductTags = productTags.map(tag => tag.toLowerCase());

// //                 let hasMatch = false;
// //                 for (const tag of badgeTags) {
// //                     if (normalizedProductTags.includes(tag)) {
// //                         hasMatch = true;
// //                         break;
// //                     }
// //                 }

// //                 if (!hasMatch) return false;
// //             }

// //             // Check excluded tags
// //             if (badge.excludedTags && badge.excludedTags.length > 0) {
// //                 const badgeTags = badge.excludedTags.map(tag => tag.toLowerCase());
// //                 const normalizedProductTags = productTags.map(tag => tag.toLowerCase());

// //                 for (const tag of badgeTags) {
// //                     if (normalizedProductTags.includes(tag)) {
// //                         return false;
// //                     }
// //                 }
// //             }

// //             // Check date range
// //             const now = new Date();

// //             if (badge.startDate && new Date(badge.startDate) > now) {
// //                 return false;
// //             }

// //             if (badge.endDate && new Date(badge.endDate) < now) {
// //                 return false;
// //             }

// //             // Check inventory
// //             if (badge.inventoryMin !== null || badge.inventoryMax !== null) {
// //                 const inventory = this.getProductInventory(product);

// //                 if (badge.inventoryMin !== null && inventory < badge.inventoryMin) {
// //                     return false;
// //                 }

// //                 if (badge.inventoryMax !== null && inventory > badge.inventoryMax) {
// //                     return false;
// //                 }
// //             }

// //             // Check price
// //             if (badge.priceMin !== null || badge.priceMax !== null) {
// //                 const price = utils.parseMoney(product.price);

// //                 if (badge.priceMin !== null && price < badge.priceMin) {
// //                     return false;
// //                 }

// //                 if (badge.priceMax !== null && price > badge.priceMax) {
// //                     return false;
// //                 }
// //             }

// //             // Check discount
// //             if (badge.minDiscountPercent !== null) {
// //                 if (!product.compare_at_price) {
// //                     return false;
// //                 }

// //                 const comparePrice = utils.parseMoney(product.compare_at_price);
// //                 const price = utils.parseMoney(product.price);
// //                 const discountPercent = utils.calculateDiscount(comparePrice, price);

// //                 if (discountPercent < badge.minDiscountPercent) {
// //                     return false;
// //                 }
// //             }

// //             return true;
// //         }
// //     };

// //     // Initialize on page load
// //     if (document.readyState === 'loading') {
// //         document.addEventListener('DOMContentLoaded', function () {
// //             TagifyBadges.init();
// //         });
// //     } else {
// //         TagifyBadges.init();
// //     }
// // })();
