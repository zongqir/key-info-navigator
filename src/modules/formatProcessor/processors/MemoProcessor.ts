import { BaseFormatProcessor } from '../BaseFormatProcessor';
import { TextFormatType, FormatConfig, FormattedTextItem, DisplayMode } from '../interfaces';

/**
 * 备注格式处理器
 */
export class MemoProcessor extends BaseFormatProcessor {
    public readonly formatType = TextFormatType.MEMO;
    
    protected readonly config: FormatConfig = {
        sqlType: ["inline-memo"],
        htmlSelectors: ["span[data-type*='inline-memo']"],
        kramdownRegex: /\(\((.+?)\)\)/g, // 备注的Kramdown格式 ((文本))
        icon: "iconMessage",
        color: "#ff9800",
        displayMode: DisplayMode.CUSTOM, // 自定义模式，使用特殊的备注显示逻辑
    };

    /**
     * 从Span数据中提取备注文本
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
            memoContent: span.memo_content || span.content, // 备注内容
        };
        
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
            
            elements.forEach((el, index) => {
                const memoItem = this.createMemoItemFromElement(el, blockId, index);
                if (memoItem) {
                    items.push(memoItem);
                }
            });
            
            // 合并相邻的相同备注
            return this.mergeSimilarMemos(items);
            
        } catch (error) {
            this.log('HTML解析错误:', error);
            return [];
        }
    }

    /**
     * 从DOM元素创建备注项
     */
    private createMemoItemFromElement(el: Element, blockId: string, index: number): FormattedTextItem | null {
        const text = this.cleanText(el.textContent || '');
        if (!text) return null;
        
        // 获取备注内容
        const memoContent = el.getAttribute("data-inline-memo-content") || text;
        
        const id = this.generateId('html', `${blockId}_${index}`);
        return {
            id,
            text,
            type: this.formatType,
            blockId,
            position: index,
            context: this.getElementContext(el),
            icon: this.config.icon,
            color: this.config.color,
            memoContent: memoContent,
            element: el as HTMLElement, // 保存DOM元素引用用于精确定位
        };
    }

    /**
     * 合并相邻的相同备注（思源的特殊处理）
     */
    private mergeSimilarMemos(memos: FormattedTextItem[]): FormattedTextItem[] {
        if (memos.length <= 1) return memos;

        const merged: FormattedTextItem[] = [];
        
        memos.forEach((memo, index) => {
            if (index === 0) {
                // 第一个备注直接添加
                merged.push({
                    ...memo,
                    text: memo.text, // 保持原始文本
                });
            } else {
                const lastMerged = merged[merged.length - 1];
                const lastElement = lastMerged.element;
                const currentElement = memo.element;
                
                // 检查是否需要合并：相邻 + 同块 + 同内容
                const isAdjacent = this.isAdjacentElements(lastElement, currentElement);
                const sameBlock = lastMerged.blockId === memo.blockId;
                const sameContent = lastMerged.memoContent === memo.memoContent;
                
                if (isAdjacent && sameBlock && sameContent) {
                    // 合并到上一个
                    lastMerged.text += memo.text;
                    this.log(`合并备注: "${lastMerged.text}" + "${memo.text}"`);
                } else {
                    // 创建新的备注项
                    merged.push({
                        ...memo,
                        text: memo.text,
                    });
                }
            }
        });
        
        this.log(`备注合并完成: ${memos.length} -> ${merged.length}`);
        return merged;
    }

    /**
     * 检查两个元素是否相邻
     */
    private isAdjacentElements(elem1?: HTMLElement, elem2?: HTMLElement): boolean {
        if (!elem1 || !elem2) return false;
        
        // 检查是否为相邻的兄弟节点
        return elem1.nextSibling === elem2 || 
               elem1.nextElementSibling === elem2;
    }

    /**
     * 获取当前页面的所有备注（实时提取）
     */
    public getAllMemosFromPage(mainNode?: HTMLElement): FormattedTextItem[] {
        const container = mainNode || document.querySelector("div.protyle-wysiwyg") as HTMLElement;
        if (!container) {
            this.log('未找到编辑器容器');
            return [];
        }

        this.log('开始从页面提取备注...');
        
        // 查找所有备注元素
        const memoElements = container.querySelectorAll(this.config.htmlSelectors.join(","));
        this.log(`找到 ${memoElements.length} 个备注元素`);
        
        const memos: FormattedTextItem[] = [];
        
        memoElements.forEach((element, index) => {
            const blockElement = this.findParentBlock(element as HTMLElement);
            const blockId = blockElement?.dataset.nodeId || 'unknown';
            
            const memo: FormattedTextItem = {
                id: this.generateId('page', `${blockId}_${index}`),
                text: this.cleanText(element.textContent || ''),
                type: this.formatType,
                blockId: blockId,
                position: index,
                context: this.getElementContext(element),
                icon: this.config.icon,
                color: this.config.color,
                memoContent: element.getAttribute("data-inline-memo-content") || element.textContent || '',
                element: element as HTMLElement,
            };
            
            if (memo.text) {
                memos.push(memo);
            }
        });
        
        this.log(`提取到 ${memos.length} 个有效备注`);
        
        // 合并相似备注
        return this.mergeSimilarMemos(memos);
    }

    /**
     * 查找备注所在的块元素
     */
    private findParentBlock(memoElement: HTMLElement): HTMLElement | null {
        let current = memoElement;
        
        // 向上遍历，直到找到有 data-node-id 的元素
        while (current && current.parentElement) {
            if (current.dataset.nodeId) {
                return current;
            }
            current = current.parentElement;
        }
        
        return null;
    }

    /**
     * 按块分组备注
     */
    public groupMemosByBlock(memos: FormattedTextItem[]): Map<string, FormattedTextItem[]> {
        const groups = new Map<string, FormattedTextItem[]>();
        
        memos.forEach(memo => {
            const blockId = memo.blockId;
            if (!groups.has(blockId)) {
                groups.set(blockId, []);
            }
            groups.get(blockId)!.push(memo);
        });
        
        this.log(`备注分组完成: ${groups.size} 个块`);
        return groups;
    }

    /**
     * 查找包含特定内容的备注
     */
    public findMemosByContent(searchText: string, memos: FormattedTextItem[]): FormattedTextItem[] {
        return memos.filter(memo => 
            (memo.memoContent && memo.memoContent.includes(searchText)) || 
            memo.text.includes(searchText)
        );
    }

    /**
     * 自定义渲染备注详细内容
     */
    public renderItemDetails(item: FormattedTextItem, displayText: string): string {
        if (!item.memoContent) {
            return '';
        }

        // 转义HTML的简单函数
        const escapeHtml = (text: string): string => {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        };

        // 截断文本的简单函数  
        const truncateText = (text: string, maxLength: number): string => {
            return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
        };

        return `
            <div class="formatted-text-dock__item-memo">
                <div class="formatted-text-dock__item-memo-target">
                    ${escapeHtml(displayText)}
                </div>
                <div class="formatted-text-dock__item-memo-content">
                    ${escapeHtml(truncateText(item.memoContent, 150))}
                </div>
            </div>
        `;
    }
}
