import { getAllEditor, showMessage, fetchPost } from "siyuan";
import { TextFormatParser, TextFormatType, FormattedTextItem, ParseOptions } from "../formatProcessor";
import { FormattedTextUIRenderer } from "./FormattedTextUIRenderer";
import { FormattedTextEventHandler } from "./FormattedTextEventHandler";
import { FormattedTextNavigator } from "./FormattedTextNavigator";
import { FormattedTextMemoManager } from "./FormattedTextMemoManager";
import { FormattedTextMultiSelectManager } from "./FormattedTextMultiSelectManager";
import { FormattedTextUtils } from "./FormattedTextUtils";
import { Logger, EditorUtils, DocumentReadonlyChecker } from "../utils";

/**
 * 格式化文本侧边栏 - 重构版本
 * 将原本的大类拆分成多个专门的模块，提高代码的可维护性和可读性
 */
export class FormattedTextDock {
    // 核心数据
    private parser: TextFormatParser;
    private formattedTexts: FormattedTextItem[] = [];
    private enabledFormats: TextFormatType[] = [
        TextFormatType.BOLD,
        TextFormatType.ITALIC,
        TextFormatType.UNDERLINE,
        TextFormatType.HIGHLIGHT,
        TextFormatType.MEMO,
        TextFormatType.TAG,
        TextFormatType.TODO,
    ];
    private currentBlockId = "";
    private refreshTimer?: number;

    // 功能模块
    private uiRenderer!: FormattedTextUIRenderer;
    private eventHandler!: FormattedTextEventHandler;
    private navigator!: FormattedTextNavigator;
    private memoManager!: FormattedTextMemoManager;
    private multiSelectManager!: FormattedTextMultiSelectManager;
    
    // 多选状态
    private selectedItemIds = new Set<string>();
    
    // 状态监听器
    private readonlyStateChangeHandler: (isReadonly: boolean) => void;

    constructor(
        private element: HTMLElement,
        private i18n: any,
        private logger?: (...args: any[]) => void,
        initialEnabledFormats?: string[],
        private onFilterChange?: (formats: string[]) => void
    ) {
        this.log('构造函数开始初始化');
        this.parser = new TextFormatParser(logger);
        
        // 从保存的设置中恢复筛选状态
        if (initialEnabledFormats && initialEnabledFormats.length > 0) {
            this.enabledFormats = initialEnabledFormats as TextFormatType[];
            this.log('从设置中恢复筛选状态:', this.enabledFormats);
        }
        
        // 初始化状态变化处理器
        this.readonlyStateChangeHandler = (isReadonly: boolean) => {
            this.log(`🔄 [FormattedTextDock] 文档状态变化: ${isReadonly ? '🔒 锁定' : '✏️ 解锁'}`);
            this.onReadonlyStateChange(isReadonly);
        };
        
        // 初始化功能模块
        this.log('初始化功能模块');
        this.initModules();
        
        // 初始化UI和功能
        this.log('初始化UI');
        this.initUI();
        
        // 添加文档状态变化监听器
        this.log('添加文档状态变化监听器');
        DocumentReadonlyChecker.addStateChangeListener(this.readonlyStateChangeHandler);
        
        this.log('开始初始刷新');
        this.refresh(true); // 初始化时强制刷新
    }

