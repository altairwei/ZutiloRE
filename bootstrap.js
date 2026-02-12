/**
 * ZutiloRE - bootstrap.js
 */

var chromeHandle;
var zutiloRE;

function log(msg) {
  if (typeof Zotero !== 'undefined' && Zotero.debug) {
    Zotero.debug("ZutiloRE: " + msg);
  }
}

function install(data, reason) {
  log("install() called");
}

async function startup({ id, version, resourceURI, rootURI }, reason) {
  log("startup() called");
  
  try {
    await Zotero.initializationPromise;
    log("Zotero initialized");

    if (!rootURI) {
      rootURI = resourceURI.spec;
    }

    log("Using global Services");

    var aomStartup = Components.classes[
      "@mozilla.org/addons/addon-manager-startup;1"
    ].getService(Components.interfaces.amIAddonManagerStartup);
    
    var manifestURI = Services.io.newURI(rootURI + "manifest.json");
    
    chromeHandle = aomStartup.registerChrome(manifestURI, [
      ["content", "zutilore", rootURI + "chrome/content/"],
      ["locale", "zutilore", "en-US", rootURI + "locale/en-US/"]
    ]);
    
    log("Chrome registered");

    var ctx = {
      rootURI: rootURI,
      Zotero: Zotero,
      Services: Services,
      Components: Components
    };
    
    ctx._globalThis = ctx;

    log("Loading main script...");
    Services.scriptloader.loadSubScript(
      rootURI + "src/zutilore.js",
      ctx
    );
    
    log("Main script loaded");

    if (typeof ctx.zutiloRE !== 'undefined' && ctx.zutiloRE.init) {
      zutiloRE = ctx.zutiloRE;
      await zutiloRE.init();
      log("Initialized successfully");
    } else {
      log("ERROR - zutiloRE not found");
    }
    
    for (var i = 0; i < Zotero.getMainWindows().length; i++) {
      await onMainWindowLoad({ window: Zotero.getMainWindows()[i] }, reason);
    }
    
  } catch (e) {
    log("ERROR in startup: " + e);
    log("Stack: " + (e.stack || "no stack"));
    throw e;
  }
}

async function onMainWindowLoad({ window }, reason) {
  log("onMainWindowLoad() called");
  
  try {
    if (window.document.readyState === "complete") {
      // already ready
    } else {
      await new Promise(function(resolve) {
        window.document.addEventListener("readystatechange", function() {
          if (window.document.readyState === "complete") {
            resolve();
          }
        });
      });
    }
    
    log("Window ready");

    if (zutiloRE && zutiloRE.registerMenus) {
      zutiloRE.registerMenus(window);
      log("Menus registered");
    }
  } catch (e) {
    log("ERROR in onMainWindowLoad: " + e);
  }
}

async function onMainWindowUnload({ window }, reason) {
  log("onMainWindowUnload() called");
}

function shutdown({ id, version, resourceURI, rootURI }, reason) {
  log("shutdown() called, reason=" + reason);
  
  if (reason === APP_SHUTDOWN) {
    return;
  }

  try {
    if (zutiloRE && zutiloRE.destroy) {
      zutiloRE.destroy();
    }

    Components.classes["@mozilla.org/intl/stringbundle;1"]
      .getService(Components.interfaces.nsIStringBundleService)
      .flushBundles();

    if (chromeHandle) {
      chromeHandle.destruct();
      chromeHandle = null;
    }
    
    log("Shutdown complete");
  } catch (e) {
    log("ERROR in shutdown: " + e);
  }
}

function uninstall(data, reason) {
  log("uninstall() called");
}
