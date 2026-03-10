/**
 * ZutiloRE - Lifecycle Hooks
 * Handles Zotero plugin startup and shutdown
 */

import { zutiloRE } from './index';

/**
 * Called when the plugin starts
 */
export async function onStartup(): Promise<void> {
  Zotero.debug('ZutiloRE: onStartup called');

  try {
    await Zotero.initializationPromise;
    Zotero.debug('ZutiloRE: Zotero initialized');

    // Initialize the plugin
    await zutiloRE.init();

    // Register for window load events
    for (const win of Zotero.getMainWindows()) {
      await onMainWindowLoad(win);
    }

    Zotero.debug('ZutiloRE: Startup complete');
  } catch (e) {
    Zotero.debug(`ZutiloRE: Startup error - ${e}`);
    throw e;
  }
}

/**
 * Called when a main window loads
 */
async function onMainWindowLoad(win: Window): Promise<void> {
  Zotero.debug('ZutiloRE: onMainWindowLoad called');

  try {
    // Wait for document ready
    if (win.document.readyState !== 'complete') {
      await new Promise<void>((resolve) => {
        win.document.addEventListener('readystatechange', () => {
          if (win.document.readyState === 'complete') {
            resolve();
          }
        });
      });
    }

    Zotero.debug('ZutiloRE: Window ready');
  } catch (e) {
    Zotero.debug(`ZutiloRE: Window load error - ${e}`);
  }
}

/**
 * Called when the plugin shuts down
 */
export function onShutdown(): void {
  Zotero.debug('ZutiloRE: onShutdown called');

  try {
    // Clean up
    if (zutiloRE && zutiloRE.destroy) {
      zutiloRE.destroy();
    }

    // Flush string bundles
    try {
      Components.classes['@mozilla.org/intl/stringbundle;1']
        .getService(Components.interfaces.nsIStringBundleService)
        .flushBundles();
    } catch (e) {
      // Ignore errors during shutdown
    }

    Zotero.debug('ZutiloRE: Shutdown complete');
  } catch (e) {
    Zotero.debug(`ZutiloRE: Shutdown error - ${e}`);
  }
}