    /**
     * 初始化功能模块
     */
    private initModules(): void {
        // UI渲染器
        this.uiRenderer = new FormattedTextUIRenderer(
            this.parser,
            this.enabledFormats,
            this.i18n,
            this.logger
        );

        // 备注管理器
        this.memoManager = new FormattedTextMemoManager(
            this.i18n,
            this.formattedTexts,
            () => this.refresh(true), // 刷新回调
            this.logger
        );

        // 导航器
        this.navigator = new FormattedTextNavigator(
            this.parser,
            this.formattedTexts,
            this.enabledFormats,
            this.element,
            this.i18n,
            this.logger
        );

        // 事件处理器
        this.eventHandler = new FormattedTextEventHandler(
            this.element,
            this.parser,
            this.navigator,
            this.memoManager,
            this.formattedTexts,
            this.enabledFormats,
            () => this.refresh(true), // 刷新回调
            (type) => this.toggleFormat(type), // 格式切换回调
            this.i18n,
            this.logger
        );

        // 多选管理器（会自动检测移动设备并决定是否启用）
        this.multiSelectManager = new FormattedTextMultiSelectManager(
            this.element,
            this.formattedTexts,
            (selectedIds) => this.onSelectionChange(selectedIds), // 选择变化回调
            (selectedItems) => this.handleBatchDelete(selectedItems), // 批量删除回调
            this.i18n,
            this.logger
        );
    }

    /**
     * 文档变更时调用
     */
    public onDocumentChange(): void {
        this.log('文档变更事件被触发');
        
        // 清除之前的定时器
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }
        
