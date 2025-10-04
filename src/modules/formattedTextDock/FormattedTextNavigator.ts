import { showMessage } from "siyuan";
import { TextFormatType, FormattedTextItem } from "../formatProcessor";
import { TextFormatParser } from "../formatProcessor/TextFormatParser";

/**
 * 格式化文本导航器
 * 负责处理导航定位、高亮显示、反向导航等功能
 */
export class FormattedTextNavigator {
    private pageClickListener?: (event: MouseEvent) => void;

    constructor(
        private parser: TextFormatParser,
        private formattedTexts: FormattedTextItem[],
        private enabledFormats: TextFormatType[],
        private element: HTMLElement,
        private i18n: any,
        private logger?: (...args: any[]) => void
    ) {
        this.initReverseNavigation();
    }

    /**
     * 导航到文本位置
     */
    public navigateToText(text: string, type: TextFormatType, itemIndex: number): void {
        try {
            // 查找对应的项目
            const savedItem = this.findItemByTextAndIndex(text, type, itemIndex);
            
            // 如果有保存的DOM元素引用，直接使用（适用于备注）
            if (savedItem?.element) {
                // 找到包含该元素的块（用于弹动效果）
                const blockElement = this.findBlockElement(savedItem.element);
                
                this.scrollToElement(savedItem.element);
                // 对块元素应用高亮和弹动效果（inline元素无法弹动）
                if (blockElement) {
                    this.highlightElement(blockElement);
                } else {
                    this.highlightElement(savedItem.element);
                }
                // showMessage(`✅ ${this.i18n.navigationSuccess}: ${text}`, 2000, 'info');
                return;
            }
            
            // 统一使用块ID导航 - 这是最可靠的方式，避免文本匹配的不确定性
            this.navigateToBlock(savedItem);

        } catch (error) {
            this.log('导航失败:', error);
            showMessage(`❌ ${this.i18n.navigationFailed}: ${text}`, 3000, 'error');
        }
    }

    /**
     * 通过文本和索引查找项目
     */
    public findItemByTextAndIndex(text: string, type: TextFormatType, index: number): FormattedTextItem | undefined {
        // 从已解析的数据中查找匹配项
        const sameTypeItems = this.formattedTexts.filter(item => 
            item.type === type && item.text === text
        );
        
        // 按位置排序
        sameTypeItems.sort((a, b) => a.position - b.position);
        
        return sameTypeItems[index];
    }

    /**
     * 通过块ID导航到标签或待办事项
     */
    private navigateToBlock(item: FormattedTextItem): void {
        if (!item || !item.blockId) {
            showMessage(`❌ ${this.i18n.textNotFound}`, 3000, 'error');
            return;
        }

        // 查找DOM元素
        const allElements = document.querySelectorAll(`[data-node-id="${item.blockId}"]`);
        
        if (allElements.length === 0) {
            showMessage(`❌ ${this.i18n.textNotFound}: ${item.text}`, 3000, 'error');
            return;
        }
        
        // 找到真正的内容块，排除UI元素
        const contentElement = Array.from(allElements).find(el => {
            const rect = el.getBoundingClientRect();
            const isVisible = rect.width > 0 && rect.height > 0;
            
            // 排除面包屑和其他UI元素
            const isUIElement = el.classList.contains('protyle-breadcrumb__item') ||
                              el.classList.contains('protyle-breadcrumb') ||
                              el.classList.contains('toolbar') ||
                              el.classList.contains('sidebar') ||
                              el.classList.contains('b3-list-item') ||
                              el.classList.contains('file-tree') ||
                              el.classList.contains('sy__file') ||
                              el.closest('.protyle-breadcrumb') ||
                              el.closest('.toolbar') ||
                              el.closest('.sidebar') ||
                              el.closest('.b3-list') ||
                              el.closest('.file-tree');
            
            // 优先选择内容区域的元素
            const isContentArea = el.classList.contains('p') ||
                                 el.classList.contains('protyle-wysiwyg__block') ||
                                 el.closest('.protyle-wysiwyg') ||
                                 el.closest('.protyle-content') ||
                                 el.closest('.protyle-background');
            
            return isVisible && !isUIElement && isContentArea;
        });
        
        if (contentElement) {
            this.scrollToElement(contentElement as HTMLElement);
            this.highlightElement(contentElement as HTMLElement);
            // showMessage(`✅ ${this.i18n.navigationSuccess}: ${item.text}`, 2000, 'info');
        } else {
            // 后备方案：使用第一个可见元素
            const fallbackElement = Array.from(allElements).find(el => {
                const rect = el.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0;
            });
            
            if (fallbackElement) {
                this.scrollToElement(fallbackElement as HTMLElement);
                this.highlightElement(fallbackElement as HTMLElement);
                // showMessage(`✅ ${this.i18n.navigationSuccess}: ${item.text}`, 2000, 'info');
            } else {
                showMessage(`❌ ${this.i18n.textNotFound}: ${item.text}`, 3000, 'error');
            }
        }
    }



