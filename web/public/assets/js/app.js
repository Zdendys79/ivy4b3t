/**
 * File: app.js
 * Location: ~/web/public/assets/js/app.js
 *
 * Purpose: Main JavaScript application for IVY4B3T web interface.
 *          Contains core functionality, utilities, and global event handlers.
 */

(function(window, document) {
    'use strict';

    // ================================
    // GLOBAL APPLICATION OBJECT
    // ================================

    window.IVY = {
        version: '2.0.0',
        debug: false,
        config: {
            apiBaseUrl: '/api',
            refreshInterval: 30000, // 30 seconds
            toastDuration: 5000,
            animationDuration: 300
        },
        modules: {},
        utils: {},
        components: {}
    };

    // ================================
    // UTILITY FUNCTIONS
    // ================================

    IVY.utils = {
        /**
         * DOM utilities
         */
        $ : function(selector, context) {
            context = context || document;
            return context.querySelector(selector);
        },

        $$ : function(selector, context) {
            context = context || document;
            return Array.from(context.querySelectorAll(selector));
        },

        createElement: function(tag, attrs, children) {
            const element = document.createElement(tag);

            if (attrs) {
                Object.keys(attrs).forEach(key => {
                    if (key === 'className') {
                        element.className = attrs[key];
                    } else if (key === 'innerHTML') {
                        element.innerHTML = attrs[key];
                    } else {
                        element.setAttribute(key, attrs[key]);
                    }
                });
            }

            if (children) {
                if (typeof children === 'string') {
                    element.textContent = children;
                } else if (Array.isArray(children)) {
                    children.forEach(child => {
                        if (typeof child === 'string') {
                            element.appendChild(document.createTextNode(child));
                        } else {
                            element.appendChild(child);
                        }
                    });
                }
            }

            return element;
        },

        /**
         * AJAX utilities
         */
        ajax: function(options) {
            const defaults = {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                timeout: 10000
            };

            const config = Object.assign({}, defaults, options);

            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();

                xhr.timeout = config.timeout;
                xhr.open(config.method, config.url);

                // Set headers
                Object.keys(config.headers).forEach(key => {
                    xhr.setRequestHeader(key, config.headers[key]);
                });

                xhr.onload = function() {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const response = JSON.parse(xhr.responseText);
                            resolve(response);
                        } catch (e) {
                            resolve(xhr.responseText);
                        }
                    } else {
                        reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
                    }
                };

                xhr.onerror = function() {
                    reject(new Error('Network error'));
                };

                xhr.ontimeout = function() {
                    reject(new Error('Request timeout'));
                };

                // Send request
                if (config.data) {
                    xhr.send(JSON.stringify(config.data));
                } else {
                    xhr.send();
                }
            });
        },

        /**
         * Form utilities
         */
        serializeForm: function(form) {
            const formData = new FormData(form);
            const data = {};

            for (let [key, value] of formData.entries()) {
                if (data[key]) {
                    if (Array.isArray(data[key])) {
                        data[key].push(value);
                    } else {
                        data[key] = [data[key], value];
                    }
                } else {
                    data[key] = value;
                }
            }

            return data;
        },

        validateForm: function(form) {
            const errors = [];
            const inputs = this.$$('input, select, textarea', form);

            inputs.forEach(input => {
                if (input.hasAttribute('required') && !input.value.trim()) {
                    errors.push(`${input.name || input.id} is required`);
                    this.addClass(input, 'error');
                } else {
                    this.removeClass(input, 'error');
                }

                // Email validation
                if (input.type === 'email' && input.value) {
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRegex.test(input.value)) {
                        errors.push('Invalid email format');
                        this.addClass(input, 'error');
                    }
                }
            });

            return {
                isValid: errors.length === 0,
                errors: errors
            };
        },

        /**
         * CSS class utilities
         */
        hasClass: function(element, className) {
            return element.classList.contains(className);
        },

        addClass: function(element, className) {
            element.classList.add(className);
        },

        removeClass: function(element, className) {
            element.classList.remove(className);
        },

        toggleClass: function(element, className) {
            element.classList.toggle(className);
        },

        /**
         * String utilities
         */
        escapeHtml: function(unsafe) {
            return unsafe
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        },

        formatNumber: function(num) {
            return new Intl.NumberFormat().format(num);
        },

        formatDate: function(date, options) {
            options = options || {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            };
            return new Intl.DateTimeFormat('cs-CZ', options).format(new Date(date));
        },

        /**
         * Local storage utilities
         */
        storage: {
            set: function(key, value) {
                try {
                    localStorage.setItem(key, JSON.stringify(value));
                    return true;
                } catch (e) {
                    console.warn('localStorage not available:', e);
                    return false;
                }
            },

            get: function(key) {
                try {
                    const item = localStorage.getItem(key);
                    return item ? JSON.parse(item) : null;
                } catch (e) {
                    console.warn('localStorage read error:', e);
                    return null;
                }
            },

            remove: function(key) {
                try {
                    localStorage.removeItem(key);
                    return true;
                } catch (e) {
                    console.warn('localStorage remove error:', e);
                    return false;
                }
            }
        },

        /**
         * Debounce function
         */
        debounce: function(func, wait, immediate) {
            let timeout;
            return function executedFunction() {
                const context = this;
                const args = arguments;
                const later = function() {
                    timeout = null;
                    if (!immediate) func.apply(context, args);
                };
                const callNow = immediate && !timeout;
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
                if (callNow) func.apply(context, args);
            };
        }
    };

    // ================================
    // TOAST NOTIFICATION SYSTEM
    // ================================

    IVY.components.Toast = {
        container: null,

        init: function() {
            if (!this.container) {
                this.container = IVY.utils.createElement('div', {
                    id: 'toast-container',
                    className: 'toast-container'
                });
                document.body.appendChild(this.container);
            }
        },

        show: function(message, type, duration) {
            this.init();

            type = type || 'info';
            duration = duration || IVY.config.toastDuration;

            const toast = IVY.utils.createElement('div', {
                className: `toast toast-${type}`,
                innerHTML: `
                    <div class="toast-content">
                        <span class="toast-icon">${this.getIcon(type)}</span>
                        <span class="toast-message">${IVY.utils.escapeHtml(message)}</span>
                        <button class="toast-close" type="button">&times;</button>
                    </div>
                `
            });

            // Add close functionality
            const closeBtn = IVY.utils.$('.toast-close', toast);
            closeBtn.addEventListener('click', () => this.hide(toast));

            // Add to container
            this.container.appendChild(toast);

            // Trigger animation
            setTimeout(() => IVY.utils.addClass(toast, 'show'), 10);

            // Auto-remove
            setTimeout(() => this.hide(toast), duration);

            return toast;
        },

        hide: function(toast) {
            IVY.utils.removeClass(toast, 'show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, IVY.config.animationDuration);
        },

        getIcon: function(type) {
            const icons = {
                success: '✅',
                error: '❌',
                warning: '⚠️',
                info: 'ℹ️'
            };
            return icons[type] || icons.info;
        },

        success: function(message, duration) {
            return this.show(message, 'success', duration);
        },

        error: function(message, duration) {
            return this.show(message, 'error', duration);
        },

        warning: function(message, duration) {
            return this.show(message, 'warning', duration);
        },

        info: function(message, duration) {
            return this.show(message, 'info', duration);
        }
    };

    // ================================
    // LOADING OVERLAY SYSTEM
    // ================================

    IVY.components.Loading = {
        overlay: null,

        show: function(message) {
            if (this.overlay) return;

            message = message || 'Loading...';

            this.overlay = IVY.utils.createElement('div', {
                className: 'loading-overlay',
                innerHTML: `
                    <div class="loading-content">
                        <div class="loading-spinner"></div>
                        <div class="loading-message">${IVY.utils.escapeHtml(message)}</div>
                    </div>
                `
            });

            document.body.appendChild(this.overlay);
            setTimeout(() => IVY.utils.addClass(this.overlay, 'show'), 10);
        },

        hide: function() {
            if (!this.overlay) return;

            IVY.utils.removeClass(this.overlay, 'show');
            setTimeout(() => {
                if (this.overlay && this.overlay.parentNode) {
                    this.overlay.parentNode.removeChild(this.overlay);
                    this.overlay = null;
                }
            }, IVY.config.animationDuration);
        },

        updateMessage: function(message) {
            if (this.overlay) {
                const messageEl = IVY.utils.$('.loading-message', this.overlay);
                if (messageEl) {
                    messageEl.textContent = message;
                }
            }
        }
    };

    // ================================
    // MODAL SYSTEM
    // ================================

    IVY.components.Modal = {
        current: null,

        show: function(content, options) {
            options = options || {};

            const modal = IVY.utils.createElement('div', {
                className: 'modal-overlay',
                innerHTML: `
                    <div class="modal-container">
                        <div class="modal-header">
                            <h3 class="modal-title">${options.title || ''}</h3>
                            <button class="modal-close" type="button">&times;</button>
                        </div>
                        <div class="modal-body">${content}</div>
                        ${options.footer ? `<div class="modal-footer">${options.footer}</div>` : ''}
                    </div>
                `
            });

            // Close functionality
            const closeBtn = IVY.utils.$('.modal-close', modal);
            closeBtn.addEventListener('click', () => this.hide());

            // Close on overlay click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hide();
                }
            });

            // ESC key support
            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    this.hide();
                    document.removeEventListener('keydown', escHandler);
                }
            };
            document.addEventListener('keydown', escHandler);

            document.body.appendChild(modal);
            setTimeout(() => IVY.utils.addClass(modal, 'show'), 10);

            this.current = modal;
            return modal;
        },

        hide: function() {
            if (!this.current) return;

            IVY.utils.removeClass(this.current, 'show');
            setTimeout(() => {
                if (this.current && this.current.parentNode) {
                    this.current.parentNode.removeChild(this.current);
                    this.current = null;
                }
            }, IVY.config.animationDuration);
        }
    };

    // ================================
    // GLOBAL EVENT HANDLERS
    // ================================

    function initGlobalEvents() {
        // Handle AJAX forms
        document.addEventListener('submit', function(e) {
            const form = e.target;
            if (form.hasAttribute('data-ajax')) {
                e.preventDefault();
                handleAjaxForm(form);
            }
        });

        // Handle loading buttons
        document.addEventListener('click', function(e) {
            const button = e.target.closest('[data-loading]');
            if (button) {
                IVY.utils.addClass(button, 'loading');
                button.disabled = true;
            }
        });

        // Auto-refresh functionality
        if (IVY.config.refreshInterval > 0) {
            setInterval(function() {
                if (!document.hidden && window.location.pathname !== '/login') {
                    refreshPageData();
                }
            }, IVY.config.refreshInterval);
        }
    }

    function handleAjaxForm(form) {
        const validation = IVY.utils.validateForm(form);
        if (!validation.isValid) {
            IVY.components.Toast.error('Please fix form errors');
            return;
        }

        const data = IVY.utils.serializeForm(form);
        const url = form.action || window.location.href;
        const method = form.method || 'POST';

        IVY.components.Loading.show('Submitting form...');

        IVY.utils.ajax({
            url: url,
            method: method,
            data: data
        })
        .then(response => {
            IVY.components.Loading.hide();

            if (response.success) {
                IVY.components.Toast.success(response.message || 'Success!');
                if (response.redirect) {
                    window.location.href = response.redirect;
                }
            } else {
                IVY.components.Toast.error(response.message || 'An error occurred');
            }
        })
        .catch(error => {
            IVY.components.Loading.hide();
            IVY.components.Toast.error('Network error: ' + error.message);
        });
    }

    function refreshPageData() {
        // This can be overridden by page-specific scripts
        if (typeof window.refreshData === 'function') {
            window.refreshData();
        }
    }

    // ================================
    // INITIALIZATION
    // ================================

    function init() {
        // Set debug mode based on URL parameter or stored preference
        const urlParams = new URLSearchParams(window.location.search);
        IVY.debug = urlParams.has('debug') || IVY.utils.storage.get('ivy_debug') === true;

        if (IVY.debug) {
            console.log('🤖 IVY4B3T Framework loaded - Debug mode enabled');
            console.log('Version:', IVY.version);
            console.log('Config:', IVY.config);
        }

        // Initialize global event handlers
        initGlobalEvents();

        // Initialize components
        IVY.components.Toast.init();

        // Dispatch ready event
        document.dispatchEvent(new CustomEvent('ivy:ready', {
            detail: { version: IVY.version }
        }));
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Export for debugging
    if (IVY.debug) {
        window.IVY_DEBUG = {
            utils: IVY.utils,
            components: IVY.components
        };
    }

})(window, document);
