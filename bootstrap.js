/**
 * ZutiloRE - bootstrap.js
 * Zotero 8 compatible bootstrap entry point
 */

// Import required modules using ES6 module syntax
const { Services } = ChromeUtils.importESModule("resource://gre/modules/Services.sys.mjs");

// Global state
let chromeHandle = null;
let zutiloRE = null;

/**
 * Plugin lifecycle: startup
 */
function startup({ id, version, rootURI }, reason) {
    console.log("ZutiloRE: Starting up...");
    
    // Register chrome URLs
    const aomStartup = Cc["@mozilla.org/addons/addon-manager-startup;1"]
        .getService(Ci.amIAddonManagerStartup);
    const manifestURI = Services.io.newURI(rootURI + "manifest.json");
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
}

/**
 * Initialize ZutiloRE
 */
async function initZutiloRE(rootURI) {
    try {
        console.log("ZutiloRE: Initializing...");
        
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
        
        console.log("ZutiloRE: Initialized successfully");
    } catch (e) {
        console.error("ZutiloRE: Initialization failed", e);
    }
}

/**
 * Plugin lifecycle: shutdown
 */
function shutdown({ id, version, rootURI }, reason) {
    console.log("ZutiloRE: Shutting down...");
    
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
    console.log("ZutiloRE: Installed");
}

/**
 * Plugin lifecycle: uninstall
 */
function uninstall({ id, version, rootURI }, reason) {
    console.log("ZutiloRE: Uninstalled");
}
