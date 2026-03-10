# Zotero 8 插件开发经验总结

## 概述

本文档总结了 ZutiloRE 项目从 JavaScript 迁移到 TypeScript 过程中积累的 Zotero 8 插件开发经验。

## 1. 插件结构

### 必需的清单文件

Zotero 8 插件需要同时包含以下两个清单文件：

```
zutilore.xpi/
├── manifest.json          # WebExtension 清单（必需）
├── install.rdf           # Firefox 传统清单（必需）
├── bootstrap.js          # 插件入口点
├── src/
│   └── zutilore.js       # 主逻辑（TypeScript 编译输出）
├── chrome/content/       # 偏好设置 UI
└── locale/en-US/         # 本地化文件
```

### manifest.json 格式

```json
{
  "manifest_version": 2,
  "name": "ZutiloRE",
  "version": "1.0.0",
  "applications": {
    "zotero": {
      "id": "your-addon@domain.com",
      "update_url": "https://example.com/updates.json",
      "strict_min_version": "7.0",
      "strict_max_version": "8.*"
    }
  }
}
```

**关键点**：
- `strict_max_version` 格式必须使用 `"8.*"`，不能是 `"8.0"`
- `update_url` 是必需的，否则安装会失败

### install.rdf 格式

```xml
<?xml version="1.0"?>
<RDF xmlns="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
     xmlns:em="http://www.mozilla.org/2004/em-rdf#">
  <Description RDF:about="urn:mozilla:install-manifest">
    <em:id>your-addon@domain.com</em:id>
    <em:name>Plugin Name</em:name>
    <em:version>1.0.0</em:version>
    <em:bootstrap>true</em:bootstrap>
    <em:type>2</em:type>
    <em:unpack>true</em:unpack>
    <em:targetApplication>
      <Description>
        <em:id>zotero@chnm.gmu.edu</em:id>
        <em:minVersion>7.0</em:minVersion>
        <em:maxVersion>8.0</em:maxVersion>
      </Description>
    </em:targetApplication>
  </Description>
</RDF>
```

**关键点**：
- `em:bootstrap` 必须为 `true`
- `em:unpack` 必须为 `true`
- `em:maxVersion` 使用 `"8.0"` 格式

## 2. 启动流程

### bootstrap.js 入口点

```javascript
var zutiloRE;

async function startup({ id, version, resourceURI, rootURI }, reason) {
  // 1. 等待 Zotero 初始化
  await Zotero.initializationPromise;

  // 2. 注册 Chrome（如果需要）
  var aomStartup = Components.classes[
    "@mozilla.org/addons/addon-manager-startup;1"
  ].getService(Components.interfaces.amIAddonManagerStartup);

  var manifestURI = Services.io.newURI(rootURI + "manifest.json");
  var chromeHandle = aomStartup.registerChrome(manifestURI, [
    ["content", "zutilore", rootURI + "chrome/content/"],
    ["locale", "zutilore", "en-US", rootURI + "locale/en-US/"]
  ]);

  // 3. 加载主脚本
  var ctx = {
    rootURI: rootURI,
    Zotero: Zotero,
    Services: Services,
    Components: Components
  };
  ctx._globalThis = ctx;

  Services.scriptloader.loadSubScript(
    rootURI + "src/zutilore.js",  // TypeScript 编译输出路径
    ctx
  );

  // 4. 初始化插件
  // 优先检查 Zotero.zutiloRE（TypeScript 编译后）
  // 其次检查 ctx.zutiloRE（原始 JavaScript 方式）
  if (typeof Zotero.zutiloRE !== 'undefined' && Zotero.zutiloRE.init) {
    zutiloRE = Zotero.zutiloRE;
    await zutiloRE.init();
  } else if (typeof ctx.zutiloRE !== 'undefined' && ctx.zutiloRE.init) {
    zutiloRE = ctx.zutiloRE;
    await zutiloRE.init();
  }

  // 5. 为每个窗口注册菜单
  for (var i = 0; i < Zotero.getMainWindows().length; i++) {
    await onMainWindowLoad({ window: Zotero.getMainWindows()[i] }, reason);
  }
}

async function onMainWindowLoad({ window }, reason) {
  // 等待文档加载完成
  if (window.document.readyState !== "complete") {
    await new Promise(function(resolve) {
      window.document.addEventListener("readystatechange", function() {
        if (window.document.readyState === "complete") {
          resolve();
        }
      });
    });
  }

  // 注册菜单
  if (zutiloRE && zutiloRE.registerMenus) {
    zutiloRE.registerMenus(window);
  }
}
```

## 3. 菜单注册机制

### 关键发现

