// /**
//  * Tagmaster Badge Script - v2.0.0
//  * 
//  * This script injects product badges onto Shopify stores based on product conditions,
//  * tags, pricing, inventory, and discounts with proper positioning and responsiveness.
//  * 
//  * Created for Shopify Tagmaster App - https://tagmaster.shopyfi.in
//  */
// (function() {
//   // Core configuration
//   const CONFIG = {
//     badgeEndpoint: 'https://tagmaster.shopyfi.in/apps/tagify/badges',
//     scanInterval: 1500,
//     badgeZIndex: 999,
//     badgeClassPrefix: 'tm-badge',
//     containerClass: 'tm-badge-container',
//     debug: false
//   };

//   /**
//    * Utility Module
//    * Handles common helper functions
//    */
//   const Utils = {
//     /**
//      * Log messages to console when debug is enabled
//      * @param {string} message - The message to log
//      * @param {string} type - Log type (log, info, warn, error)
//      * @param {any} data - Optional data to log
//      */
//     log(message, type = 'log', data = null) {
//       if (!CONFIG.debug) return;
      
//       const logger = console[type] || console.log;
//       const prefix = '🏷️ Tagmaster: ';
      
//       if (data) {
//         logger(prefix + message, data);
//       } else {
//         logger(prefix + message);
//       }
//     },
    
//     /**
//      * Get the current shop domain
//      * @returns {string} The shop domain
//      */
//     getShopDomain() {
//       // Try Shopify global
//       if (typeof Shopify !== 'undefined' && Shopify?.shop) {
//         return Shopify.shop;
//       }
      
//       // Try meta tags
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
    
//     /**
//      * Calculate discount percentage
//      * @param {number|string} compareAtPrice - Original price
//      * @param {number|string} price - Current price
//      * @returns {number} Discount percentage
//      */
//     calculateDiscount(compareAtPrice, price) {
//       if (!compareAtPrice || !price) return 0;
      
//       const originalPrice = parseFloat(compareAtPrice);
//       const currentPrice = parseFloat(price);
      
//       if (originalPrice <= currentPrice) return 0;
      
//       return Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
//     },
    
//     /**
//      * Parse money amount from Shopify format (cents) to dollars
//      * @param {number|string} amount - Amount in cents or formatted string
//      * @returns {number} Amount in dollars
//      */
//     parseMoney(amount) {
//       if (!amount) return 0;
      
//       // Handle string values with currency symbols
//       if (typeof amount === 'string') {
//         amount = amount.replace(/[^\d.]/g, '');
//       }
      
//       return parseFloat(amount) / 100;
//     },
    
//     /**
//      * Fetch data from an API endpoint
//      * @param {string} url - URL to fetch
//      * @returns {Promise<Object>} Promise resolving to JSON data
//      */
//     async fetchData(url) {
//       this.log(`Fetching data from: ${url}`);
      
//       try {
//         const response = await fetch(url);
        
//         if (!response.ok) {
//           throw new Error(`HTTP error! Status: ${response.status}`);
//         }
        
//         const data = await response.json();
//         this.log('Data received successfully', 'info', data);
//         return data;
//       } catch (error) {
//         this.log(`Error fetching data: ${error.message}`, 'error');
//         return null;
//       }
//     },
    
//     /**
//      * Generate a unique ID for elements
//      * @param {string} prefix - ID prefix
//      * @returns {string} Unique ID
//      */
//     generateUniqueId(prefix = 'tm') {
//       return `${prefix}-${Math.random().toString(36).substring(2, 11)}`;
//     },
    
//     /**
//      * Check if an element is visible in the viewport
//      * @param {HTMLElement} element - Element to check
//      * @returns {boolean} True if element is visible
//      */
//     isElementVisible(element) {
//       if (!element) return false;
      
//       const rect = element.getBoundingClientRect();
      
//       return (
//         rect.width > 0 &&
//         rect.height > 0 &&
//         rect.top >= 0 &&
//         rect.left >= 0 &&
//         rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
//         rect.right <= (window.innerWidth || document.documentElement.clientWidth)
//       );
//     },
    
//     /**
//      * Safely access nested object properties
//      * @param {Object} obj - Object to access
//      * @param {string} path - Path to property (e.g., 'a.b.c')
//      * @param {any} defaultValue - Default value if property doesn't exist
//      * @returns {any} Property value or default
//      */
//     getProperty(obj, path, defaultValue = null) {
//       const keys = path.split('.');
//       let result = obj;
      
//       for (const key of keys) {
//         if (result === null || result === undefined) return defaultValue;
//         result = result[key];
//       }
      
//       return result !== undefined ? result : defaultValue;
//     },
    
//     /**
//      * Debounce a function
//      * @param {Function} func - Function to debounce
//      * @param {number} wait - Wait time in milliseconds
//      * @returns {Function} Debounced function
//      */
//     debounce(func, wait = 300) {
//       let timeout;
      
//       return function executedFunction(...args) {
//         const later = () => {
//           clearTimeout(timeout);
//           func(...args);
//         };
        
//         clearTimeout(timeout);
//         timeout = setTimeout(later, wait);
//       };
//     }
//   };
  
//   /**
//    * DOM Module
//    * Handles DOM manipulation functions
//    */
//   const DOM = {
//     /**
//      * Get all product elements on the page
//      * @returns {Array<HTMLElement>} Array of product elements
//      */
//     getProductElements() {
//       // Common product card selectors for popular themes
//       const productSelectors = [
//         // Theme-specific selectors
//         '.product-card',
//         '.grid__item',
//         '.product-item',
//         '.card',
//         '.product',
//         '.card-wrapper',
//         // Generic selectors
//         '[class*="product-card"]',
//         '[class*="product-item"]',
//         // Links containing product paths
//         'a[href*="/products/"]:not([data-tm-processed])'
//       ];
      
//       // Find all elements matching selectors
//       const elements = new Set();
      
//       productSelectors.forEach(selector => {
//         document.querySelectorAll(selector).forEach(element => {
//           // Skip if already processed
//           if (element.hasAttribute('data-tm-processed')) return;
          
//           // For link elements, find parent product container
//           if (element.tagName === 'A' && element.href.includes('/products/')) {
//             const container = this.findProductContainer(element);
//             if (container) {
//               elements.add(container);
//             } else {
//               elements.add(element);
//             }
//           } else {
//             elements.add(element);
//           }
//         });
//       });
      
//       return Array.from(elements);
//     },
    
//     /**
//      * Find product container from a product link
//      * @param {HTMLElement} link - Product link element
//      * @returns {HTMLElement|null} Product container element
//      */
//     findProductContainer(link) {
//       if (!link) return null;
      
//       // Common selectors for product cards/containers
//       const selectors = [
//         '.product-card',
//         '.grid__item',
//         '.product-item',
//         '.card',
//         '.product',
//         '.card-wrapper',
//         '[class*="product-card"]',
//         '[class*="product-item"]'
//       ];
      
//       // Try to find container using selectors
//       for (const selector of selectors) {
//         const container = link.closest(selector);
//         if (container) return container;
//       }
      
//       // Walk up the DOM tree to find a suitable container
//       let element = link.parentElement;
//       let depth = 0;
      
//       while (element && depth < 4) {
//         // Check if this element contains product information
//         const hasImage = element.querySelector('img');
//         const hasPrice = element.querySelector('.price') || element.querySelector('[class*="price"]');
        
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
//      * Find the product image container
//      * @param {HTMLElement} productElement - Product element
//      * @returns {HTMLElement|null} Image container element
//      */
//     findImageContainer(productElement) {
//       if (!productElement) return null;
      
//       // Try to find image container with common selectors
//       const imageContainerSelectors = [
//         '.card__media',
//         '.product-card__image-container',
//         '.product-card__image',
//         '.card__image-container',
//         '.product-item__image-container',
//         '.product__media',
//         '.product-image',
//         '.card-media',
//         '[class*="product-image"]',
//         '[class*="product-media"]'
//       ];
      
//       for (const selector of imageContainerSelectors) {
//         const container = productElement.querySelector(selector);
//         if (container) return container;
//       }
      
//       // Try to find the image element
//       const imageElement = productElement.querySelector('img');
//       if (imageElement) {
//         // Return image parent as container
//         return imageElement.parentElement;
//       }
      
