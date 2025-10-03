import { BaseFormatProcessor } from '../BaseFormatProcessor';
import { TextFormatType, FormatConfig, FormattedTextItem, DisplayMode } from '../interfaces';

/**
 * 备注格式处理器 - 重构版本
 * 
 * 思源笔记的备注格式：划线文本(备注内容)
 * - 外面是被标记的文本（显示为划线）
 * - 括号内是备注/评论内容
 */
export class MemoProcessor extends BaseFormatProcessor {
    public readonly formatType = TextFormatType.MEMO;
    
    protected readonly config: FormatConfig = {
        sqlType: ["inline-memo"],
        htmlSelectors: ["span[data-type='inline-memo']", "span[data-inline-memo-content]"],
        kramdownRegex: /(.+?)\((.+?)\)/g, // 匹配：划线文本(备注内容)
        icon: "iconMessage",
        color: "#8250df", // 现代简约紫色
        displayMode: DisplayMode.CUSTOM
    };

    /**
     * 从Span数据中提取备注文本
     */
    public extractFromSpan(span: any, blockId?: string): FormattedTextItem[] {
        if (!this.isValidSpan(span)) {
            return [];
        }
        
        this.log('提取备注span数据:', span);
        
        // 从 markdown 中提取被标记的文本（括号外的部分）
        let markedText = '';
        if (span.markdown) {
            // 尝试多种格式提取被标记文本
            let match = span.markdown.match(/^(.+?)<sup>/);  // 格式1：xxx<sup>
            if (match) {
                markedText = this.cleanText(match[1]);
            } else {
                // 格式2：xxx（yyy） 或 xxx(yyy) - 提取括号前的内容
                match = span.markdown.match(/^(.+?)[（(]/);
                if (match) {
                    markedText = this.cleanText(match[1]);
                } else {
                    markedText = this.cleanText(span.content || '');
                }
            }
        } else {
            markedText = this.cleanText(span.content || '');
        }
        
        // 备注内容可能在不同的字段中
        const memoContent = this.extractMemoContent(span);
        
        if (!markedText) {
            this.log('跳过空的标记文本');
            return [];
        }
        
        const id = this.generateId('span', span.id || span.block_id);
        const item: FormattedTextItem = {
            id,
            text: markedText, // 显示被标记的文本
            type: this.formatType,
            blockId: blockId || span.block_id || span.root_id,
            position: this.parsePosition(span.start_offset),
            context: this.extractContext(span),
            icon: this.config.icon,
            color: this.config.color,
            memoContent: memoContent, // 备注内容
            metadata: {
                originalSpan: span,
                markedText: markedText,
                memoText: memoContent
            }
        };
        
        this.log('创建备注项:', item);
        return [item];
    }

    /**
     * 从HTML中提取备注文本
     */
    public extractFromHTML(html: string, blockId: string): FormattedTextItem[] {
        try {
            const doc = new DOMParser().parseFromString(html, "text/html");
            const elements = doc.querySelectorAll(this.config.htmlSelectors.join(","));
            
            const items: FormattedTextItem[] = [];
            
            elements.forEach((element, index) => {
                const markedText = this.cleanText(element.textContent || '');
                if (!markedText) return;
                
                // 从DOM元素获取备注内容
                const memoContent = this.extractMemoContentFromElement(element);
                
                const item: FormattedTextItem = {
                    id: this.generateId('html', `${blockId}_${index}`),
                    text: markedText, // 显示被标记的文本
                    type: this.formatType,
                    blockId: blockId,
                    position: index,
                    context: this.getElementContext(element),
                    icon: this.config.icon,
                    color: this.config.color,
                    memoContent: memoContent, // 备注内容
                    metadata: {
                        markedText: markedText,
                        memoText: memoContent
                    }
                };
                
                items.push(item);
                this.log('从HTML提取备注项:', item);
            });
            
            return items;
            
        } catch (error) {
            this.log('HTML解析错误:', error);
            return [];
        }
    }

    /**
     * 从span数据中提取备注内容
     */
    private extractMemoContent(span: any): string {
        // 优先从 markdown 字段提取（格式：划线文本(备注内容)）
        if (span.markdown) {
            const extracted = this.extractMemoFromMarkdown(span.markdown);
            if (extracted) {
                return extracted;
            }
        }
        
        // 备用方案：尝试其他字段
        const memoContent = span.memo_content || 
               span.memo || 
               span['inline-memo-content'] || 
               span.attrs?.memo || 
               span.attrs?.['memo-content'] ||
               this.extractMemoFromMarkdown(span.content || '') ||
               '';
        
        return memoContent;
    }

    /**
     * 从DOM元素中提取备注内容
     */
    private extractMemoContentFromElement(element: Element): string {
        // 从data属性获取备注内容
        return element.getAttribute('data-inline-memo-content') ||
               element.getAttribute('data-memo-content') ||
               element.getAttribute('data-memo') ||
               element.getAttribute('title') ||
               this.extractMemoFromText(element.textContent || '') ||
               '';
    }

    /**
     * 从Markdown文本中提取备注内容
     * 支持多种格式：
     * 1. 标准格式：划线文本<sup>(备注内容)</sup>
     * 2. 中文括号：划线文本（备注内容）
     * 3. 英文括号：划线文本(备注内容)
     */
    private extractMemoFromMarkdown(markdown: string): string {
        // 格式1：fwefwefwe<sup>(fwefewfwe)</sup> - 标准格式
        let match = markdown.match(/<sup>\((.+?)\)<\/sup>/);
        if (match) return match[1];
        
        // 格式2：fwefwefwe<sup>（fwefewfwe）</sup> - 中文括号带sup标签
        match = markdown.match(/<sup>（(.+?)）<\/sup>/);
        if (match) return match[1];
        
        // 格式3：fwefwefwe（fwefewfwe） - 纯中文括号
        match = markdown.match(/(.+?)（(.+?)）$/);
        if (match) return match[2];
        
        // 格式4：fwefwefwe(fwefewfwe) - 纯英文括号
        match = markdown.match(/(.+?)\((.+?)\)$/);
        if (match) return match[2];
        
        return '';
    }

    /**
     * 从文本中提取备注内容（如果格式包含括号）
     * 支持中文括号（）和英文括号()
     */
    private extractMemoFromText(text: string): string {
        // 优先匹配中文括号
        let match = text.match(/(.+?)（(.+?)）$/);
        if (match) return match[2];
        
        // 匹配英文括号
        match = text.match(/(.+?)\((.+?)\)$/);
        return match ? match[2] : '';
    }

    /**
     * 自定义渲染主要内容 - 第一行：只显示被标记的文本
     */
    public renderMainContent(item: FormattedTextItem): string {
        const markedText = item.text;
        
        // 第一行只显示被标记的文本（带下划线样式）
        return `<span class="formatted-text-dock__memo-marked-text">${this.escapeHtml(markedText)}</span>`;
    }

    /**
     * 自定义渲染详细内容 - 第二行：显示备注卡片
     */
    public renderItemDetails(item: FormattedTextItem, displayText: string): string {
        const memoContent = item.memoContent || '';
        
        if (!memoContent) {
            return ''; // 没有备注内容就不显示第二行
        }
        
        // 第二行显示备注内容卡片
        return `
            <div class="formatted-text-dock__item-memo">
                <div class="formatted-text-dock__item-memo-content">${this.escapeHtml(memoContent)}</div>
            </div>
        `;
    }

    /**
     * 是否支持添加备注功能（备注本身可以添加额外备注）
     */
    public supportAddMemo(): boolean {
        return true;
    }

    /**
     * 删除备注格式化，保留被标记的文本
     */
    public async removeFormatting(text: string, blockId: string, itemIndex?: number): Promise<boolean> {
        try {
            this.log(`开始删除备注格式化: "${text}", 块ID: ${blockId}`);
            
            // 查找备注元素
            const memoElements = this.findFormattedElements(text, itemIndex);
            
            if (memoElements.length === 0) {
                this.log('未找到目标备注元素');
                return false;
            }
            
            // 删除备注格式化，保留被标记的文本
            let success = false;
            for (const element of memoElements) {
                if (this.removeElementFormatting(element, text)) {
                    success = true;
                }
            }
            
            if (success) {
                this.log('备注格式删除成功');
                await this.updateDocumentContent();
            }
            
            return success;
            
        } catch (error) {
            this.log('删除备注格式化失败:', error);
            return false;
        }
    }

    /**
     * 转义HTML
     */
    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 验证span是否为有效的备注span
     */
    protected isValidSpan(span: any): boolean {
        if (!span || !span.content) return false;
        
        // 修复：span.type 是 "textmark inline-memo" 格式，需要部分匹配
        const isCorrectType = this.config.sqlType.some(sqlType => {
            // 完整匹配
            if (span.type === sqlType) return true;
            // 或者按空格分割后匹配
            const spanTypeParts = span.type.split(' ');
            return spanTypeParts.includes(sqlType);
        });
        
        // 检查是否有有效的文本内容
        const hasValidContent = !!this.cleanText(span.content);
        
        return isCorrectType && hasValidContent;
    }
}
