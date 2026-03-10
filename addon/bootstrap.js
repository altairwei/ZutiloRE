/**
 * ZutiloRE - Bootstrap Entry Point
 * Handles plugin initialization for Zotero
 */

var chromeHandle;
var zutiloRE;
var _devReloadInterval;
var _devLogWriterInterval;
var _originalZoteroDebug;

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

    chromeHandle = aomStartup.registerChrome(manifestURI, [
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

    // DEV: Start hot-reload watcher and log writer for proxy-file installations
    if (rootURI && rootURI.indexOf('file://') === 0) {
      _startDevReloadWatcher(id, rootURI);
      // Log writer only needed on Windows — on Unix, dev.mjs pipes Zotero's
      // stderr directly, so writing again from here would cause duplicate lines.
      if (Services.appinfo.OS === 'WINNT') {
        _startDevLogWriter(rootURI);
      }
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
    // Stop dev tools (reload watcher + log writer)
    if (_devReloadInterval) {
      clearInterval(_devReloadInterval);
      _devReloadInterval = null;
    }
    if (_devLogWriterInterval) {
      clearInterval(_devLogWriterInterval);
      _devLogWriterInterval = null;
    }
    if (_originalZoteroDebug) {
      Zotero.debug = _originalZoteroDebug;
      _originalZoteroDebug = null;
    }

    // Clean up plugin
    if (zutiloRE && zutiloRE.destroy) {
      zutiloRE.destroy();
    }
    zutiloRE = null;

    // Clean up Zotero global reference
    if (typeof Zotero !== 'undefined' && Zotero.zutiloRE) {
      delete Zotero.zutiloRE;
    }

    // Flush string bundles
    Components.classes['@mozilla.org/intl/stringbundle;1']
      .getService(Components.interfaces.nsIStringBundleService)
      .flushBundles();

    // Destruct chrome handle
    if (chromeHandle) {
      chromeHandle.destruct();
      chromeHandle = null;
    }

    Zotero.debug('ZutiloRE: Shutdown complete');
  } catch (e) {
    Zotero.debug('ZutiloRE: ERROR in shutdown: ' + e);
  }
}

function uninstall(data, reason) {
  Zotero.debug('ZutiloRE: uninstall() called');
}

/**
 * DEV: Log writer — monkey-patches Zotero.debug() to also write to logs/zotero.log.
 * Uses IOUtils.writeUTF8 (proven to work — the reload watcher already uses IOUtils).
 * Only active for file:// (dev proxy) installs.
 */
function _startDevLogWriter(rootURI) {
  var fileHandler = Services.io
    .getProtocolHandler('file')
    .QueryInterface(Components.interfaces.nsIFileProtocolHandler);
  var rootDir = fileHandler.getFileFromURLSpec(rootURI);

  // rootURI points to dist/, go up one level to project root
  var projectRoot = rootDir.parent;
  var logFile = projectRoot.clone();
  logFile.append('logs');
  logFile.append('zotero.log');
  var logPath = logFile.path;

  // Buffer messages, flush periodically
  var buffer = [];
  _originalZoteroDebug = Zotero.debug;

  Zotero.debug = function(message, level) {
    _originalZoteroDebug.apply(Zotero, arguments);
    try {
      var ts = new Date().toISOString().slice(11, 23);
      buffer.push('[' + ts + '] ' + message);
    } catch (e) {
      // never break debug logging
    }
  };

  _devLogWriterInterval = setInterval(function() {
    if (buffer.length === 0) return;
    var lines = buffer.splice(0, buffer.length);
    var content = lines.join('\n') + '\n';
    IOUtils.writeUTF8(logPath, content, { mode: 'appendOrCreate' }).catch(function() {});
  }, 1000);

  Zotero.debug('ZutiloRE: [dev] Log writer started, writing to ' + logPath);
}

/**
 * DEV: Hot-reload watcher for development with proxy-file installations.
 * Polls a trigger file written by scripts/dev.mjs after each rebuild.
 * When the trigger changes, reloads the addon via AddonManager.
 * Only active when rootURI is file:// (dev proxy installs).
 * Completely inert for production XPI installs (jar: URIs).
 */
function _startDevReloadWatcher(addonId, rootURI) {
  // Convert file:// URI to local filesystem path
  var fileHandler = Services.io
    .getProtocolHandler('file')
    .QueryInterface(Components.interfaces.nsIFileProtocolHandler);
  var rootDir = fileHandler.getFileFromURLSpec(rootURI);
  var triggerFile = rootDir.clone();
  triggerFile.append('.reload-trigger');
  var triggerPath = triggerFile.path;

  var lastValue = '';
  var isReloading = false;

  Zotero.debug('ZutiloRE: [dev] Reload watcher started, polling ' + triggerPath);

  _devReloadInterval = setInterval(function() {
    if (isReloading) return;

    IOUtils.readUTF8(triggerPath).then(
      function(content) {
        content = content.trim();
        if (!content) return;

        if (lastValue === '') {
          // First successful read: seed the value, do not reload
          lastValue = content;
          Zotero.debug('ZutiloRE: [dev] Trigger seeded: ' + content);
          return;
        }

        if (content === lastValue) return;

        // Value changed: trigger reload
        lastValue = content;
        isReloading = true;
        Zotero.debug('ZutiloRE: [dev] Trigger changed, reloading addon...');

        // Invalidate startup cache so Zotero reads fresh scripts from disk
        Services.obs.notifyObservers(null, 'startupcache-invalidate', null);

        // Import AddonManager (try ESModule first, then JSM fallback)
        var AddonManager;
        try {
          AddonManager = ChromeUtils.importESModule(
            'resource://gre/modules/AddonManager.sys.mjs'
          ).AddonManager;
        } catch (e) {
          AddonManager = ChromeUtils.import(
            'resource://gre/modules/AddonManager.jsm'
          ).AddonManager;
        }

        // Reload via AddonManager
        AddonManager.getAddonByID(addonId).then(function(addon) {
          if (addon) {
            Zotero.debug('ZutiloRE: [dev] Calling addon.reload()');
            return addon.reload();
          }
        }).catch(function(err) {
          Zotero.debug('ZutiloRE: [dev] Reload error: ' + err);
          isReloading = false;
        });
      },
      function() {
        // File does not exist - normal before first build or in production
      }
    );
  }, 1500);
}
