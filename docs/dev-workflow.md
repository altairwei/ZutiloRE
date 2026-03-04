# ZutiloRE 开发工作流

本文档面向后续 coding agent，描述完整的开发环境搭建、热加载机制和日常开发循环。

## 快速上手

```bash
# 首次使用（从 XPI 安装切换到 proxy 开发模式，只需一次）
npm run dev:build

# 日常开发
npm run dev
```

`npm run dev` 自动完成：构建 TypeScript → 安装 proxy file → 修正 `extensions.json` → 启动 Zotero → 监听文件变化。

---

## 目录结构

```
ZutiloRE/
├── src/                    # TypeScript 源码（编辑此处）
│   ├── index.ts            # 插件入口，handleMenuCommand 分发器
│   ├── hooks.ts            # onStartup / onShutdown 钩子
│   └── modules/
│       ├── main.ts         # 工具函数 + 菜单注册
│       ├── collections.ts  # Collection 操作
│       ├── items.ts        # Item 操作
│       ├── tags.ts         # Tag 操作
│       └── creation.ts     # Item 创建操作
├── addon/
│   └── bootstrap.js        # Zotero 生命周期入口（含热加载 watcher）
├── typings/
│   └── index.d.ts          # Zotero API 类型声明
├── dist/                   # 构建输出（git ignored）
│   ├── bootstrap.js        # 从 addon/ 复制
│   ├── src/zutilore.js     # esbuild 编译输出
│   └── .reload-trigger     # 热加载触发文件（dev 专用）
├── scripts/
│   ├── dev.mjs             # 统一开发脚本
│   └── build-xpi.mjs       # 打包 XPI
├── build.mjs               # esbuild 构建配置
└── logs/
    └── zotero.log          # Zotero 运行时日志（git ignored）
```

---

## 热加载机制

```
编辑 src/ → fs.watch 检测变化（300ms debounce）
→ esbuild 重新构建到 dist/ (~3ms)
→ dev.mjs 写入 dist/.reload-trigger（当前时间戳）
→ bootstrap.js 内部每 1500ms 轮询该文件
→ 检测到时间戳变化
→ Services.obs.notifyObservers(null, 'startupcache-invalidate', null)
→ AddonManager.getAddonByID(id).then(addon => addon.reload())
→ Zotero 调用 shutdown() → 销毁旧 sandbox → 重新加载 bootstrap.js → 调用 startup()
→ 插件以新代码重新初始化，无需任何手动操作
```

**安全保障：**
- 热加载 watcher 仅在 `rootURI.indexOf('file://') === 0` 时激活（proxy file 安装）
- 生产 XPI 安装使用 `jar:` URI，watcher 永不启动
- 构建失败时不写 trigger，Zotero 继续运行上一个可用版本

---

## proxy file 机制与 extensions.json

Zotero 通过以下文件确定插件位置：

1. **proxy file**：`{profile}/extensions/zutilore@altairwei.github.io`（无扩展名的纯文本文件，内容为 `dist/` 的绝对路径）
2. **extensions.json**：Zotero 的扩展数据库缓存

**重要陷阱**：如果之前通过 XPI 安装过插件，`extensions.json` 中会缓存 `"rootURI": "jar:file://...xpi!/"` 。即使删除了 XPI 并放置了 proxy file，Zotero 启动时仍优先读取 `extensions.json` 缓存，导致 `bootstrap method 'startup' missing`。

`dev.mjs` 的 `installProxyFile()` 已包含 `patchExtensionsJson()` 修复此问题，会将 `extensions.json` 中的条目更新为：
```json
{
  "path": "/path/to/ZutiloRE/dist",
  "rootURI": "file:///path/to/ZutiloRE/dist/"
}
```

---

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动完整开发环境（构建 + 安装 + 启动 Zotero + 监听） |
| `npm run dev:build` | 仅构建并安装 proxy file，不启动 Zotero |
| `npm run dev:log` | 查看最近 100 行 Zotero 日志 |
| `npm run build` | 生产构建（minify） |
| `npm run build:xpi` | 打包为 XPI（排除 .reload-trigger） |

### dev 模式选项

```bash
npm run dev -- --no-launch   # 不启动 Zotero（适合 Zotero 已运行的情况）
npm run dev:log -- -n 50     # 查看最近 50 行日志
```

---

## 日志读取

Zotero 启动时输出重定向到 `logs/zotero.log`，agent 可直接 `Read` 读取。

常用搜索关键词：

```
ZutiloRE:          # 所有插件日志
ZutiloRE: ERROR    # 插件错误
ZutiloRE: [dev]    # 热加载事件（Trigger seeded / Trigger changed / Reload error）
JavaScript error   # 运行时脚本错误
missing bootstrap  # bootstrap.js 加载失败
```

典型的成功热加载日志：
```
ZutiloRE: [dev] Reload watcher started, polling /path/to/dist/.reload-trigger
ZutiloRE: [dev] Trigger seeded: 1234567890
ZutiloRE: [dev] Trigger changed, reloading addon...
ZutiloRE: [dev] Calling addon.reload()
ZutiloRE: startup() called
ZutiloRE: Initialized successfully
```

---

## 新增功能的标准步骤

以添加 menu item 为例：

### 1. 实现功能函数（`src/modules/` 下对应文件）

```typescript
export function myNewFeature(): void {
  const item = getSelectedItems()[0];
  if (!item) return;
  // ...
  copyToClipboard(result);
  showNotification('Title', 'message');
}
```

### 2. 在 `src/modules/main.ts` 注册菜单项

**Item 右键菜单**：在 `addItemMenuItems()` 的 `items` 数组中添加：
```typescript
{ id: 'zutilore-my-feature', label: 'My Feature Label' },
```

**Collection 右键菜单**：在 `addCollectionMenuItems()` 的 `items` 数组中添加：
```typescript
{ id: 'zutilore-my-feature', label: 'My Feature Label' },
```

### 3. 在 `src/index.ts` 注册命令处理器

导入函数：
```typescript
import { myNewFeature } from './modules/myModule';
```

在 `handleMenuCommand` 的 switch 中添加：
```typescript
case 'zutilore-my-feature':
  myNewFeature();
  break;
```

### 4. 构建验证

```bash
node build.mjs
```

无报错即可；热加载会自动将变更推送到 Zotero。

---

## 环境配置

Zotero 路径和 Profile 目录的查找优先级：

1. 环境变量 `ZOTERO_BIN` / `ZOTERO_PROFILE_DIR`
2. 项目根目录的 `zotero-plugin.ini`：
   ```ini
   [zotero]
   path = /Applications/Zotero.app/Contents/MacOS/zotero

   [profile]
   path = /Users/you/Library/Application Support/Zotero/profiles/xxx.default
   ```
3. 自动探测（macOS 默认路径 + `profiles.ini` Default=1）

---

## 已知问题与解决方案

| 问题 | 原因 | 解决 |
|------|------|------|
| `missing bootstrap method 'startup'` | `extensions.json` 缓存了旧 XPI 路径 | 运行 `npm run dev:build` 修正缓存 |
| `npm run dev` 无法 Ctrl+C 退出 | Zotero 先退出后 dev 进程死等（已修复） | 已修复：用 `exitCode === null` 判断进程存活 |
| 热加载不触发 | `.reload-trigger` 写入位置错误或首次启动 | 检查 `dist/.reload-trigger` 是否存在且时间戳在变化 |
| 菜单项重复出现 | 热加载后 `registerMenus` 被重复调用 | `addItemMenuItems()` 已有 `getElementById` 去重保护 |
