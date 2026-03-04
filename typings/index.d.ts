/**
 * ZutiloRE - TypeScript Type Definitions
 * Type declarations for Zotero plugin development
 */

// Global Zotero object exposed in plugin context
declare const Zotero: ZoteroAPI;
declare const ZoteroPane: any;
declare const Zotero_Tabs: any;
declare const window: Window;
declare const document: Document;

// Zotero API Types
interface ZoteroAPI {
  // Initialization
  initializationPromise: Promise<void>;
  unlockPromise: Promise<void>;
  uiReadyPromise: Promise<void>;

  // Windows
  getMainWindows(): Window[];
  getActiveZoteroPane(): ZoteroPane | null;

  // Items
  Items: ItemsConstructor;
  ItemTypes: ItemTypesConstructor;

  // Collections
  Collections: CollectionsConstructor;

  // Libraries
  Libraries: LibrariesConstructor;

  // URI
  URI: URIAPI;

  // Users
  Users: UsersAPI;

  // Preferences
  Prefs: PrefsAPI;

  // Notifier
  Notifier: NotifierAPI;

  // Plugin specific
  zutiloRE?: ZutiloRE;

  // Debug
  debug(msg: string): void;
}

interface ItemsConstructor {
  get(id: number): ZoteroItem | null;
  add(type: string, data?: object): ZoteroItem;
}

interface ZoteroItem {
  id: number;
  key: string;
  libraryID: number;
  itemTypeID: number;

  getField(field: string): any;
  setField(field: string, value: any): void;
  getTags(): { tag: string }[];
  addTag(tag: string, color?: string): void;
  setTags(tags: string[]): void;
  getCreators(): Creator[];
  addCreator(creator: Creator): void;
  addRelatedItem(item: ZoteroItem): void;
  saveTx(): Promise<number>;
}

interface Creator {
  firstName?: string;
  lastName?: string;
  creatorTypeID?: number;
  name?: string;
}

interface ItemTypesConstructor {
  getID(name: string): number;
  getName(id: number): string;
}

interface CollectionsConstructor {
  get(id: number): ZoteroCollection | null;
}

interface ZoteroCollection {
  id: number;
  key: string;
  libraryID: number;
  name: string;
  parentID: number | false;
}

interface LibrariesConstructor {
  get(id: number): Library | null;
}

interface Library {
  id: number;
  libraryType: 'user' | 'group';
}

interface URIAPI {
  getItemURI(item: ZoteroItem): string;
  getLibraryPath(libraryID: number): string;
}

interface UsersAPI {
  getCurrentUserID(): number;
  getCurrentUsername(): string | null;
}

interface PrefsAPI {
  get(key: string): any;
  set(key: string, value: any): void;
}

interface NotifierAPI {
  registerObserver(callback: Function, types: string[]): void;
  unregisterObserver(callback: Function): void;
}

// ZutiloRE plugin API
interface ZutiloRE {
  initialized: boolean;

  init(): Promise<void>;
  destroy(): void;

  // Menu registration
  registerMenus(window: Window): void;
  handleMenuCommand(commandId: string): void;

  // Operations
  copyTags(): void;
  pasteTags(): Promise<void>;
  removeTags(): Promise<void>;
  relateItems(): Promise<void>;
  copyCollectionLink(): void;
  copyZoteroSelectLink(): void;
  copyZoteroItemID(): void;
  copyZoteroItemURI(): void;

  // Helpers
  getSelectedItems(): ZoteroItem[];
  getSelectedCollection(): ZoteroCollection | null;
  copyToClipboard(text: string): void;
  pasteFromClipboard(): string;
  showNotification(title: string, message: string): void;

  // Development
  devReload(): string;
}

// Services object
declare const Services: {
  clipboard: {
    copyString(text: string): void;
    getData(trans: any, clipboard: number): void;
  };
  io: {
    newURI(spec: string): any;
  };
  scriptloader: {
    loadSubScript(url: string, ctx: object): void;
  };
  prompt: {
    confirm(window: Window, title: string, message: string): boolean;
  };
  console: {
    log(message: string): void;
    error(message: string): void;
  };
};

// Components (legacy Firefox API)
declare const Components: {
  classes: {
    [key: string]: {
      getService(): any;
      createInstance(): any;
    };
  };
  interfaces: {
    nsIClipboardHelper: any;
    nsIClipboard: any;
    nsITransferable: any;
    nsISupportsString: any;
    nsIAlertsService: any;
    amIAddonManagerStartup: any;
  };
};

// Export for modules
export type { ZoteroAPI, ZoteroItem, ZoteroCollection, Creator };
export type { ZutiloRE };