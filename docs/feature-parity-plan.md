# ZutiloRE 复刻计划

本文档列出需要从原始 Zutilo 复刻到 ZutiloRE 的所有功能。

## 状态说明

- ✅ 已实现
- 🔄 开发中
- ⏳ 待实现

---

## Item 菜单功能 (27 项)

| # | 功能 | 状态 | 描述 |
|---|------|------|------|
| 1 | copyTags | ✅ | 复制标签到剪贴板 |
| 2 | pasteTags | ✅ | 从剪贴板粘贴标签 |
| 3 | removeTags | ✅ | 移除所有标签 |
| 4 | relateItems | ✅ | 关联项目 |
| 5 | showAttachments | ⏳ | 显示附件 |
| 6 | modifyAttachments | ⏳ | 修改附件 |
| 7 | modifyURLAttachments | ⏳ | 修改 URL 附件 |
| 8 | copyAttachmentPaths | ⏳ | 复制附件路径 |
| 9 | copyCreators | ⏳ | 复制创建者信息 |
| 10 | copyItems | ⏳ | 复制项目（多格式） |
| 11 | copyZoteroSelectLink | ✅ | 复制 Zotero 选择链接 |
| 12 | copyZoteroPDFLink | ⏳ | 复制 PDF 链接 |
| 13 | copyZoteroItemID | ✅ | 复制项目 ID |
| 14 | copyZoteroItemURI | ✅ | 复制项目 URI |
| 15 | createBookSection | ✅ | 从章节创建书籍（已在 creation.ts） |
| 16 | createBookItem | ✅ | 从书籍创建章节（已在 creation.ts） |
| 17 | copyChildIDs | ⏳ | 复制子项 ID |
| 18 | relocateChildren | ⏳ | 移动子项 |
| 19 | copyJSON | ⏳ | 复制 JSON |
| 20 | pasteJSONIntoEmptyFields | ⏳ | 从 JSON 粘贴到空字段 |
| 21 | pasteJSONFromNonEmptyFields | ⏳ | 从 JSON 粘贴到非空字段 |
| 22 | pasteJSONAll | ⏳ | 从 JSON 粘贴全部 |
| 23 | pasteJSONItemType | ⏳ | 从 JSON 粘贴项目类型 |
| 24 | openZoteroItemURI | ⏳ | 打开 Zotero 项目 URI |
| 25 | copyZoteroSelectLink | ✅ | 复制选择链接（已在 items.ts） |
| 26 | copyZoteroPDFLink | ⏳ | 复制 PDF 链接 |
| 27 | copyChildIDs | ⏳ | 复制子项 IDs |

---

## Collection 菜单功能 (3 项)

| # | 功能 | 状态 | 描述 |
|---|------|------|------|
| 1 | copyZoteroCollectionSelectLink | ✅ | 复制 Collection 选择链接 |
| 2 | copyZoteroCollectionURI | ⏳ | 复制 Collection URI |
| 3 | copyCollectionPath | ✅ | 复制 Collection 路径（ZutiloRE 额外） |

---

## 高级功能

| # | 功能 | 状态 | 描述 |
|---|------|------|------|
| 1 | 快捷键支持 | ⏳ | 完整的快捷键系统 |
| 2 | 偏好设置面板 | 🔄 | Zotero 设置集成 |
| 3 | 多格式复制 (copyItems_alt) | ⏳ | 可配置的复制格式 |
| 4 | QuickCopy 替代 | ⏳ | QuickCopy 功能 |
| 5 | 通知栏状态 | ⏳ | 显示操作状态 |

---

## 实现优先级

### 第一阶段：快速实现（低难度）
1. copyAttachmentPaths - 复制附件路径
2. copyCreators - 复制创建者信息
3. copyZoteroCollectionURI - 复制 Collection URI
4. copyChildIDs - 复制子项 ID

### 第二阶段：中等难度
5. showAttachments - 显示附件
6. modifyAttachments - 修改附件
7. modifyURLAttachments - 修改 URL 附件
8. relocateChildren - 移动子项

### 第三阶段：JSON 复制/粘贴
9. copyJSON - 复制 JSON
10. pasteJSONIntoEmptyFields
11. pasteJSONFromNonEmptyFields
12. pasteJSONAll
13. pasteJSONItemType

### 第四阶段：高级功能
14. 快捷键系统
15. 偏好设置面板
16. 完整 copyItems 功能

---

## 技术参考

原始实现位于：
- `_reference/zutilo-original/addon/chrome/content/zutilo/zoteroOverlay.js` - 菜单功能实现
- `_reference/zutilo-original/addon/chrome/content/zutilo/zutiloChrome.js` - 辅助函数

当前 ZutiloRE 实现位于：
- `src/modules/` - 各功能模块
- `src/modules/main.ts` - 菜单注册
- `src/modules/items.ts` - 项目操作
- `src/modules/collections.ts` - 集合操作