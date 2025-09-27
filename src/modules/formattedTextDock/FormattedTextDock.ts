import { getAllEditor, showMessage, fetchPost } from "siyuan";
import { TextFormatParser, TextFormatType, FormattedTextItem, ParseOptions } from "../formatProcessor";
import { MemoDialog } from "../memoDialog";

/**
 * 格式化文本侧边栏
 */
export class FormattedTextDock {
    private parser: TextFormatParser;
    private formattedTexts: FormattedTextItem[] = [];
    private enabledFormats: TextFormatType[] = [
        TextFormatType.BOLD,
        TextFormatType.ITALIC,
        TextFormatType.UNDERLINE,
        TextFormatType.HIGHLIGHT,
        TextFormatType.MEMO,
    ];
    private currentBlockId = "";
    private refreshTimer?: NodeJS.Timeout;
    private memoDialog: MemoDialog;

    constructor(
        private element: HTMLElement,
        private i18n: any,
        private logger?: (...args: any[]) => void
    ) {
        this.parser = new TextFormatParser(logger);
        this.memoDialog = new MemoDialog(i18n, logger);
        this.initUI();
        this.refresh(true); // 初始化时强制刷新
    }

    /**
     * 文档变更时调用
     */
    public onDocumentChange(): void {
        this.log('文档变更事件被触发');
        // 防抖，避免频繁刷新
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }
        this.refreshTimer = setTimeout(() => {
            this.log('自动刷新开始执行');
            this.refresh(false); // 自动刷新可以使用缓存
        }, 500);
    }

    /**
     * 销毁组件
     */
    public destroy(): void {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = undefined;
        }
        
        // 关闭可能打开的备注对话框
        this.memoDialog?.hide();
    }

    /**
     * 初始化UI
     */
    private initUI(): void {
        this.element.innerHTML = this.createMainHTML();
        this.bindEvents();
    }

    /**
     * 创建主要HTML结构
     */
    private createMainHTML(): string {
        const filtersHTML = this.createFiltersHTML();
        
        return `
            <div class="fn__flex-1 fn__flex-column formatted-text-dock">
                <div class="formatted-text-dock__header">
                    <div class="formatted-text-dock__title">
                        <svg class="formatted-text-dock__icon">
                            <use xlink:href="#iconList"></use>
                        </svg>
                        <span>${this.i18n.formattedTextNavigation}</span>
                    </div>
                    <div class="formatted-text-dock__controls">
                        <div class="formatted-text-dock__filters">${filtersHTML}</div>
                        <button class="formatted-text-dock__refresh b3-button b3-button--outline" 
                                title="${this.i18n.refresh}" data-action="refresh">
                            <svg><use xlink:href="#iconRefresh"></use></svg>
                        </button>
                    </div>
                </div>
                <div class="formatted-text-dock__content">
                    <div class="formatted-text-dock__empty">${this.i18n.openDocumentFirst}</div>
                </div>
            </div>
        `;
    }

    /**
     * 创建过滤器HTML
     */
    private createFiltersHTML(): string {
        return this.enabledFormats.map(type => {
            const processor = this.parser.getFormatProcessor(type);
            const config = processor.getConfig();
            
            return `
                <button class="format-filter active" 
                        data-format="${type}"
                        title="${this.getFormatDisplayName(type)}"
                        style="border-color:${config.color}">
                    <div class="filter-dot" style="background:${config.color}"></div>
                    <svg class="filter-icon">
                        <use xlink:href="#${config.icon}"></use>
                    </svg>
                </button>
            `;
        }).join("");
    }

    /**
     * 绑定事件
     */
    private bindEvents(): void {
        // 过滤器切换事件
        this.element.querySelectorAll<HTMLButtonElement>(".format-filter")
            .forEach(btn => {
                btn.addEventListener("click", () => {
                    const format = btn.dataset.format as TextFormatType;
                    this.toggleFormat(format);
                    btn.classList.toggle("active");
                });
            });

        // 刷新按钮事件 - 强制刷新
        const refreshBtn = this.element.querySelector<HTMLButtonElement>('[data-action="refresh"]');
        if (refreshBtn) {
            refreshBtn.addEventListener("click", () => {
                this.log('手动刷新被触发');
                this.refresh(true); // 强制刷新，跳过缓存
            });
        }
    }

    /**
     * 刷新数据
     */
    private async refresh(force = false): Promise<void> {
        const editor = getAllEditor()[0];
        if (!editor?.protyle?.block) {
            this.showEmpty(this.i18n.openDocumentFirst);
            return;
        }

        const blockId = editor.protyle.block.rootID;
        
        // 只有在自动刷新且数据已存在时才跳过重新获取
        if (!force && blockId === this.currentBlockId && this.formattedTexts.length > 0) {
            this.log('使用缓存数据，重新渲染列表');
            this.renderList();
            return;
        }

        this.currentBlockId = blockId;
        this.showLoading();

        try {
            this.log(`开始${force ? '强制' : '自动'}刷新，文档ID: ${blockId}`);
            
            const options: ParseOptions = {
                enabledFormats: this.enabledFormats,
                maxResults: 200,
                includeContext: true
            };

            this.log('解析选项:', options);

            // 优先从编辑器实时获取
            this.log('尝试从编辑器实时获取格式化文本...');
            const realtimeResults = this.parser.getCurrentEditorFormattedTexts(editor.protyle, options);
            this.log(`实时解析结果: ${realtimeResults.length} 项`);
            
            // 如果实时结果为空，从数据库查询
            if (realtimeResults.length === 0) {
                this.log('实时解析无结果，从数据库查询...');
                this.formattedTexts = await this.parser.parseFormattedTexts(blockId, options);
                this.log(`数据库查询结果: ${this.formattedTexts.length} 项`);
            } else {
                this.formattedTexts = realtimeResults;
            }

            this.log(`最终获取到 ${this.formattedTexts.length} 个格式化文本项`);

            if (this.formattedTexts.length === 0) {
                this.log('没有找到格式化文本，显示空状态');
                this.showEmpty(this.i18n.noFormattedText);
            } else {
                this.log('开始渲染列表');
                this.renderList();
            }

        } catch (error) {
            this.log('刷新失败:', error);
            this.showEmpty(this.i18n.loadFailed);
        }
    }

    /**
     * 渲染列表
     */
    private renderList(): void {
        this.log('开始渲染列表');
        const content = this.element.querySelector<HTMLElement>(".formatted-text-dock__content");
        if (!content) {
            this.log('未找到内容容器元素');
            return;
        }

        const activeFormats = this.getActiveFormats();
        this.log('当前激活的格式:', activeFormats);
        
        const filteredItems = this.formattedTexts.filter(item => activeFormats.includes(item.type));
        this.log(`过滤后的项目数量: ${filteredItems.length}`);

        if (filteredItems.length === 0) {
            this.log('没有匹配的格式化文本，显示空状态');
            this.showEmpty(this.i18n.noMatchingFormat);
            return;
        }

        const groupedItems = this.groupItems(filteredItems);
        this.log(`分组后的项目数量: ${groupedItems.size}`);
        
        const listHTML = this.createListHTML(groupedItems);
        this.log('生成列表HTML完成');

        content.innerHTML = `<div class="formatted-text-dock__list">${listHTML}</div>`;
        
        // 绑定点击事件
        this.bindItemEvents(content);
        this.log('列表渲染完成并绑定事件');
    }

    /**
     * 分组项目（相同文本内容的项目）
     */
    private groupItems(items: FormattedTextItem[]): Map<string, FormattedTextItem[]> {
        const groups = new Map<string, FormattedTextItem[]>();
        
        for (const item of items) {
            const key = `${item.type}_${item.text}`;
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key)!.push(item);
        }
        
        return groups;
    }

    /**
     * 创建列表HTML
     */
    private createListHTML(groupedItems: Map<string, FormattedTextItem[]>): string {
        const html: string[] = [];
        
        // 将分组转换为数组并按文档位置排序
        const sortedGroups = Array.from(groupedItems.entries()).sort((a, b) => {
            const [keyA, itemsA] = a;
            const [keyB, itemsB] = b;
            
            // 按照每组第一个项目的位置和块ID排序
            const firstA = itemsA[0];
            const firstB = itemsB[0];
            
            // 首先按块ID排序
            if (firstA.blockId !== firstB.blockId) {
                return firstA.blockId.localeCompare(firstB.blockId);
            }
            
            // 同一块内按位置排序
            return firstA.position - firstB.position;
        });
        
        this.log(`分组排序完成，共 ${sortedGroups.length} 个分组:`);
        sortedGroups.forEach(([key, items], index) => {
            const first = items[0];
            this.log(`  ${index + 1}. [${first.type}] "${first.text}" - 位置: ${first.position}, 块: ${first.blockId}`);
        });
        
        for (const [key, items] of sortedGroups) {
            const firstItem = items[0];
            const processor = this.parser.getFormatProcessor(firstItem.type);
            const config = processor.getConfig();
            
            // 按位置排序同一组的项目，确保索引与DOM顺序一致
            const sortedItems = [...items].sort((a, b) => a.position - b.position);
            
            for (let i = 0; i < sortedItems.length; i++) {
                const item = sortedItems[i];
                const displayText = sortedItems.length > 1 ? `${item.text} (${i + 1})` : item.text;
                
                const actionButtons = processor.renderActionButtons ? processor.renderActionButtons(item, this.i18n) : '';
                
                html.push(`
                    <div class="formatted-text-dock__item" 
                         data-type="${item.type}"
                         data-text="${item.text}"
                         data-block-id="${item.blockId}"
                         data-index="${i}"
                         data-position="${item.position}">
                        <div class="formatted-text-dock__item-indicator" 
                             style="background-color: ${config.color}"></div>
                        <div class="formatted-text-dock__item-content">
                            <div class="formatted-text-dock__item-header">
                                <div class="formatted-text-dock__item-main">
                                    <svg class="formatted-text-dock__item-icon" style="color: ${config.color}">
                                        <use xlink:href="#${config.icon}"></use>
                                    </svg>
                                    <span class="formatted-text-dock__item-text">${this.escapeHtml(displayText)}</span>
                                </div>
                                <div class="formatted-text-dock__item-actions">
                                    ${actionButtons}
                                </div>
                            </div>
                            ${this.renderItemDetails(item, displayText)}
                        </div>
                    </div>
                `);
            }
        }
        
        return html.join('');
    }

    /**
     * 渲染项目详细信息（多态实现）
     */
    private renderItemDetails(item: FormattedTextItem, displayText: string): string {
        const processor = this.parser.getFormatProcessor(item.type);
        const config = processor.getConfig();
        
        // 使用处理器的显示模式决定渲染方式
        switch (config.displayMode) {
            case 'simple':
                // 简单模式：不显示额外信息
                return '';
                
            case 'detailed':
                // 详细模式：显示上下文信息
                return item.context ? `
                    <div class="formatted-text-dock__item-context">
                        ${this.escapeHtml(this.truncateText(item.context, 80))}
                    </div>
                ` : '';
                
            case 'custom':
                // 自定义模式：使用处理器的自定义渲染
                if (processor.renderItemDetails) {
                    return processor.renderItemDetails(item, displayText);
                }
                return '';
                
            default:
                return '';
        }
    }

    /**
     * 绑定项目点击事件
     */
    private bindItemEvents(container: HTMLElement): void {
        // 绑定项目点击事件（导航）
        const items = container.querySelectorAll<HTMLElement>('.formatted-text-dock__item');
        
        items.forEach(item => {
            // 点击项目主体进行导航
            const mainContent = item.querySelector('.formatted-text-dock__item-main');
            if (mainContent) {
                mainContent.addEventListener('click', () => {
                    const text = item.dataset.text || '';
                    const type = item.dataset.type as TextFormatType;
                    const index = Number(item.dataset.index || 0);
                    
                    this.navigateToText(text, type, index);
                });
            }
        });
        
        // 绑定添加备注按钮事件
        const addMemoButtons = container.querySelectorAll<HTMLButtonElement>('.formatted-text-dock__add-memo-btn');
        
        addMemoButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // 阻止事件冒泡，避免触发导航
                
                const blockId = btn.dataset.blockId || '';
                const text = btn.dataset.text || '';
                
                this.addMemoToText(blockId, text);
            });
        });
        
        // 绑定删除格式化按钮事件
        const removeFormatButtons = container.querySelectorAll<HTMLButtonElement>('.formatted-text-dock__remove-format-btn');
        
        removeFormatButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // 阻止事件冒泡，避免触发导航
                
                const blockId = btn.dataset.blockId || '';
                const text = btn.dataset.text || '';
                const type = btn.dataset.type as TextFormatType;
                const position = Number(btn.dataset.position || 0);
                
                this.removeFormattingFromText(blockId, text, type, position);
            });
        });
    }

    /**
     * 为文本添加备注
     */
    private async addMemoToText(blockId: string, text: string): Promise<void> {
        try {
            this.log(`开始为文本添加备注: "${text}", 块ID: ${blockId}`);
            
            // 显示自定义备注对话框
            this.memoDialog.show(text, (memoContent: string) => {
                this.saveMemoToText(blockId, text, memoContent);
            });
            
        } catch (error) {
            this.log('显示备注对话框失败:', error);
            showMessage(`❌ ${this.i18n.addMemoFailed}: ${text}`, 3000, 'error');
        }
    }
    
    /**
     * 保存备注到文本
     */
    private async saveMemoToText(blockId: string, text: string, memoContent: string): Promise<void> {
        try {
            this.log(`保存备注: "${text}" -> "${memoContent}"`);
            
            // 获取当前编辑器
            const editor = getAllEditor()[0];
            if (!editor?.protyle) {
                showMessage('❌ 无法获取编辑器实例', 3000, 'error');
                return;
            }
            
            // 查找包含该文本的元素
            const targetElement = this.findTextElement(text);
            if (!targetElement) {
                showMessage(`❌ ${this.i18n.textNotFound}: ${text}`, 3000, 'error');
                return;
            }
            
            // 将目标元素包装成备注元素
            await this.wrapTextWithMemo(targetElement, text, memoContent);
            
            // 刷新列表显示最新的备注
            setTimeout(() => {
                this.refresh(true);
            }, 500);
            
        } catch (error) {
            this.log('保存备注失败:', error);
            showMessage(`❌ ${this.i18n.addMemoFailed}: ${text}`, 3000, 'error');
        }
    }
    
    /**
     * 将文本包装成备注元素
     */
    private async wrapTextWithMemo(element: HTMLElement, text: string, memoContent: string): Promise<void> {
        try {
            // 创建备注span元素
            const memoSpan = document.createElement('span');
            memoSpan.setAttribute('data-type', 'inline-memo');
            memoSpan.setAttribute('data-inline-memo-content', memoContent);
            memoSpan.textContent = text;
            
            // 复制原有的样式属性
            if (element.className) {
                memoSpan.className = element.className;
            }
            
            // 复制原有的data属性（如果有）
            Array.from(element.attributes).forEach(attr => {
                if (attr.name.startsWith('data-') && attr.name !== 'data-type') {
                    memoSpan.setAttribute(attr.name, attr.value);
                }
            });
            
            // 替换原元素
            element.parentNode?.replaceChild(memoSpan, element);
            
            this.log('备注元素创建成功');
            
            // 如果可能的话，通过API更新到后端
            await this.updateBlockContent();
            
        } catch (error) {
            this.log('包装备注元素失败:', error);
            throw error;
        }
    }
    
    /**
     * 更新块内容到后端
     */
    private async updateBlockContent(): Promise<void> {
        try {
            const editor = getAllEditor()[0];
            if (!editor?.protyle?.block) {
                return;
            }
            
            const blockId = editor.protyle.block.rootID;
            const blockElement = editor.protyle.wysiwyg.element;
            
            if (!blockElement) {
                return;
            }
            
            // 获取更新后的HTML内容
            const newContent = blockElement.innerHTML;
            
            // 调用思源API更新块内容
            const response = await fetchPost('/api/block/updateBlock', {
                id: blockId,
                data: newContent,
                dataType: 'dom'
            });
            
            if (response.code === 0) {
                this.log('块内容更新成功');
            } else {
                this.log('块内容更新失败:', response);
            }
            
        } catch (error) {
            this.log('更新块内容失败:', error);
        }
    }
    
    /**
     * 删除文本格式化
     */
    private async removeFormattingFromText(blockId: string, text: string, type: TextFormatType, position: number): Promise<void> {
        try {
            this.log(`开始删除格式化: "${text}", 类型: ${type}, 位置: ${position}`);
            
            // 获取对应的格式处理器
            const processor = this.parser.getFormatProcessor(type);
            
            // 计算项目索引（同类型同文本的项目中的索引）
            const sameTypeItems = this.formattedTexts.filter(item => 
                item.type === type && item.text === text
            );
            
            // 按位置排序找到当前项目的索引
            sameTypeItems.sort((a, b) => a.position - b.position);
            const itemIndex = sameTypeItems.findIndex(item => item.position === position);
            
            this.log(`找到 ${sameTypeItems.length} 个相同的项目，当前项目索引: ${itemIndex}`);
            
            // 调用处理器删除格式化
            const success = await processor.removeFormatting!(text, blockId, itemIndex >= 0 ? itemIndex : 0);
            
            if (success) {
                showMessage(`✅ ${this.i18n.removeFormatSuccess || '格式删除成功'}: ${text}`, 2000, 'info');
                
                // 更新块内容到后端
                await this.updateBlockContent();
                
                // 延迟刷新列表，让DOM更新完成
                setTimeout(() => {
                    this.refresh(true);
                }, 500);
                
            } else {
                showMessage(`❌ ${this.i18n.removeFormatFailed || '格式删除失败'}: ${text}`, 3000, 'error');
            }
            
        } catch (error) {
            this.log('删除格式化失败:', error);
            showMessage(`❌ ${this.i18n.removeFormatFailed || '格式删除失败'}: ${text}`, 3000, 'error');
        }
    }
    
    /**
     * 查找文本元素
     */
    private findTextElement(text: string): HTMLElement | null {
        // 查找所有可能包含该文本的元素
        const selectors = [
            'strong', 'b', 'em', 'i', 'u', 'mark',
            '[data-type="strong"]', '[data-type="em"]', '[data-type="u"]', '[data-type="mark"]'
        ];
        
        for (const selector of selectors) {
            const elements = Array.from(document.querySelectorAll(selector));
            const found = elements.find(el => el.textContent?.trim() === text);
            if (found) {
                return found as HTMLElement;
            }
        }
        
        return null;
    }
    

    /**
     * 导航到文本位置
     */
    private navigateToText(text: string, type: TextFormatType, itemIndex: number): void {
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
    private findItemByTextAndIndex(text: string, type: TextFormatType, index: number): FormattedTextItem | undefined {
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
    private scrollToElement(element: HTMLElement): void {
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'center'
        });
    }

    /**
     * 高亮元素
     */
    private highlightElement(element: HTMLElement): void {
        element.classList.add('formatted-text-dock__highlight');
        
        setTimeout(() => {
            element.classList.remove('formatted-text-dock__highlight');
        }, 2000);
    }

    /**
     * 切换格式类型
     */
    private toggleFormat(type: TextFormatType): void {
        const index = this.enabledFormats.indexOf(type);
        if (index >= 0) {
            this.enabledFormats.splice(index, 1);
            this.log(`禁用格式类型: ${type}`);
        } else {
            this.enabledFormats.push(type);
            this.log(`启用格式类型: ${type}`);
        }
        
        this.log('当前启用的格式类型:', this.enabledFormats);
        this.renderList();
    }

    /**
     * 获取当前激活的格式类型
     */
    private getActiveFormats(): TextFormatType[] {
        const activeButtons = this.element.querySelectorAll('.format-filter.active');
        return Array.from(activeButtons)
            .map(btn => (btn as HTMLElement).dataset.format as TextFormatType)
            .filter(type => type);
    }

    /**
     * 显示加载状态
     */
    private showLoading(): void {
        const content = this.element.querySelector<HTMLElement>(".formatted-text-dock__content");
        if (content) {
            content.innerHTML = `
                <div class="formatted-text-dock__loading">
                    <div class="formatted-text-dock__loading-spinner"></div>
                    <span>${this.i18n.loading}</span>
                </div>
            `;
        }
    }

    /**
     * 显示空状态
     */
    private showEmpty(message: string): void {
        const content = this.element.querySelector<HTMLElement>(".formatted-text-dock__content");
        if (content) {
            content.innerHTML = `<div class="formatted-text-dock__empty">${this.escapeHtml(message)}</div>`;
        }
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
     * 转义HTML
     */
    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 截断文本
     */
    private truncateText(text: string, maxLength: number): string {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    /**
     * 日志输出
     */
    private log(...args: any[]): void {
        if (this.logger) {
            this.logger('[FormattedTextDock]', ...args);
        }
    }
}