    /**
     * 滚动到元素位置
     */
    public scrollToElement(element: HTMLElement): void {
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'center'
        });
    }

    /**
     * 高亮元素 - 使用深蓝色波纹扩散效果
     */
    public highlightElement(element: HTMLElement): void {
        // 移除可能存在的旧高亮效果
        element.classList.remove('formatted-text-dock__highlight', 'formatted-text-dock__highlight-ripple');
        
        // 添加新的波纹高亮效果
        element.classList.add('formatted-text-dock__highlight-ripple');
        
        // 2秒后移除高亮效果
        setTimeout(() => {
            element.classList.remove('formatted-text-dock__highlight-ripple');
        }, 2000);
        
        // 短暂的背景色变化作为初始提示
        const originalBackground = element.style.backgroundColor;
        element.style.backgroundColor = 'rgba(33, 150, 243, 0.1)';
        
        // 300毫秒后恢复原始背景色，让CSS波纹动画接管
        setTimeout(() => {
            element.style.backgroundColor = originalBackground;
        }, 300);
    }

    /**
     * 初始化反向导航功能
     */
    public initReverseNavigation(): void {
        this.log('初始化反向导航功能');
        
        // 创建页面点击监听器
        this.pageClickListener = (event: MouseEvent) => {
            this.handlePageClick(event);
        };
        
        // 添加到document上，使用捕获阶段确保能捕获到所有点击
        document.addEventListener('click', this.pageClickListener, true);
    }
    
    /**
     * 销毁反向导航功能
     */
    public destroyReverseNavigation(): void {
        if (this.pageClickListener) {
            document.removeEventListener('click', this.pageClickListener, true);
            this.pageClickListener = undefined;
            this.log('反向导航功能已销毁');
        }
    }
    
    /**
     * 处理页面点击事件 - 简化版本，优先尝试精确匹配，失败则退回到块ID匹配
     */
    private handlePageClick(event: MouseEvent): void {
        const target = event.target as HTMLElement;
        if (!target) return;
        
        // 检查是否点击了侧边栏本身，如果是则不处理
        if (this.element.contains(target)) {
            return;
        }
        
        // 查找点击元素所在的块
        const blockElement = this.findBlockElement(target);
        if (!blockElement) {
            return;
        }
        
        // 获取块ID
        const blockId = blockElement.getAttribute('data-node-id');
        if (!blockId) {
            return;
        }
        
        // 尝试智能匹配：如果点击的元素本身就是格式化元素，优先匹配它
        const clickedText = target.textContent?.trim();
        if (clickedText && this.tryExactMatch(blockId, clickedText)) {
            return; // 精确匹配成功
        }
        
        // 退回到简单的块ID匹配
        this.locateInDockByBlockId(blockId);
    }
    
    /**
     * 尝试精确匹配：优先匹配点击元素的文本内容
     */
    private tryExactMatch(blockId: string, clickedText: string): boolean {
        const dockItems = this.element.querySelectorAll('.formatted-text-dock__item');
        
        for (let i = 0; i < dockItems.length; i++) {
            const itemElement = dockItems[i] as HTMLElement;
            const itemBlockId = itemElement.dataset.blockId;
            const itemText = itemElement.dataset.text;
            
            // 精确匹配：block ID + 文本内容都匹配
            if (itemBlockId === blockId && itemText === clickedText) {
                this.log(`🎯 精确匹配成功: blockId=${blockId}, text="${clickedText}"`);
                this.highlightDockItem(itemElement);
                return true;
            }
        }
        
        return false; // 精确匹配失败
    }
    
    /**
     * 查找点击元素所在的块
     */
    private findBlockElement(element: HTMLElement): HTMLElement | null {
        let current: HTMLElement | null = element;
        
        // 第一轮：优先查找待办项块（data-subtype='t'）
        let temp: HTMLElement | null = element;
        while (temp && temp !== document.body) {
            if (temp.getAttribute && temp.getAttribute('data-subtype') === 't' && temp.getAttribute('data-node-id')) {
                return temp;
            }
            temp = temp.parentElement;
        }
        
        // 第二轮：查找普通的块元素（data-node-id）
        while (current && current !== document.body) {
            if (current.getAttribute && current.getAttribute('data-node-id')) {
                return current;
            }
            current = current.parentElement;
        }
        
        return null;
    }

    /**
     * 查找块中的所有格式化文本元素
     */
    private findAllFormattedElementsInBlock(blockElement: HTMLElement): Array<{text: string, type: TextFormatType, element: HTMLElement}> {
        const results: Array<{text: string, type: TextFormatType, element: HTMLElement}> = [];
        
        // 特殊处理：如果块本身就是待办项，直接把它作为一个格式化元素
        if (blockElement.getAttribute('data-subtype') === 't' && this.enabledFormats.includes(TextFormatType.TODO)) {
            const text = blockElement.textContent?.trim();
            if (text) {
                results.push({
                    text,
                    type: TextFormatType.TODO,
                    element: blockElement
                });
            }
        }
        
        // 遍历所有启用的格式类型
        for (const formatType of this.enabledFormats) {
            const processor = this.parser.getFormatProcessor(formatType);
            const config = processor.getConfig();
            
            // 在块内查找该格式的所有元素
            for (const selector of config.htmlSelectors) {
                try {
                    const elements = blockElement.querySelectorAll(selector);
                    
                    elements.forEach(element => {
                        const text = element.textContent?.trim();
                        if (text) {
                            results.push({
                                text,
                                type: formatType,
                                element: element as HTMLElement
                            });
                        }
                    });
                } catch (error) {
                    // 忽略无效的选择器
                    continue;
                }
            }
        }
        
        return results;
    }

    /**
     * 查找格式化元素（向上遍历DOM树）
     */
    private findFormattedElement(element: HTMLElement): HTMLElement | null {
        let current: HTMLElement | null = element;
        
        // 向上遍历，最多遍历10层，避免无限循环
        for (let i = 0; i < 10 && current; i++) {
            // 检查当前元素是否是格式化元素
            if (this.isFormattedElement(current)) {
                return current;
            }
            current = current.parentElement;
        }
        
        return null;
    }
    
    /**
     * 检查元素是否是格式化元素
     */
    private isFormattedElement(element: HTMLElement): boolean {
        // 收集所有格式处理器的选择器
        const allSelectors = new Set<string>();
        
        for (const formatType of this.enabledFormats) {
            const processor = this.parser.getFormatProcessor(formatType);
            const config = processor.getConfig();
            config.htmlSelectors.forEach(selector => allSelectors.add(selector));
        }
        
        // 检查元素是否匹配任何选择器
        for (const selector of allSelectors) {
            try {
                if (element.matches(selector)) {
                    return true;
                }
            } catch (error) {
                // 忽略无效的选择器
                continue;
            }
        }
        
        return false;
    }
    
    /**
     * 识别格式化元素的类型和内容
     */
    private identifyFormattedElement(element: HTMLElement): {text: string, type: TextFormatType, element: HTMLElement} | null {
        const text = element.textContent?.trim();
        if (!text) return null;
        
        // 遍历所有格式类型，找到匹配的
        for (const formatType of this.enabledFormats) {
            const processor = this.parser.getFormatProcessor(formatType);
            const config = processor.getConfig();
            
            // 检查元素是否匹配该格式的选择器
            for (const selector of config.htmlSelectors) {
                try {
                    if (element.matches(selector)) {
                        return {
                            text,
                            type: formatType,
                            element
                        };
                    }
                } catch (error) {
                    // 忽略无效的选择器
                    continue;
                }
            }
        }
        
        return null;
    }
    
    /**
     * 纯基于块ID的侧边栏定位 - 极简版本
     */
    private locateInDockByBlockId(blockId: string): void {
        this.log(`纯块ID定位: ${blockId}`);
        
        // 查找侧边栏中匹配的条目
        const dockItems = this.element.querySelectorAll('.formatted-text-dock__item');
        
        // 找到第一个匹配的block ID就用
        for (let i = 0; i < dockItems.length; i++) {
            const itemElement = dockItems[i] as HTMLElement;
            const itemBlockId = itemElement.dataset.blockId;
            
            if (itemBlockId === blockId) {
                const matchedType = itemElement.dataset.type;
                const matchedText = itemElement.dataset.text;
                this.log(`✅ 块ID匹配成功: ${blockId}, 类型=${matchedType}, 文本="${matchedText}"`);
                this.highlightDockItem(itemElement);
                return;
            }
        }
        
        this.log(`❌ 未在侧边栏中找到块ID: ${blockId}`);
    }

    /**
     * 在侧边栏中定位对应条目 - 纯基于块ID匹配，简单有效
     */
    private locateInDock(text: string, type: TextFormatType, clickedElement: HTMLElement): void {
        this.log(`在侧边栏中定位: "${text}", 类型: ${type}`);
        
        // 找到点击元素所在的块ID
        const clickedBlockId = this.findBlockId(clickedElement);
        if (!clickedBlockId) {
            this.log('未找到点击元素的块ID');
            return;
        }
        
        this.log(`点击元素的块ID: ${clickedBlockId}`);
        
        // 查找侧边栏中匹配的条目 - 纯基于块ID匹配
        const dockItems = this.element.querySelectorAll('.formatted-text-dock__item');
        
        let targetItem: HTMLElement | null = null;
        
        // 简单匹配：只看块ID，找到第一个就用
        dockItems.forEach((item) => {
            const itemElement = item as HTMLElement;
            const itemBlockId = itemElement.dataset.blockId;
            
            // 如果还没找到匹配项，且块ID匹配，就用这个
            if (!targetItem && itemBlockId === clickedBlockId) {
                targetItem = itemElement;
            }
        });
        
        if (targetItem) {
            const matchedType = targetItem.dataset.type;
            const matchedText = targetItem.dataset.text;
            this.log(`块ID匹配成功: ${clickedBlockId}, 匹配到类型=${matchedType}, 文本="${matchedText}"`);
            this.highlightDockItem(targetItem);
        } else {
            this.log(`未在侧边栏中找到匹配的条目: blockId=${clickedBlockId}`);
        }
    }
    
    /**
     * 查找元素所在的块ID
     */
    private findBlockId(element: HTMLElement): string | null {
        let currentElement = element;
        
        // 向上查找，寻找具有data-node-id的元素
        while (currentElement && currentElement !== document.body) {
            if (currentElement.getAttribute && currentElement.getAttribute('data-node-id')) {
                return currentElement.getAttribute('data-node-id');
            }
            currentElement = currentElement.parentElement as HTMLElement;
        }
        
        return null;
    }

    /**
     * 高亮侧边栏条目
     */
    private highlightDockItem(item: HTMLElement): void {
        this.log('高亮侧边栏条目:', item.dataset.text);
        
        // 滚动到条目位置
        item.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
        });
        
        // 添加高亮效果
        item.classList.add('formatted-text-dock__item--reverse-highlight');
        
        // 移除之前的高亮
        const previousHighlighted = this.element.querySelectorAll('.formatted-text-dock__item--reverse-highlight');
        previousHighlighted.forEach(el => {
            if (el !== item) {
                el.classList.remove('formatted-text-dock__item--reverse-highlight');
            }
        });
        
        // 2秒后移除高亮
        setTimeout(() => {
            item.classList.remove('formatted-text-dock__item--reverse-highlight');
        }, 2000);
        
        // 显示反馈消息
        const text = item.dataset.text || '';
        const type = item.dataset.type || '';
        const typeName = this.getFormatDisplayName(type as TextFormatType);
        // showMessage(`🎯 ${this.i18n.reverseNavigationSuccess || '已定位到侧边栏条目'}: ${typeName} "${text}"`, 2000, 'info');
    }

    /**
     * 获取格式显示名称
     */
    private getFormatDisplayName(type: TextFormatType): string {
        const names: Record<TextFormatType, string> = {
            [TextFormatType.BOLD]: this.i18n.bold,
            [TextFormatType.ITALIC]: this.i18n.italic,
            [TextFormatType.UNDERLINE]: this.i18n.underline,
            [TextFormatType.HIGHLIGHT]: this.i18n.highlight,
            [TextFormatType.MEMO]: this.i18n.memo,
            [TextFormatType.TAG]: this.i18n.tag || "标签",
            [TextFormatType.TODO]: this.i18n.todo || "待办",
        };
        return names[type] || type;
    }

    /**
     * 更新格式化文本数据
     */
    public updateFormattedTexts(formattedTexts: FormattedTextItem[]): void {
        this.formattedTexts = formattedTexts;
    }

    /**
     * 销毁组件
     */
    public destroy(): void {
        this.destroyReverseNavigation();
    }

    /**
     * 日志输出
     */
    private log(...args: any[]): void {
        if (this.logger) {
            this.logger(...args);
        }
    }
}
