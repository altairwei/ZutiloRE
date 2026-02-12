/**
 * ZutiloRE - bootstrap.js
 * Based on Zotero's Make It Red example and zotero-pdf-translate
 */

var chromeHandle;

function install(data, reason) {}

async function startup({ id, version, resourceURI, rootURI }, reason) {
  await Zotero.initializationPromise;

  if (!rootURI) {
    rootURI = resourceURI.spec;
  }

  var aomStartup = Components.classes[
    "@mozilla.org/addons/addon-manager-startup;1"
  ].getService(Components.interfaces.amIAddonManagerStartup);
  var manifestURI = Services.io.newURI(rootURI + "manifest.json");
  chromeHandle = aomStartup.registerChrome(manifestURI, [
    ["content", "zutilore", rootURI + "chrome/content/"],
    ["locale", "zutilore", "en-US", rootURI + "locale/en-US/"]
  ]);

  const ctx = {
    rootURI: rootURI
  };
  ctx._globalThis = ctx;

  Services.scriptloader.loadSubScript(
    rootURI + "src/zutilore.js",
    ctx
  );
}

async function onMainWindowLoad({ window }, reason) {
  if (typeof zutiloRE !== 'undefined' && zutiloRE.init && !zutiloRE.initialized) {
    await zutiloRE.init();
  }
}

async function onMainWindowUnload({ window }, reason) {}

function shutdown({ id, version, resourceURI, rootURI }, reason) {
  if (reason === APP_SHUTDOWN) {
    return;
  }

  if (typeof zutiloRE !== 'undefined' && zutiloRE.destroy) {
    zutiloRE.destroy();
  }

  Components.classes["@mozilla.org/intl/stringbundle;1"]
    .getService(Components.interfaces.nsIStringBundleService)
    .flushBundles();

  if (chromeHandle) {
    chromeHandle.destruct();
    chromeHandle = null;
  }
}

function uninstall(data, reason) {}
