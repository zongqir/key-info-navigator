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
     * 自定义渲染主要内容（可选，子类可重写）
     */
    public renderMainContent?(item: FormattedTextItem): string;

    /**
     * 渲染操作按钮
     */
    public renderActionButtons(item: FormattedTextItem, i18n?: any): string {
        const buttons: string[] = [];
        
        // 删除格式化按钮（所有类型都支持）
        const deleteTitle = i18n?.removeFormat || '删除格式';
        buttons.push(`
            <button class="formatted-text-dock__action-btn formatted-text-dock__remove-format-btn" 
                    data-block-id="${item.blockId}"
                    data-text="${item.text}"
                    data-type="${item.type}"
                    data-position="${item.position}"
                    data-action="remove-format"
                    title="${deleteTitle}">
                <svg class="formatted-text-dock__action-icon">
                    <use xlink:href="#iconTrashcan"></use>
                </svg>
            </button>
        `);
        
        // 添加备注按钮（只有支持的类型才显示）
        if (this.supportAddMemo()) {
            const addMemoTitle = i18n?.addMemo || '添加备注';
            buttons.push(`
                <button class="formatted-text-dock__action-btn formatted-text-dock__add-memo-btn" 
                        data-block-id="${item.blockId}"
                        data-text="${item.text}"
                        data-action="add-memo"
                        title="${addMemoTitle}">
                    <span style="font-size: 12px;">💭</span>
                </button>
            `);
        }
        
        return buttons.join('');
    }
    
    /**
     * 删除格式化，保留纯文本
     */
    public async removeFormatting(text: string, blockId: string, itemIndex?: number): Promise<boolean> {
        try {
            this.log(`开始删除格式化: "${text}", 块ID: ${blockId}, 索引: ${itemIndex}`);
            
            // 查找目标元素
            const targetElements = this.findFormattedElements(text, itemIndex);
            if (targetElements.length === 0) {
                this.log('未找到目标格式化元素');
                return false;
            }
            
            // 删除格式化
            let success = false;
            for (const element of targetElements) {
                if (this.removeElementFormatting(element, text)) {
                    success = true;
                }
            }
            
            if (success) {
                this.log('格式化删除成功');
                // 触发文档更新
                await this.updateDocumentContent();
            }
            
            return success;
            
        } catch (error) {
            this.log('删除格式化失败:', error);
            return false;
        }
    }
    
    /**
     * 查找格式化元素
     */
    protected findFormattedElements(text: string, itemIndex?: number): HTMLElement[] {
        const selectors = this.config.htmlSelectors.join(',');
        const allElements = Array.from(document.querySelectorAll(selectors)) as HTMLElement[];
        
        // 过滤出文本匹配的元素
        const matchingElements = allElements.filter(el => 
            el.textContent?.trim() === text
        );
        
        // 如果指定了索引，返回对应的元素
        if (itemIndex !== undefined && itemIndex < matchingElements.length) {
            return [matchingElements[itemIndex]];
        }
        
        // 否则返回所有匹配的元素
        return matchingElements;
    }
    
    /**
     * 删除元素的格式化
     */
    protected removeElementFormatting(element: HTMLElement, text: string): boolean {
        try {
            // 创建纯文本节点
            const textNode = document.createTextNode(text);
            
            // 替换格式化元素为纯文本
            element.parentNode?.replaceChild(textNode, element);
            
            this.log(`成功将格式化元素替换为纯文本: "${text}"`);
            return true;
            
        } catch (error) {
            this.log('删除元素格式化失败:', error);
            return false;
        }
    }
    
    /**
     * 更新文档内容到后端
     */
    protected async updateDocumentContent(): Promise<void> {
        try {
            // 这里需要导入 fetchPost，先暂时留空，在具体实现中处理
            // 或者通过回调函数的方式让调用方处理
            this.log('文档内容已更新（需要在具体实现中处理后端同步）');
        } catch (error) {
            this.log('更新文档内容失败:', error);
        }
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
