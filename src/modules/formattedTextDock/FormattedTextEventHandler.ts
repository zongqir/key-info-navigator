import { showMessage } from "siyuan";
import { TextFormatType, FormattedTextItem } from "../formatProcessor";
import { TextFormatParser } from "../formatProcessor/TextFormatParser";
import { FormattedTextNavigator } from "./FormattedTextNavigator";
import { FormattedTextMemoManager } from "./FormattedTextMemoManager";
import { TodoProcessor } from "../formatProcessor/processors/TodoProcessor";
import { DocumentReadonlyChecker } from "../utils/DocumentReadonlyChecker";

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
     * 删除文本格式化
     */
    private async removeFormattingFromText(blockId: string, text: string, type: TextFormatType, position: number): Promise<void> {
        try {
            this.log(`开始删除格式化: "${text}", 类型: ${type}, 位置: ${position}`);
            
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
            
            // 调用处理器删除格式化
            const success = await processor.removeFormatting!(text, blockId, itemIndex >= 0 ? itemIndex : 0);
            
            if (success) {
                showMessage(`✅ ${this.i18n.removeFormatSuccess || '格式删除成功'}: ${text}`, 2000, 'info');
                
                // 更新块内容到后端
                await this.memoManager.updateBlockContent();
                
                // 延迟刷新列表，让DOM更新完成
                setTimeout(() => {
                    this.onRefresh();
                }, 500);
                
            } else {
                showMessage(`❌ ${this.i18n.removeFormatFailed || '格式删除失败'}: ${text}`, 3000, 'error');
            }
            
        } catch (error) {
            this.log('删除格式化失败:', error);
            showMessage(`❌ ${this.i18n.removeFormatFailed || '格式删除失败'}: ${text}`, 3000, 'error');
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
                
                showMessage('❌ Todo状态更新失败', 3000, 'error');
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
            
            showMessage('❌ Todo状态更新异常', 3000, 'error');
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
            this.logger('[FormattedTextEventHandler]', ...args);
        }
    }
}
