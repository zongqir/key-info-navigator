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
        icon: "iconCube",
        color: "#e85aad", // 现代简约玫瑰色
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
     * 标签不支持添加备注（标签本身就是块级标记）
     */
    public supportAddMemo(): boolean {
        return false;
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
    extractFromBlock(block: any, blockIndex?: number): FormattedTextItem[] {
        const items: FormattedTextItem[] = [];
        
        this.log('TagProcessor.extractFromBlock called with block:', block, 'blockIndex:', blockIndex);
        
        if (block && block.tag) {
            // 保留原始标签文本（包含#号），用于匹配DOM
            const tags = block.tag.split(',').map((tag: string) => tag.trim()).filter(Boolean);
            this.log('解析出的标签列表:', tags);
            
            tags.forEach((tag, tagIndex) => {
                // 使用块在文档中的位置，而不是标签在块中的索引
                const position = blockIndex !== undefined ? blockIndex : 0;
                
                // 思源在DOM中存储标签时会去掉#号，只保留零宽空格
                const cleanTag = tag.replace(/^#+|#+$/g, '');
                
                this.log('🏷️ 提取标签:', tag);
                this.log('  ├─ 原始标签（包含#）:', tag);
                this.log('  └─ 干净标签（去除#，用于匹配DOM）:', cleanTag);
                
                const item = {
                    id: `tag_${block.id}_${tag}`,
                    text: cleanTag, // 存储不带#的文本，用于匹配DOM（DOM中也没有#）
                    type: this.formatType,
                    blockId: block.id,
                    position: position,
                    context: this.truncateText(block.content || "", 50),
                    icon: this.getConfig().icon,
                    color: this.getTagColor(cleanTag),
                    // 保存标签名用于显示
                    metadata: { 
                        displayName: cleanTag, // 显示用标签（不带#）
                        blockContent: block.content || "" 
                    }
                };
                
                this.log('  ✅ item.text（用于匹配DOM）:', item.text);
                this.log('  ✅ item.metadata.displayName（用于显示）:', item.metadata.displayName);
                
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
        
        // 查找标签元素
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const tagElements = doc.querySelectorAll(config.htmlSelectors[0]);
        
        tagElements.forEach((element, index) => {
            const text = element.textContent?.trim() || '';
            
            if (text) {
                // 从标签文本中提取标签名称（移除#号）
                const tagName = text.startsWith('#') ? text.substring(1) : text;
                
                // 查找标签所在的具体段落ID
                let actualBlockId = blockId; // 默认使用传入的blockId
                let currentElement = element.parentElement;
                
                // 向上查找，寻找具有data-node-id的元素（这才是真正的段落ID）
                while (currentElement) {
                    const nodeId = currentElement.getAttribute('data-node-id');
                    if (nodeId && nodeId !== blockId) {
                        // 找到了不同于根ID的段落ID
                        actualBlockId = nodeId;
                        break;
                    }
                    currentElement = currentElement.parentElement;
                }
                
                const item = {
                    id: this.generateId('html', `${actualBlockId}_${index}`),
                    text: text, // 保留原始文本（可能包含#）
                    type: this.formatType,
                    blockId: actualBlockId, // 使用真实的段落ID
                    position: index,
                    context: element.parentElement?.textContent || "",
                    icon: config.icon,
                    color: this.getTagColor(tagName),
                    // 设置metadata用于胶囊状渲染
                    metadata: { 
                        tagName: text, // 原始标签（可能带#）
                        displayName: tagName, // 显示用标签（不带#）
                        blockContent: element.parentElement?.textContent || "" 
                    }
                };
                
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
        this.log('renderMainContent called with item:', item);
        
        this.log('🎨 渲染标签');
        this.log('  ├─ item.text（原始）:', item.text);
        this.log('  ├─ item.metadata:', item.metadata);
        
        if (!item.metadata) {
            this.log('No metadata found, returning default text:', item.text);
            this.log('  ❌ 没有metadata，返回默认文本:', item.text);
            return item.text;
        }
        
        const { displayName, blockContent } = item.metadata;
        const tagColor = this.getTagColor(displayName);
        
        this.log('  ├─ displayName（用于显示）:', displayName);
        this.log('  ├─ tagColor:', tagColor);
        this.log('  └─ blockContent:', blockContent?.substring(0, 30));
        
        this.log('Rendering tag:', displayName, 'with color:', tagColor);
        
        // 截断块内容用于显示
        const truncatedContent = this.truncateText(blockContent, 80);
        
        const result = `
            <div class="formatted-text-dock__item-tag-inline">
                <div class="formatted-text-dock__tag-shape" style="background-color: ${tagColor}">
                    <span class="formatted-text-dock__tag-text">${displayName}</span>
                </div>
                <span class="formatted-text-dock__tag-block-text">${this.escapeHtml(truncatedContent)}</span>
            </div>
        `;
        
        this.log('  ✅ 渲染完成，显示:', displayName);
        this.log('Generated HTML:', result);
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
