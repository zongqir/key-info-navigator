/**
 * 排序模块使用示例
 * 此文件仅用于演示，不会被实际编译使用
 */

import { SorterFactory, SortStrategy } from "./index";
import { FormattedTextItem } from "../formatProcessor";

/**
 * 示例1: 基本使用
 */
async function example1_basicUsage() {
    const items: FormattedTextItem[] = []; // 假设已经有数据
    
    // 使用默认排序器（渲染顺序）
    const defaultSorter = SorterFactory.getDefaultSorter();
    const sortedItems = await defaultSorter.sort(items);
    
    console.log('排序后的项目:', sortedItems);
}

/**
 * 示例2: 使用不同的排序策略
 */
async function example2_differentStrategies() {
    const items: FormattedTextItem[] = []; // 假设已经有数据
    
    // 按渲染顺序排序
    const renderOrderSorter = SorterFactory.getSorter(SortStrategy.RENDER_ORDER);
    const sortedByRender = await renderOrderSorter.sort(items);
    console.log('按渲染顺序:', sortedByRender);
    
    // 按 Block ID 排序
    const blockIdSorter = SorterFactory.getSorter(SortStrategy.BLOCK_ID);
    const sortedByBlockId = await blockIdSorter.sort(items);
    console.log('按 Block ID:', sortedByBlockId);
    
    // 按更新时间排序
    const updateTimeSorter = SorterFactory.getSorter(SortStrategy.UPDATE_TIME);
    const sortedByUpdateTime = await updateTimeSorter.sort(items);
    console.log('按更新时间:', sortedByUpdateTime);
}

/**
 * 示例3: 在类中集成使用
 */
class FormattedTextManager {
    private items: FormattedTextItem[] = [];
    private sortStrategy: SortStrategy = SortStrategy.RENDER_ORDER;
    
    constructor() {
        // 设置日志
        SorterFactory.setLogger((...args) => {
            console.log('[FormattedTextManager]', ...args);
        });
    }
    
    /**
     * 设置排序策略
     */
    public setSortStrategy(strategy: SortStrategy): void {
        this.sortStrategy = strategy;
    }
    
    /**
     * 获取排序后的项目
     */
    public async getSortedItems(): Promise<FormattedTextItem[]> {
        const sorter = SorterFactory.getSorter(this.sortStrategy);
        return await sorter.sort(this.items);
    }
    
    /**
     * 刷新并重新排序
     */
    public async refresh(): Promise<void> {
        // 假设从某处加载数据
        this.items = await this.loadItemsFromDatabase();
        
        // 排序
        const sortedItems = await this.getSortedItems();
        
        // 渲染
        this.render(sortedItems);
    }
    
    private async loadItemsFromDatabase(): Promise<FormattedTextItem[]> {
        // 实现数据加载逻辑
        return [];
    }
    
    private render(items: FormattedTextItem[]): void {
        // 实现渲染逻辑
        console.log('渲染项目:', items);
    }
}

/**
 * 示例4: 动态切换排序策略（带UI）
 */
class FormattedTextDockWithSorter {
    private items: FormattedTextItem[] = [];
    private currentStrategy: SortStrategy = SortStrategy.RENDER_ORDER;
    private container: HTMLElement;
    
    constructor(container: HTMLElement) {
        this.container = container;
        this.setupUI();
    }
    
    /**
     * 设置UI（包含排序策略选择器）
     */
    private setupUI(): void {
        // 创建排序策略选择器
        const selector = document.createElement('select');
        selector.innerHTML = `
            <option value="${SortStrategy.RENDER_ORDER}">渲染顺序</option>
            <option value="${SortStrategy.BLOCK_ID}">Block ID</option>
            <option value="${SortStrategy.UPDATE_TIME}">更新时间</option>
        `;
        
        selector.addEventListener('change', async (e) => {
            const target = e.target as HTMLSelectElement;
            this.currentStrategy = target.value as SortStrategy;
            await this.refreshList();
        });
        
        this.container.appendChild(selector);
    }
    
    /**
     * 刷新列表
     */
    private async refreshList(): Promise<void> {
        const sorter = SorterFactory.getSorter(this.currentStrategy);
        const sortedItems = await sorter.sort(this.items);
        this.renderList(sortedItems);
    }
    
    /**
     * 渲染列表
     */
    private renderList(items: FormattedTextItem[]): void {
        // 实现渲染逻辑
        console.log('使用策略', this.currentStrategy, '渲染:', items);
    }
}

/**
 * 示例5: 对比不同排序策略的结果
 */
async function example5_compareStrategies() {
    const items: FormattedTextItem[] = [
        // 假设有一些测试数据
    ];
    
    console.log('原始数据:', items);
    
    // 获取所有排序策略
    const strategies = [
        SortStrategy.RENDER_ORDER,
        SortStrategy.BLOCK_ID,
        SortStrategy.UPDATE_TIME
    ];
    
    // 对比所有策略的结果
    for (const strategy of strategies) {
        const sorter = SorterFactory.getSorter(strategy);
        const sorted = await sorter.sort(items);
        
        console.log(`\n使用策略 ${strategy}:`);
        sorted.forEach((item, index) => {
            console.log(`  ${index + 1}. [${item.type}] ${item.text} (blockId: ${item.blockId})`);
        });
    }
}

/**
 * 示例6: 错误处理
 */
async function example6_errorHandling() {
    const items: FormattedTextItem[] = [];
    
    try {
        const sorter = SorterFactory.getSorter(SortStrategy.RENDER_ORDER);
        const sorted = await sorter.sort(items);
        console.log('排序成功:', sorted);
    } catch (error) {
        console.error('排序失败:', error);
        // 降级到简单排序
        const fallbackSorter = SorterFactory.getSorter(SortStrategy.BLOCK_ID);
        const sorted = await fallbackSorter.sort(items);
        console.log('使用降级排序:', sorted);
    }
}

// 导出示例函数（仅用于演示）
export {
    example1_basicUsage,
    example2_differentStrategies,
    FormattedTextManager,
    FormattedTextDockWithSorter,
    example5_compareStrategies,
    example6_errorHandling
};

