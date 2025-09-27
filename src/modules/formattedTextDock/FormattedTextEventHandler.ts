import { showMessage } from "siyuan";
import { TextFormatType, FormattedTextItem } from "../formatProcessor";
import { TextFormatParser } from "../formatProcessor/TextFormatParser";
import { FormattedTextNavigator } from "./FormattedTextNavigator";
import { FormattedTextMemoManager } from "./FormattedTextMemoManager";

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
                    btn.classList.toggle("active");
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
                mainContent.addEventListener('click', () => {
                    const text = item.dataset.text || '';
                    const type = item.dataset.type as TextFormatType;
                    const index = Number(item.dataset.index || 0);
                    
                    this.navigator.navigateToText(text, type, index);
                });
            }
        });
        
        // 绑定添加备注按钮事件
        const addMemoButtons = container.querySelectorAll<HTMLButtonElement>('.formatted-text-dock__add-memo-btn');
        
        addMemoButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // 阻止事件冒泡，避免触发导航
                
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
                
                const blockId = btn.dataset.blockId || '';
                const text = btn.dataset.text || '';
                const type = btn.dataset.type as TextFormatType;
                const position = Number(btn.dataset.position || 0);
                
                this.removeFormattingFromText(blockId, text, type, position);
            });
        });
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