//       // Fallback to product element itself
//       return productElement;
//     },
    
//     /**
//      * Mark an element as processed
//      * @param {HTMLElement} element - Element to mark
//      */
//     markAsProcessed(element) {
//       if (!element) return;
//       element.setAttribute('data-tm-processed', 'true');
//     },
    
//     /**
//      * Check if an element is already processed
//      * @param {HTMLElement} element - Element to check
//      * @returns {boolean} True if element is processed
//      */
//     isProcessed(element) {
//       return element && element.hasAttribute('data-tm-processed');
//     },
    
//     /**
//      * Prepare a container for badges
//      * @param {HTMLElement} container - Container element
//      * @returns {HTMLElement} Prepared container
//      */
//     prepareContainer(container) {
//       if (!container) return container;
      
//       // Skip if already prepared
//       if (container.classList.contains(CONFIG.containerClass)) {
//         return container;
//       }
      
//       // Make sure container has position relative for proper badge positioning
//       const computedStyle = window.getComputedStyle(container);
//       if (computedStyle.position === 'static' || computedStyle.position === 'initial') {
//         container.style.position = 'relative';
//       }
      
//       // Make sure container has overflow visible for badges to show outside boundaries
//       if (computedStyle.overflow === 'hidden') {
//         container.style.overflow = 'visible';
//       }
      
//       // Add container class
//       container.classList.add(CONFIG.containerClass);
      
//       return container;
//     },
    
//     /**
//      * Extract product handle from URL
//      * @param {string} url - Product URL
//      * @returns {string|null} Product handle
//      */
//     extractProductHandleFromUrl(url) {
//       if (!url) return null;
      
//       const parts = url.split('/products/');
//       if (parts.length < 2) return null;
      
//       // Get handle and remove query parameters and hash
//       let handle = parts[1].split('?')[0].split('#')[0];
      
//       // Remove trailing slash if present
//       if (handle.endsWith('/')) {
//         handle = handle.slice(0, -1);
//       }
      
//       return handle;
//     },
    
//     /**
//      * Get product handle from a product element
//      * @param {HTMLElement} element - Product element
//      * @returns {string|null} Product handle
//      */
//     getProductHandleFromElement(element) {
//       if (!element) return null;
      
//       // Try to find product link
//       const productLink = element.querySelector('a[href*="/products/"]') || 
//                           element.closest('a[href*="/products/"]');
      
//       if (productLink) {
//         return this.extractProductHandleFromUrl(productLink.href);
//       }
      
//       return null;
//     },
    
//     /**
//      * Create a badge element
//      * @param {Object} badge - Badge configuration
//      * @param {Object} product - Product data
//      * @param {number} position - Badge position
//      * @param {number} stackIndex - Stacking index for multiple badges
//      * @returns {HTMLElement} Badge element
//      */
//     createBadgeElement(badge, product, position, stackIndex = 0) {
//       // Create badge element
//       const badgeElement = document.createElement('div');
      
//       // Set badge ID
//       const badgeId = `${CONFIG.badgeClassPrefix}-${product.id || product.handle}-${badge.id}`;
//       badgeElement.id = badgeId;
      
//       // Add base classes
//       badgeElement.className = `${CONFIG.badgeClassPrefix} ${CONFIG.badgeClassPrefix}-pos-${position}`;
      
//       // Add shape class
//       if (badge.shape) {
//         badgeElement.classList.add(`${CONFIG.badgeClassPrefix}-${badge.shape}`);
//       } else {
//         badgeElement.classList.add(`${CONFIG.badgeClassPrefix}-standard`);
//       }
      
//       // Add animation class
//       if (badge.animation && badge.animation !== 'none') {
//         badgeElement.classList.add(`${CONFIG.badgeClassPrefix}-animate-${badge.animation}`);
//       }
      
//       // Add stacked class if needed
//       if (stackIndex > 0) {
//         badgeElement.classList.add(`${CONFIG.badgeClassPrefix}-stacked-${stackIndex}`);
//       }
      
//       // Apply styles
//       Object.assign(badgeElement.style, {
//         backgroundColor: badge.backgroundColor || '#6366f1',
//         color: badge.textColor || '#FFFFFF',
//         fontSize: `${badge.fontSize || 14}px`,
//         zIndex: badge.zIndex || CONFIG.badgeZIndex
//       });
      
//       // Apply border if specified
//       if (badge.borderWidth && badge.borderColor) {
//         badgeElement.style.border = `${badge.borderWidth}px solid ${badge.borderColor}`;
//       }
      
//       // Apply border radius if not a shape with specific radius
//       if (!['circle', 'star', 'ribbon', 'sale', 'new'].includes(badge.shape)) {
//         badgeElement.style.borderRadius = `${badge.borderRadius || 4}px`;
//       }
      
//       // Apply custom padding if specified
//       if (badge.padding) {
//         badgeElement.style.padding = badge.padding;
//       }
      
//       // Process badge text with variables
//       const badgeText = this.processBadgeText(badge.text || badge.name || 'SALE', product);
      
//       // For circle shape, ensure content is centered properly
//       if (badge.shape === 'circle') {
//         badgeElement.style.display = 'flex';
//         badgeElement.style.alignItems = 'center';
//         badgeElement.style.justifyContent = 'center';
//         if (!badge.padding) {
//           badgeElement.style.width = '40px';
//           badgeElement.style.height = '40px';
//         }
//       }
      
//       // Add badge text
//       badgeElement.textContent = badgeText;
      
//       // Add link if specified
//       if (badge.link) {
//         const link = document.createElement('a');
//         link.href = badge.link;
//         link.textContent = badgeText;
//         link.style.color = badge.textColor || '#FFFFFF';
//         link.style.textDecoration = 'none';
        
//         // Reset badge text and add link
//         badgeElement.textContent = '';
//         badgeElement.appendChild(link);
//       }
      
//       return badgeElement;
//     },
    
//     /**
//      * Process badge text with variable replacements
//      * @param {string} text - Badge text with variables
//      * @param {Object} product - Product data
//      * @returns {string} Processed text
//      */
//     processBadgeText(text, product) {
//       if (!text) return 'SALE';
      
//       // Replace discount percentage
//       if (text.includes('[DISCOUNT_PERCENT]') && product.compare_at_price) {
//         const comparePrice = Utils.parseMoney(product.compare_at_price);
//         const price = Utils.parseMoney(product.price);
//         const discountPercent = Utils.calculateDiscount(comparePrice, price);
//         text = text.replace(/\[DISCOUNT_PERCENT\]/g, discountPercent);
//       }
      
//       // Replace discount amount
//       if (text.includes('[DISCOUNT_AMOUNT]') && product.compare_at_price) {
//         const comparePrice = Utils.parseMoney(product.compare_at_price);
//         const price = Utils.parseMoney(product.price);
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
//      * Get product inventory quantity
//      * @param {Object} product - Product data
//      * @returns {number} Inventory quantity
//      */
//     getProductInventory(product) {
//       if (product?.inventory_quantity !== undefined) {
//         return product.inventory_quantity;
//       }
      
//       if (product?.variants && product.variants.length > 0) {
//         let total = 0;
//         for (const variant of product.variants) {
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
//      * @returns {string} Currency symbol
//      */
//     getCurrencySymbol() {
//       // Try to get currency from Shopify
//       if (typeof Shopify !== 'undefined' && Shopify?.currency?.active) {
//         return Shopify.currency.active;
//       }
      
//       // Try to get from money format
//       if (typeof theme !== 'undefined' && theme?.moneyFormat) {
//         const match = theme.moneyFormat.match(/\{\{\s*?amount_with_currency.*?\}\}/);
//         if (match) {
//           return 'INR'; // With currency symbol
//         }
//       }
      
//       // Default
//       return 'INR';
//     },
    
//     /**
//      * Inject base CSS styles for badges
//      */
//     injectBaseStyles() {
//       // Skip if styles already exist
//       if (document.getElementById(`${CONFIG.badgeClassPrefix}-styles`)) return;
      
//       // Create style element
//       const style = document.createElement('style');
//       style.id = `${CONFIG.badgeClassPrefix}-styles`;
      
