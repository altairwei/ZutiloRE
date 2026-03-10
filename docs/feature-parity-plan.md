# ZutiloRE 开发计划

> ⚠️ **注意**: 原始 Zutilo 插件已恢复开发并支持 Zotero 8。ZutiloRE 现已转型为开发 Zutilo 暂无的独特功能。

## 当前实现的功能

| 功能 | 说明 |
|------|------|
| Copy Collection Path | 复制集合路径（如 "我的文献 / 子收藏"） |

## 架构

- **TypeScript** - 现代开发体验
- **esbuild** - 快速构建
- **热加载** - 修改代码即时生效
- **完整骨架** - bootstrap、菜单注册、错误处理

## 开发命令

```bash
npm run dev      # 启动开发模式
npm run build    # 构建
npm run build:xpi  # 打包 XPI
```