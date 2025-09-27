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
            this.log('查找的项目:', savedItem);
            
            if (savedItem?.element) {
                this.log('使用保存的DOM元素引用进行导航');
                this.scrollToElement(savedItem.element);
                this.highlightElement(savedItem.element);
                showMessage(`✅ ${this.i18n.navigationSuccess}: ${text}`, 2000, 'info');
                return;
            }
            
            // 特殊处理标签和待办事项 - 通过块ID导航
            if (type === TextFormatType.TAG || type === TextFormatType.TODO) {
                this.log(`使用块ID导航方式处理 ${type}, 项目:`, savedItem);
                this.navigateToBlock(savedItem);
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
        this.log(`查找项目: 文本="${text}", 类型=${type}, 索引=${index}`);
        this.log(`当前格式化文本总数: ${this.formattedTexts.length}`);
        
        // 从已解析的数据中查找匹配项
        const sameTypeItems = this.formattedTexts.filter(item => 
            item.type === type && item.text === text
        );
        
        this.log(`同类型同文本的项目数量: ${sameTypeItems.length}`);
        sameTypeItems.forEach((item, i) => {
            this.log(`  项目 ${i}:`, {
                id: item.id,
                text: item.text,
                type: item.type,
                blockId: item.blockId,
                position: item.position,
                hasElement: !!item.element
            });
        });
        
        // 按位置排序
        sameTypeItems.sort((a, b) => a.position - b.position);
        
        const result = sameTypeItems[index];
        this.log(`返回的项目:`, result);
        
        return result;
    }

    /**
     * 通过块ID导航到标签或待办事项
     */
    private async navigateToBlock(item: FormattedTextItem | undefined): Promise<void> {
        this.log('navigateToBlock 被调用，项目:', item);
        
        if (!item || !item.blockId) {
            this.log('项目或块ID为空，显示错误消息');
            showMessage(`❌ ${this.i18n.textNotFound}`, 3000, 'error');
            return;
        }

        // 1. 查询数据库获取块内容
        try {
            this.log(`🔍 查询数据库，块ID: ${item.blockId}`);
            
            // 使用Siyuan API查询块内容
            const response = await fetch('/api/query/sql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    stmt: `SELECT * FROM blocks WHERE id = '${item.blockId}'`
                })
            });
            
            const data = await response.json();
            this.log('数据库查询结果:', data);
            
            if (data.code === 0 && data.data && data.data.length > 0) {
                const blockData = data.data[0];
                
                console.log('='.repeat(60));
                console.log('📋 数据库块内容信息：');
                console.log('='.repeat(60));
                console.log(`块ID: ${blockData.id}`);
                console.log(`类型: ${blockData.type}`);
                console.log(`内容: ${blockData.content || blockData.markdown || '无内容'}`);
                console.log(`路径: ${blockData.path}`);
                console.log(`创建时间: ${blockData.created}`);
                console.log(`更新时间: ${blockData.updated}`);
                console.log('完整块数据:', blockData);
                console.log('='.repeat(60));
                
                this.log('块内容:', blockData);
            } else {
                console.log(`❌ 未在数据库中找到块ID: ${item.blockId}`);
                this.log('数据库中未找到块');
            }
        } catch (error) {
            console.log(`❌ 数据库查询失败:`, error);
            this.log('数据库查询失败:', error);
        }

        // 2. 查找DOM元素
        const allElements = document.querySelectorAll(`[data-node-id="${item.blockId}"]`);
        this.log(`找到 ${allElements.length} 个匹配的DOM元素`);
        
        console.log('='.repeat(60));
        console.log('🌐 DOM元素信息：');
        console.log(`找到 ${allElements.length} 个匹配data-node-id="${item.blockId}"的元素：`);
        console.log('='.repeat(60));
        
        if (allElements.length === 0) {
            console.log(`❌ DOM中未找到data-node-id="${item.blockId}"的元素`);
            return;
        }
        
        Array.from(allElements).forEach((element, index) => {
            const rect = element.getBoundingClientRect();
            console.log(`元素 ${index}：`);
            console.log(`  标签: ${element.tagName}`);
            console.log(`  ID: ${element.id || '无'}`);
            console.log(`  类名: ${element.className}`);
            console.log(`  位置: top=${Math.round(rect.top)}, left=${Math.round(rect.left)}`);
            console.log(`  大小: ${Math.round(rect.width)}x${Math.round(rect.height)}`);
            console.log(`  可见: ${rect.width > 0 && rect.height > 0 ? '是' : '否'}`);
            console.log(`  文本(前100字): ${element.textContent?.substring(0, 100) || '无'}...`);
            console.log(`  HTML(前200字): ${element.outerHTML.substring(0, 200)}...`);
            console.log(`  DOM对象:`, element);
            console.log('-'.repeat(40));
        });
        
        console.log('='.repeat(60));
        
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
            
            console.log(`元素分析: ${el.tagName}.${el.className}`);
            console.log(`  可见: ${isVisible}, UI元素: ${isUIElement}, 内容区域: ${isContentArea}`);
            
            return isVisible && !isUIElement && isContentArea;
        });
        
        if (contentElement) {
            console.log('🎯 导航到内容元素:', contentElement);
            this.log('导航到内容元素:', contentElement);
            this.scrollToElement(contentElement as HTMLElement);
            this.highlightElement(contentElement as HTMLElement);
            showMessage(`✅ ${this.i18n.navigationSuccess}: ${item.text}`, 2000, 'info');
        } else {
            console.log('❌ 没有找到内容区域的DOM元素');
            console.log('尝试使用第一个可见元素作为后备方案...');
            
            const fallbackElement = Array.from(allElements).find(el => {
                const rect = el.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0;
            });
            
            if (fallbackElement) {
                console.log('🔄 使用后备元素:', fallbackElement);
                this.scrollToElement(fallbackElement as HTMLElement);
                this.highlightElement(fallbackElement as HTMLElement);
                showMessage(`⚠️ ${this.i18n.navigationSuccess}: ${item.text} (后备)`, 2000, 'warning');
            } else {
                showMessage(`❌ ${this.i18n.textNotFound}: ${item.text}`, 3000, 'error');
            }
        }
    }


    /**
     * 通过文本内容导航
     */
    private navigateByTextContent(item: FormattedTextItem): void {
        const { text, type } = item;
        
        // 对于标签，尝试查找包含标签文本的块
        if (type === TextFormatType.TAG) {
            // 移除#号，查找纯文本
            const tagText = text.replace('#', '');
            
            // 查找包含标签文本的块
            const blocks = document.querySelectorAll('[data-node-id]');
            for (const block of Array.from(blocks)) {
                if (block.textContent?.includes(tagText)) {
                    this.log('通过文本内容找到块元素');
                    this.scrollToElement(block as HTMLElement);
                    this.highlightElement(block as HTMLElement);
                    showMessage(`✅ ${this.i18n.navigationSuccess}: ${text}`, 2000, 'info');
                    return;
                }
            }
        }
        
        // 对于待办事项，查找包含待办文本的块
        if (type === TextFormatType.TODO) {
            const blocks = document.querySelectorAll('[data-node-id]');
            for (const block of Array.from(blocks)) {
                if (block.textContent?.includes(text)) {
                    this.log('通过文本内容找到待办块元素');
                    this.scrollToElement(block as HTMLElement);
                    this.highlightElement(block as HTMLElement);
                    showMessage(`✅ ${this.i18n.navigationSuccess}: ${text}`, 2000, 'info');
                    return;
                }
            }
        }
        
        showMessage(`❌ ${this.i18n.textNotFound}: ${text}`, 3000, 'error');
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
            this.logger('[FormattedTextNavigator]', ...args);
        }
    }
}
