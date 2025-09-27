import { TextFormatType, FormattedTextItem } from "../formatProcessor";
import { TextFormatParser } from "../formatProcessor/TextFormatParser";

/**
 * 格式化文本UI渲染器
 * 负责生成和渲染侧边栏的UI元素
 */
export class FormattedTextUIRenderer {
    constructor(
        private parser: TextFormatParser,
        private enabledFormats: TextFormatType[],
        private i18n: any,
        private logger?: (...args: any[]) => void
    ) {}

    /**
     * 创建主要HTML结构
     */
    public createMainHTML(): string {
        const filtersHTML = this.createFiltersHTML();
        
        return `
            <div class="fn__flex-1 fn__flex-column formatted-text-dock">
                <div class="formatted-text-dock__header">
                    <div class="formatted-text-dock__title">
                        <svg class="formatted-text-dock__icon">
                            <use xlink:href="#iconFocus"></use>
                        </svg>
                        <span>${this.i18n.keyInformation}</span>
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
    public createFiltersHTML(): string {
        return this.enabledFormats.map(type => {
            const processor = this.parser.getFormatProcessor(type);
            const config = processor.getConfig();
            
            return `
                <button class="format-filter active" 
                        data-format="${type}"
                        title="${this.getFormatDisplayName(type)}">
                    <div class="filter-circle" style="background-color:${config.color}"></div>
                </button>
            `;
        }).join("");
    }

    /**
     * 创建列表HTML
     */
    public createListHTML(groupedItems: Map<string, FormattedTextItem[]>): string {
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
                                    ${(() => {
                                        console.log('[UIRenderer] Processing item type:', item.type, 'processor:', processor.constructor.name);
                                        console.log('[UIRenderer] Has renderMainContent?', typeof processor.renderMainContent === 'function');
                                        if (typeof processor.renderMainContent === 'function') {
                                            console.log('[UIRenderer] Calling renderMainContent for item:', item);
                                            return processor.renderMainContent(item);
                                        } else {
                                            console.log('[UIRenderer] Using default text rendering');
                                            return `<span class="formatted-text-dock__item-text">${this.escapeHtml(displayText)}</span>`;
                                        }
                                    })()}
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
    public renderItemDetails(item: FormattedTextItem, displayText: string): string {
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
     * 显示加载状态
     */
    public createLoadingHTML(): string {
        return `
            <div class="formatted-text-dock__loading">
                <div class="formatted-text-dock__loading-spinner"></div>
                <span>${this.i18n.loading}</span>
            </div>
        `;
    }

    /**
     * 显示空状态
     */
    public createEmptyHTML(message: string): string {
        return `<div class="formatted-text-dock__empty">${this.escapeHtml(message)}</div>`;
    }

    /**
     * 获取格式显示名称
     */
    public getFormatDisplayName(type: TextFormatType): string {
        const names = {
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
     * 转义HTML
     */
    public escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 截断文本
     */
    public truncateText(text: string, maxLength: number): string {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    /**
     * 日志输出
     */
    private log(...args: any[]): void {
        if (this.logger) {
            this.logger('[FormattedTextUIRenderer]', ...args);
        }
    }
}
