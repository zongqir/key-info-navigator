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
            this.log(`导航到文本: "${text}", 类型: ${type}, 项目索引: ${itemIndex}`);
            
            // 先尝试通过保存的元素引用直接定位（适用于备注）
            const savedItem = this.findItemByTextAndIndex(text, type, itemIndex);
            if (savedItem?.element) {
                this.log('使用保存的DOM元素引用进行导航');
                this.scrollToElement(savedItem.element);
                this.highlightElement(savedItem.element);
                showMessage(`✅ ${this.i18n.navigationSuccess}: ${text}`, 2000, 'info');
                return;
            }
            
            // 回退到传统的选择器查找方式
            const processor = this.parser.getFormatProcessor(type);
            const config = processor.getConfig();
            const selectors = config.htmlSelectors.join(',');
            
            // 获取所有匹配的元素
            const allTypeElements = Array.from(document.querySelectorAll(selectors));
            this.log(`找到所有 ${type} 元素: ${allTypeElements.length} 个`);
            
            // 过滤出文本匹配的元素
            const matchingElements = allTypeElements.filter(el => el.textContent?.trim() === text);
            this.log(`文本匹配的元素: ${matchingElements.length} 个`);

            if (matchingElements.length === 0) {
                showMessage(`❌ ${this.i18n.textNotFound}: ${text}`, 3000, 'error');
                return;
            }

            // 根据在分组中的索引来找到对应的元素
            const targetIndex = Math.min(itemIndex, matchingElements.length - 1);
            const target = matchingElements[targetIndex];
            
            this.log(`选择目标元素索引: ${targetIndex}`);
            
            this.scrollToElement(target as HTMLElement);
            this.highlightElement(target as HTMLElement);
            
            showMessage(`✅ ${this.i18n.navigationSuccess}: ${text}`, 2000, 'info');

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
     * 处理页面点击事件
     */
    private handlePageClick(event: MouseEvent): void {
        const target = event.target as HTMLElement;
        if (!target) return;
        
        // 检查是否点击了侧边栏本身，如果是则不处理
        if (this.element.contains(target)) {
            return;
        }
        
        // 检查点击的是否是格式化文本元素
        const formattedElement = this.findFormattedElement(target);
        if (!formattedElement) {
            return;
        }
        
        // 识别格式化文本的类型和内容
        const formatInfo = this.identifyFormattedElement(formattedElement);
        if (!formatInfo) {
            return;
        }
        
        this.log('检测到格式化元素点击:', formatInfo);
        
        // 在侧边栏中定位对应条目
        this.locateInDock(formatInfo.text, formatInfo.type, formatInfo.element);
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
     * 在侧边栏中定位对应条目
     */
    private locateInDock(text: string, type: TextFormatType, clickedElement: HTMLElement): void {
        this.log(`在侧边栏中定位: "${text}", 类型: ${type}`);
        
        // 查找侧边栏中匹配的条目
        const dockItems = this.element.querySelectorAll('.formatted-text-dock__item');
        
        let targetItem: HTMLElement | null = null;
        let bestMatch = -1;
        
        dockItems.forEach((item, index) => {
            const itemElement = item as HTMLElement;
            const itemText = itemElement.dataset.text;
            const itemType = itemElement.dataset.type;
            
            if (itemText === text && itemType === type) {
                // 如果有多个相同的项目，尝试找到最匹配的
                const itemPosition = Number(itemElement.dataset.position || 0);
                const clickedPosition = this.getElementPosition(clickedElement);
                
                // 简单的位置匹配逻辑：选择位置最接近的
                if (bestMatch === -1 || Math.abs(clickedPosition - itemPosition) < bestMatch) {
                    bestMatch = Math.abs(clickedPosition - itemPosition);
                    targetItem = itemElement;
                }
            }
        });
        
        if (targetItem) {
            this.highlightDockItem(targetItem);
        } else {
            this.log(`未在侧边栏中找到匹配的条目: "${text}", 类型: ${type}`);
        }
    }
    
    /**
     * 获取元素在文档中的大致位置
     */
    private getElementPosition(element: HTMLElement): number {
        try {
            const rect = element.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            return rect.top + scrollTop;
        } catch (error) {
            this.log('获取元素位置失败:', error);
            return 0;
        }
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
        showMessage(`🎯 ${this.i18n.reverseNavigationSuccess || '已定位到侧边栏条目'}: ${typeName} "${text}"`, 2000, 'info');
    }

    /**
     * 获取格式显示名称
     */
    private getFormatDisplayName(type: TextFormatType): string {
        const names = {
            [TextFormatType.BOLD]: this.i18n.bold,
            [TextFormatType.ITALIC]: this.i18n.italic,
            [TextFormatType.UNDERLINE]: this.i18n.underline,
            [TextFormatType.HIGHLIGHT]: this.i18n.highlight,
            [TextFormatType.MEMO]: this.i18n.memo,
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
            this.logger('[FormattedTextNavigator]', ...args);
        }
    }
}
