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
     * 从Span数据中提取备注文本 - 自定义模式
     */
    public extractFromSpan(span: any, blockId?: string): FormattedTextItem[] {
        if (!this.isValidSpan(span)) {
            return [];
        }
        
        this.log('提取备注span数据:', span);
        
        // 获取基础数据
        const content = span.content || '';
        const markdown = span.markdown || '';
        
        this.log('基础数据 - content:', content, 'markdown:', markdown);
        
        // 自定义备注提取逻辑
        let markedText = '';
        let memoContent = '';
        
        this.log('🔍 开始备注提取逻辑...');
        
        if (content && markdown) {
            this.log('✅ 同时具备content和markdown，开始自定义提取');
            
            // 从markdown中提取从content第一个字符开始，到")"结束的完整部分
            const firstChar = content.charAt(0);
            this.log('📍 content第一个字符:', JSON.stringify(firstChar));
            
            if (firstChar) {
                // 在markdown中找到content开始的位置
                const contentStartIndex = markdown.indexOf(firstChar);
                this.log('🔎 在markdown中查找第一个字符的位置:', contentStartIndex);
                this.log('📝 markdown完整内容:', JSON.stringify(markdown));
                
                if (contentStartIndex !== -1) {
                    // 从该位置开始，查找最后一个括号（优先英文，后备中文）
                    let parenIndex = markdown.lastIndexOf(')');
                    
                    // 如果没找到英文括号，尝试中文括号
                    if (parenIndex === -1) {
                        parenIndex = markdown.lastIndexOf('）');
                    }
                    
                    this.log('🔍 从位置', contentStartIndex, '开始查找")"的位置:', parenIndex);
                    
                    if (parenIndex !== -1) {
                        // 提取从第一个字符到括号的完整部分
                        let extractedText = markdown.substring(contentStartIndex, parenIndex + 1);
                        this.log('✂️ 从markdown提取的完整文本:', JSON.stringify(extractedText));
                        
                        // 如果是中文括号，转换为英文括号进行处理
                        if (extractedText.includes('）')) {
                            extractedText = extractedText.replace(/（/g, '(').replace(/）/g, ')');
                            this.log('🔄 转换中文括号为英文括号:', JSON.stringify(extractedText));
                        }
                        
                        // 解析被标记文本和备注内容
                        const parsedResult = this.parseExtractedText(extractedText);
                        this.log('🔧 parseExtractedText解析结果:', parsedResult);
                        
                        if (parsedResult) {
                            // 从content第一个字符开始，不包含前面的markdown格式符号，只去掉HTML标签
                            const cleanedMarkedText = this.removeHtmlTags(parsedResult.markedText);
                            markedText = cleanedMarkedText;
                            memoContent = parsedResult.memoContent;
                            
                            this.log('🎯 最终提取结果:');
                            this.log('  - 被标记文本(从content第一个字符开始,去HTML):', JSON.stringify(markedText));
                            this.log('  - 备注内容:', JSON.stringify(memoContent));
                        } else {
                            // 解析失败，使用整个markdown作为被标记文本
                            this.log('❌ parseExtractedText解析失败，使用整个markdown');
                            markedText = this.removeHtmlTags(markdown);
                        }
                    } else {
                        // 如果没有找到任何括号，使用整个markdown作为被标记文本
                        this.log('❌ 未找到任何括号，使用整个markdown作为被标记文本');
                        markedText = this.removeHtmlTags(markdown);
                    }
                } else {
                    // 如果在markdown中找不到content的开始，直接使用markdown
                    this.log('❌ 在markdown中找不到content的第一个字符，使用整个markdown');
                    markedText = markdown;
                }
            } else {
                this.log('❌ content第一个字符为空，使用markdown或content');
                markedText = markdown || content;
            }
        } else {
            // 如果缺少基础数据，优先使用markdown
            this.log('❌ 缺少content或markdown，使用后备方案');
            this.log('  - content存在:', !!content);
            this.log('  - markdown存在:', !!markdown);
            markedText = markdown || content;
        }
        
        this.log('🏁 备注提取逻辑完成，最终markedText:', JSON.stringify(markedText), 'memoContent:', JSON.stringify(memoContent));
        
        // 清理文本
        const cleanedMarkedText = this.cleanText(markedText);
        
        if (!cleanedMarkedText) {
            this.log('跳过空的标记文本');
            return [];
        }
        
        const id = this.generateId('span', span.id || span.block_id);
        const item: FormattedTextItem = {
            id,
            text: cleanedMarkedText, // 显示从markdown提取的被标记文本（保留格式）
            type: this.formatType,
            blockId: blockId || span.block_id || span.root_id,
            position: this.parsePosition(span.start_offset),
            context: this.extractContext(span),
            icon: this.config.icon,
            color: this.config.color,
            memoContent: memoContent, // 备注内容
            metadata: {
                originalSpan: span,
                markedText: cleanedMarkedText,
                memoText: memoContent,
                originalMarkdown: markdown
            }
        };
        
        this.log('创建备注项:', item);
        return [item];
    }

    /**
     * 解析提取的文本，分离被标记文本和备注内容
     * 例如："a123(456)" -> { markedText: "a123", memoContent: "456" }
     */
    private parseExtractedText(extractedText: string): { markedText: string, memoContent: string } | null {
        this.log('🔧 parseExtractedText开始解析:', JSON.stringify(extractedText));
        
        // 只处理英文括号格式：被标记文本(备注内容)
        // 支持HTML标签格式：被标记文本<sup>(备注内容)</sup>
        
        // 格式1：HTML sup标签格式（英文括号）
        let match = extractedText.match(/^(.+?)<sup>\((.+?)\)<\/sup>$/);
        if (match) {
            const markedText = match[1].trim();
            const memoContent = match[2].trim();
            this.log('✅ 匹配HTML sup英文括号格式成功:');
            this.log('  - 被标记文本:', JSON.stringify(markedText));
            this.log('  - 备注内容:', JSON.stringify(memoContent));
            return { markedText, memoContent };
        }
        
        // 格式2：纯英文括号
        match = extractedText.match(/^(.+?)\((.+?)\)$/);
        if (match) {
            const markedText = match[1].trim();
            const memoContent = match[2].trim();
            this.log('✅ 匹配英文括号格式成功:');
            this.log('  - 被标记文本:', JSON.stringify(markedText));
            this.log('  - 备注内容:', JSON.stringify(memoContent));
            return { markedText, memoContent };
        }
        
        // 如果不匹配任何括号格式，整个文本作为被标记文本
        this.log('❌ 未匹配到任何括号格式，使用整个文本作为被标记文本');
        this.log('  - 尝试的正则表达式:');
        this.log('    1. /^(.+?)<sup>\\((.+?)\\)<\\/sup>$/ (HTML sup英文括号)');
        this.log('    2. /^(.+?)\\((.+?)\\)$/ (纯英文括号)');
        return { markedText: extractedText, memoContent: '' };
    }

    /**
     * 去掉HTML标签，只保留文本内容
     */
    private removeHtmlTags(text: string): string {
        // 去掉HTML标签，但保留markdown格式符号如**
        return text.replace(/<[^>]*>/g, '');
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
