import { showMessage } from "siyuan";
import { TextFormatType, FormattedTextItem } from "../formatProcessor";
import { TextFormatParser } from "../formatProcessor/TextFormatParser";
import { FormattedTextNavigator } from "./FormattedTextNavigator";
import { FormattedTextMemoManager } from "./FormattedTextMemoManager";
import { TodoProcessor } from "../formatProcessor/processors/TodoProcessor";
import { DocumentReadonlyChecker } from "../utils/DocumentReadonlyChecker";
import { EditorUtils } from "../utils/EditorUtils";

/**
 * 格式化文本事件处理器
 * 负责处理所有用户交互事件
 */
export class FormattedTextEventHandler {
    constructor(
        private element: HTMLElement,
        private parser: TextFormatParser,
        private navigator: FormattedTextNavigator,
        private memoManager: FormattedTextMemoManager,
        private formattedTexts: FormattedTextItem[],
        private enabledFormats: TextFormatType[],
        private onRefresh: () => void,
        private onFormatToggle: (type: TextFormatType) => void,
        private i18n: any,
        private logger?: (...args: any[]) => void
    ) {}

    /**
     * 绑定基础事件
     */
    public bindEvents(): void {
        // 过滤器切换事件
        this.element.querySelectorAll<HTMLButtonElement>(".format-filter")
            .forEach(btn => {
                btn.addEventListener("click", () => {
                    const format = btn.dataset.format as TextFormatType;
                    this.onFormatToggle(format);
                    // DOM状态会在toggleFormat方法中统一更新，不需要在这里手动toggle
                });
            });

        // 刷新按钮事件 - 强制刷新
        const refreshBtn = this.element.querySelector<HTMLButtonElement>('[data-action="refresh"]');
        if (refreshBtn) {
            refreshBtn.addEventListener("click", () => {
                this.log('手动刷新被触发');
                this.onRefresh();
            });
        }

        // 筛选提示区域的事件处理
        this.bindFilterHintEvents();
    }