//       // Badge styles
//       style.innerHTML = `
//         /* Badge container */
//         .${CONFIG.containerClass} {
//           position: relative !important;
//           overflow: visible !important;
//         }
        
//         /* Base badge styles */
//         .${CONFIG.badgeClassPrefix} {
//           position: absolute;
//           z-index: ${CONFIG.badgeZIndex};
//           display: inline-block;
//           font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
//           font-weight: 700;
//           line-height: 1.2;
//           text-align: center;
//           text-transform: uppercase;
//           letter-spacing: 0.5px;
//           box-shadow: 0 2px 4px rgba(0,0,0,0.2);
//           white-space: nowrap;
//           animation: ${CONFIG.badgeClassPrefix}-appear 300ms forwards;
//           box-sizing: content-box;
//         }
        
//         /* Appearance animation */
//         @keyframes ${CONFIG.badgeClassPrefix}-appear {
//           0% { opacity: 0; transform: scale(0.8); }
//           100% { opacity: 1; transform: scale(1); }
//         }
        
//         /* Badge shapes */
//         .${CONFIG.badgeClassPrefix}-standard {
//           border-radius: 4px;
//           padding: 5px 10px;
//         }
        
//         .${CONFIG.badgeClassPrefix}-circle {
//           border-radius: 50%;
//           padding: 0;
//           min-width: 40px;
//           min-height: 40px;
//           display: flex;
//           align-items: center;
//           justify-content: center;
//         }
        
//         .${CONFIG.badgeClassPrefix}-ribbon {
//           clip-path: polygon(0 0, 100% 0, 100% 70%, 50% 100%, 0 70%);
//           padding: 5px 12px;
//         }
        
//         .${CONFIG.badgeClassPrefix}-star {
//           clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
//           padding: 15px;
//           display: flex;
//           align-items: center;
//           justify-content: center;
//         }
        
//         .${CONFIG.badgeClassPrefix}-sale {
//           clip-path: polygon(0% 0%, 100% 0%, 100% 70%, 85% 100%, 0% 100%);
//           padding: 5px 15px 5px 10px;
//         }
        
//         .${CONFIG.badgeClassPrefix}-new {
//           clip-path: polygon(15% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 30%);
//           padding: 5px 10px 5px 15px;
//         }
        
//         .${CONFIG.badgeClassPrefix}-popular {
//           transform: rotate(-5deg);
//           padding: 5px 10px;
//           border-radius: 4px;
//         }
        
//         .${CONFIG.badgeClassPrefix}-premium,
//         .${CONFIG.badgeClassPrefix}-limited,
//         .${CONFIG.badgeClassPrefix}-verified {
//           padding: 5px 10px;
//           border-radius: 4px;
//         }
        
//         /* Position classes */
//         .${CONFIG.badgeClassPrefix}-pos-1 {
//           top: 10px;
//           left: 10px;
//         }
        
//         .${CONFIG.badgeClassPrefix}-pos-2 {
//           top: 10px;
//           left: 50%;
//           transform: translateX(-50%);
//         }
        
//         .${CONFIG.badgeClassPrefix}-pos-3 {
//           top: 10px;
//           right: 10px;
//         }
        
//         .${CONFIG.badgeClassPrefix}-pos-4 {
//           top: 50%;
//           left: 10px;
//           transform: translateY(-50%);
//         }
        
//         .${CONFIG.badgeClassPrefix}-pos-5 {
//           top: 50%;
//           left: 50%;
//           transform: translate(-50%, -50%);
//         }
        
//         .${CONFIG.badgeClassPrefix}-pos-6 {
//           top: 50%;
//           right: 10px;
//           transform: translateY(-50%);
//         }
        
//         .${CONFIG.badgeClassPrefix}-pos-7 {
//           bottom: 10px;
//           left: 10px;
//         }
        
//         .${CONFIG.badgeClassPrefix}-pos-8 {
//           bottom: 10px;
//           left: 50%;
//           transform: translateX(-50%);
//         }
        
//         .${CONFIG.badgeClassPrefix}-pos-9 {
//           bottom: 10px;
//           right: 10px;
//         }
        
//         /* Stacked badges */
//         .${CONFIG.badgeClassPrefix}-pos-1.${CONFIG.badgeClassPrefix}-stacked-1 { top: 50px; }
//         .${CONFIG.badgeClassPrefix}-pos-1.${CONFIG.badgeClassPrefix}-stacked-2 { top: 90px; }
//         .${CONFIG.badgeClassPrefix}-pos-2.${CONFIG.badgeClassPrefix}-stacked-1 { top: 50px; }
//         .${CONFIG.badgeClassPrefix}-pos-2.${CONFIG.badgeClassPrefix}-stacked-2 { top: 90px; }
//         .${CONFIG.badgeClassPrefix}-pos-3.${CONFIG.badgeClassPrefix}-stacked-1 { top: 50px; }
//         .${CONFIG.badgeClassPrefix}-pos-3.${CONFIG.badgeClassPrefix}-stacked-2 { top: 90px; }
//         .${CONFIG.badgeClassPrefix}-pos-7.${CONFIG.badgeClassPrefix}-stacked-1 { bottom: 50px; }
//         .${CONFIG.badgeClassPrefix}-pos-7.${CONFIG.badgeClassPrefix}-stacked-2 { bottom: 90px; }
//         .${CONFIG.badgeClassPrefix}-pos-8.${CONFIG.badgeClassPrefix}-stacked-1 { bottom: 50px; }
//         .${CONFIG.badgeClassPrefix}-pos-8.${CONFIG.badgeClassPrefix}-stacked-2 { bottom: 90px; }
//         .${CONFIG.badgeClassPrefix}-pos-9.${CONFIG.badgeClassPrefix}-stacked-1 { bottom: 50px; }
//         .${CONFIG.badgeClassPrefix}-pos-9.${CONFIG.badgeClassPrefix}-stacked-2 { bottom: 90px; }
        
//         /* Animations */
//         .${CONFIG.badgeClassPrefix}-animate-pulse {
//           animation: ${CONFIG.badgeClassPrefix}-pulse 2s infinite;
//         }
        
//         @keyframes ${CONFIG.badgeClassPrefix}-pulse {
//           0% { transform: scale(1); }
//           50% { transform: scale(1.1); }
//           100% { transform: scale(1); }
//         }
        
//         .${CONFIG.badgeClassPrefix}-animate-bounce {
//           animation: ${CONFIG.badgeClassPrefix}-bounce 1s infinite;
//         }
        
//         @keyframes ${CONFIG.badgeClassPrefix}-bounce {
//           0%, 100% { transform: translateY(0); }
//           50% { transform: translateY(-10px); }
//         }
        
//         .${CONFIG.badgeClassPrefix}-animate-shake {
//           animation: ${CONFIG.badgeClassPrefix}-shake 0.82s cubic-bezier(.36,.07,.19,.97) infinite;
//         }
        
//         @keyframes ${CONFIG.badgeClassPrefix}-shake {
//           10%, 90% { transform: translate3d(-1px, 0, 0); }
//           20%, 80% { transform: translate3d(2px, 0, 0); }
//           30%, 50%, 70% { transform: translate3d(-3px, 0, 0); }
//           40%, 60% { transform: translate3d(3px, 0, 0); }
//         }
        
//         .${CONFIG.badgeClassPrefix}-animate-spin {
//           animation: ${CONFIG.badgeClassPrefix}-spin 2s linear infinite;
//         }
        
//         @keyframes ${CONFIG.badgeClassPrefix}-spin {
//           from { transform: rotate(0deg); }
//           to { transform: rotate(360deg); }
//         }
        
//         .${CONFIG.badgeClassPrefix}-animate-fade-in {
//           animation: ${CONFIG.badgeClassPrefix}-fade 1.5s ease-in-out infinite alternate;
//         }
        
//         @keyframes ${CONFIG.badgeClassPrefix}-fade {
//           from { opacity: 0.5; }
//           to { opacity: 1; }
//         }
        
//         /* Responsive styles */
//         @media (max-width: 768px) {
//           .${CONFIG.badgeClassPrefix} {
//             font-size: 11px !important;
//             padding: 3px 6px !important;
//           }
          
//           .${CONFIG.badgeClassPrefix}-circle {
//             min-width: 30px !important;
//             min-height: 30px !important;
//           }
//         }
//       `;
      
