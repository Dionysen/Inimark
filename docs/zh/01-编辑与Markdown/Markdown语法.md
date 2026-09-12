---
title: Markdown语法
lang: zh
translationKey: markdown-syntax
---


# Markdown 语法


**English:** [[Markdown Syntax|English]] · 相关 [[编辑模式]] · [[数学公式与图表]]

> [!IMPORTANT]
> 这一页既是 **参考**，也是 **活样本**。在 Inimark 里打开它，多数格式会直接渲染出来。

嵌入卡片：

![[语法速览卡片]]

---

## 标题

```markdown
# H1
## H2
### H3
#### H4
##### H5
###### H6
```

快捷键：`Ctrl/⌘ + 1…6`，段落 `Ctrl/⌘ + 0`（见 [[查找替换与快捷键]]）。

## 行内样式

| 效果 | 写法 |
| --- | --- |
| **粗体** | `**粗体**` |
| *斜体* | `*斜体*` |
| ***粗斜*** | `***粗斜***` |
| ~~删除线~~ | `~~删除线~~` |
| ==高亮== | `==高亮==` |
| <u>下划线</u> | `<u>下划线</u>` |
| `代码` | `` `代码` `` |
| H~2~O | `H~2~O` |
| E=mc^2^ | `E=mc^2^` |

用 `\` 转义标记，例如 `\*\*不是粗体\*\*`。

## 链接与图片

- 外链：[示例链接](https://example.com/)
- 自动链接：https://help.obsidian.md/
- 图片：`![alt](path/or/url.png)` — 稳妥路径与粘贴现状：[[图片与附件]]
- 双链：见 [[双链与嵌入]] — 例如 [[关系图谱]]

也支持参考式链接，适合进阶排版。

## 列表

无序：

- Alpha
- Beta
  - Nested
  - Deeper

有序：

1. First
2. Second
3. Third

任务：

- [x] 学会所见即所得
- [x] 写第一个 `[[双链]]`
- [ ] 发布帮助站

### 列表快捷键习惯

| 操作 | 默认 |
| --- | --- |
| 无序列表 | `Alt + Ctrl/⌘ + U` |
| 有序列表 | `Alt + Ctrl/⌘ + O` |
| 任务列表 | `Alt + Ctrl/⌘ + X` |
| 缩进 / 反缩进 | `Tab` / `Shift + Tab`（在列表中） |
| 软续行 | `Enter` 会跟着列表「阶梯」规则走 |

在空列表项上再按 Enter 可离开列表（类似 Typora）。

## 引用与 Callout

普通引用：

> “未经审视的人生不值得过。” — 知识库文章爱引用的那句。

### Callout

> [!NOTE]
> 不打断主线的补充说明。

> [!TIP]
> 小技巧：`Ctrl/⌘ + K` 插入 Markdown 链接；双链直接敲 `[[`。

> [!IMPORTANT]
> 重要：重命名文件时留意 [[双链与嵌入#重命名与改链|链接改写]]。

> [!WARNING]
> 警告：图片粘贴落盘流水线尚未完成 — 见 [[图片与附件]] 与 [[路线图]]。

> [!DANGER]
> 危险：不要随手改 `.inimark/link-index.json`。

别名：`WARN` / `CAUTION` 会映射到 warning。

选型卡片：

![[Callout选型卡片]]

## 代码围栏

````markdown
```ts
export function hello(name: string): string {
  return `Hello, ${name}`;
}
```
````

实况示例：

```ts
export function hello(name: string): string {
  return `Hello, ${name}`;
}
```

语言写成 `mermaid` 会走图表渲染 → [[数学公式与图表]]。

## 表格

| 模块 | 状态 | 文档 |
| --- | --- | --- |
| 编辑器 | ✅ | [[编辑模式]] |
| 双链 | ✅ | [[双链与嵌入]] |
| 图谱 | ✅ | [[关系图谱]] |
| 标签面板 | ❌ | [[路线图]] |

用 `Alt + Ctrl/⌘ + T` 插入起步表格。用 `Alt + Ctrl/⌘ + Arrow` 移动行/列（或依平台的 `Ctrl/⌘ + Ctrl + Arrow` 变体）。粘贴后表格严重坏掉时，切到 [[编辑模式#源码模式|源码模式]] 修好管道符再回来。

## 分隔线

上方内容。

---

下方内容。

## Front matter

本笔记顶部的 YAML：

```yaml
---
title: Markdown语法
lang: zh
translationKey: markdown-syntax
---
```

用于标题等元数据；发布会读 `title`，多语言站点还会读 `lang` / `translationKey`（见 [[发布为网站]]）。

## 目录（TOC）

确切写法：把 **`[toc]`** 或 **`[TOC]` 单独放在一行**，再按 **Enter**。编辑器会把它变成实时目录原子（Typora 风格）。按 Enter 之前它还是普通文本。

这份帮助库主要靠大纲侧栏，所以这些页面没有嵌入该标记。

## HTML 与注释

- HTML 块：允许（请克制使用）
- 注释：`<!-- 阅读流里会隐藏 -->`
- 摘录分隔：一种特殊的 HTML 注释 more 标记，用于发布 / 摘要切分（本帮助库未使用）

<!-- HTML comment sample -->

## Emoji

短代码：`:smile:` `:rocket:` `:memo:`（可用集合取决于 emoji 功能）

或直接写 Unicode：📝 🚀 ✨

## 脚注（部分支持）

快捷键可插入 `[^]`；**完整脚注渲染尚未完成** — 见 [[路线图]]。

## 交叉链接

| 目标 | 阅读 |
| --- | --- |
| 公式 / 图表 | [[数学公式与图表]] |
| 图片 | [[图片与附件]] |
| 快捷键 | [[查找替换与快捷键]] |
| 双链 | [[双链与嵌入]] |
| 主题 | [[主题与外观]] |

---

上一篇：[[编辑模式]] · 下一篇：[[数学公式与图表]]
