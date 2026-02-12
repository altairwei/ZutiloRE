# ZutiloRE 开发计划与进度

**项目**: ZutiloRE - Zotero 8 兼容版 Zutilo 插件  
**GitHub**: https://github.com/altairwei/ZutiloRE  
**当前版本**: v1.0.38  
**最后更新**: 2026-02-12

---

## ✅ 已完成的功能

### 第一批功能（已实现）

#### 标签操作 (Tag Operations)
- [x] **Copy Tags to Clipboard** - 复制选中项目的标签
  - 同时支持系统剪贴板和内部存储
- [x] **Paste Tags from Clipboard** - 粘贴标签到选中项目
  - 使用内部存储避免 macOS 剪贴板权限问题
- [x] **Remove All Tags** - 删除所有标签

#### 项目操作 (Item Operations)
- [x] **Relate Items** - 关联多个项目
- [x] **Copy Select Link** - 复制 zotero://select 链接
- [x] **Copy Item ID** - 复制项目 Key
- [x] **Copy Zotero URI** - 复制 www.zotero.org 链接

#### 集合操作 (Collection Operations)
- [x] **Copy Collection Link** - 复制集合的 zotero:// 链接

---

## 🚧 待开发的功能（按优先级排序）

### 第二批功能（高优先级）

#### 附件操作 (Attachment Operations)
- [ ] **View Attachment Paths** - 查看附件路径
- [ ] **Copy Attachment Paths** - 复制附件文件路径
- [ ] **Modify Attachment Paths** - 批量修改附件路径
- [ ] **Rename Attachments** - 使用父项目元数据重命名附件

#### QuickCopy 功能
- [ ] **QuickCopy items** - 使用默认格式复制项目
- [ ] **Alternative QuickCopy 1/2** - 备用快速复制格式

### 第三批功能（中优先级）

#### 项目创建 (Item Creation)
- [ ] **Create Book from Section** - 从书籍章节创建书籍项目
- [ ] **Create Section from Book** - 从书籍创建章节项目

#### 复制功能增强
- [ ] **Copy Creators** - 复制作者信息
- [ ] **Copy Attachment Paths** - 复制附件路径
- [ ] **Copy Child Items** - 复制子项目
- [ ] **Relocate Child Items** - 移动子项目到选定项目

### 第四批功能（低优先级）

#### 字段操作 (Field Operations)
- [ ] **Copy Item Fields** - 复制项目所有字段
- [ ] **Paste into Empty Item Fields** - 粘贴到空字段
- [ ] **Paste Non-Empty Item Fields** - 粘贴非空字段
- [ ] **Paste All Item Fields** - 粘贴所有字段
- [ ] **Paste Item Type** - 粘贴项目类型

#### 其他功能
- [ ] **Duplicate Item** - 复制项目
- [ ] **Generate Report** - 生成 Zotero 报告
- [ ] **Attach New File** - 附加新文件

---

## 🔧 技术债务与优化

### 需要修复的问题
- [ ] **代码重构**: 将功能拆分为独立模块
- [ ] **错误处理**: 添加更完善的 try-catch 错误处理
- [ ] **国际化**: 添加多语言支持
- [ ] **快捷键支持**: 添加键盘快捷键
- [ ] **偏好设置**: 添加插件偏好设置界面

---

## 📝 开发日志

### 2026-02-12
- ✅ 创建项目基础架构
- ✅ 实现第一批核心功能
- ✅ 解决 macOS 剪贴板权限问题
- ✅ 修复 Zotero 8 API 兼容性问题
- ✅ 添加插件图标
- ✅ 发布到 GitHub
- ✅ 编写开发文档

---

## 🎯 下次开发议程

1. **决定第二批功能的范围**（选择 2-3 个功能）
2. **讨论代码重构计划**
3. **确定快捷键设计方案**
4. **评估国际化需求**

---

*计划文档版本: 1.0*  
*创建日期: 2026-02-12*