**菜单元素在 window load 时已经存在于 DOM 中**，可以直接同步添加，不需要事件监听。

### 正确的菜单注册方式

```javascript
// 在 src/zutilore.js 中
var zutiloRE = {
  registerMenus: function(window) {
    var doc = window.document;

    // 直接获取菜单元素（无需等待事件）
    var itemMenu = doc.getElementById("zotero-itemmenu");
    if (itemMenu) {
      this.addItemMenuItems(itemMenu);
    }

    var collectionMenu = doc.getElementById("zotero-collectionmenu");
    if (collectionMenu) {
      this.addCollectionMenuItems(collectionMenu);
    }
  },

  addItemMenuItems: function(itemMenu) {
    var doc = itemMenu.ownerDocument;

    // 检查是否已添加
    if (doc.getElementById("zutilore-itemmenu-separator")) {
      return;
    }

    // 添加分隔符
    var separator = doc.createXULElement("menuseparator");
    separator.id = "zutilore-itemmenu-separator";
    itemMenu.appendChild(separator);

    // 添加菜单项
    var items = [
      { id: "zutilore-copy-tags", label: "Copy Tags to Clipboard" },
      // ... more items
    ];

    items.forEach(function(item) {
      var menuitem = doc.createXULElement("menuitem");
      menuitem.id = item.id;
      menuitem.setAttribute("label", item.label);
      menuitem.setAttribute("oncommand", "Zotero.zutiloRE.handleMenuCommand('" + item.id + "')");
      itemMenu.appendChild(menuitem);
    });
  }
};
```

## 4. TypeScript 构建配置

### esbuild 配置

```javascript
// build.mjs
const buildOptions = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/src/zutilore.js',  // 注意路径：src/ 子目录
  format: 'iife',
  target: 'es2022',
  platform: 'browser',
  globalName: 'zutiloRE',
  sourcemap: true,
  minify: !isWatch,
};
```

### 关键点

1. **输出路径必须是 `dist/src/zutilore.js`**，因为 bootstrap.js 加载的是 `src/zutilore.js`
2. **使用 IIFE 格式**，编译后的代码会设置 `Zotero.zutiloRE` 全局变量
3. **globalName 设为插件名**，确保编译后的代码正确导出

### XPI 打包

```javascript
// build-xpi.mjs
// 保持目录结构，将 dist/ 的内容直接映射到 XPI 根目录
async function addDirectoryToZip(zip, dir, baseDir) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const zipPath = baseDir ? join(baseDir, entry.name) : entry.name;

    if (entry.isDirectory()) {
      await addDirectoryToZip(zip, fullPath, zipPath);
    } else {
      zip.addLocalFile(fullPath, baseDir);
    }
  }
}
```

最终 XPI 结构：
```
zutilore.xpi/
├── bootstrap.js
├── manifest.json
├── install.rdf
├── src/zutilore.js     ← TypeScript 编译输出
├── chrome/content/     ← 偏好设置
└── locale/en-US/       ← 本地化
```

## 5. 常见问题排查

### 插件无法安装

1. **缺少 update_url**：在 manifest.json 中添加 `applications.zotero.update_url`
2. **缺少 strict_max_version**：添加 `"strict_max_version": "8.*"`
3. **版本格式错误**：使用 `"8.*"` 而非 `"8.0"` 或 `"8.*.*"`
4. **同时需要 manifest.json 和 install.rdf**

### 菜单不显示

1. **检查菜单元素是否存在**：在控制台运行 `document.getElementById("zotero-itemmenu")`
2. **检查注册是否被调用**：添加 `Zotero.debug()` 日志
3. **确保使用同步注册**：不要使用 `popupshowing` 事件，菜单元素在 window load 时已存在

### 插件未初始化

1. **检查 `Zotero.zutiloRE`**：在控制台运行 `Zotero.zutiloRE`
2. **检查 bootstrap.js 加载路径**：确保 `loadSubScript` 的路径与实际文件位置匹配
3. **确保 zutiloRE.init() 被调用**

## 6. 开发命令

```bash
# 构建 TypeScript
npm run build
# 或
node build.mjs

# 构建 XPI
node scripts/build-xpi.mjs

# 安装到 Zotero
node scripts/install-to-profile.mjs

# 自动构建并安装
npm run install
```

## 7. 参考资料

- [Zotero 7 for Developers](https://www.zotero.org/support/dev/zotero_7_for_developers)
- [Zotero 8 Plugin Development Guide](https://gist.github.com/EwoutH/04c8df5a97963b5b46cec9f392ceb103)
- [Zotero Integration and Manifests](https://deepwiki.com/windingwind/zotero-better-notes/2.2-zotero-integration-and-manifests)