//       // Add style to head
//       document.head.appendChild(style);
//     }
//   };

//   /**
//    * Product Module
//    * Handles product data and badge application
//    */
//   const ProductModule = {
//     /**
//      * Get product data sources
//      * @returns {Array<Function>} Array of data source functions
//      */
//     getProductDataSources() {
//       return [
//         // Source 1: meta.product
//         () => typeof meta !== 'undefined' && meta?.product,
        
//         // Source 2: window.product
//         () => window.product,
        
//         // Source 3: ShopifyAnalytics
//         () => Utils.getProperty(window, 'ShopifyAnalytics.meta.product'),
        
//         // Source 4: Product JSON in script tags
//         () => this.findProductJsonInScripts(),
        
//         // Source 5: Extract from URL (fallback)
//         () => {
//           const handle = DOM.extractProductHandleFromUrl(window.location.pathname);
//           return handle ? { handle, pending: true } : null;
//         }
//       ];
//     },
    
//     /**
//      * Find product JSON in script tags
//      * @returns {Object|null} Product data object
//      */
//     findProductJsonInScripts() {
//       const jsonScriptSelectors = [
//         'script[type="application/json"][data-product-json]',
//         'script[id*="ProductJson-"]',
//         'script[data-product-json]',
//         'script[id*="product-json"]',
//         'script[type="application/json"]'
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
//             Utils.log(`Error parsing JSON from script: ${e.message}`, 'error');
//             // Continue to the next script
//           }
//         }
//       }
      
//       return null;
//     },
    
//     /**
//      * Get product data on a product page
//      * @returns {Object|null} Product data object
//      */
//     getProductData() {
//       // Try each data source in sequence
//       const dataSources = this.getProductDataSources();
      
//       for (const source of dataSources) {
//         try {
//           const data = source();
//           if (data) return data;
//         } catch (e) {
//           // Continue to next method if current one fails
//           Utils.log(`Error in data source: ${e.message}`, 'warn');
//         }
//       }
      
//       return null;
//     },
    
//     /**
//      * Fetch product data from Shopify
//      * @param {string} handle - Product handle
//      * @returns {Promise<Object|null>} Promise resolving to product data
//      */
//     async fetchProductData(handle) {
//       if (!handle) return null;
      
//       try {
//         // Use product.js endpoint
//         const url = `/products/${handle}.js`;
//         const response = await fetch(url);
        
//         if (!response.ok) {
//           throw new Error(`Product fetch failed: ${response.status}`);
//         }
        
//         return await response.json();
//       } catch (error) {
//         Utils.log(`Error fetching product data for ${handle}: ${error.message}`, 'error');
//         return null;
//       }
//     },
    
//     /**
//      * Check if a badge should be applied to a product
//      * @param {Object} badge - Badge configuration
//      * @param {Object} product - Product data
//      * @param {Array<string>} productTags - Product tags
//      * @returns {boolean} True if badge should be applied
//      */
//     shouldApplyBadge(badge, product, productTags) {
//       // Check if badge is active
//       if (!badge.active) return false;
      
//       // Check page type
//       if (badge.pageType && badge.pageType !== 'all' && badge.pageType !== BadgeApp.state.pageType) {
//         return false;
//       }
      
//       // Check included products
//       if (badge.includedProducts && badge.includedProducts.length > 0) {
//         const productId = String(product.id);
//         if (!badge.includedProducts.includes(productId)) {
//           return false;
//         }
//       }
      
//       // Check excluded products
//       if (badge.excludedProducts && badge.excludedProducts.length > 0) {
//         const productId = String(product.id);
//         if (badge.excludedProducts.includes(productId)) {
//           return false;
//         }
//       }
      
//       // Check included collections
//       if (badge.includedCollections && badge.includedCollections.length > 0) {
//         // If product.collections is available, check membership
//         if (product.collections) {
//           let inCollection = false;
          
//           for (const collectionId of badge.includedCollections) {
//             if (product.collections.includes(collectionId)) {
//               inCollection = true;
//               break;
//             }
//           }
          
//           if (!inCollection) return false;
//         }
//       }
      
//       // Check excluded collections
//       if (badge.excludedCollections && badge.excludedCollections.length > 0) {
//         // If product.collections is available, check membership
//         if (product.collections) {
//           for (const collectionId of badge.excludedCollections) {
//             if (product.collections.includes(collectionId)) {
//               return false;
//             }
//           }
//         }
//       }
      
//       // Check included tags
//       if (badge.includedTags && badge.includedTags.length > 0) {
//         if (!productTags || productTags.length === 0) return false;
        
//         const badgeTags = badge.includedTags.map(tag => tag.toLowerCase());
//         const normalizedProductTags = productTags.map(tag => tag.toLowerCase());
        
//         let hasMatch = false;
//         for (const tag of badgeTags) {
//           if (normalizedProductTags.includes(tag)) {
//             hasMatch = true;
//             break;
//           }
//         }
        
//         if (!hasMatch) return false;
//       }
      
//       // Check excluded tags
//       if (badge.excludedTags && badge.excludedTags.length > 0) {
//         if (productTags && productTags.length > 0) {
//           const badgeTags = badge.excludedTags.map(tag => tag.toLowerCase());
//           const normalizedProductTags = productTags.map(tag => tag.toLowerCase());
          
//           for (const tag of badgeTags) {
//             if (normalizedProductTags.includes(tag)) {
//               return false;
//             }
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
//         const inventory = DOM.getProductInventory(product);
        
//         if (badge.inventoryMin !== null && inventory < badge.inventoryMin) {
//           return false;
//         }
        
//         if (badge.inventoryMax !== null && inventory > badge.inventoryMax) {
//           return false;
//         }
//       }
      
//       // Check price
//       if (badge.priceMin !== null || badge.priceMax !== null) {
//         const price = Utils.parseMoney(product.price);
        
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
        
//         const comparePrice = Utils.parseMoney(product.compare_at_price);
//         const price = Utils.parseMoney(product.price);
//         const discountPercent = Utils.calculateDiscount(comparePrice, price);
        
//         if (discountPercent < badge.minDiscountPercent) {
//           return false;
//         }
//       }
      
//       return true;
//     },
    
//     /**
//      * Apply badges to a product element
//      * @param {Object} product - Product data
//      * @param {HTMLElement} container - Container element
//      */
//     applyBadgesToElement(product, container) {
//       if (!product || !container) return;
      
//       // Get product tags
//       const productTags = this.getProductTags(product);
      
//       Utils.log(`Applying badges to product: ${product.title || product.handle}`, 'info', {
//         productId: product.id,
//         tags: productTags
//       });
      
//       // Prepare container for badges
//       DOM.prepareContainer(container);
      
//       // Track position counts for stacking
//       const positionCounts = {};
      
//       // Check each badge
//       BadgeApp.state.badges.forEach(badge => {
//         if (this.shouldApplyBadge(badge, product, productTags)) {
//           // Get position
//           const position = parseInt(badge.position || 3);
          
//           // Track how many badges at this position
//           positionCounts[position] = (positionCounts[position] || 0) + 1;
          
//           // Create and add badge
//           const badgeElement = DOM.createBadgeElement(badge, product, position, positionCounts[position] - 1);
          
//           // Add badge to container
//           if (badgeElement) {
//             container.appendChild(badgeElement);
//             BadgeApp.state.appliedBadges++;
            
//             Utils.log(`Added badge "${badge.text || badge.name}" to product ${product.title || product.handle}`);
//           }
//         }
//       });
//     },
    
//     /**
//      * Get normalized product tags array
//      * @param {Object} product - Product data
//      * @returns {Array<string>} Array of product tags
//      */
//     getProductTags(product) {
//       if (!product.tags) return [];
      
//       // Handle array tags
//       if (Array.isArray(product.tags)) {
//         return product.tags;
//       }
      
//       // Handle string tags
//       if (typeof product.tags === 'string') {
//         return product.tags.split(', ');
//       }
      
//       return [];
//     }
//   };
  
//   /**
//    * Main Badge Application
//    * Controls the overall badge application process
//    */
//   const BadgeApp = {
//     // State management
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
//     async init() {
//       if (this.state.initialized) return;
      
