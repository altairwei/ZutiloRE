# ZutiloRE 开发经验总结

## 项目概述
**ZutiloRE** 是一个 Zotero 8 兼容的实用插件，基于原版 Zutilo 重新开发，解决了 Zotero 8 的兼容性问题。

---

## 关键开发经验

### 1. Zotero 8 Bootstrap 插件架构

#### 核心文件结构
```
ZutiloRE/
├── manifest.json          # WebExtension 格式（Zotero 8 需要）
├── install.rdf            # Bootstrap 声明（em:bootstrap=true）
├── bootstrap.js           # 入口点
├── src/zutilore.js       # 主功能代码
└── chrome/content/       # XUL 偏好设置界面
```

#### 关键初始化流程
```javascript
async function startup({ id, version, resourceURI, rootURI }, reason) {
  // 1. 等待 Zotero 初始化
  await Zotero.initializationPromise;
  
  // 2. 注册 Chrome
  var aomStartup = Components.classes[
    "@mozilla.org/addons/addon-manager-startup;1"
  ].getService(Components.interfaces.amIAddonManagerStartup);
  
  // 3. 加载主脚本
  Services.scriptloader.loadSubScript(
    rootURI + "src/zutilore.js",
    { Zotero, Services, Components }
  );
}
```

### 2. JavaScript 兼容性陷阱

#### ❌ 避免这些写法
```javascript
// 1. 不要使用尾随逗号（ES5 不兼容）
[
  "item1",
  "item2",  // ← 这个逗号会导致 SyntaxError
]

// 2. 不要使用解构参数
function({ id, name }) { }  // ❌

// 3. 不要使用简写对象属性
{ rootURI, Zotero }  // ❌ 写成 { rootURI: rootURI, Zotero: Zotero }

// 4. 不要使用 const/let（在某些上下文中）
const x = 1;  // 改用 var
```

#### ✅ 推荐的写法
```javascript
// 1. 无尾随逗号
[
  "item1",
  "item2"
]

// 2. 传统参数
function(options) {
  var id = options.id;
  var name = options.name;
}

// 3. 完整对象属性
{ rootURI: rootURI, Zotero: Zotero }

// 4. 使用 var
var x = 1;
```

### 3. XUL 菜单事件绑定

#### ✅ 推荐：使用 oncommand 属性
```javascript
menuitem.setAttribute("oncommand", "zutiloRE.handleMenuCommand('item-id')");
```

#### ❌ 不推荐：addEventListener
```javascript
// 在 XUL 菜单项上不可靠
menuitem.addEventListener("command", function() { ... });
```

### 4. 获取选中项目/集合

#### Zotero 8 API 变化
```javascript
// 获取选中项目
var items = Zotero.getActiveZoteroPane().getSelectedItems();

// 获取选中集合（注意使用 .ref 而不是 .getObject()）
var collectionTreeRow = zoteroPane.getCollectionTreeRow();
var collection = collectionTreeRow.ref;  // ← Zotero 8 用法
// NOT: collectionTreeRow.getObject()  // ← 旧版，已废弃
```

### 5. macOS 剪贴板权限问题

#### 问题
macOS 限制应用读取系统剪贴板，导致 `Paste Tags from Clipboard` 功能失效。

#### 解决方案
使用**内部存储**代替系统剪贴板：
```javascript
var zutiloRE = {
  copiedTags: [], // 内部存储
  
  copyTags: function() {
    // 复制到剪贴板（供外部使用）
    this.copyToClipboard(tagString);
    // 同时存储到内部（供粘贴使用）
    this.copiedTags = Array.from(allTags);
  },
  
  pasteTags: function() {
    // 从内部存储读取，避免剪贴板权限问题
    if (!this.copiedTags.length) return;
    // ... 使用 this.copiedTags
  }
};
```

### 6. 调试技巧

#### 当 Debug Output 不可用时的替代方案

##### 方案 1: Notification 弹窗
```javascript
showDebugNotification: function(title, message) {
  try {
    var alertsService = Components.classes["@mozilla.org/alerts-service;1"]
      .getService(Components.interfaces.nsIAlertsService);
    alertsService.showAlertNotification(null, title, message, false, "", null);
  } catch (e) {
    dump("Debug: " + title + " - " + message + "\n");
  }
}
```

##### 方案 2: Zotero 进度窗口
```javascript
var progress = new Zotero.ProgressWindow();
progress.changeHeadline("Processing...");
progress.show();
// ... 操作完成后
progress.close();
```

### 7. URI 格式处理

#### Zotero 8 的 URI 格式变化
```javascript
// Zotero 7/8 使用 http:// 格式
"http://zotero.org/users/5132527/items/L9ZKFPBC"

// 旧版使用 zotero:// 格式
"zotero://library/items/L9ZKFPBC"

// 正则表达式需要匹配多种格式
var match = uri.match(/http:\/\/zotero\.org\/(users\/(\d+)|groups\/(\d+))\/items\/(.+)/);
```

### 8. 构建脚本注意事项

#### 必须包含的文件
```bash
zip -r zutilore.xpi \
    manifest.json \      # Zotero 8 必需
    install.rdf \        # Bootstrap 声明
    bootstrap.js \       # 入口点
    icon.png \           # ← 别忘了图标！
    icon@2x.png \        # ← 高分辨率图标
    src/ \
    chrome/ \
    locale/
```

---

## 故障排查清单

### 插件安装后消失
- [ ] 检查 `bootstrap.js` 是否有语法错误（尾随逗号等）
- [ ] 检查 `Services` 是否正确引用
- [ ] 查看 Help → Debug Output 的错误信息

### 菜单不显示
- [ ] 检查 `registerMenus` 是否在 `onWindowLoad` 中调用
- [ ] 检查菜单 ID 是否正确（`zotero-itemmenu`）
- [ ] 检查是否有重复添加的保护逻辑

### 功能点击无反应
- [ ] 使用 Notification 调试确认代码被执行
- [ ] 检查 `oncommand` 属性是否正确绑定
- [ ] 检查函数内部是否有错误（添加 try-catch）

### 生成的 URI 无法访问
- [ ] 检查 URI 格式（http:// vs zotero://）
- [ ] 检查使用 userID 还是 username
- [ ] 测试生成的链接是否在浏览器中能打开

---

## 参考资源

- **原版 Zutilo**: https://github.com/wshanks/Zutilo
- **Zotero 7 开发文档**: https://www.zotero.org/support/dev/zotero_7_for_developers
- **Zotero 论坛**: https://forums.zotero.org/

---

*经验总结: 2026-02-12*  
*作者: Karu (OpenClaw AI)*