    /**
     * 绑定筛选提示区域的事件
     */
    private bindFilterHintEvents(): void {
        // 使用事件委托处理动态生成的筛选提示按钮
        this.element.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const button = target.closest('button');
            
            if (!button) return;
            
            // 显示全部按钮
            if (button.hasAttribute('data-action') && button.dataset.action === 'show-all') {
                e.preventDefault();
                e.stopPropagation();
                this.showAllFormats();
                return;
            }
            
            // 格式切换按钮
            if (button.classList.contains('format-toggle') && button.hasAttribute('data-format')) {
                e.preventDefault();
                e.stopPropagation();
                const format = button.dataset.format as TextFormatType;
                this.onFormatToggle(format);
                return;
            }
        });
    }

    /**
     * 显示所有格式类型
     */
    private showAllFormats(): void {
        this.log('显示全部格式类型');
        // 启用所有格式
        const allFormats: TextFormatType[] = [
            TextFormatType.BOLD,
            TextFormatType.ITALIC,
            TextFormatType.UNDERLINE,
            TextFormatType.HIGHLIGHT,
            TextFormatType.MEMO,
            TextFormatType.TAG,
            TextFormatType.TODO,
        ];
        
        // 通过切换器逐个启用
        allFormats.forEach(format => {
            if (!this.enabledFormats.includes(format)) {
                this.onFormatToggle(format);
            }
        });
    }

    /**
     * 绑定项目点击事件
     */
    public bindItemEvents(container: HTMLElement): void {
        // 绑定项目点击事件（导航）
        const items = container.querySelectorAll<HTMLElement>('.formatted-text-dock__item');
        
        items.forEach(item => {
            // 点击项目主体进行导航
            const mainContent = item.querySelector('.formatted-text-dock__item-main');
            if (mainContent) {
                mainContent.addEventListener('click', (e) => {
                    // 检查点击的是否是Todo勾选框相关元素，如果是则不导航
                    const target = e.target as HTMLElement;
                    if (target.closest('.formatted-text-dock__todo-checkbox-container') ||
                        target.classList.contains('formatted-text-dock__todo-checkbox') ||
                        target.classList.contains('formatted-text-dock__todo-checkbox-custom')) {
                        this.log('🚫 [EventHandler] 点击了勾选框相关元素，跳过导航');
                        return;
                    }
                    
                    const text = item.dataset.text || '';
                    const type = item.dataset.type as TextFormatType;
                    const index = Number(item.dataset.index || 0);
                    
                    this.log('🧭 [EventHandler] 触发导航:', text, type, index);
                    this.navigator.navigateToText(text, type, index);
                });
            }
        });
        
        // 绑定添加备注按钮事件
        const addMemoButtons = container.querySelectorAll<HTMLButtonElement>('.formatted-text-dock__add-memo-btn');
        
        addMemoButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // 阻止事件冒泡，避免触发导航
                
                // 检查文档是否处于只读状态
                if (DocumentReadonlyChecker.checkDocumentReadonly()) {
                    this.log('🔒 文档处于只读状态，禁止添加备注操作');
                    DocumentReadonlyChecker.showUnlockPrompt(
                        showMessage,
                        this.i18n.unlockPrompt || DocumentReadonlyChecker.getUnlockPromptMessage()
                    );
                    return;
                }
                
                const blockId = btn.dataset.blockId || '';
                const text = btn.dataset.text || '';
                
                // 检查是否是备注类型的项目
                const itemElement = btn.closest('.formatted-text-dock__item') as HTMLElement;
                const itemType = itemElement?.dataset.type as TextFormatType;
                
                if (itemType === TextFormatType.MEMO) {
                    // 备注类型：编辑已有备注
                    this.memoManager.editExistingMemo(blockId, text);
                } else {
                    // 其他类型：添加新备注
                    this.memoManager.addMemoToText(blockId, text);
                }
            });
        });
        
        // 绑定删除格式化按钮事件
        const removeFormatButtons = container.querySelectorAll<HTMLButtonElement>('.formatted-text-dock__remove-format-btn');
        
        removeFormatButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // 阻止事件冒泡，避免触发导航
                
                // 检查文档是否处于只读状态
                if (DocumentReadonlyChecker.checkDocumentReadonly()) {
                    this.log('🔒 文档处于只读状态，禁止删除格式操作');
                    DocumentReadonlyChecker.showUnlockPrompt(
                        showMessage,
                        this.i18n.unlockPrompt || DocumentReadonlyChecker.getUnlockPromptMessage()
                    );
                    return;
                }
                
                const blockId = btn.dataset.blockId || '';
                const text = btn.dataset.text || '';
                const type = btn.dataset.type as TextFormatType;
                const position = Number(btn.dataset.position || 0);
                
                this.removeFormattingFromText(blockId, text, type, position);
            });
        });
        
        // 绑定Todo勾选框事件
        const todoCheckboxes = container.querySelectorAll<HTMLInputElement>('.formatted-text-dock__todo-checkbox');
        
        this.log('🎯 [EventHandler] 查找到的Todo勾选框数量:', todoCheckboxes.length);
        
        todoCheckboxes.forEach((checkbox, index) => {
            this.log(`📋 [EventHandler] 绑定第${index + 1}个Todo勾选框:`, checkbox);
            this.log(`📋 [EventHandler] 勾选框数据 - blockId:`, checkbox.dataset.blockId, 'itemId:', checkbox.dataset.itemId);
            
            checkbox.addEventListener('change', (e) => {
                e.preventDefault(); // 阻止默认行为
                e.stopPropagation(); // 阻止事件冒泡，避免触发导航
                e.stopImmediatePropagation(); // 立即停止事件传播
                
                const blockId = checkbox.dataset.blockId || '';
                const itemId = checkbox.dataset.itemId || '';
                const isChecked = checkbox.checked;
                
                this.log('🔄 [EventHandler] Todo勾选框状态变化触发！blockId:', blockId, 'itemId:', itemId, 'checked:', isChecked);
                
                this.handleTodoStatusChange(blockId, itemId, isChecked);
            });
            
            // 也为checkbox容器绑定点击事件，确保点击自定义样式也能工作
            const checkboxContainer = checkbox.closest('.formatted-text-dock__todo-checkbox-container');
            if (checkboxContainer) {
                checkboxContainer.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    
                    // 手动切换checkbox状态
                    checkbox.checked = !checkbox.checked;
                    
                    // 触发change事件
                    const changeEvent = new Event('change', { bubbles: false, cancelable: false });
                    checkbox.dispatchEvent(changeEvent);
                    
                    this.log('📋 [EventHandler] 通过容器点击切换Todo状态');
                });
            }
            
            this.log(`✅ [EventHandler] 第${index + 1}个Todo勾选框事件绑定完成`);
        });
        
        this.log('🎉 [EventHandler] 所有Todo勾选框事件绑定完成！');
    }

    /**
     * 删除文本格式化（使用transactions API同步删除数据库记录）
     */
    private async removeFormattingFromText(blockId: string, text: string, type: TextFormatType, position: number): Promise<void> {
        try {
            this.log(`开始删除格式化: "${text}", 类型: ${type}, 位置: ${position}`);
            
            // 获取编辑器中的块元素
            const editor = EditorUtils.getCurrentActiveEditor(this.log.bind(this));
            if (!editor?.protyle?.wysiwyg?.element) {
                this.log(`❌ 无法获取编辑器`);
                return;
            }
            
            const blockElement = editor.protyle.wysiwyg.element.querySelector(`[data-node-id="${blockId}"]`) as HTMLElement;
            if (!blockElement) {
                this.log(`❌ 未找到块元素: ${blockId}`);
                return;
            }
            
            // 保存旧的HTML（用于undo，包含旧的updated时间戳）
            const oldData = blockElement.outerHTML;
            
            // 获取对应的格式处理器
            const processor = this.parser.getFormatProcessor(type);
            
            // 计算项目索引（同类型同文本的项目中的索引）
            const sameTypeItems = this.formattedTexts.filter(item => 
                item.type === type && item.text === text
            );
            
            // 按位置排序找到当前项目的索引
            sameTypeItems.sort((a, b) => a.position - b.position);
            const itemIndex = sameTypeItems.findIndex(item => item.position === position);
            
            this.log(`找到 ${sameTypeItems.length} 个相同的项目，当前项目索引: ${itemIndex}`);
            
            // 调用处理器删除格式化（这只是DOM操作）
            const success = await processor.removeFormatting!(text, blockId, itemIndex >= 0 ? itemIndex : 0);
            
            if (success) {
                // ⚠️ 等待DOM更新完成
                await new Promise(resolve => setTimeout(resolve, 10));
                
                // ✅ 关键修复：更新 updated 时间戳（触发spans表重建）
                const timestamp = new Date().getTime().toString().substring(0, 14);
                blockElement.setAttribute('updated', timestamp);
                this.log(`🕐 更新时间戳到: ${timestamp}`);
                
                // 获取新的HTML（包含wbr和新的updated时间戳）
                const newData = blockElement.outerHTML;
                
                this.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                this.log(`📦 单个删除 - HTML对比:`);
                this.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                this.log(`🔴 删除前:`);
                this.log(oldData);
                this.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                this.log(`🟢 删除后:`);
                this.log(newData);
                this.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                
                // 检查是否真的删除了span
                const oldSpanCount = (oldData.match(/<span[^>]*data-type[^>]*strong/g) || []).length;
                const newSpanCount = (newData.match(/<span[^>]*data-type[^>]*strong/g) || []).length;
                this.log(`📊 strong span数量: ${oldSpanCount} -> ${newSpanCount}`);
                
                if (oldSpanCount === newSpanCount) {
                    this.log(`❌❌❌ 警告：span数量没有减少！DOM删除可能没有生效！`);
                }
                
                // ✅ 使用transactions API更新（会同步删除数据库中的spans记录）
                await this.submitTransactions([{
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
                }]);
                
                showMessage(`✅ ${this.i18n.removeFormatSuccess || '格式删除成功'}`, 2000, 'info');
                
                // 延迟刷新列表，让spans表更新完成
                setTimeout(() => {
                    this.onRefresh();
                }, 300);
                
            }
            // 失败时不显示提示
            
        } catch (error) {
            this.log('删除格式化失败:', error);
            // 静默失败，不显示错误提示
        }
    }
    
    /**
     * 提交 transactions 到思源后端
     */
    private async submitTransactions(transactions: any[]): Promise<void> {
        try {
            const baseUrl = window.location.origin;
            const apiUrl = `${baseUrl}/api/transactions`;
            
            const editor = EditorUtils.getCurrentActiveEditor(this.log.bind(this));
            const sessionId = editor?.protyle?.id || `plugin-${Date.now()}`;
            const appId = (window as any).siyuan?.config?.system?.appId || 'siyuan';
            
            // ✅ 关键修复：添加 reqId 参数
            const reqId = Date.now();
            const requestBody = {
                session: sessionId,
                app: appId,
                transactions: transactions,
                reqId: reqId
            };
            
            this.log('📡 完整请求体:');
            this.log(JSON.stringify(requestBody, null, 2));
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const responseData = await response.json();
            
            this.log('📡 Transactions 完整响应:');
            this.log(JSON.stringify(responseData, null, 2));
            
            if (responseData.code !== 0) {
                throw new Error(responseData.msg || 'Transactions 失败');
            }
            
            this.log('✅ Transactions 提交成功');
            
        } catch (error) {
            this.log('❌ 提交 Transactions 失败:', error);
            throw error;
        }
    }
    
    /**
     * 处理Todo状态变化
     */
    private async handleTodoStatusChange(blockId: string, itemId: string, isChecked: boolean): Promise<void> {
        try {
            this.log(`🚀 [EventHandler] 开始处理Todo状态变化: 块ID=${blockId}, 项目ID=${itemId}, 勾选=${isChecked}`);
            
            // 获取TodoProcessor
            this.log('🔍 [EventHandler] 获取TodoProcessor...');
            const todoProcessor = this.parser.getFormatProcessor(TextFormatType.TODO) as TodoProcessor;
            this.log('✅ [EventHandler] 获得TodoProcessor:', todoProcessor);
            
            // 更新后端数据
            this.log('📡 [EventHandler] 开始调用API更新后端数据...');
            const success = await todoProcessor.updateTodoStatus(blockId, isChecked);
            this.log('📡 [EventHandler] API调用结果:', success);
            
            if (success) {
                this.log('✅ [EventHandler] API更新成功，开始更新UI...');
                
                // 更新UI状态
                this.updateTodoItemUI(itemId, isChecked);
                
                showMessage(
                    `✅ ${isChecked ? '已完成' : '取消完成'} Todo`,
                    2000,
                    'info'
                );
                
                this.log('🔄 [EventHandler] 延迟刷新列表...');
                // 延迟刷新以同步状态
                setTimeout(() => {
                    this.onRefresh();
                }, 500);
                
            } else {
                this.log('❌ [EventHandler] API更新失败，恢复勾选框状态...');
                
                // 恢复勾选框状态
                const checkbox = this.element.querySelector(`[data-item-id="${itemId}"]`) as HTMLInputElement;
                if (checkbox) {
                    checkbox.checked = !isChecked;
                    this.log('🔄 [EventHandler] 勾选框状态已恢复');
                } else {
                    this.log('⚠️ [EventHandler] 未找到要恢复的勾选框');
                }
                
                // 失败时不显示提示
            }
            
        } catch (error) {
            this.log('💥 [EventHandler] 处理Todo状态变化异常:', error);
            
            // 恢复勾选框状态
            const checkbox = this.element.querySelector(`[data-item-id="${itemId}"]`) as HTMLInputElement;
            if (checkbox) {
                checkbox.checked = !isChecked;
                this.log('🔄 [EventHandler] 异常情况下勾选框状态已恢复');
            } else {
                this.log('⚠️ [EventHandler] 异常情况下未找到要恢复的勾选框');
            }
            
            // 静默失败，不显示错误提示
        }
    }
    
    /**
     * 更新Todo项目的UI状态
     */
    private updateTodoItemUI(itemId: string, isCompleted: boolean): void {
        // 查找对应的todo项目
        const todoItem = this.element.querySelector(`[data-item-id="${itemId}"]`)?.closest('.formatted-text-dock__item');
        if (todoItem) {
            const todoText = todoItem.querySelector('.formatted-text-dock__todo-text');
            if (todoText) {
                if (isCompleted) {
                    todoText.classList.add('completed');
                } else {
                    todoText.classList.remove('completed');
                }
            }
        }
    }

    /**
     * 更新格式化文本数据
     */
    public updateFormattedTexts(formattedTexts: FormattedTextItem[]): void {
        this.formattedTexts = formattedTexts;
    }

    /**
     * 更新启用的格式类型
     */
    public updateEnabledFormats(enabledFormats: TextFormatType[]): void {
        this.enabledFormats = enabledFormats;
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