//       Utils.log('Initializing Tagmaster Badge App...');
      
//       // Set shop domain
//       this.state.shopDomain = Utils.getShopDomain();
//       Utils.log(`Shop domain: ${this.state.shopDomain}`);
      
//       // Detect page type
//       this.detectPageType();
//       Utils.log(`Page type detected: ${this.state.pageType}`);
      
//       // Add base styles
//       DOM.injectBaseStyles();
//       Utils.log('Base styles injected');
      
//       // Fetch badge configurations
//       await this.fetchBadges();
      
//       // Mark as initialized
//       this.state.initialized = true;
      
//       // Start processing based on page type
//       if (this.state.pageType === 'product') {
//         this.processProductPage();
//       }
      
//       // Process all pages
//       this.scanForProducts();
      
//       // Set up interval for scanning
//       setInterval(() => this.scanForProducts(), CONFIG.scanInterval);
      
//       // Set up mutation observer for dynamic content
//       this.setupMutationObserver();
//     },
    
//     /**
//      * Detect the current page type
//      */
//     detectPageType() {
//       // Check meta.page (common in many themes)
//       if (typeof meta !== 'undefined' && meta?.page?.pageType) {
//         this.state.pageType = meta.page.pageType;
//         return;
//       }
      
//       // Check Shopify object
//       if (typeof Shopify !== 'undefined' && Shopify?.template) {
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
//      * Fetch badge configurations from server
//      */
//     async fetchBadges() {
//       const url = `${CONFIG.badgeEndpoint}?shop=${this.state.shopDomain}`;
//       Utils.log(`Fetching badges from ${url}`);
      
//       try {
//         const data = await Utils.fetchData(url);
        
//         if (!data?.badges || data.badges.length === 0) {
//           Utils.log('No badges found or invalid data format', 'warn');
//           return;
//         }
        
//         // Filter active badges
//         this.state.badges = data.badges.filter(badge => badge.active === true);
//         Utils.log(`Loaded ${this.state.badges.length} active badges`, 'info', this.state.badges);
//       } catch (error) {
//         Utils.log(`Error fetching badges: ${error.message}`, 'error');
//       }
//     },
    
//     /**
//      * Set up mutation observer to detect newly added product elements
//      */
//     setupMutationObserver() {
//       // Skip if MutationObserver not supported
//       if (!window.MutationObserver) return;
      
//       const observer = new MutationObserver(
//         Utils.debounce((mutations) => {
//           let shouldScan = false;
          
//           mutations.forEach(mutation => {
//             if (mutation.type === 'childList' && mutation.addedNodes.length) {
//               for (let i = 0; i < mutation.addedNodes.length; i++) {
//                 const node = mutation.addedNodes[i];
                
//                 // Skip non-element nodes
//                 if (node.nodeType !== Node.ELEMENT_NODE) continue;
                
//                 // Check if this is likely a product element
//                 const hasProductLink = node.tagName === 'A' && node.href?.includes('/products/');
//                 const containsProductLink = !!node.querySelector('a[href*="/products/"]');
//                 const hasProductClasses = node.classList && (
//                   node.classList.contains('product') ||
//                   node.classList.contains('product-card') ||
//                   node.classList.contains('product-item') ||
//                   node.classList.contains('grid__item')
//                 );
                
//                 if (hasProductLink || containsProductLink || hasProductClasses) {
//                   shouldScan = true;
//                   break;
//                 }
//               }
//             }
//           });
          
//           if (shouldScan) {
//             Utils.log('New potential product elements detected');
//             this.scanForProducts();
//           }
//         }, 300)
//       );
      
//       // Start observing the document with the configured parameters
//       observer.observe(document.body, {
//         childList: true,
//         subtree: true
//       });
      
//       Utils.log('Mutation observer configured');
//     },
    
//     /**
//      * Process product page
//      */
//     async processProductPage() {
//       Utils.log('Processing product page');
      
//       // Try to get product data
//       const productData = ProductModule.getProductData();
//       if (!productData) {
//         Utils.log('No product data found on product page', 'warn');
//         return;
//       }
      
//       // If product data is pending, fetch it
//       if (productData.pending && productData.handle) {
//         const fetchedProductData = await ProductModule.fetchProductData(productData.handle);
//         if (!fetchedProductData) {
//           Utils.log('Failed to fetch product data', 'error');
//           return;
//         }
        
//         Utils.log('Product data fetched', 'info', fetchedProductData);
        
//         // Find primary product image container
//         const imageContainer = this.findProductImageContainer();
//         if (!imageContainer) {
//           Utils.log('Could not find primary product image container', 'warn');
//           return;
//         }
        
//         // Apply badges
//         ProductModule.applyBadgesToElement(fetchedProductData, imageContainer);
//       } else {
//         Utils.log('Product data found', 'info', productData);
        
//         // Find primary product image container
//         const imageContainer = this.findProductImageContainer();
//         if (!imageContainer) {
//           Utils.log('Could not find primary product image container', 'warn');
//           return;
//         }
        
//         // Apply badges
//         ProductModule.applyBadgesToElement(productData, imageContainer);
//       }
//     },
    
//     /**
//      * Find product image container on product page
//      * @returns {HTMLElement|null} Image container element
//      */
//     findProductImageContainer() {
//       // Try selectors for common themes
//       const selectors = [
//         // Dawn theme
//         '.product__media-wrapper',
//         '.product__media-container',
//         '.product-single__media-wrapper',
//         '.product__image-wrapper',
//         // Debut theme
//         '.product-single__media',
//         '.product-featured-media-wrapper',
//         '.product-single__photos',
//         // Brooklyn theme
//         '.product-single__photo-wrapper',
//         // Other themes
//         '.featured-img-container',
//         '.product__slides',
//         '.product-single__photo-container',
//         // Generic fallbacks
//         '.product-images',
//         '.product-image',
//         '.product-gallery',
//         '.product-media',
//         '[class*="product-media"]',
//         '[class*="product-image"]'
//       ];
      
//       for (const selector of selectors) {
//         const container = document.querySelector(selector);
//         if (container) {
//           return container;
//         }
//       }
      
//       // Try to find a product image first, then get its container
//       const productImages = document.querySelectorAll(
//         'img[src*="/products/"], ' +
//         'img[srcset*="/products/"], ' +
//         'img[src*="/cdn.shopify.com/s/files/"], ' +
//         'img[src*="/cdn/shop/products/"]'
//       );
      
//       if (productImages.length > 0) {
//         // Find the largest image
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
        
//         // Get parent container (if any)
//         let container = largest.parentElement;
//         while (container && container !== document.body) {
//           if (
//             container.classList.contains('product-image') ||
//             container.classList.contains('product-media') ||
//             container.classList.contains('product-photo') ||
//             container.classList.contains('product__media')
//           ) {
//             return container;
//           }
//           container = container.parentElement;
//         }
        
//         // If no suitable container found, use image's direct parent
//         return largest.parentElement;
//       }
      
//       return null;
//     },
    
//     /**
//      * Scan for product elements on the page
//      */
//     async scanForProducts() {
//       if (this.state.isProcessing || this.state.badges.length === 0) return;
      
//       this.state.isProcessing = true;
//       this.state.scanCount++;
      
//       Utils.log(`Scanning for products (scan #${this.state.scanCount})`);
      
//       // Find product elements
//       const productElements = DOM.getProductElements();
      
//       if (productElements.length === 0) {
//         this.state.isProcessing = false;
//         return;
//       }
      
//       Utils.log(`Found ${productElements.length} unprocessed product elements`);
      
//       // Process each product element
//       for (const element of productElements) {
//         // Mark as processed
//         DOM.markAsProcessed(element);
        
//         // Extract product handle
//         const handle = DOM.getProductHandleFromElement(element);
//         if (!handle) continue;
        
//         // Find image container
//         const imageContainer = DOM.findImageContainer(element) || element;
        
//         // Skip if already processed completely
//         if (this.state.processedElements.has(imageContainer)) continue;
        
//         // Mark as processed completely
//         this.state.processedElements.add(imageContainer);
        
//         // Fetch product data
//         try {
//           const productData = await ProductModule.fetchProductData(handle);
//           if (productData) {
//             // Apply badges
//             ProductModule.applyBadgesToElement(productData, imageContainer);
//           }
//         } catch (error) {
//           Utils.log(`Error processing product ${handle}: ${error.message}`, 'error');
//         }
//       }
      
