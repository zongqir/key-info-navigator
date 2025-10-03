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
                        <span></span>
                    </div>
                    <div class="formatted-text-dock__controls">
                        <div class="formatted-text-dock__filters">${filtersHTML}</div>
                        <button class="formatted-text-dock__refresh b3-button" 
                                title="${this.i18n.refresh}" data-action="refresh">
                            <span style="font-size: 18px;">♻️</span>
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
        const textFormats = [TextFormatType.BOLD, TextFormatType.ITALIC, TextFormatType.UNDERLINE];
        const otherFormats = this.enabledFormats.filter(type => !textFormats.includes(type));
        
        const textFormatButtons = textFormats
            .filter(type => this.enabledFormats.includes(type))
            .map(type => {
                const processor = this.parser.getFormatProcessor(type);
                const config = processor.getConfig();
                
                return `
                    <button class="format-filter active" 
                            data-format="${type}"
                            title="${this.getFormatDisplayName(type)}">
                        <div class="filter-icon">
                            ${this.getFormatIconWithColor(type, config.color)}
                        </div>
                    </button>
                `;
            }).join("");
        
        const otherFormatButtons = otherFormats.map(type => {
            const processor = this.parser.getFormatProcessor(type);
            const config = processor.getConfig();
            
            return `
                <button class="format-filter active" 
                        data-format="${type}"
                        title="${this.getFormatDisplayName(type)}">
                    <div class="filter-icon" style="color:${config.color}">
                        ${this.getFormatIcon(type)}
                    </div>
                </button>
            `;
        }).join("");
        
        return textFormatButtons + otherFormatButtons;
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
                        <div class="formatted-text-dock__item-content">
                            <div class="formatted-text-dock__item-header">
                                <div class="formatted-text-dock__item-main">
                                    ${(() => {
                                        if (typeof processor.renderMainContent === 'function') {
                                            return processor.renderMainContent(item);
                                        } else {
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
     * 获取格式类型对应的统一大小图标
     */
    public getFormatIcon(type: TextFormatType): string {
        // 统一的现代配色方案 - 使用协调的色相和饱和度
        const icons = {
            [TextFormatType.BOLD]: `
                <div style="font-size: 14px; display: flex; align-items: center; justify-content: center; height: 20px; width: 20px; background: #0969da; color: white; font-weight: 900; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; border-radius: 3px; line-height: 1;">B</div>
            `,
            [TextFormatType.ITALIC]: `
                <div style="font-size: 14px; display: flex; align-items: center; justify-content: center; height: 20px; width: 20px; background: #FF6B6B; color: white; font-style: italic; font-weight: 900; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; border-radius: 3px; line-height: 1;">I</div>
            `,
            [TextFormatType.UNDERLINE]: `
                <div style="font-size: 14px; display: flex; align-items: center; justify-content: center; height: 20px; width: 20px; background: #8B5CF6; color: white; text-decoration: underline; font-weight: 900; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; border-radius: 3px; line-height: 1; text-underline-offset: 2px;">U</div>
            `,
            [TextFormatType.HIGHLIGHT]: `
                <div style="font-size: 14px; display: flex; align-items: center; justify-content: center; height: 20px; width: 20px; background: #F59E0B; color: white; font-weight: 900; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; border-radius: 3px; line-height: 1;">H</div>
            `,
            [TextFormatType.MEMO]: `
                <div style="font-size: 14px; display: flex; align-items: center; justify-content: center; height: 20px; width: 20px; background: #8B5CF6; color: white; font-weight: 900; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; border-radius: 3px; line-height: 1;">M</div>
            `,
            [TextFormatType.TAG]: `
                <div style="font-size: 14px; display: flex; align-items: center; justify-content: center; height: 20px; width: 20px; background: #EC4899; color: white; font-weight: 900; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; border-radius: 3px; line-height: 1;">#</div>
            `,
            [TextFormatType.TODO]: `
                <div style="font-size: 14px; display: flex; align-items: center; justify-content: center; height: 20px; width: 20px; background: #10B981; color: white; font-weight: 900; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; border-radius: 3px; line-height: 1;">✓</div>
            `
        };
        
        return icons[type] || `
            <div style="font-size: 14px; display: flex; align-items: center; justify-content: center; height: 20px; width: 20px;">●</div>
        `;
    }

    /**
     * 获取带特定颜色的图标（用于BIU）
     */
    public getFormatIconWithColor(type: TextFormatType, color: string): string {
        const icons: Partial<Record<TextFormatType, string>> = {
            [TextFormatType.BOLD]: `
                <div style="font-size: 14px; display: flex; align-items: center; justify-content: center; height: 20px; width: 20px; background: #0969da; color: white; font-weight: 900; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; border-radius: 3px; line-height: 1;">B</div>
            `,
            [TextFormatType.ITALIC]: `
                <div style="font-size: 14px; display: flex; align-items: center; justify-content: center; height: 20px; width: 20px; background: #FF6B6B; color: white; font-style: italic; font-weight: 900; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; border-radius: 3px; line-height: 1;">I</div>
            `,
            [TextFormatType.UNDERLINE]: `
                <div style="font-size: 14px; display: flex; align-items: center; justify-content: center; height: 20px; width: 20px; background: #8B5CF6; color: white; text-decoration: underline; font-weight: 900; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; border-radius: 3px; line-height: 1; text-underline-offset: 2px;">U</div>
            `
        };
        
        return icons[type] || this.getFormatIcon(type);
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
            this.logger(...args);
        }
    }
}
