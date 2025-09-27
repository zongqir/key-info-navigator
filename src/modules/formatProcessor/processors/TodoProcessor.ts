import { BaseFormatProcessor } from '../BaseFormatProcessor';
import { TextFormatType, FormattedTextItem, FormatConfig, DisplayMode } from '../interfaces';
import { fetchPost } from 'siyuan';

/**
 * Todo块处理器
 */
export class TodoProcessor extends BaseFormatProcessor {
    public readonly formatType = TextFormatType.TODO;
    
    protected readonly config: FormatConfig = {
        sqlType: [], // Todo块通过blocks表查询，不使用spans
        htmlSelectors: ["div[data-subtype='t']", "li[data-subtype='t']"],
        kramdownRegex: /^\s*[-*+]\s*\[[ x]\]/m,
        icon: "iconStop",
        color: "#dc2626",
        displayMode: DisplayMode.CUSTOM
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
    extractFromBlock(block: any, blockIndex?: number): FormattedTextItem[] {
        this.log('🔍 [TodoProcessor] extractFromBlock 被调用，block:', block, 'blockIndex:', blockIndex);
        
        const items: FormattedTextItem[] = [];
        
        if (block && block.subtype === 't') {
            this.log('✅ [TodoProcessor] 发现todo块，开始提取数据');
            
            const content = this.extractTodoContent(block.content || "");
            const isCompleted = this.isTodoCompleted(block.content || "");
            
            this.log('📝 [TodoProcessor] 提取到的内容:', content);
            this.log('☑️ [TodoProcessor] 完成状态:', isCompleted);
            this.log('📄 [TodoProcessor] 原始内容:', block.content);
            
            // 使用块在文档中的位置
            const position = blockIndex !== undefined ? blockIndex : 0;
            
            const item = {
                id: `todo_${block.id}`,
                text: content,
                type: this.formatType,
                blockId: block.id,
                position: position,
                context: this.truncateText(content, 80),
                icon: isCompleted ? "iconStop" : "iconStop",
                color: isCompleted ? "#dc2626" : "#dc2626",
                metadata: { 
                    isCompleted: isCompleted,
                    originalContent: block.content || ""
                }
            };
            
            this.log('🎯 [TodoProcessor] 创建的todo项:', item);
            items.push(item);
        } else {
            this.log('❌ [TodoProcessor] 不是todo块或块为空，跳过');
        }
        
        this.log('🔄 [TodoProcessor] extractFromBlock 完成，返回', items.length, '个项目');
        return items;
    }
    
    private truncateText(text: string, maxLength: number): string {
        if (text.length <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength) + '...';
    }
    
    extractFromHTML(html: string, blockId: string): FormattedTextItem[] {
        this.log('🔍 [TodoProcessor] extractFromHTML 被调用，html长度:', html.length, 'blockId:', blockId);
        
        const items: FormattedTextItem[] = [];
        const config = this.getConfig();
        
        this.log('🔍 [TodoProcessor] HTML选择器:', config.htmlSelectors);
        
        // 查找Todo元素
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        config.htmlSelectors.forEach((selector, selectorIndex) => {
            this.log(`🔍 [TodoProcessor] 使用选择器${selectorIndex + 1}: "${selector}"`);
            const todoElements = doc.querySelectorAll(selector);
            this.log(`✅ [TodoProcessor] 找到 ${todoElements.length} 个todo元素`);
            
            todoElements.forEach((element, index) => {
                this.log(`📋 [TodoProcessor] 处理第${index + 1}个todo元素:`, element);
                
                const text = this.extractTodoText(element);
                this.log('📝 [TodoProcessor] 提取的文本:', text);
                
                if (text) {
                    this.log('🔍 [TodoProcessor] 开始检测Todo完成状态...');
                    const isCompleted = this.isTodoCompleted(element);
                    this.log('☑️ [TodoProcessor] 最终检测结果 - 完成状态:', isCompleted);
                    this.log('🎯 [TodoProcessor] 检测的元素HTML:', element.outerHTML.substring(0, 300) + '...');
                    
                    // 查找TODO所在的具体段落ID
                    let actualBlockId = blockId; // 默认使用传入的blockId
                    let currentElement = element.parentElement;
                    
                    this.log('🔍 [TodoProcessor] 开始查找实际的段落ID，当前blockId:', blockId);
                    
                    // 向上查找，寻找具有data-node-id的元素（这才是真正的段落ID）
                    while (currentElement) {
                        const nodeId = currentElement.getAttribute('data-node-id');
                        if (nodeId && nodeId !== blockId) {
                            // 找到了不同于根ID的段落ID
                            actualBlockId = nodeId;
                            this.log('✅ [TodoProcessor] 找到实际段落ID:', actualBlockId);
                            break;
                        }
                        currentElement = currentElement.parentElement;
                    }
                    
                    const todoItem = {
                        id: this.generateId('html', `${actualBlockId}_${index}`),
                        text: text,
                        type: this.formatType,
                        blockId: actualBlockId, // 使用真实的段落ID
                        position: index,
                        context: element.parentElement?.textContent || "",
                        icon: isCompleted ? "iconStop" : "iconStop",
                        color: isCompleted ? "#dc2626" : "#dc2626",
                        metadata: { 
                            isCompleted: isCompleted,
                            originalContent: element.outerHTML || ""
                        }
                        // 不设置element属性，让导航器使用块ID导航
                        // element: element as HTMLElement
                    };
                    
                    this.log('🎯 [TodoProcessor] 创建HTML提取的todo项:');
                    this.log('  - id:', todoItem.id);
                    this.log('  - text:', todoItem.text);
                    this.log('  - blockId:', todoItem.blockId);
                    this.log('  - metadata.isCompleted:', todoItem.metadata.isCompleted);
                    this.log('  - icon:', todoItem.icon);
                    this.log('  - color:', todoItem.color);
                    
                    items.push(todoItem);
                } else {
                    this.log('⚠️ [TodoProcessor] 跳过空文本的todo元素');
                }
            });
        });
        
        this.log('🎉 [TodoProcessor] extractFromHTML 完成，总共', items.length, '个Todo项目');
        return items;
    }
    
    matches(text: string): boolean {
        return this.getConfig().kramdownRegex.test(text);
    }
    
    /**
     * 提取Todo文本内容
     */
    private extractTodoText(element: Element): string {
        this.log('📝 [TodoProcessor] extractTodoText - 元素:', element);
        this.log('📝 [TodoProcessor] extractTodoText - 元素标签:', element.tagName);
        this.log('📝 [TodoProcessor] extractTodoText - 元素属性:', element.attributes);
        
        // 获取Todo项的文本内容，排除checkbox
        const textContent = element.textContent?.trim() || '';
        this.log('📝 [TodoProcessor] extractTodoText - 原始文本:', textContent);
        
        // 移除checkbox符号
        const cleanText = textContent.replace(/^\s*[\[✓☑️✗✘]\s*/, '').trim();
        this.log('📝 [TodoProcessor] extractTodoText - 清理后文本:', cleanText);
        
        return cleanText;
    }
    
    /**
     * 检查Todo是否已完成 (用于DOM元素)
     */
    private isTodoCompleted(element: Element): boolean;
    /**
     * 检查Todo是否已完成 (用于块内容字符串)
     */
    private isTodoCompleted(content: string): boolean;
    /**
     * 检查Todo是否已完成的重载实现
     */
    private isTodoCompleted(input: Element | string): boolean {
        if (typeof input === 'string') {
            this.log('☑️ [TodoProcessor] isTodoCompleted - 字符串输入:', input);
            // 检查块内容字符串中的Todo状态
            // 思源笔记中，completed todo的markdown格式为 [x] 或 [X]
            // 未完成的为 [ ] 
            const isCompleted = /^\s*[-*+]\s*\[x\]/mi.test(input) || /^\s*\[x\]/mi.test(input);
            this.log('☑️ [TodoProcessor] isTodoCompleted - 字符串结果:', isCompleted);
            return isCompleted;
        } else {
            this.log('☑️ [TodoProcessor] isTodoCompleted - DOM元素输入:', input);
            this.log('☑️ [TodoProcessor] isTodoCompleted - DOM元素标签:', input.tagName);
            this.log('☑️ [TodoProcessor] isTodoCompleted - DOM元素类名:', input.className);
            
            // 方法1: 检查思源笔记的特殊类名
            if (input.classList.contains('protyle-task--done')) {
                this.log('✅ [TodoProcessor] isTodoCompleted - 通过类名检测到已完成状态');
                return true;
            }
            
            // 方法2: 检查SVG图标
            const taskIcon = input.querySelector('.protyle-action--task svg use');
            if (taskIcon) {
                const iconHref = taskIcon.getAttribute('xlink:href');
                this.log('☑️ [TodoProcessor] isTodoCompleted - SVG图标href:', iconHref);
                if (iconHref === '#iconCheck') {
                    this.log('✅ [TodoProcessor] isTodoCompleted - 通过SVG图标检测到已完成状态');
                    return true;
                }
                if (iconHref === '#iconUncheck') {
                    this.log('❌ [TodoProcessor] isTodoCompleted - 通过SVG图标检测到未完成状态');
                    return false;
                }
            }
            
            // 方法3: 检查原生checkbox
            const checkbox = input.querySelector('input[type="checkbox"]');
            this.log('☑️ [TodoProcessor] isTodoCompleted - 找到的checkbox:', checkbox);
            
        if (checkbox) {
                const isChecked = (checkbox as HTMLInputElement).checked;
                this.log('☑️ [TodoProcessor] isTodoCompleted - checkbox状态:', isChecked);
                return isChecked;
            }
            
            // 方法4: 通过文本内容判断
            const text = input.textContent || '';
            this.log('☑️ [TodoProcessor] isTodoCompleted - 元素文本内容:', text);
            const isCompleted = /^\s*[\[✓☑️\]|\[x\]]/.test(text);
            this.log('☑️ [TodoProcessor] isTodoCompleted - 文本匹配结果:', isCompleted);
            
            return isCompleted;
        }
    }
    
    /**
     * 从块内容中提取Todo文本内容
     */
    private extractTodoContent(content: string): string {
        // 移除todo标记，提取纯文本内容
        // 思源笔记的todo格式：* [ ] 文本内容 或 * [x] 文本内容
        return content
            .replace(/^\s*[-*+]\s*\[[ xX]\]\s*/, '') // 移除列表标记和checkbox
            .replace(/^\s*\[[ xX]\]\s*/, '') // 移除单独的checkbox
            .trim();
    }
    
    /**
     * 自定义渲染主要内容 - 显示勾选框和文本
     */
    public renderMainContent(item: FormattedTextItem): string {
        this.log('🎨 [TodoProcessor] renderMainContent 被调用！item:', item);
        this.log('🔍 [TodoProcessor] 检查item类型:', item.type);
        this.log('🔍 [TodoProcessor] 检查displayMode:', this.config.displayMode);
        
        if (!item.metadata) {
            this.log('❌ [TodoProcessor] 没有metadata，返回默认文本:', item.text);
            return `<span class="formatted-text-dock__item-text">${this.escapeHtml(item.text)}</span>`;
        }
        
        const { isCompleted } = item.metadata;
        
        this.log('✅ [TodoProcessor] 开始渲染todo:', item.text, '完成状态:', isCompleted);
        this.log('🎯 [TodoProcessor] blockId:', item.blockId, 'itemId:', item.id);
        
        const checkedAttr = isCompleted ? 'checked="checked"' : '';
        const completedClass = isCompleted ? 'completed' : '';
        
        const result = `
            <div class="formatted-text-dock__item-todo-inline">
                <div class="formatted-text-dock__todo-checkbox-container">
                    <input type="checkbox" 
                           class="formatted-text-dock__todo-checkbox" 
                           ${checkedAttr}
                           data-block-id="${item.blockId}"
                           data-item-id="${item.id}">
                    <span class="formatted-text-dock__todo-checkbox-custom"></span>
                </div>
                <span class="formatted-text-dock__todo-text ${completedClass}">${this.escapeHtml(item.text)}</span>
            </div>
        `;
        
        this.log('🎨 [TodoProcessor] 渲染参数 - isCompleted:', isCompleted, 'checkedAttr:', checkedAttr, 'completedClass:', completedClass);
        
        this.log('🎨 [TodoProcessor] 生成的HTML:', result);
        return result;
    }

    /**
     * 自定义渲染todo项目详情 - 返回空，因为主要内容已经包含了所有信息
     */
    public renderItemDetails(item: FormattedTextItem, displayText: string): string {
        return ''; // 不需要额外的详情，主要内容已经包含了勾选框+文本
    }
    
    /**
     * 更新Todo的完成状态
     */
    public async updateTodoStatus(blockId: string, completed: boolean): Promise<boolean> {
        try {
            this.log(`🚀 [TodoProcessor] 开始更新Todo状态: 块ID=${blockId}, 完成状态=${completed}`);
            
            // 查找页面中对应的DOM元素
            this.log('🔍 [TodoProcessor] 查找页面中的Todo元素...');
            const todoElement = document.querySelector(`[data-node-id="${blockId}"]`);
            this.log('📍 [TodoProcessor] 找到的Todo元素:', todoElement);
            
            if (!todoElement) {
                this.log('❌ [TodoProcessor] 未找到对应的Todo DOM元素');
                return false;
            }
            
            // 查找todo的checkbox元素
            const checkboxElement = todoElement.querySelector('.protyle-action--task svg use');
            if (!checkboxElement) {
                this.log('❌ [TodoProcessor] 未找到Todo的checkbox元素');
                return false;
            }
            
            // 获取当前状态
            const currentHref = checkboxElement.getAttribute('xlink:href');
            const isCurrentlyCompleted = currentHref === '#iconCheck';
            this.log('📋 [TodoProcessor] 当前状态:', isCurrentlyCompleted ? '已完成' : '未完成');
            
            // 如果状态已经是目标状态，直接返回成功
            if (isCurrentlyCompleted === completed) {
                this.log('✅ [TodoProcessor] 状态已经正确，无需更新');
                return true;
            }
            
            // 生成新的HTML数据
            const newIcon = completed ? 'iconCheck' : 'iconUncheck';
            
            // 克隆当前元素来生成新的HTML
            const clonedElement = todoElement.cloneNode(true) as HTMLElement;
            
            this.log('📋 [TodoProcessor] 克隆元素的原始class:', clonedElement.className);
            this.log('📋 [TodoProcessor] 验证必要属性:');
            this.log('  - data-marker:', clonedElement.getAttribute('data-marker'));
            this.log('  - data-subtype:', clonedElement.getAttribute('data-subtype'));
            this.log('  - data-node-id:', clonedElement.getAttribute('data-node-id'));
            this.log('  - data-type:', clonedElement.getAttribute('data-type'));
            
            // 更新class - 保留原有class，只修改task状态相关的
            if (completed) {
                // 添加完成状态的class
                if (!clonedElement.classList.contains('protyle-task--done')) {
                    clonedElement.classList.add('protyle-task--done');
                }
            } else {
                // 移除完成状态的class
                if (clonedElement.classList.contains('protyle-task--done')) {
                    clonedElement.classList.remove('protyle-task--done');
                }
            }
            
            this.log('📋 [TodoProcessor] 更新后的class:', clonedElement.className);
            
            // 更新checkbox图标
            const clonedCheckbox = clonedElement.querySelector('.protyle-action--task svg use');
            if (clonedCheckbox) {
                this.log('📋 [TodoProcessor] 更新SVG图标:', `#${newIcon}`);
                clonedCheckbox.setAttribute('xlink:href', `#${newIcon}`);
            } else {
                this.log('❌ [TodoProcessor] 未找到克隆元素中的checkbox SVG');
            }
            
            // 更新updated属性
            const now = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 14);
            clonedElement.setAttribute('updated', now);
            this.log('📋 [TodoProcessor] 更新updated属性:', now);
            
            const newData = clonedElement.outerHTML;
            const oldData = todoElement.outerHTML;
            
            this.log('📝 [TodoProcessor] 原始HTML数据 (前200字符):', oldData.substring(0, 200) + '...');
            this.log('📝 [TodoProcessor] 新HTML数据 (前200字符):', newData.substring(0, 200) + '...');
            
            // 比较新旧数据的关键差异
            this.log('🔍 [TodoProcessor] HTML数据比较:');
            this.log('  - 原始包含protyle-task--done:', oldData.includes('protyle-task--done'));
            this.log('  - 新数据包含protyle-task--done:', newData.includes('protyle-task--done'));
            this.log('  - 原始SVG图标:', oldData.match(/#icon(Check|Uncheck)/)?.[0] || 'not found');
            this.log('  - 新SVG图标:', newData.match(/#icon(Check|Uncheck)/)?.[0] || 'not found');
            
            // 使用事务API更新
            this.log('📡 [TodoProcessor] 准备使用transactions API更新...');
            
            const sessionId = this.generateSessionId();
            const appId = this.getAppId();
            const reqId = Date.now();
            
            this.log('📡 [TodoProcessor] 事务参数:');
            this.log('  - sessionId:', sessionId);
            this.log('  - appId:', appId);
            this.log('  - reqId:', reqId);
            this.log('  - blockId:', blockId);
            
            const transactionData = {
                session: sessionId,
                app: appId,
                transactions: [{
                    doOperations: [{
                        id: blockId,
                        data: newData,
                        action: "update"
                    }],
                    undoOperations: [{
                        id: blockId,
                        data: oldData,
                        action: "update"
                    }]
                }],
                reqId: reqId
            };
            
            this.log('📡 [TodoProcessor] 事务数据完整结构:', JSON.stringify(transactionData, null, 2));
            
            this.log('📡 [TodoProcessor] 开始调用 /api/transactions...');
            
            // 使用原生fetch，完全匹配真实API调用的格式
            const requestBody = JSON.stringify(transactionData);
            this.log('📡 [TodoProcessor] 请求体字符串:', requestBody);
            
            try {
                // 获取思源笔记的基础URL
                const baseUrl = window.location.origin;
                const apiUrl = `${baseUrl}/api/transactions`;
                this.log('📡 [TodoProcessor] API URL:', apiUrl);
                
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'accept': '*/*',
                        'accept-language': 'en,zh;q=0.9,zh-CN;q=0.8',
                        'cache-control': 'no-cache',
                        'content-type': 'text/plain;charset=UTF-8',
                        'pragma': 'no-cache'
                    },
                    body: requestBody,
                    mode: 'cors',
                    credentials: 'include'
                });
                
                this.log('📡 [TodoProcessor] Fetch响应状态:', response.status);
                
                const responseData = await response.json();
                this.log('📡 [TodoProcessor] Transactions API响应:', responseData);
                
                if (response.ok && (!responseData.code || responseData.code === 0)) {
                    this.log('✅ [TodoProcessor] Todo状态更新成功');
                    return true;
                } else {
                    this.log('❌ [TodoProcessor] Todo状态更新失败:', responseData);
                    return false;
                }
                
            } catch (fetchError) {
                this.log('💥 [TodoProcessor] Fetch调用异常:', fetchError);
                return false;
            }
            
        } catch (error) {
            this.log('💥 [TodoProcessor] 更新Todo状态异常:', error);
            return false;
        }
    }
    
    /**
     * 生成会话ID
     */
    private generateSessionId(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    
    /**
     * 获取应用ID（从window对象中获取）
     */
    private getAppId(): string {
        // 尝试从思源的全局对象中获取app id
        const appId = (window as any).siyuan?.config?.system?.id || 
                     (window as any).siyuan?.config?.system?.appId ||
                     (window as any).siyuan?.appId ||
                     this.generateShortId();
        
        this.log('🔍 [TodoProcessor] 获取到的appId:', appId);
        return appId;
    }
    
    /**
     * 生成短ID（作为备用方案）
     */
    private generateShortId(): string {
        return Math.random().toString(36).substring(2, 7);
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
