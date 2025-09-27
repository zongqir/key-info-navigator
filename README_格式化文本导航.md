# 格式化文本导航功能

## 功能概述

这个功能为思源笔记插件添加了一个侧边栏，能够自动提取和导航文档中的格式化文本（加粗、斜体、下划线、高亮），支持点击定位。

## 功能特性

- ✅ **模块化设计**：采用多态设计模式，易于扩展新的格式类型
- ✅ **实时解析**：支持从当前编辑器实时提取格式化文本
- ✅ **数据库查询**：当实时解析无结果时，自动从数据库查询
- ✅ **格式过滤**：可以选择性显示不同格式类型
- ✅ **点击定位**：点击项目可自动滚动并高亮到对应位置
- ✅ **重复文本处理**：同一文本多次出现时显示序号
- ✅ **响应式UI**：支持桌面和移动端适配
- ✅ **国际化支持**：支持中英文界面

## 架构设计

### 1. 核心接口层 (`interfaces.ts`)

```typescript
// 格式处理器接口
interface IFormatProcessor {
    formatType: TextFormatType;
    getConfig(): FormatConfig;
    extractFromSpan(span: any): FormattedTextItem[];
    extractFromHTML(html: string, blockId: string): FormattedTextItem[];
    matches(text: string): boolean;
}

// 格式化文本项
interface FormattedTextItem {
    id: string;
    text: string;
    type: TextFormatType;
    blockId: string;
    position: number;
    context: string;
    icon: string;
    color: string;
}
```

### 2. 抽象基类层 (`BaseFormatProcessor.ts`)

提供公共实现逻辑：

- 通用的文本清理和验证方法
- DOM解析的共用逻辑
- 错误处理和日志记录
- ID生成和上下文提取

### 3. 具体实现层

每种格式类型都有独立的处理器：

- **BoldProcessor** - 加粗文本处理器
- **ItalicProcessor** - 斜体文本处理器  
- **UnderlineProcessor** - 下划线文本处理器
- **HighlightProcessor** - 高亮文本处理器

每个处理器只需要定义自己的配置：

```typescript
export class BoldProcessor extends BaseFormatProcessor {
    public readonly formatType = TextFormatType.BOLD;
    
    protected readonly config: FormatConfig = {
        sqlType: ["strong", "textmark"],
        htmlSelectors: ["strong", "b", '[data-type="strong"]'],
        kramdownRegex: /(\*\*|__)(.*?)\1/g,
        icon: "iconBold",
        color: "#d73a49",
    };
}
```

### 4. 工厂模式层 (`FormatProcessorFactory.ts`)

- 统一管理所有格式处理器实例
- 支持动态注册新的格式类型
- 单例模式确保资源利用效率

### 5. 解析器层 (`TextFormatParser.ts`)

- 协调多个格式处理器工作
- 处理SQL查询和HTML解析
- 数据去重和排序
- 结果过滤和限制

### 6. UI组件层 (`FormattedTextDock.ts`)

- 响应式侧边栏界面
- 格式过滤器交互
- 点击导航功能
- 状态管理和事件处理

## 扩展新格式类型

由于采用了多态设计，添加新的格式类型非常简单：

### 1. 创建新的处理器

```typescript
// src/modules/formatProcessor/processors/StrikeThroughProcessor.ts
export class StrikeThroughProcessor extends BaseFormatProcessor {
    public readonly formatType = TextFormatType.STRIKETHROUGH;
    
    protected readonly config: FormatConfig = {
        sqlType: ["s"],
        htmlSelectors: ["s", "del", '[data-type="s"]'],
        kramdownRegex: /(~~)(.*?)\1/g,
        icon: "iconStrikethrough",
        color: "#ff6b6b",
    };
}
```

### 2. 注册到枚举

```typescript
// interfaces.ts
export enum TextFormatType {
    BOLD = "bold",
    ITALIC = "italic",
    UNDERLINE = "underline",
    HIGHLIGHT = "highlight",
    STRIKETHROUGH = "strikethrough", // 新增
}
```

### 3. 更新工厂

```typescript
// FormatProcessorFactory.ts
private static createProcessor(type: TextFormatType): IFormatProcessor {
    switch (type) {
        case TextFormatType.STRIKETHROUGH:
            return new StrikeThroughProcessor(logger);
        // ...其他cases
    }
}
```

### 4. 添加国际化

```json
// i18n/zh_CN.json
{
    "strikethrough": "删除线"
}
```

### 5. 更新默认配置

```typescript
// FormattedTextDock.ts
private enabledFormats: TextFormatType[] = [
    TextFormatType.BOLD,
    TextFormatType.ITALIC,
    TextFormatType.UNDERLINE,
    TextFormatType.HIGHLIGHT,
    TextFormatType.STRIKETHROUGH, // 新增
];
```

## 使用方法

### 基本使用

1. **打开侧边栏**：点击右侧工具栏中的列表图标，或使用快捷键 `⌥⌘F`

2. **筛选格式**：点击顶部的格式过滤器按钮来选择要显示的格式类型

3. **定位文本**：点击列表中的任意项目，会自动滚动到对应位置并高亮显示

4. **刷新数据**：点击刷新按钮重新加载当前文档的格式化文本

### 高级配置

可以通过修改 `FormattedTextDock` 构造函数的参数来自定义：

```typescript
// 自定义默认启用的格式
private enabledFormats: TextFormatType[] = [
    TextFormatType.BOLD,
    TextFormatType.HIGHLIGHT,
];

// 自定义解析选项
const options: ParseOptions = {
    enabledFormats: this.enabledFormats,
    maxResults: 100,  // 限制结果数量
    includeContext: true  // 包含上下文信息
};
```

## 技术特点

### 1. 双重解析策略

- **实时解析**：优先从当前编辑器DOM中提取，响应速度快
- **数据库查询**：当实时解析无结果时，从思源数据库查询，确保完整性

### 2. 智能去重

- 相同文本内容的重复项会被合并
- 多个重复项显示序号便于区分
- 按文档位置排序

### 3. 高效缓存

- 同文档切换时复用已解析的数据
- 格式处理器单例模式减少内存占用
- 防抖机制避免频繁刷新

### 4. 错误处理

- 完善的异常捕获和日志记录
- 优雅降级，单个格式失败不影响其他格式
- 用户友好的错误提示

## 样式定制

所有样式都定义在 `src/styles/formattedTextDock.scss` 中，支持：

- 暗色主题适配
- 响应式布局
- 自定义动画效果
- 滚动条样式

可以通过修改CSS变量来调整外观：

```scss
.formatted-text-dock {
  --primary-color: #your-color;
  --hover-color: #your-hover-color;
  // ...其他变量
}
```

## 性能优化

- **按需加载**：只有打开侧边栏时才开始解析
- **增量更新**：文档变更时使用防抖机制
- **限制结果**：默认最多显示200个结果
- **DOM查询优化**：使用高效的选择器策略

## 兼容性

- ✅ 思源笔记桌面版
- ✅ 思源笔记移动版
- ✅ 思源笔记浏览器版
- ✅ 支持所有主流操作系统

## 开发调试

启用控制台日志来调试：

```typescript
// 在插件初始化时
this.formattedTextDock = new FormattedTextDock(
    dock.element as HTMLElement,
    this.i18n,
    console.log.bind(console) // 启用日志
);
```

日志会显示：
- SQL查询语句
- HTML解析过程
- 导航操作结果
- 错误信息详情
