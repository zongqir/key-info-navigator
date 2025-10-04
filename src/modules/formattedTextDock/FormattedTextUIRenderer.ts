import { TextFormatType, FormattedTextItem } from "../formatProcessor";
import { TextFormatParser } from "../formatProcessor/TextFormatParser";

/**
 * 格式化文本UI渲染器
 * 负责生成和渲染侧边栏的UI元素
 */
export class FormattedTextUIRenderer {
    // 所有可用的格式类型（固定不变）
    private readonly allFormats: TextFormatType[] = [
        TextFormatType.BOLD,
        TextFormatType.ITALIC,
        TextFormatType.UNDERLINE,
        TextFormatType.HIGHLIGHT,
        TextFormatType.MEMO,
        TextFormatType.TAG,
        TextFormatType.TODO,
    ];

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
                        <button class="formatted-text-dock__refresh" 
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
        const textFormats = [TextFormatType.BOLD, TextFormatType.ITALIC, TextFormatType.UNDERLINE];
        const otherFormats = this.allFormats.filter(type => !textFormats.includes(type));
        
        const textFormatButtons = textFormats
            .map(type => {
                const processor = this.parser.getFormatProcessor(type);
                const config = processor.getConfig();
                const isActive = this.enabledFormats.includes(type);
                
                return `
                    <button class="format-filter ${isActive ? 'active' : ''}" 
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
            const isActive = this.enabledFormats.includes(type);
            
            return `
                <button class="format-filter ${isActive ? 'active' : ''}" 
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
     * 注意：items 已经在 TextFormatParser 中通过排序器按渲染顺序排序
     */
    public createListHTML(groupedItems: Map<string, FormattedTextItem[]>): string {
        const html: string[] = [];
        
        // 将分组转换为数组（保持原有顺序，因为已经排序过了）
        const sortedGroups = Array.from(groupedItems.entries());
        
        this.log(`共 ${sortedGroups.length} 个分组（已通过排序器排序）:`);
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
                
                // 检测是否有多行内容，决定垂直对齐方式
                const itemDetails = this.renderItemDetails(item, displayText);
                const hasMultilineContent = itemDetails.trim() !== '';
                
                // 检测是否是备注类型且有备注内容
                const isMemoWithContent = item.type === 'memo' && item.memoContent && item.memoContent.trim() !== '';
                
                // 确定对齐样式类
                const alignmentClass = (hasMultilineContent || isMemoWithContent) ? 'has-context' : '';
                
                html.push(`
                    <div class="formatted-text-dock__item ${alignmentClass}" 
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
                            ${itemDetails}
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
     * 显示带筛选提示的空状态
     */
    public createEmptyWithHintHTML(message: string, filteredOutTypes: TextFormatType[]): string {
        let typeHints = '';
        if (filteredOutTypes.length > 0) {
            typeHints = `
                <div class="formatted-text-dock__filter-hint-section empty-state">
                    <div class="filter-hint-container">
                        <div class="filter-hint-icons">
                            ${filteredOutTypes.map(type => `
                                <button class="filter-hint-icon format-toggle" data-format="${type}" title="显示${this.getFormatDisplayName(type)}">
                                    ${this.getFormatIcon(type)}
                                </button>
                            `).join('')}
                        </div>
                        <button class="filter-hint-show-all" data-action="show-all" title="显示全部">
                            <svg class="show-all-icon" viewBox="0 0 16 16" width="12" height="12">
                                <path d="M8 1L10.5 6H15L11.5 9L13 14L8 11L3 14L4.5 9L1 6H5.5L8 1Z" fill="currentColor"/>
                            </svg>
                            <span>显示全部</span>
                        </button>
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="formatted-text-dock__empty">
                <div class="empty-message">${this.escapeHtml(message)}</div>
                ${typeHints}
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
        // 图标背景色与竖线指示器颜色保持一致（来自各Processor的color配置）
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
                <div style="font-size: 14px; display: flex; align-items: center; justify-content: center; height: 20px; width: 20px; background: #FF8C00; color: white; font-weight: 900; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; border-radius: 3px; line-height: 1;">H</div>
            `,
            [TextFormatType.MEMO]: `
                <div style="font-size: 14px; display: flex; align-items: center; justify-content: center; height: 20px; width: 20px; background: #20B2AA; color: white; font-weight: 900; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; border-radius: 3px; line-height: 1;">M</div>
            `,
            [TextFormatType.TAG]: `
                <div style="font-size: 16px; display: flex; align-items: center; justify-content: center; height: 20px; width: 20px; background: #FFD700; color: white; font-weight: 900; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; border-radius: 3px; line-height: 1;">#</div>
            `,
            [TextFormatType.TODO]: `
                <div style="font-size: 14px; display: flex; align-items: center; justify-content: center; height: 20px; width: 20px; background: #32CD32; color: white; font-weight: 900; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; border-radius: 3px; line-height: 1;">✓</div>
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
