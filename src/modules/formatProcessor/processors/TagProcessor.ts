import { BaseFormatProcessor } from '../BaseFormatProcessor';
import { TextFormatType, FormattedTextItem, FormatConfig, DisplayMode } from '../interfaces';

/**
 * 标签块处理器
 */
export class TagProcessor extends BaseFormatProcessor {
    public readonly formatType = TextFormatType.TAG;
    
    protected readonly config: FormatConfig = {
        sqlType: [], // 标签块通过blocks表查询，不使用spans
        htmlSelectors: ["span[data-type='tag']"],
        kramdownRegex: /#[\w\u4e00-\u9fa5]+/g,
        icon: "iconTags",
        color: "#4285f4",
        displayMode: DisplayMode.CUSTOM
    };
    
    // 10种明亮的标签颜色配色方案
    private readonly tagColors: string[] = [
        "#FF6B6B", // 珊瑚红
        "#4ECDC4", // 青绿色
        "#45B7D1", // 天蓝色
        "#96CEB4", // 薄荷绿
        "#FFEAA7", // 柠檬黄
        "#DDA0DD", // 梅花紫
        "#98D8C8", // 海绿色
        "#F7DC6F", // 金黄色
        "#BB8FCE", // 淡紫色
        "#85C1E9"  // 浅蓝色
    ];
    
    constructor(logger?: (...args: any[]) => void) {
        super(logger);
    }
    
    /**
     * 根据标签名称获取颜色
     */
    private getTagColor(tagName: string): string {
        // 使用标签名称的哈希值来确定颜色，确保相同标签始终使用相同颜色
        let hash = 0;
        for (let i = 0; i < tagName.length; i++) {
            hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % this.tagColors.length;
        return this.tagColors[index];
    }
    
    
    extractFromSpan(span: any, blockId = ""): FormattedTextItem[] {
        // 标签块处理器主要通过块查询，span提取作为补充
        return [];
    }
    
    /**
     * 从块数据中提取标签项目（这是主要方法）
     */
    extractFromBlock(block: any): FormattedTextItem[] {
        const items: FormattedTextItem[] = [];
        
        if (block && block.tag) {
            const tags = block.tag.split(',').map((tag: string) => tag.trim()).filter(Boolean);
            
            tags.forEach((tag, index) => {
                items.push({
                    id: `tag_${block.id}_${tag}`,
                    text: `#${tag}`,
                    type: this.formatType,
                    blockId: block.id,
                    position: index,
                    context: this.extractContext(tag, this.truncateText(block.content || "", 50)),
                    icon: this.getConfig().icon,
                    color: this.getTagColor(tag),
                    // 保存原始标签名称（不含#）用于渲染
                    metadata: { tagName: tag, blockContent: block.content || "" }
                });
            });
        }
        
        return items;
    }
    
    private truncateText(text: string, maxLength: number): string {
        if (text.length <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength) + '...';
    }
    
    extractFromHTML(html: string, blockId: string): FormattedTextItem[] {
        const items: FormattedTextItem[] = [];
        const config = this.getConfig();
        
        // 查找标签元素
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const tagElements = doc.querySelectorAll(config.htmlSelectors[0]);
        
        tagElements.forEach((element, index) => {
            const text = element.textContent?.trim() || '';
            if (text) {
                items.push({
                    id: this.generateId({ text, index }, blockId),
                    text: text,
                    type: this.formatType,
                    blockId: blockId,
                    position: index,
                    context: this.extractContext(text, element.parentElement?.textContent || ""),
                    icon: config.icon,
                    color: config.color,
                    element: element as HTMLElement
                });
            }
        });
        
        return items;
    }
    
    matches(text: string): boolean {
        return this.getConfig().kramdownRegex.test(text);
    }
    
    /**
     * 自定义渲染主要内容 - 替换默认的标签文本显示
     */
    renderMainContent(item: FormattedTextItem): string {
        console.log('[TagProcessor] renderMainContent called with item:', item);
        
        if (!item.metadata) {
            console.log('[TagProcessor] No metadata found, returning default text:', item.text);
            return item.text;
        }
        
        const { tagName, blockContent } = item.metadata;
        const tagColor = this.getTagColor(tagName);
        
        console.log('[TagProcessor] Rendering tag:', tagName, 'with color:', tagColor);
        
        // 截断块内容用于显示
        const truncatedContent = this.truncateText(blockContent, 80);
        
        const result = `
            <div class="formatted-text-dock__item-tag-inline">
                <div class="formatted-text-dock__tag-shape" style="background-color: ${tagColor}">
                    <span class="formatted-text-dock__tag-text">#${tagName}</span>
                </div>
                <span class="formatted-text-dock__tag-block-text">${this.escapeHtml(truncatedContent)}</span>
            </div>
        `;
        
        console.log('[TagProcessor] Generated HTML:', result);
        return result;
    }

    /**
     * 自定义渲染标签项目详情 - 现在返回空，因为主要内容已经包含了所有信息
     */
    renderItemDetails(item: FormattedTextItem, displayText: string): string {
        return ''; // 不需要额外的详情，主要内容已经包含了胶囊+文本
    }
    
    /**
     * 转义HTML
     */
    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