//       this.state.isProcessing = false;
//     }
//   };
  
//   // Initialize on page load
//   if (document.readyState === 'loading') {
//     document.addEventListener('DOMContentLoaded', () => {
//       BadgeApp.init();
//     });
//   } else {
//     BadgeApp.init();
//   }
// })();

/**
 * Improved Tagify Badge Script
 * 
 * This script reliably injects badges onto Shopify product elements
 * based on product conditions, tags, inventory, pricing, and discounts.
 */
(function () {
  // Configuration
  const CONFIG = {
    debug: true,                          // Enable console logging for debugging
    badgeEndpoint: 'https://tagmaster.shopyfi.in/apps/tagify/badges', // API endpoint for badge data
    scanInterval: 1500,                   // Interval between scans (ms)
    badgeZIndex: 999,                     // Z-index for badges
    badgePrefix: 'tm-badge',              // Class prefix for badges
    containerClass: 'tm-badge-container'  // Container class
  };

  // Utility functions
  const utils = {
    // Log messages to console when debug is enabled
    log: function (message, type = 'log', data = null) {
      if (!CONFIG.debug) return;

      const logger = console[type] || console.log;
      const prefix = '🏷️ Tagmaster: ';

      if (data) {
        logger(prefix + message, data);
      } else {
        logger(prefix + message);
      }
    },

    // Get the current shop domain
    getShopDomain: function () {
      // Try different ways to get shop domain
      if (Shopify && Shopify.shop) {
        return Shopify.shop;
      }

      // Try to extract from meta tags
      const shopTag = document.querySelector('meta[property="og:url"]');
      if (shopTag) {
        try {
          const url = new URL(shopTag.getAttribute('content'));
          return url.hostname;
        } catch (e) {
          // Ignore URL parsing errors
        }
      }

      // Fallback to current hostname
      return window.location.hostname;
    },

    // Calculate discount percentage
    calculateDiscount: function (compareAtPrice, price) {
      if (!compareAtPrice || !price || parseFloat(compareAtPrice) <= parseFloat(price)) {
        return 0;
      }

      return Math.round(((parseFloat(compareAtPrice) - parseFloat(price)) / parseFloat(compareAtPrice)) * 100);
    },

    // Parse money amount from Shopify format (cents) to dollars
    parseMoney: function (amount) {
      if (!amount) return 0;

      // Handle string values
      if (typeof amount === 'string') {
        amount = amount.replace(/[^\d.]/g, '');
      }

      return parseFloat(amount) / 100;
    },

    // Make an HTTP request
    fetchData: function (url, callback) {
      this.log(`Fetching data from: ${url}`);

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
    }
  };

  // Main badge application
  const TagifyBadges = {
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
    init: function () {
      if (this.state.initialized) return;

      utils.log('Initializing TagifyBadges...');

      // Set shop domain
      this.state.shopDomain = utils.getShopDomain();
      utils.log(`Shop domain: ${this.state.shopDomain}`);

      // Detect page type
      this.detectPageType();
      utils.log(`Page type detected: ${this.state.pageType}`);

      // Add base styles
      this.injectBaseStyles();
      utils.log('Base styles injected');

      // Fetch badge configurations
      this.fetchBadges();

      // Mark as initialized
      this.state.initialized = true;
    },

    /**
     * Detect the current page type
     */
    detectPageType: function () {
      // Check meta.page (common in many themes)
      if (typeof meta !== 'undefined' && meta.page && meta.page.pageType) {
        this.state.pageType = meta.page.pageType;
        return;
      }

      // Check Shopify object
      if (typeof Shopify !== 'undefined') {
        if (Shopify.template) {
          this.state.pageType = Shopify.template;
          return;
        }
      }

      // Check URL pattern
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
    injectBaseStyles: function () {
      // Check if styles are already injected
      if (document.getElementById(`${CONFIG.badgePrefix}-styles`)) return;

      const style = document.createElement('style');
      style.id = `${CONFIG.badgePrefix}-styles`;
      style.innerHTML = `
        /* Badge container */
        .${CONFIG.containerClass} {
          position: relative !important;
          overflow: visible !important;
        }
        
        /* Base badge styles */
        .${CONFIG.badgePrefix} {
          position: absolute;
          z-index: ${CONFIG.badgeZIndex};
          display: inline-block;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-weight: 700;
          line-height: 1.2;
          text-align: center;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          white-space: nowrap;
          animation: ${CONFIG.badgePrefix}-appear 300ms forwards;
          box-sizing: content-box;
        }
        
        /* Appearance animation */
        @keyframes ${CONFIG.badgePrefix}-appear {
          0% { opacity: 0; transform: scale(0.8); }
          100% { opacity: 1; transform: scale(1); }
        }
        
        /* Badge shapes */
        .${CONFIG.badgePrefix}-standard {
          border-radius: 4px;
          padding: 5px 10px;
        }
        
        .${CONFIG.badgePrefix}-circle {
          border-radius: 50%;
          padding: 0;
          min-width: 40px;
          min-height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .${CONFIG.badgePrefix}-ribbon {
          clip-path: polygon(0 0, 100% 0, 100% 70%, 50% 100%, 0 70%);
          padding: 5px 12px;
        }
        
        .${CONFIG.badgePrefix}-star {
          clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
          padding: 15px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .${CONFIG.badgePrefix}-sale {
          clip-path: polygon(0% 0%, 100% 0%, 100% 70%, 85% 100%, 0% 100%);
          padding: 5px 15px 5px 10px;
        }
        
        .${CONFIG.badgePrefix}-new {
          clip-path: polygon(15% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 30%);
          padding: 5px 10px 5px 15px;
        }
        
        .${CONFIG.badgePrefix}-popular {
          transform: rotate(-5deg);
          padding: 5px 10px;
          border-radius: 4px;
        }
        
        .${CONFIG.badgePrefix}-premium,
        .${CONFIG.badgePrefix}-limited,
        .${CONFIG.badgePrefix}-verified {
          padding: 5px 10px;
          border-radius: 4px;
        }
        
        /* Position classes */
        .${CONFIG.badgePrefix}-pos-1 {
          top: 10px;
          left: 10px;
        }
        
        .${CONFIG.badgePrefix}-pos-2 {
          top: 10px;
          left: 50%;
          transform: translateX(-50%);
        }
        
        .${CONFIG.badgePrefix}-pos-3 {
          top: 10px;
          right: 10px;
        }
        
        .${CONFIG.badgePrefix}-pos-4 {
          top: 50%;
          left: 10px;
          transform: translateY(-50%);
        }
        
        .${CONFIG.badgePrefix}-pos-5 {
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }
        
        .${CONFIG.badgePrefix}-pos-6 {
          top: 50%;
          right: 10px;
          transform: translateY(-50%);
        }
        
        .${CONFIG.badgePrefix}-pos-7 {
          bottom: 10px;
          left: 10px;
        }
        
        .${CONFIG.badgePrefix}-pos-8 {
          bottom: 10px;
          left: 50%;
          transform: translateX(-50%);
        }
        
        .${CONFIG.badgePrefix}-pos-9 {
          bottom: 10px;
          right: 10px;
        }
        
        /* Stacked badges */
        .${CONFIG.badgePrefix}-pos-1.${CONFIG.badgePrefix}-stacked-1 { top: 50px; }
        .${CONFIG.badgePrefix}-pos-1.${CONFIG.badgePrefix}-stacked-2 { top: 90px; }
        .${CONFIG.badgePrefix}-pos-2.${CONFIG.badgePrefix}-stacked-1 { top: 50px; }
        .${CONFIG.badgePrefix}-pos-2.${CONFIG.badgePrefix}-stacked-2 { top: 90px; }
        .${CONFIG.badgePrefix}-pos-3.${CONFIG.badgePrefix}-stacked-1 { top: 50px; }
        .${CONFIG.badgePrefix}-pos-3.${CONFIG.badgePrefix}-stacked-2 { top: 90px; }
        .${CONFIG.badgePrefix}-pos-7.${CONFIG.badgePrefix}-stacked-1 { bottom: 50px; }
        .${CONFIG.badgePrefix}-pos-7.${CONFIG.badgePrefix}-stacked-2 { bottom: 90px; }
        .${CONFIG.badgePrefix}-pos-8.${CONFIG.badgePrefix}-stacked-1 { bottom: 50px; }
        .${CONFIG.badgePrefix}-pos-8.${CONFIG.badgePrefix}-stacked-2 { bottom: 90px; }
        .${CONFIG.badgePrefix}-pos-9.${CONFIG.badgePrefix}-stacked-1 { bottom: 50px; }
        .${CONFIG.badgePrefix}-pos-9.${CONFIG.badgePrefix}-stacked-2 { bottom: 90px; }
        
        /* Animations */
        .${CONFIG.badgePrefix}-animate-pulse {
          animation: ${CONFIG.badgePrefix}-pulse 2s infinite;
        }
        
        @keyframes ${CONFIG.badgePrefix}-pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
        
        .${CONFIG.badgePrefix}-animate-bounce {
          animation: ${CONFIG.badgePrefix}-bounce 1s infinite;
        }
        
        @keyframes ${CONFIG.badgePrefix}-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        
        .${CONFIG.badgePrefix}-animate-shake {
          animation: ${CONFIG.badgePrefix}-shake 0.82s cubic-bezier(.36,.07,.19,.97) infinite;
        }
        
        @keyframes ${CONFIG.badgePrefix}-shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-3px, 0, 0); }
          40%, 60% { transform: translate3d(3px, 0, 0); }
        }
        
        .${CONFIG.badgePrefix}-animate-spin {
          animation: ${CONFIG.badgePrefix}-spin 2s linear infinite;
        }
        
        @keyframes ${CONFIG.badgePrefix}-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .${CONFIG.badgePrefix}-animate-fade-in {
          animation: ${CONFIG.badgePrefix}-fade 1.5s ease-in-out infinite alternate;
        }
        
        @keyframes ${CONFIG.badgePrefix}-fade {
          from { opacity: 0.5; }
          to { opacity: 1; }
        }
        
        /* Responsive styles */
        @media (max-width: 768px) {
          .${CONFIG.badgePrefix} {
            font-size: 11px !important;
            padding: 3px 6px !important;
          }
          
          .${CONFIG.badgePrefix}-circle {
            min-width: 30px !important;
            min-height: 30px !important;
          }
        }
      `;

      document.head.appendChild(style);
    },

    /**
     * Fetch badge configurations from server
     */
    fetchBadges: function () {
      const url = `${CONFIG.badgeEndpoint}?shop=${this.state.shopDomain}`;
      utils.log(`Fetching badges from ${url}`);

      utils.fetchData(url, (data) => {
        if (!data || !data.badges || data.badges.length === 0) {
          utils.log('No badges found or invalid data format', 'warn');
          return;
        }

        // Filter active badges
        this.state.badges = data.badges.filter(badge => badge.active === true);
        utils.log(`Loaded ${this.state.badges.length} active badges`, 'info', this.state.badges);

        if (this.state.badges.length === 0) return;

        // Start processing based on page type
        if (this.state.pageType === 'product') {
          this.processProductPage();
        }

        // Process all pages
        this.scanForProducts();

        // Set up interval for scanning
        setInterval(() => this.scanForProducts(), CONFIG.scanInterval);

        // Set up mutation observer for dynamic content
        this.setupMutationObserver();
      });
    },

    /**
     * Set up mutation observer to detect newly added product elements
     */
    setupMutationObserver: function () {
      if (!window.MutationObserver) return;

      const observer = new MutationObserver((mutations) => {
        let shouldScan = false;

        mutations.forEach(mutation => {
          if (mutation.type === 'childList' && mutation.addedNodes.length) {
            for (let i = 0; i < mutation.addedNodes.length; i++) {
              const node = mutation.addedNodes[i];

              // Skip non-element nodes
              if (node.nodeType !== Node.ELEMENT_NODE) continue;

              // Check if this is likely a product element
              const hasProductLink = node.tagName === 'A' && node.href && node.href.includes('/products/');
              const containsProductLink = !!node.querySelector('a[href*="/products/"]');
              const hasProductClasses = node.classList && (
                node.classList.contains('product') ||
                node.classList.contains('product-card') ||
                node.classList.contains('product-item') ||
                node.classList.contains('grid__item')
              );

              if (hasProductLink || containsProductLink || hasProductClasses) {
                shouldScan = true;
                break;
              }
            }
          }
        });

        if (shouldScan) {
          utils.log('New potential product elements detected');
          this.scanForProducts();
        }
      });

      // Start observing the document with the configured parameters
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      utils.log('Mutation observer configured');
    },

    /**
     * Process product page
     */
    processProductPage: function () {
      utils.log('Processing product page');

      // Try to get product data
      const productData = this.getProductData();
      if (!productData) {
        utils.log('No product data found on product page', 'warn');
        return;
      }

      utils.log('Product data found', 'info', productData);

      // Find primary product image container
      const imageContainer = this.findProductImageContainer();
      if (!imageContainer) {
        utils.log('Could not find primary product image container', 'warn');
        return;
      }

      // Apply badges
      this.applyBadgesToElement(productData, imageContainer);
    },

    /**
     * Get product data on a product page
     */
    getProductData: function () {
      // Try multiple methods to get product data

      // Method 1: Check meta.product
      if (typeof meta !== 'undefined' && meta.product) {
        return meta.product;
      }

      // Method 2: Check window.product
      if (window.product) {
        return window.product;
      }

      // Method 3: Check ShopifyAnalytics
      if (
        typeof ShopifyAnalytics !== 'undefined' &&
        ShopifyAnalytics.meta &&
        ShopifyAnalytics.meta.product
      ) {
        return ShopifyAnalytics.meta.product;
      }

      // Method 4: Look for product JSON in script tags
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
            // Ignore parsing errors
          }
        }
      }

      // Method 5: Get product handle from URL and fetch product data
      const handle = this.extractProductHandleFromUrl(window.location.pathname);
      if (handle) {
        // We'll need to fetch the product data asynchronously
        // For now, return a placeholder with the handle
        return { handle: handle, pending: true };
      }

      return null;
    },

    /**
     * Find product image container on product page
     */
    findProductImageContainer: function () {
      // Try selectors for common themes
      const selectors = [
        // Dawn theme
        '.product__media-wrapper',
        '.product__media-container',
        '.product-single__media-wrapper',
        '.product__image-wrapper',
        // Debut theme
        '.product-single__media',
        '.product-featured-media-wrapper',
        '.product-single__photos',
        // Brooklyn theme
        '.product-single__photo-wrapper',
        // Other themes
        '.featured-img-container',
        '.product__slides',
        '.product-single__photo-container',
        // Generic fallbacks
        '.product-images',
        '.product-image',
        '.product-gallery',
        '.product-media',
        '[class*="product-media"]',
        '[class*="product-image"]'
      ];

      for (const selector of selectors) {
        const container = document.querySelector(selector);
        if (container) {
          return container;
        }
      }

      // Try to find a product image first, then get its container
      const productImages = document.querySelectorAll(
        'img[src*="/products/"], ' +
        'img[srcset*="/products/"], ' +
        'img[src*="/cdn.shopify.com/s/files/"], ' +
        'img[src*="/cdn/shop/products/"]'
      );

      if (productImages.length > 0) {
        // Find the largest image
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

        // Get parent container (if any)
        let container = largest.parentElement;
        while (container && container !== document.body) {
          if (
            container.classList.contains('product-image') ||
            container.classList.contains('product-media') ||
            container.classList.contains('product-photo') ||
            container.classList.contains('product__media')
          ) {
            return container;
          }
          container = container.parentElement;
        }

        // If no suitable container found, use image's direct parent
        return largest.parentElement;
      }

      return null;
    },

    /**
     * Scan for product elements on the page
     */
    scanForProducts: function () {
      if (this.state.isProcessing || this.state.badges.length === 0) return;

      this.state.isProcessing = true;
      this.state.scanCount++;

      utils.log(`Scanning for products (scan #${this.state.scanCount})`);

      // Find product links
      const productLinks = document.querySelectorAll('a[href*="/products/"]:not([data-tm-processed])');

      if (productLinks.length === 0) {
        this.state.isProcessing = false;
        return;
      }

      utils.log(`Found ${productLinks.length} unprocessed product links`);

      // Process each product link
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

        // Fetch product data
        this.fetchProductData(handle, (productData) => {
          if (productData) {
            // Apply badges
            this.applyBadgesToElement(productData, container);
          }
        });
      }

      this.state.isProcessing = false;
    },

    /**
     * Find product container from a product link
     */
    findProductContainer: function (link) {
      if (!link) return null;

      // Common selectors for product cards/containers
      const selectors = [
        '.product-card',
        '.grid__item',
        '.product-item',
        '.card',
        '.product',
        '.card-wrapper',
        '[class*="product-card"]',
        '[class*="product-item"]'
      ];

      // Try to find container using selectors
      for (const selector of selectors) {
        const container = link.closest(selector);
        if (container) return container;
      }

      // Walk up the DOM tree to find a suitable container
      let element = link.parentElement;
      let depth = 0;

      while (element && depth < 4) {
        // Check if this element contains product information
        const hasImage = element.querySelector('img');
        const hasPrice = element.querySelector('.price') || element.querySelector('[class*="price"]');

        if (hasImage && hasPrice) {
          return element;
        }

        element = element.parentElement;
        depth++;
      }

      // Fallback to parent or grandparent
      return link.parentElement || link;
    },

    /**
     * Extract product handle from URL
     */
    extractProductHandleFromUrl: function (url) {
      if (!url) return null;

      const parts = url.split('/products/');
      if (parts.length < 2) return null;

      // Get handle and remove query parameters and hash
      let handle = parts[1].split('?')[0].split('#')[0];

      // Remove trailing slash if present
      if (handle.endsWith('/')) {
        handle = handle.slice(0, -1);
      }

      return handle;
    },

    /**
     * Fetch product data from Shopify
     */
    fetchProductData: function (handle, callback) {
      if (!handle) {
        callback(null);
        return;
      }

      // Use product.js endpoint
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
          utils.log(`Error fetching product data for ${handle}: ${error.message}`, 'error');
          callback(null);
        });
    },

    /**
     * Apply badges to a product element
     */
    applyBadgesToElement: function (product, container) {
      if (!product || !container) return;

      // Get product tags
      const productTags = this.getProductTags(product);

      utils.log(`Applying badges to product: ${product.title || product.handle}`, 'info', {
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
          const position = parseInt(badge.position || 3);

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
    prepareContainer: function (container) {
      if (!container) return container;

      // Skip if already prepared
      if (container.classList.contains(CONFIG.containerClass)) {
        return container;
      }

      // Make sure container has position relative
      const computedStyle = window.getComputedStyle(container);
      if (computedStyle.position === 'static') {
        container.style.position = 'relative';
      }

      // Add container class
      container.classList.add(CONFIG.containerClass);

      return container;
    },

    /**
     * Create a badge element and add it to the container
     */
    createBadge: function (container, badge, product, position, stackIndex) {
      // Create unique ID
      const badgeId = `${CONFIG.badgePrefix}-${product.id || 'handle'}-${badge.id}`;

      // Skip if badge already exists
      if (document.getElementById(badgeId)) {
        return;
      }

      // Create element
      const badgeElement = document.createElement('div');
      badgeElement.id = badgeId;
      badgeElement.className = `${CONFIG.badgePrefix} ${CONFIG.badgePrefix}-pos-${position}`;

      // Add shape class
      if (badge.shape) {
        badgeElement.classList.add(`${CONFIG.badgePrefix}-${badge.shape}`);
      } else {
        badgeElement.classList.add(`${CONFIG.badgePrefix}-standard`);
      }

      // Add animation class
      if (badge.animation && badge.animation !== 'none') {
        badgeElement.classList.add(`${CONFIG.badgePrefix}-animate-${badge.animation}`);
      }

      // Add stacked class if needed
      if (stackIndex > 0) {
        badgeElement.classList.add(`${CONFIG.badgePrefix}-stacked-${stackIndex}`);
      }

      // Apply styles
      Object.assign(badgeElement.style, {
        backgroundColor: badge.backgroundColor || '#6366f1',
        color: badge.textColor || '#FFFFFF',
        fontSize: `${badge.fontSize || 14}px`
      });

      // Apply border if specified
      if (badge.borderWidth && badge.borderColor) {
        badgeElement.style.border = `${badge.borderWidth}px solid ${badge.borderColor}`;
      }

      // Apply border radius if not a shape with specific radius
      if (!['circle', 'star', 'ribbon', 'sale', 'new'].includes(badge.shape)) {
        badgeElement.style.borderRadius = `${badge.borderRadius || 4}px`;
      }

      // Apply custom padding if specified
      if (badge.padding) {
        badgeElement.style.padding = badge.padding;
      }

      // Process badge text
      const badgeText = this.processBadgeText(badge.text || badge.name || 'SALE', product);
      badgeElement.textContent = badgeText;

      // Add to container
      container.appendChild(badgeElement);

      utils.log(`Added badge "${badgeText}" to product ${product.title || product.handle}`);
      this.state.appliedBadges++;

      return badgeElement;
    },

    /**
     * Process badge text with variable replacements
     */
    processBadgeText: function (text, product) {
      if (!text) return 'SALE';

      // Replace discount percentage
      if (text.includes('[DISCOUNT_PERCENT]') && product.compare_at_price) {
        const comparePrice = utils.parseMoney(product.compare_at_price);
        const price = utils.parseMoney(product.price);
        const discountPercent = utils.calculateDiscount(comparePrice, price);
        text = text.replace(/\[DISCOUNT_PERCENT\]/g, discountPercent);
      }

      // Replace discount amount
      if (text.includes('[DISCOUNT_AMOUNT]') && product.compare_at_price) {
        const comparePrice = utils.parseMoney(product.compare_at_price);
        const price = utils.parseMoney(product.price);
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
     * Get currency symbol
     */
    getCurrencySymbol: function () {
      // Try to get currency from Shopify
      if (typeof Shopify !== 'undefined' && Shopify.currency) {
        if (Shopify.currency.active) {
          return Shopify.currency.active;
        }
      }

      // Try to get from money format
      if (typeof theme !== 'undefined' && theme.moneyFormat) {
        const match = theme.moneyFormat.match(/\{\{\s*?amount_with_currency.*?\}\}/);
        if (match) {
          return 'INR'; // With currency symbol
        }
      }

      // Default
      return 'INR';
    },

    /**
     * Get product inventory quantity
     */
    getProductInventory: function (product) {
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
     * Get normalized product tags array
     */
    getProductTags: function (product) {
      if (!product.tags) return [];

      // Handle array tags
      if (Array.isArray(product.tags)) {
        return product.tags;
      }

      // Handle string tags
      if (typeof product.tags === 'string') {
        return product.tags.split(', ');
      }

      return [];
    },

    /**
     * Check if a badge should be applied to a product
     */
    shouldApplyBadge: function (badge, product, productTags) {
      // Check page type
      if (badge.pageType && badge.pageType !== 'all' && badge.pageType !== this.state.pageType) {
        return false;
      }

      // Check included tags
      if (badge.includedTags && badge.includedTags.length > 0) {
        const badgeTags = badge.includedTags.map(tag => tag.toLowerCase());
        const normalizedProductTags = productTags.map(tag => tag.toLowerCase());

        let hasMatch = false;
        for (const tag of badgeTags) {
          if (normalizedProductTags.includes(tag)) {
            hasMatch = true;
            break;
          }
        }

        if (!hasMatch) return false;
      }

      // Check excluded tags
      if (badge.excludedTags && badge.excludedTags.length > 0) {
        const badgeTags = badge.excludedTags.map(tag => tag.toLowerCase());
        const normalizedProductTags = productTags.map(tag => tag.toLowerCase());

        for (const tag of badgeTags) {
          if (normalizedProductTags.includes(tag)) {
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
        const price = utils.parseMoney(product.price);

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

        const comparePrice = utils.parseMoney(product.compare_at_price);
        const price = utils.parseMoney(product.price);
        const discountPercent = utils.calculateDiscount(comparePrice, price);

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
      TagifyBadges.init();
    });
  } else {
    TagifyBadges.init();
  }
})();
