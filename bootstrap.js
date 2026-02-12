/**
 * ZutiloRE - bootstrap.js
 * Zotero 8 compatible bootstrap entry point
 */

// Use dump for logging (console is not available in bootstrap scope)
function log(msg) {
    dump("ZutiloRE: " + msg + "\n");
}

// Import Services - try different methods for compatibility
let Services;
try {
    // Try ChromeUtils.importESModule (Zotero 8 / Firefox 115)
    ({ Services } = ChromeUtils.importESModule("resource://gre/modules/Services.sys.mjs"));
} catch (e) {
    try {
        // Fallback to ChromeUtils.import (older versions)
        ({ Services } = ChromeUtils.import("resource://gre/modules/Services.jsm"));
    } catch (e2) {
        // Last resort: use global Services if available
        if (typeof window !== 'undefined' && window.Services) {
            Services = window.Services;
        } else if (typeof globalThis.Services !== 'undefined') {
            Services = globalThis.Services;
        } else {
            log("ERROR: Could not import Services");
            throw new Error("Services not available");
        }
    }
}

// Global state
let chromeHandle = null;
let zutiloRE = null;

/**
 * Plugin lifecycle: startup
 */
function startup({ id, version, rootURI }, reason) {
    log("Starting up...");
    
    try {
        // Register chrome URLs
        const aomStartup = Cc["@mozilla.org/addons/addon-manager-startup;1"]
            .getService(Ci.amIAddonManagerStartup);
        const manifestURI = Services.io.newURI(rootURI + "install.rdf");
        chromeHandle = aomStartup.registerChrome(manifestURI, [
            ["content", "zutilore", "chrome/content/"],
            ["locale", "zutilore", "en-US", "locale/en-US/"]
        ]);
        
        // Initialize when Zotero is ready
        if (typeof Zotero !== 'undefined' && Zotero.initialized) {
            initZutiloRE(rootURI);
        } else {
            // Wait for Zotero initialization
            const observer = {
                observe: function(subject, topic, data) {
                    if (topic === 'final-ui-startup') {
                        Services.obs.removeObserver(observer, 'final-ui-startup');
                        initZutiloRE(rootURI);
                    }
                }
            };
            Services.obs.addObserver(observer, 'final-ui-startup');
        }
        
        log("Startup complete");
    } catch (e) {
        log("ERROR in startup: " + e);
    }
}

/**
 * Initialize ZutiloRE
 */
async function initZutiloRE(rootURI) {
    try {
        log("Initializing...");
        
        // Load main module
        const scriptPath = rootURI + 'src/zutilore.js';
        Services.scriptloader.loadSubScript(scriptPath, {
            Zotero,
            Services,
            rootURI,
            ChromeUtils
        });
        
        // Initialize if global zutiloRE was set by the script
        if (typeof zutiloRE !== 'undefined' && zutiloRE.init) {
            await zutiloRE.init();
        }
        
        log("Initialized successfully");
    } catch (e) {
        log("ERROR: Initialization failed - " + e);
    }
}

/**
 * Plugin lifecycle: shutdown
 */
function shutdown({ id, version, rootURI }, reason) {
    log("Shutting down...");
    
    if (reason === APP_SHUTDOWN) return;
    
    // Cleanup
    if (zutiloRE && zutiloRE.destroy) {
        zutiloRE.destroy();
    }
    
    // Deregister chrome
    if (chromeHandle) {
        chromeHandle.destruct();
        chromeHandle = null;
    }
    
    zutiloRE = null;
}

/**
 * Plugin lifecycle: install
 */
function install({ id, version, rootURI }, reason) {
    log("Installed");
}

/**
 * Plugin lifecycle: uninstall
 */
function uninstall({ id, version, rootURI }, reason) {
    log("Uninstalled");
}
