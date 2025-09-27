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
        displayMode: DisplayMode.SIMPLE
    };
    
    constructor(logger?: (...args: any[]) => void) {
        super(logger);
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
                    color: this.getConfig().color
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
}
