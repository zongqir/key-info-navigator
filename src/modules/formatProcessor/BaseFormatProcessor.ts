import { IFormatProcessor, TextFormatType, FormattedTextItem, FormatConfig } from './interfaces';

/**
 * 抽象格式处理器基类
 */
export abstract class BaseFormatProcessor implements IFormatProcessor {
    public abstract readonly formatType: TextFormatType;
    
    protected abstract readonly config: FormatConfig;
    
    constructor(protected logger?: (...args: any[]) => void) {}
    
    /**
     * 获取格式配置
     */
    public getConfig(): FormatConfig {
        return this.config;
    }
    
    /**
     * 从Span数据中提取格式文本
     */
    public extractFromSpan(span: any, blockId?: string): FormattedTextItem[] {
        if (!this.isValidSpan(span)) {
            return [];
        }
        
        const id = this.generateId('span', span.id || span.block_id);
        const item: FormattedTextItem = {
            id,
            text: this.cleanText(span.content),
            type: this.formatType,
            blockId: blockId || span.block_id || span.root_id,
            position: this.parsePosition(span.start_offset),
            context: this.extractContext(span),
            icon: this.config.icon,
            color: this.config.color,
        };
        
        return [item];
    }
    
    /**
     * 从HTML中提取格式文本
     */
    public extractFromHTML(html: string, blockId: string): FormattedTextItem[] {
        try {
            const doc = new DOMParser().parseFromString(html, "text/html");
            const elements = doc.querySelectorAll(this.config.htmlSelectors.join(","));
            
            return Array.from(elements)
                .map((el, index) => this.createItemFromElement(el, blockId, index))
                .filter((item): item is FormattedTextItem => item !== null);
        } catch (error) {
            this.log('HTML解析错误:', error);
            return [];
        }
    }
    
    /**
     * 验证文本是否匹配该格式
     */
    public matches(text: string): boolean {
        return this.config.kramdownRegex.test(text);
    }
    
    /**
     * 验证Span是否有效
     */
    protected isValidSpan(span: any): boolean {
        if (!span || !span.content) return false;
        return this.config.sqlType.includes(span.type) && 
               !!this.cleanText(span.content);
    }
    
    /**
     * 从DOM元素创建格式文本项
     */
    protected createItemFromElement(el: Element, blockId: string, index: number): FormattedTextItem | null {
        const text = this.cleanText(el.textContent || '');
        if (!text) return null;
        
        // 计算元素在文档中的真实位置
        const documentPosition = this.getElementDocumentPosition(el);
        
        const id = this.generateId('html', `${blockId}_${index}`);
        return {
            id,
            text,
            type: this.formatType,
            blockId,
            position: documentPosition, // 使用真实的文档位置
            context: this.getElementContext(el),
            icon: this.config.icon,
            color: this.config.color,
        };
    }
    
    /**
     * 计算元素在文档中的位置（使用简单的DOM遍历方法）
     */
    protected getElementDocumentPosition(element: Element): number {
        try {
            // 使用 compareDocumentPosition 来确定相对位置
            const container = element.ownerDocument.body || element.ownerDocument.documentElement;
            if (!container) return 0;
            
            // 获取容器中的所有元素
            const allElements = container.querySelectorAll('*');
            
            // 找到当前元素在所有元素中的索引
            for (let i = 0; i < allElements.length; i++) {
                if (allElements[i] === element) {
                    return i;
                }
            }
            
            return 0;
        } catch (error) {
            // 如果计算失败，回退到使用时间戳
            this.log('计算文档位置失败，使用时间戳:', error);
            return Date.now() % 100000; // 使用时间戳作为位置，确保顺序
        }
    }
    
    /**
     * 清理文本
     */
    protected cleanText(text: string): string {
        return text.trim().replace(/\s+/g, ' ');
    }
    
    /**
     * 解析位置
     */
    protected parsePosition(offset: string | number): number {
        return typeof offset === 'string' ? parseInt(offset, 10) || 0 : offset || 0;
    }
    
    /**
     * 提取上下文
     */
    protected extractContext(span: any): string {
        return span.markdown || span.content || '';
    }
    
    /**
     * 获取元素上下文
     */
    protected getElementContext(el: Element): string {
        const parent = el.parentElement;
        if (!parent) return el.textContent?.trim() || '';
        
        const parentText = parent.textContent?.trim() || '';
        return parentText.length > 100 ? parentText.substring(0, 100) + '...' : parentText;
    }
    
    /**
     * 生成唯一ID
     */
    protected generateId(source: string, identifier: string): string {
        return `${this.formatType}_${source}_${identifier}`;
    }
    
    /**
     * 是否支持添加备注功能（默认支持）
     */
    public supportAddMemo(): boolean {
        return true;
    }
    
    /**
     * 渲染操作按钮
     */
    public renderActionButtons(item: FormattedTextItem, i18n?: any): string {
        if (!this.supportAddMemo()) {
            return '';
        }
        
        const title = i18n?.addMemo || '添加备注';
        
        return `
            <button class="formatted-text-dock__action-btn formatted-text-dock__add-memo-btn" 
                    data-block-id="${item.blockId}"
                    data-text="${item.text}"
                    data-action="add-memo"
                    title="${title}">
                <svg class="formatted-text-dock__action-icon">
                    <use xlink:href="#iconMessage"></use>
                </svg>
            </button>
        `;
    }
    
    /**
     * 日志输出
     */
    protected log(...args: any[]): void {
        if (this.logger) {
            this.logger(`[${this.formatType}]`, ...args);
        }
    }
}
