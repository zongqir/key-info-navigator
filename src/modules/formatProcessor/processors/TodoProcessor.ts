import { BaseFormatProcessor } from '../BaseFormatProcessor';
import { TextFormatType, FormattedTextItem, FormatConfig, DisplayMode } from '../interfaces';

/**
 * Todo块处理器
 */
export class TodoProcessor extends BaseFormatProcessor {
    public readonly formatType = TextFormatType.TODO;
    
    protected readonly config: FormatConfig = {
        sqlType: [], // Todo块通过blocks表查询，不使用spans
        htmlSelectors: ["div[data-subtype='t']", "li[data-subtype='t']"],
        kramdownRegex: /^\s*[-*+]\s*\[[ x]\]/m,
        icon: "iconCheck",
        color: "#34a853",
        displayMode: DisplayMode.SIMPLE
    };
    
    constructor(logger?: (...args: any[]) => void) {
        super(logger);
    }
    
    extractFromSpan(span: any, blockId = ""): FormattedTextItem[] {
        // Todo块处理器主要通过块查询，span提取作为补充
        return [];
    }
    
    /**
     * 从块数据中提取Todo项目（这是主要方法）
     */
    extractFromBlock(block: any): FormattedTextItem[] {
        const items: FormattedTextItem[] = [];
        
        if (block && block.subtype === 't') {
            const content = this.extractTodoContent(block.content || "");
            const isCompleted = this.isTodoCompleted(block.content || "");
            
            items.push({
                id: `todo_${block.id}`,
                text: content,
                type: this.formatType,
                blockId: block.id,
                position: 0,
                context: this.truncateText(content, 80),
                icon: isCompleted ? "iconCheck" : "iconUncheck",
                color: isCompleted ? "#34a853" : "#ff9800"
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
        
        // 查找Todo元素
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        config.htmlSelectors.forEach(selector => {
            const todoElements = doc.querySelectorAll(selector);
            
            todoElements.forEach((element, index) => {
                const text = this.extractTodoText(element);
                if (text) {
                    const isCompleted = this.isTodoCompleted(element);
                    items.push({
                        id: this.generateId({ text, index, completed: isCompleted }, blockId),
                        text: text,
                        type: this.formatType,
                        blockId: blockId,
                        position: index,
                        context: this.extractContext(text, element.parentElement?.textContent || ""),
                        icon: isCompleted ? "iconCheck" : "iconUncheck",
                        color: isCompleted ? "#34a853" : "#ff9800",
                        element: element as HTMLElement
                    });
                }
            });
        });
        
        return items;
    }
    
    matches(text: string): boolean {
        return this.getConfig().kramdownRegex.test(text);
    }
    
    /**
     * 提取Todo文本内容
     */
    private extractTodoText(element: Element): string {
        // 获取Todo项的文本内容，排除checkbox
        const textContent = element.textContent?.trim() || '';
        // 移除checkbox符号
        return textContent.replace(/^\s*[\[✓☑️✗✘]\s*/, '').trim();
    }
    
    /**
     * 检查Todo是否已完成
     */
    private isTodoCompleted(element: Element): boolean {
        // 检查data-subtype或者查找checkbox状态
        const checkbox = element.querySelector('input[type="checkbox"]');
        if (checkbox) {
            return (checkbox as HTMLInputElement).checked;
        }
        
        // 通过文本内容判断
        const text = element.textContent || '';
        return /^\s*[\[✓☑️\]|\[x\]]/.test(text);
    }
}
