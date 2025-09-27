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
    
    // 10种鲜艳的标签颜色配色方案
    private readonly tagColors: string[] = [
        "#FF4757", // 鲜艳红色
        "#2ED573", // 鲜艳绿色
        "#1E90FF", // 鲜艳蓝色
        "#FFA502", // 鲜艳橙色
        "#FF6348", // 鲜艳番茄红
        "#9C88FF", // 鲜艳紫色
        "#00D2D3", // 鲜艳青色
        "#FF9FF3", // 鲜艳粉色
        "#54A0FF", // 鲜艳天蓝
        "#5F27CD"  // 鲜艳深紫
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
        
        this.log('TagProcessor.extractFromBlock called with block:', block);
        
        if (block && block.tag) {
            const tags = block.tag.split(',').map((tag: string) => tag.trim()).filter(Boolean);
            this.log('解析出的标签列表:', tags);
            
            tags.forEach((tag, index) => {
                const item = {
                    id: `tag_${block.id}_${tag}`,
                    text: `#${tag}`,
                    type: this.formatType,
                    blockId: block.id,
                    position: index,
                    context: this.truncateText(block.content || "", 50),
                    icon: this.getConfig().icon,
                    color: this.getTagColor(tag),
                    // 保存原始标签名称（不含#）用于渲染
                    metadata: { tagName: tag, blockContent: block.content || "" }
                };
                
                this.log('创建的标签项:', item);
                items.push(item);
            });
        } else {
            this.log('块没有标签或块为空:', { block, hasTag: !!block?.tag });
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
        
        this.log('TagProcessor.extractFromHTML called with:', { html: html.substring(0, 200) + '...', blockId });
        
        // 查找标签元素
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const tagElements = doc.querySelectorAll(config.htmlSelectors[0]);
        
        this.log('找到的标签元素数量:', tagElements.length);
        
        tagElements.forEach((element, index) => {
            const text = element.textContent?.trim() || '';
            this.log(`处理标签元素 ${index}:`, { text, element: element.outerHTML });
            
            if (text) {
                // 从标签文本中提取标签名称（移除#号）
                const tagName = text.startsWith('#') ? text.substring(1) : text;
                
                const item = {
                    id: this.generateId('html', `${blockId}_${index}`),
                    text: text,
                    type: this.formatType,
                    blockId: blockId,
                    position: index,
                    context: element.parentElement?.textContent || "",
                    icon: config.icon,
                    color: this.getTagColor(tagName),
                    element: element as HTMLElement,
                    // 设置metadata用于胶囊状渲染
                    metadata: { 
                        tagName: tagName, 
                        blockContent: element.parentElement?.textContent || "" 
                    }
                };
                
                this.log('创建的HTML标签项:', item);
                items.push(item);
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
