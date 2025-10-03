# Sorter 排序模块

## 快速开始

排序模块提供了灵活的排序策略，用于对格式化文本项进行排序。

### 安装和导入

```typescript
import { SorterFactory, SortStrategy } from "@/modules/sorter";
```

### 基本用法

```typescript
// 1. 获取默认排序器（渲染顺序）
const sorter = SorterFactory.getDefaultSorter();
const sortedItems = await sorter.sort(items);

// 2. 获取指定策略的排序器
const blockIdSorter = SorterFactory.getSorter(SortStrategy.BLOCK_ID);
const sortedItems = await blockIdSorter.sort(items);

// 3. 获取更新时间排序器
const updateTimeSorter = SorterFactory.getSorter(SortStrategy.UPDATE_TIME);
const sortedItems = await updateTimeSorter.sort(items);
```

## 排序策略说明

| 策略 | 枚举值 | 说明 | 默认 |
|------|--------|------|------|
| 渲染顺序 | `RENDER_ORDER` | 根据块在文档中的实际位置排序 | ✅ |
| Block ID | `BLOCK_ID` | 根据 blockId 字符串排序 | |
| 更新时间 | `UPDATE_TIME` | 根据块的更新时间排序（新的在前） | |

## 集成示例

### 示例1: 在解析器中使用

```typescript
// TextFormatParser.ts
import { SorterFactory } from "../sorter";

public async parseFormattedTexts(
    rootBlockId: string, 
    options: ParseOptions
): Promise<FormattedTextItem[]> {
    try {
        const allItems: FormattedTextItem[] = [];
        
        // ... 执行查询和提取逻辑 ...
        
        // 使用默认排序器（渲染顺序）
        const sorter = SorterFactory.getDefaultSorter();
        const sortedItems = await sorter.sort(allItems);
        
        return sortedItems;
        
    } catch (error) {
        this.log('解析格式化文本时出错:', error);
        return [];
    }
}
```

### 示例2: 在UI渲染器中使用

```typescript
// FormattedTextUIRenderer.ts
import { SorterFactory, SortStrategy } from "../sorter";

public async createListHTML(
    items: FormattedTextItem[]
): Promise<string> {
    // 根据需要选择排序策略
    const strategy = this.getUserPreferredSortStrategy(); // 从配置读取
    const sorter = SorterFactory.getSorter(strategy);
    
    const sortedItems = await sorter.sort(items);
    
    // ... 渲染HTML ...
}
```

### 示例3: 动态切换排序策略

```typescript
class FormattedTextDock {
    private currentSortStrategy: SortStrategy = SortStrategy.RENDER_ORDER;
    
    // 切换排序策略
    public async changeSortStrategy(strategy: SortStrategy): Promise<void> {
        this.currentSortStrategy = strategy;
        await this.refreshList();
    }
    
    // 刷新列表
    private async refreshList(): Promise<void> {
        const sorter = SorterFactory.getSorter(this.currentSortStrategy);
        this.formattedTexts = await sorter.sort(this.formattedTexts);
        this.renderList();
    }
}
```

## 设置日志

```typescript
// 在插件初始化时
import { SorterFactory } from "@/modules/sorter";

SorterFactory.setLogger((...args) => {
    console.log('[Sorter]', ...args);
});
```

## 注意事项

1. **异步调用**: 所有排序方法都是异步的（返回 Promise）
2. **不修改原数组**: 排序器会创建新数组，不会修改原始数组
3. **实例缓存**: 工厂会自动缓存排序器实例，无需担心重复创建

## 性能考虑

- **渲染顺序排序**: 优先使用 DOM（快），降级到数据库查询
- **Block ID 排序**: 纯内存操作，性能最好
- **更新时间排序**: 需要数据库查询，性能稍慢

## 扩展开发

如需添加自定义排序策略，请参考 `wiki/排序系统设计说明.md`。

