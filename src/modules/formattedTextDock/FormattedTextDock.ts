import { getAllEditor, showMessage } from "siyuan";
import { TextFormatParser, TextFormatType, FormattedTextItem, ParseOptions } from "../formatProcessor";

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
    ];
    private currentBlockId = "";
    private refreshTimer?: NodeJS.Timeout;

    constructor(
        private element: HTMLElement,
        private i18n: any,
        private logger?: (...args: any[]) => void
    ) {
        this.parser = new TextFormatParser(logger);
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
        
        for (const [key, items] of groupedItems) {
            const firstItem = items[0];
            const processor = this.parser.getFormatProcessor(firstItem.type);
            const config = processor.getConfig();
            
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const displayText = items.length > 1 ? `${item.text} (${i + 1})` : item.text;
                
                html.push(`
                    <div class="formatted-text-dock__item" 
                         data-type="${item.type}"
                         data-text="${item.text}"
                         data-block-id="${item.blockId}"
                         data-index="${i}">
                        <div class="formatted-text-dock__item-indicator" 
                             style="background-color: ${config.color}"></div>
                        <div class="formatted-text-dock__item-content">
                            <div class="formatted-text-dock__item-header">
                                <svg class="formatted-text-dock__item-icon" style="color: ${config.color}">
                                    <use xlink:href="#${config.icon}"></use>
                                </svg>
                                <span class="formatted-text-dock__item-text">${this.escapeHtml(displayText)}</span>
                            </div>
                            ${item.context ? `
                                <div class="formatted-text-dock__item-context">
                                    ${this.escapeHtml(this.truncateText(item.context, 80))}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `);
            }
        }
        
        return html.join('');
    }

    /**
     * 绑定项目点击事件
     */
    private bindItemEvents(container: HTMLElement): void {
        const items = container.querySelectorAll<HTMLElement>('.formatted-text-dock__item');
        
        items.forEach(item => {
            item.addEventListener('click', () => {
                const text = item.dataset.text || '';
                const type = item.dataset.type as TextFormatType;
                const index = Number(item.dataset.index || 0);
                
                this.navigateToText(text, type, index);
            });
        });
    }

    /**
     * 导航到文本位置
     */
    private navigateToText(text: string, type: TextFormatType, index: number): void {
        try {
            const processor = this.parser.getFormatProcessor(type);
            const config = processor.getConfig();
            const selectors = config.htmlSelectors.join(',');
            
            const elements = Array.from(document.querySelectorAll(selectors))
                .filter(el => el.textContent?.trim() === text);

            if (elements.length === 0) {
                showMessage(`❌ ${this.i18n.textNotFound}: ${text}`, 3000, 'error');
                return;
            }

            const targetIndex = Math.min(index, elements.length - 1);
            const target = elements[targetIndex];
            
            // 滚动到目标位置
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'center'
            });

            // 高亮效果
            this.highlightElement(target as HTMLElement);
            
            showMessage(`✅ ${this.i18n.navigationSuccess}: ${text}`, 2000, 'info');

        } catch (error) {
            this.log('导航失败:', error);
            showMessage(`❌ ${this.i18n.navigationFailed}: ${text}`, 3000, 'error');
        }
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