        // 使用较短的延迟时间来提高响应性，特别是对于 tab 切换
        this.refreshTimer = window.setTimeout(() => {
            this.log('延迟刷新开始执行');
            
            // 获取当前编辑器以检查是否真的发生了变化
            const currentEditor = EditorUtils.getCurrentActiveEditor(this.logger);
            const newBlockId = currentEditor?.protyle?.block?.rootID;
            
            if (newBlockId && newBlockId !== this.currentBlockId) {
                this.log(`检测到文档切换: ${this.currentBlockId} -> ${newBlockId}`);
                this.refresh(true); // 文档切换时强制刷新
            } else if (newBlockId === this.currentBlockId) {
                this.log('同一文档，使用缓存刷新');
                this.refresh(false); // 同一文档可以使用缓存
            } else {
                this.log('无有效文档，跳过刷新');
            }
            
            this.refreshTimer = undefined;
        }, 200); // 减少延迟时间从 500ms 到 200ms 以提高响应性
    }

    /**
     * 处理文档只读状态变化
     */
    private onReadonlyStateChange(isReadonly: boolean): void {
        this.log(`🔄 [FormattedTextDock] 处理状态变化: ${isReadonly ? '🔒 锁定' : '✏️ 解锁'} - 开始刷新dock`);
        
        // 状态变化时强制刷新dock来更新按钮状态
        this.renderList();
        
        this.log('🔄 [FormattedTextDock] 状态变化处理完成');
    }

    /**
     * 销毁组件
     */
    public destroy(): void {
        this.log('🔄 [FormattedTextDock] 开始销毁组件');
        
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = undefined;
        }
        
        // 移除文档状态变化监听器
        if (this.readonlyStateChangeHandler) {
            this.log('🔄 [FormattedTextDock] 移除状态变化监听器');
            DocumentReadonlyChecker.removeStateChangeListener(this.readonlyStateChangeHandler);
        }
        
        // 销毁各个模块
        this.memoManager?.destroy();
        this.navigator?.destroy();
        
        // 清理多选管理器
        if (this.multiSelectManager) {
            this.multiSelectManager.destroy();
        }
        
        this.log('🔄 [FormattedTextDock] 组件销毁完成');
    }

    /**
     * 初始化UI
     */
    private initUI(): void {
        this.element.innerHTML = this.uiRenderer.createMainHTML();
        // 确保DOM状态与enabledFormats数组一致
        this.updateFilterButtonsState();
        this.eventHandler.bindEvents();
    }


    /**
     * 刷新数据
     */
    private async refresh(force = false): Promise<void> {
        const editor = EditorUtils.getCurrentActiveEditor(this.logger);
        if (!editor?.protyle?.block) {
            this.showEmpty(this.i18n.openDocumentFirst);
            return;
        }

        const blockId = editor.protyle.block.rootID;
        if (!blockId) {
            this.showEmpty(this.i18n.noBlockId || '无法获取文档ID');
            return;
        }
        
        // 只有在自动刷新且数据已存在时才跳过重新获取
        if (!force && blockId === this.currentBlockId && this.formattedTexts.length > 0) {
            this.log('使用缓存数据，重新渲染列表');
            this.renderList();
            return;
        }

        this.currentBlockId = blockId;
        this.showLoading();

        try {
            this.log(`开始${force ? '强制' : '自动'}刷新，文档ID: ${blockId}`);
            
            const options: ParseOptions = {
                enabledFormats: this.enabledFormats, // 现在这个参数不影响查询，只用于兼容性
                maxResults: 200,
                includeContext: true
            };

            this.log('解析选项:', options);

            // 从数据库 SQL 查询
            this.log('从数据库查询格式化文本...');
            this.formattedTexts = await this.parser.parseFormattedTexts(blockId, options);
            this.log(`数据库查询结果: ${this.formattedTexts.length} 项`);
            
            // 详细日志：分析标签数据
            const tagItems = this.formattedTexts.filter(item => item.type === TextFormatType.TAG);
            this.log('标签数据详情:', tagItems);
            tagItems.forEach((item, index) => {
                this.log(`标签 ${index + 1}:`, {
                    id: item.id,
                    text: item.text,
                    type: item.type,
                    blockId: item.blockId,
                    metadata: item.metadata,
                    color: item.color
                });
            });

            // 更新各模块的数据
            this.updateModulesData();

            this.log(`最终获取到 ${this.formattedTexts.length} 个格式化文本项`);

            if (this.formattedTexts.length === 0) {
                this.log('没有找到格式化文本，显示空状态');
                this.showEmpty(this.i18n.noFormattedText);
            } else {
                this.log('开始渲染列表');
                this.renderList();
            }

        } catch (error) {
            this.log('刷新失败:', error);
            this.showEmpty(this.i18n.loadFailed);
        }
    }

    /**
     * 更新各模块的数据
     */
    private updateModulesData(): void {
        this.navigator.updateFormattedTexts(this.formattedTexts);
        this.memoManager.updateFormattedTexts(this.formattedTexts);
        this.eventHandler.updateFormattedTexts(this.formattedTexts);
        this.multiSelectManager.updateFormattedTexts(this.formattedTexts);
    }

    /**
     * 渲染列表
     */
    private renderList(): void {
        this.log('开始渲染列表');
        const content = this.element.querySelector<HTMLElement>(".formatted-text-dock__content");
        if (!content) {
            this.log('未找到内容容器元素');
            return;
        }

        const activeFormats = this.getActiveFormats();
        this.log('当前激活的格式:', activeFormats);
        
        const filteredItems = this.formattedTexts.filter(item => activeFormats.indexOf(item.type) !== -1);
        this.log(`过滤后的项目数量: ${filteredItems.length}`);
        
        // 检查是否有被筛选掉的内容
        const filteredOutTypes = this.getFilteredOutTypes();
        const hasFilteredOutContent = filteredOutTypes.length > 0;
        
        if (filteredItems.length === 0) {
            this.log('没有匹配的格式化文本，显示空状态');
            if (hasFilteredOutContent) {
                this.showEmptyWithFilterHint();
            } else {
                this.showEmpty(this.i18n.noMatchingFormat);
            }
            return;
        }

        // 有显示内容，但也可能有被筛选的内容  
        const groupedItems = FormattedTextUtils.groupItems(filteredItems);
        this.log(`分组后的项目数量: ${groupedItems.size}`);
        
        let listHTML = this.uiRenderer.createListHTML(groupedItems, this.selectedItemIds);
        
        // 如果有被筛选的内容，在列表顶部添加筛选提示
        if (hasFilteredOutContent) {
            const hintHTML = this.createFilterHintSection(filteredOutTypes);
            listHTML = hintHTML + listHTML;  // 放在列表前面
        }

        content.innerHTML = `<div class="formatted-text-dock__list">${listHTML}</div>`;
        
        // 绑定点击事件
        this.eventHandler.bindItemEvents(content);
        this.log('列表渲染完成并绑定事件');
    }

    /**
     * 切换格式类型
     */
    private toggleFormat(type: TextFormatType): void {
        const index = this.enabledFormats.indexOf(type);
        if (index >= 0) {
            this.enabledFormats.splice(index, 1);
            this.log(`禁用格式类型: ${type}`);
        } else {
            this.enabledFormats.push(type);
            this.log(`启用格式类型: ${type}`);
        }
        
        // 同步更新DOM状态
        this.updateFilterButtonsState();
        
        // 更新事件处理器的格式列表
        this.eventHandler.updateEnabledFormats(this.enabledFormats);
        
        this.log('当前启用的格式类型:', this.enabledFormats);
        
        // 保存筛选状态
        if (this.onFilterChange) {
            this.onFilterChange(this.enabledFormats);
        }
        
        this.renderList();
    }

    /**
     * 获取当前激活的格式类型
     */
    private getActiveFormats(): TextFormatType[] {
        return [...this.enabledFormats];
    }

    /**
     * 更新过滤器按钮状态以同步DOM
     */
    private updateFilterButtonsState(): void {
        const filterButtons = this.element.querySelectorAll<HTMLButtonElement>('.format-filter');
        filterButtons.forEach(btn => {
            const format = btn.dataset.format as TextFormatType;
            if (this.enabledFormats.includes(format)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    /**
     * 显示加载状态
     */
    private showLoading(): void {
        const content = this.element.querySelector<HTMLElement>(".formatted-text-dock__content");
        if (content) {
            content.innerHTML = this.uiRenderer.createLoadingHTML();
        }
    }

    /**
     * 创建筛选提示区域
     */
    private createFilterHintSection(filteredOutTypes: TextFormatType[]): string {
        if (filteredOutTypes.length === 0) return '';
            
        return `
            <div class="formatted-text-dock__filter-hint-section">
                <div class="filter-hint-container">
                    <div class="filter-hint-icons">
                        ${filteredOutTypes.map(type => `
                            <button class="filter-hint-icon format-toggle" data-format="${type}" title="显示${this.uiRenderer.getFormatDisplayName(type)}">
                                ${this.uiRenderer.getFormatIcon(type)}
                            </button>
                        `).join('')}
                    </div>
                    <button class="filter-hint-show-all" data-action="show-all" title="显示全部">
                        <svg class="show-all-icon" viewBox="0 0 16 16" width="12" height="12">
                            <path d="M8 1L10.5 6H15L11.5 9L13 14L8 11L3 14L4.5 9L1 6H5.5L8 1Z" fill="currentColor"/>
                        </svg>
                        <span>显示全部</span>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * 显示带筛选提示的空状态
     */
    private showEmptyWithFilterHint(): void {
        const content = this.element.querySelector<HTMLElement>(".formatted-text-dock__content");
        if (content) {
            // 分析被筛选掉的内容类型
            const filteredOutTypes = this.getFilteredOutTypes();
            const hintMessage = this.i18n.noMatchingFormatWithHint || 
                `暂无匹配的关键信息。文档还包含其他类型的重要内容，调整筛选条件即可查看。`;
            
            content.innerHTML = this.uiRenderer.createEmptyWithHintHTML(hintMessage, filteredOutTypes);
        }
    }

    /**
     * 获取被筛选掉的格式类型
     */
    private getFilteredOutTypes(): TextFormatType[] {
        const allTypes = this.formattedTexts.map(item => item.type);
        const uniqueTypes = Array.from(new Set(allTypes));
        return uniqueTypes.filter(type => !this.enabledFormats.includes(type));
    }

    /**
     * 显示空状态
     */
    private showEmpty(message: string): void {
        const content = this.element.querySelector<HTMLElement>(".formatted-text-dock__content");
        if (content) {
            content.innerHTML = this.uiRenderer.createEmptyHTML(message);
        }
    }


    /**
     * 选择状态变化回调
     */
    private onSelectionChange(selectedIds: Set<string>): void {
        this.selectedItemIds = selectedIds;
        this.log('选择状态变化，选中项目数:', selectedIds.size);
    }

    /**
     * 批量删除格式化回调 - 优化版本
     */
    private async handleBatchDelete(selectedItems: FormattedTextItem[]): Promise<void> {
        this.log('开始批量删除格式化，项目数量:', selectedItems.length);
        
        let successCount = 0;
        let failCount = 0;
        let wasReadonly = false;

        try {
            // 1. 检查文档状态，如果是只读则先解锁
            wasReadonly = DocumentReadonlyChecker.checkDocumentReadonly();
            if (wasReadonly) {
                this.log('文档处于只读状态，尝试临时解锁进行批量操作');
                // 这里需要解锁文档，具体实现取决于解锁API
                // 暂时先记录日志，真正的解锁逻辑需要根据实际API实现
                this.log('⚠️ 检测到文档锁定，建议先手动解锁后再进行批量删除');
            }

            // 2. 按块ID分组进行批量DOM操作
            const itemsByBlock = new Map<string, FormattedTextItem[]>();
            selectedItems.forEach(item => {
                if (!itemsByBlock.has(item.blockId)) {
                    itemsByBlock.set(item.blockId, []);
                }
                itemsByBlock.get(item.blockId)!.push(item);
            });

            // 3. 对每个块进行批量DOM操作（不调用API）
            for (const [blockId, blockItems] of itemsByBlock) {
                this.log(`处理块 ${blockId}，包含 ${blockItems.length} 个项目`);
                
                // 按位置倒序排序，从后往前删除，避免索引变化问题
                const sortedItems = blockItems.sort((a, b) => b.position - a.position);
                
                // 批量执行DOM删除操作（不触发API更新）
                for (const item of sortedItems) {
                    try {
                        const processor = this.parser.getFormatProcessor(item.type);
                        
                        if (!processor.removeFormatting) {
                            this.log(`格式处理器 ${item.type} 不支持删除格式化功能`);
                            failCount++;
                            continue;
                        }
                        
                        // 重新计算当前项目的索引
                        const currentFormattedItems = this.formattedTexts.filter(formattedItem => 
                            formattedItem.type === item.type && 
                            formattedItem.text === item.text &&
                            formattedItem.blockId === item.blockId
                        );
                        currentFormattedItems.sort((a, b) => a.position - b.position);
                        
                        const itemIndex = currentFormattedItems.findIndex(formattedItem => 
                            formattedItem.position === item.position
                        );

                        this.log(`删除项目: [${item.type}] "${item.text}" 位置=${item.position} 索引=${itemIndex}`);

                        // 仅执行DOM删除操作，不调用updateDocumentContent
                        const success = await this.removeFormattingDOMOnly(processor, item.text, item.blockId, itemIndex >= 0 ? itemIndex : 0);

                        if (success) {
                            successCount++;
                            this.log(`✅ 删除成功`);
                        } else {
                            failCount++;
                            this.log(`❌ 删除失败`);
                        }

                    } catch (error) {
                        this.log('删除格式化异常:', error);
                        failCount++;
                    }
                }

                this.log(`块 ${blockId} 的 DOM 操作完成`);
            }

            // 4. 统一更新所有修改过的块到后端（一次性API调用）
            if (successCount > 0) {
                this.log('开始统一更新所有修改过的块到后端');
                try {
                    await this.batchUpdateBlocksContent(Array.from(itemsByBlock.keys()));
                    this.log('✅ 批量更新到后端成功');
                } catch (updateError) {
                    this.log('❌ 批量更新到后端失败:', updateError);
                    // 即使API更新失败，DOM操作已经成功了
                }
            }

        } finally {
            // 5. 恢复文档锁定状态（如果原来是锁定的）
            if (wasReadonly) {
                this.log('恢复文档锁定状态');
                // 这里需要重新锁定文档
                // 具体实现取决于锁定API
            }
        }

        // 显示结果消息
        if (successCount > 0 && failCount === 0) {
            showMessage(`✅ 成功删除 ${successCount} 个项目的格式`, 3000, 'info');
        } else if (successCount > 0 && failCount > 0) {
            showMessage(`⚠️ 成功删除 ${successCount} 个，失败 ${failCount} 个项目的格式`, 4000, 'info');
        } else {
            showMessage(`❌ 删除格式失败，请手动处理`, 4000, 'error');
        }

        // 刷新列表
        setTimeout(() => {
            this.refresh(true);
        }, 500);
    }

    /**
     * 仅执行DOM删除操作，不调用API更新
     */
    private async removeFormattingDOMOnly(processor: any, text: string, blockId: string, itemIndex: number): Promise<boolean> {
        try {
            // 查找目标元素
            const targetElements = this.findFormattedElementsForProcessor(processor, text, itemIndex);
            
            if (targetElements.length === 0) {
                this.log('未找到目标格式化元素');
                return false;
            }
            
            // 删除格式化（仅DOM操作）
            let success = false;
            for (const element of targetElements) {
                const removed = this.removeElementFormattingDOMOnly(element, text);
                if (removed) {
                    success = true;
                }
            }
            
            return success;
            
        } catch (error) {
            this.log('DOM删除操作失败:', error);
            return false;
        }
    }

    /**
     * 查找格式化元素（供处理器使用）
     */
    private findFormattedElementsForProcessor(processor: any, text: string, itemIndex: number): HTMLElement[] {
        const config = processor.getConfig();
        const elements: HTMLElement[] = [];
        
        for (const selector of config.htmlSelectors) {
            try {
                const foundElements = Array.from(document.querySelectorAll(selector)) as HTMLElement[];
                const matchingElements = foundElements.filter(el => 
                    el.textContent?.trim() === text
                );
                
                // 如果有索引要求，取对应位置的元素
                if (itemIndex >= 0 && itemIndex < matchingElements.length) {
                    elements.push(matchingElements[itemIndex]);
                } else if (matchingElements.length > 0) {
                    elements.push(...matchingElements);
                }
            } catch (error) {
                this.log('查找元素失败:', error);
            }
        }
        
        return elements;
    }

    /**
     * 删除元素格式化（仅DOM操作）
     */
    private removeElementFormattingDOMOnly(element: HTMLElement, text: string): boolean {
        try {
            // 保存父节点
            const parent = element.parentNode;
            if (!parent) return false;

            // 创建文本节点替换格式化元素
            const textNode = document.createTextNode(text);
            parent.replaceChild(textNode, element);

            return true;
        } catch (error) {
            this.log('替换元素失败:', error);
            return false;
        }
    }

    /**
     * 批量更新多个块的内容到后端
     */
    private async batchUpdateBlocksContent(blockIds: string[]): Promise<void> {
        try {
            const editor = EditorUtils.getCurrentActiveEditor(this.logger);
            if (!editor?.protyle?.block) {
                return;
            }
            
            // 获取当前文档的根块ID
            const rootBlockId = editor.protyle.block.rootID;
            const blockElement = editor.protyle.wysiwyg.element;
            
            if (!rootBlockId || !blockElement) {
                return;
            }
            
            // 获取更新后的HTML内容
            const newContent = blockElement.innerHTML;
            
            // 调用思源API更新整个文档块内容（一次性更新）
            await fetchPost('/api/block/updateBlock', {
                id: rootBlockId,
                data: newContent,
                dataType: 'dom'
            });
            
            this.log(`成功批量更新 ${blockIds.length} 个块的内容`);
            
        } catch (error) {
            this.log('批量更新块内容失败:', error);
            throw error;
        }
    }

    /**
     * 日志输出
     */
    private log(...args: any[]): void {
        if (this.logger) {
            this.logger(...args);
        }
    }
}