/**
 * ZutiloRE - Bootstrap Entry Point
 * Handles plugin initialization for Zotero
 */

var zutiloRE;

function install(data, reason) {
  Zotero.debug('ZutiloRE: install() called');
}

async function startup({ id, version, resourceURI, rootURI }, reason) {
  Zotero.debug('ZutiloRE: startup() called');

  try {
    await Zotero.initializationPromise;
    Zotero.debug('ZutiloRE: Zotero initialized');

    // Set rootURI if not provided
    if (!rootURI) {
      rootURI = resourceURI.spec;
    }

    // Register chrome
    var aomStartup = Components.classes[
      '@mozilla.org/addons/addon-manager-startup;1'
    ].getService(Components.interfaces.amIAddonManagerStartup);

    var manifestURI = Services.io.newURI(rootURI + 'manifest.json');

    var chromeHandle = aomStartup.registerChrome(manifestURI, [
      ['content', 'zutilore', rootURI + 'chrome/content/'],
      ['locale', 'zutilore', 'en-US', rootURI + 'locale/en-US/']
    ]);

    Zotero.debug('ZutiloRE: Chrome registered');

    // Create context for script loading
    var ctx = {
      rootURI: rootURI,
      Zotero: Zotero,
      Services: Services,
      Components: Components,
    };
    ctx._globalThis = ctx;

    // Load main script (zutilore.js in src/ directory)
    Zotero.debug('ZutiloRE: Loading main script...');
    Services.scriptloader.loadSubScript(
      rootURI + 'src/zutilore.js',
      ctx
    );

    Zotero.debug('ZutiloRE: Main script loaded');

    // Initialize if available - check both ctx.zutiloRE (original) and Zotero.zutiloRE (compiled)
    if (typeof Zotero.zutiloRE !== 'undefined' && Zotero.zutiloRE.init) {
      zutiloRE = Zotero.zutiloRE;
      await zutiloRE.init();
      Zotero.debug('ZutiloRE: Initialized from Zotero.zutiloRE');
    } else if (typeof ctx.zutiloRE !== 'undefined' && ctx.zutiloRE.init) {
      zutiloRE = ctx.zutiloRE;
      await zutiloRE.init();
      Zotero.debug('ZutiloRE: Initialized from ctx.zutiloRE');
    } else {
      Zotero.debug('ZutiloRE: ERROR - zutiloRE not found');
    }

    // Register menus in all windows
    for (var i = 0; i < Zotero.getMainWindows().length; i++) {
      await onMainWindowLoad({ window: Zotero.getMainWindows()[i] }, reason);
    }

  } catch (e) {
    Zotero.debug('ZutiloRE: ERROR in startup: ' + e);
    Zotero.debug('ZutiloRE: Stack: ' + (e.stack || 'no stack'));
    throw e;
  }
}

async function onMainWindowLoad({ window }, reason) {
  Zotero.debug('ZutiloRE: onMainWindowLoad() called');

  try {
    // Wait for document ready
    if (window.document.readyState !== 'complete') {
      await new Promise(function(resolve) {
        window.document.addEventListener('readystatechange', function() {
          if (window.document.readyState === 'complete') {
            resolve();
          }
        });
      });
    }

    Zotero.debug('ZutiloRE: Window ready');

    // Register menus
    if (zutiloRE && zutiloRE.registerMenus) {
      zutiloRE.registerMenus(window);
      Zotero.debug('ZutiloRE: Menus registered');
    }
  } catch (e) {
    Zotero.debug('ZutiloRE: ERROR in onMainWindowLoad: ' + e);
  }
}

function onMainWindowUnload({ window }, reason) {
  Zotero.debug('ZutiloRE: onMainWindowUnload() called');
}

function shutdown({ id, version, resourceURI, rootURI }, reason) {
  Zotero.debug('ZutiloRE: shutdown() called, reason=' + reason);

  if (reason === APP_SHUTDOWN) {
    return;
  }

  try {
    // Clean up plugin
    if (zutiloRE && zutiloRE.destroy) {
      zutiloRE.destroy();
    }

    // Flush string bundles
    Components.classes['@mozilla.org/intl/stringbundle;1']
      .getService(Components.interfaces.nsIStringBundleService)
      .flushBundles();

    Zotero.debug('ZutiloRE: Shutdown complete');
  } catch (e) {
    Zotero.debug('ZutiloRE: ERROR in shutdown: ' + e);
  }
}

function uninstall(data, reason) {
  Zotero.debug('ZutiloRE: uninstall() called');
}