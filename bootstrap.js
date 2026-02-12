/**
 * ZutiloRE - bootstrap.js
 * Based on Zotero's Make It Red example and zotero-pdf-translate best practices
 */

var chromeHandle;

function install(data, reason) {}

async function startup({ id, version, resourceURI, rootURI }, reason) {
  // Wait for Zotero to be fully initialized
  await Zotero.initializationPromise;

  // String 'rootURI' introduced in Zotero 7
  if (!rootURI) {
    rootURI = resourceURI.spec;
  }

  // Register chrome
  var aomStartup = Components.classes[
    "@mozilla.org/addons/addon-manager-startup;1"
  ].getService(Components.interfaces.amIAddonManagerStartup);
  var manifestURI = Services.io.newURI(rootURI + "manifest.json");
  chromeHandle = aomStartup.registerChrome(manifestURI, [
    ["content", "zutilore", rootURI + "chrome/content/"],
    ["locale", "zutilore", "en-US", rootURI + "locale/en-US/"],
  ]);

  // Create context for loading scripts
  const ctx = {
    rootURI,
    Zotero,
    Services,
    Components,
    ChromeUtils,
  };
  ctx._globalThis = ctx;

  // Load main script
  Services.scriptloader.loadSubScript(
    rootURI + "src/zutilore.js",
    ctx,
  );

  // Initialize
  if (typeof zutiloRE !== 'undefined' && zutiloRE.init) {
    await zutiloRE.init();
  }
}

async function onMainWindowLoad({ window }, reason) {
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

  // Register menu items when window is ready
  if (typeof zutiloRE !== 'undefined' && zutiloRE.registerMenus) {
    zutiloRE.registerMenus(window);
  }
}

async function onMainWindowUnload({ window }, reason) {
  // Cleanup menus if needed
}

function shutdown({ id, version, resourceURI, rootURI }, reason) {
  if (reason === APP_SHUTDOWN) {
    return;
  }

  // Cleanup
  if (typeof zutiloRE !== 'undefined' && zutiloRE.destroy) {
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
}

function uninstall(data, reason) {}
