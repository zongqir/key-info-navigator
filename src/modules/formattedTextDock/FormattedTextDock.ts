import { getAllEditor, showMessage } from "siyuan";
import { TextFormatParser, TextFormatType, FormattedTextItem, ParseOptions } from "../formatProcessor";
import { FormattedTextUIRenderer } from "./FormattedTextUIRenderer";
import { FormattedTextEventHandler } from "./FormattedTextEventHandler";
import { FormattedTextNavigator } from "./FormattedTextNavigator";
import { FormattedTextMemoManager } from "./FormattedTextMemoManager";
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
        
        let listHTML = this.uiRenderer.createListHTML(groupedItems);
        
        // 如果有被筛选的内容，在列表底部添加筛选提示
        if (hasFilteredOutContent) {
            const hintHTML = this.createFilterHintSection(filteredOutTypes);
            listHTML += hintHTML;
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
                `没有匹配当前筛选条件的格式化文字。当前文档中包含其他类型的格式化文字，请调整筛选器设置查看。`;
            
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
     * 日志输出
     */
    private log(...args: any[]): void {
        if (this.logger) {
            this.logger(...args);
        }
    }
}