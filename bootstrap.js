/**
 * ZutiloRE - bootstrap.js
 */

var chromeHandle;
var zutiloRE;

function install(data, reason) {
  dump("ZutiloRE: install() called\n");
}

async function startup({ id, version, resourceURI, rootURI }, reason) {
  dump("ZutiloRE: startup() called\n");
  
  try {
    await Zotero.initializationPromise;
    dump("ZutiloRE: Zotero initialized\n");

    if (!rootURI) {
      rootURI = resourceURI.spec;
    }

    dump("ZutiloRE: Using global Services\n");

    var aomStartup = Components.classes[
      "@mozilla.org/addons/addon-manager-startup;1"
    ].getService(Components.interfaces.amIAddonManagerStartup);
    
    var manifestURI = Services.io.newURI(rootURI + "manifest.json");
    
    chromeHandle = aomStartup.registerChrome(manifestURI, [
      ["content", "zutilore", rootURI + "chrome/content/"],
      ["locale", "zutilore", "en-US", rootURI + "locale/en-US/"]
    ]);
    
    dump("ZutiloRE: Chrome registered\n");

    var ctx = {
      rootURI: rootURI,
      Zotero: Zotero,
      Services: Services,
      Components: Components
    };
    
    ctx._globalThis = ctx;

    dump("ZutiloRE: Loading main script...\n");
    Services.scriptloader.loadSubScript(
      rootURI + "src/zutilore.js",
      ctx
    );
    
    dump("ZutiloRE: Main script loaded\n");

    if (typeof ctx.zutiloRE !== 'undefined' && ctx.zutiloRE.init) {
      zutiloRE = ctx.zutiloRE;
      await zutiloRE.init();
      dump("ZutiloRE: Initialized successfully\n");
    } else {
      dump("ZutiloRE: ERROR - zutiloRE not found\n");
    }
    
    for (var i = 0; i < Zotero.getMainWindows().length; i++) {
      await onMainWindowLoad({ window: Zotero.getMainWindows()[i] }, reason);
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
    
    dump("ZutiloRE: Window ready\n");

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
    
    dump("ZutiloRE: Shutdown complete\n");
  } catch (e) {
    dump("ZutiloRE: ERROR in shutdown: " + e + "\n");
  }
}

function uninstall(data, reason) {
  dump("ZutiloRE: uninstall() called\n");
}
