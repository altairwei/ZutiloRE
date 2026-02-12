/**
 * ZutiloRE - bootstrap.js
 * Based on Zotero's Make It Red example
 */

var chromeHandle;
var zutiloRE;

function install(data, reason) {
  dump("ZutiloRE: install() called\n");
}

async function startup({ id, version, resourceURI, rootURI }, reason) {
  dump("ZutiloRE: startup() called\n");
  
  try {
    // Wait for Zotero to be fully initialized
    await Zotero.initializationPromise;
    dump("ZutiloRE: Zotero initialized\n");

    // String 'rootURI' introduced in Zotero 7
    if (!rootURI) {
      rootURI = resourceURI.spec;
    }

    // Services is available globally in Zotero bootstrap scope
    dump("ZutiloRE: Using global Services\n");

    // Register chrome
    var aomStartup = Components.classes[
      "@mozilla.org/addons/addon-manager-startup;1"
    ].getService(Components.interfaces.amIAddonManagerStartup);
    var manifestURI = Services.io.newURI(rootURI + "manifest.json");
    chromeHandle = aomStartup.registerChrome(manifestURI, [
      ["content", "zutilore", rootURI + "chrome/content/"],
      ["locale", "zutilore", "en-US", rootURI + "locale/en-US/"],
    ]);
    dump("ZutiloRE: Chrome registered\n");

    // Create context for loading scripts
    const ctx = {
      rootURI,
      Zotero,
      Services,
      Components,
    };
    ctx._globalThis = ctx;

    // Load main script
    dump("ZutiloRE: Loading main script...\n");
    Services.scriptloader.loadSubScript(
      rootURI + "src/zutilore.js",
      ctx,
    );
    dump("ZutiloRE: Main script loaded\n");

    // Initialize
    if (typeof ctx.zutiloRE !== 'undefined' && ctx.zutiloRE.init) {
      zutiloRE = ctx.zutiloRE;
      await zutiloRE.init();
      dump("ZutiloRE: Initialized successfully\n");
    } else {
      dump("ZutiloRE: ERROR - zutiloRE not found in loaded script\n");
    }
    
    // Register for window load events
    for (const win of Zotero.getMainWindows()) {
      await onMainWindowLoad({ window: win }, reason);
    }
    
  } catch (e) {
    dump("ZutiloRE: ERROR in startup: " + e + "\n");
    dump("ZutiloRE: Stack: " + (e.stack || "no stack") + "\n");
    throw e;
  }
}

async function onMainWindowLoad({ window }, reason) {
  dump("ZutiloRE: onMainWindowLoad() called\n");
  
  try {
    // Wait for window to be ready
    await new Promise((resolve) => {
      if (window.document.readyState === "complete") {
        resolve();
      } else {
        window.document.addEventListener("readystatechange", () => {
          if (window.document.readyState === "complete") {
            resolve();
          }
        });
      }
    });
    dump("ZutiloRE: Window ready\n");

    // Register menu items when window is ready
    if (zutiloRE && zutiloRE.registerMenus) {
      zutiloRE.registerMenus(window);
      dump("ZutiloRE: Menus registered\n");
    }
  } catch (e) {
    dump("ZutiloRE: ERROR in onMainWindowLoad: " + e + "\n");
  }
}

async function onMainWindowUnload({ window }, reason) {
  dump("ZutiloRE: onMainWindowUnload() called\n");
}

function shutdown({ id, version, resourceURI, rootURI }, reason) {
  dump("ZutiloRE: shutdown() called, reason=" + reason + "\n");
  
  if (reason === APP_SHUTDOWN) {
    return;
  }

  try {
    // Cleanup
    if (zutiloRE && zutiloRE.destroy) {
      zutiloRE.destroy();
    }

    // Flush string bundles
    Components.classes["@mozilla.org/intl/stringbundle;1"]
      .getService(Components.interfaces.nsIStringBundleService)
      .flushBundles();

    // Deregister chrome
    if (chromeHandle) {
      chromeHandle.destruct();
      chromeHandle = null;
    }
    
    dump("ZutiloRE: Shutdown complete\n");
  } catch (e) {
    dump("ZutiloRE: ERROR in shutdown: " + e + "\n");
  }
}

function uninstall(data, reason) {
  dump("ZutiloRE: uninstall() called\n");
}
