import { getAllEditor, showMessage } from "siyuan";
import { TextFormatParser, TextFormatType, FormattedTextItem, ParseOptions } from "../formatProcessor";
import { FormattedTextUIRenderer } from "./FormattedTextUIRenderer";
import { FormattedTextEventHandler } from "./FormattedTextEventHandler";
import { FormattedTextNavigator } from "./FormattedTextNavigator";
import { FormattedTextMemoManager } from "./FormattedTextMemoManager";
import { FormattedTextUtils } from "./FormattedTextUtils";
import { Logger, EditorUtils, DocumentReadonlyChecker } from "../utils";

/**
 * 移动端底部抽屉面板状态
 */
enum BottomSheetState {
    CLOSED = 'closed',
    PEEK = 'peek',
    HALF = 'half',
    FULL = 'full'
}

/**
 * 移动端底部抽屉面板 - 专为手机设计的格式化文本导航器
 */
export class MobileBottomSheet {
    // 核心数据 - 复用现有逻辑
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

    // 功能模块 - 复用现有模块
    private uiRenderer!: FormattedTextUIRenderer;
    private eventHandler!: FormattedTextEventHandler;
    private navigator!: FormattedTextNavigator;
    private memoManager!: FormattedTextMemoManager;
    
    // 底部抽屉特有属性
    private container!: HTMLElement;
    private backdrop!: HTMLElement;
    private sheetContainer!: HTMLElement;
    private handle!: HTMLElement;
    private peekContent!: HTMLElement;
    private fullContent!: HTMLElement;
    
    // 状态管理
    private currentState: BottomSheetState = BottomSheetState.PEEK;
    private isDragging = false;
    private startY = 0;
    private lastTapTime = 0; // 用于检测双击
    private tapTimeout: number | null = null; // 双击超时
    
    // 状态监听器
    private readonlyStateChangeHandler: (isReadonly: boolean) => void;

    constructor(
        private i18n: any,
        private logger?: (...args: any[]) => void,
        initialEnabledFormats?: string[],
        private onFilterChange?: (formats: string[]) => void
    ) {
        this.log('MobileBottomSheet 初始化开始');
        this.parser = new TextFormatParser(logger);
        
        // 从保存的设置中恢复筛选状态
        if (initialEnabledFormats && initialEnabledFormats.length > 0) {
            this.enabledFormats = initialEnabledFormats as TextFormatType[];
            this.log('从设置中恢复筛选状态:', this.enabledFormats);
        }
        
        // 初始化状态变化处理器
        this.readonlyStateChangeHandler = (isReadonly: boolean) => {
            this.log(`文档状态变化: ${isReadonly ? '🔒 锁定' : '✏️ 解锁'}`);
            this.onReadonlyStateChange(isReadonly);
        };
        
        // 初始化功能模块
        this.initModules();
        
        // 创建UI
        this.createUI();
        
        // 添加文档状态变化监听器
        DocumentReadonlyChecker.addStateChangeListener(this.readonlyStateChangeHandler);
        
        // 初始化时强制刷新
        this.refresh(true);
        
        this.log('MobileBottomSheet 初始化完成');
    }

    /**
     * 初始化功能模块 - 复用现有逻辑
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

        // 注意：navigator 和 eventHandler 会在 createUI 后重新初始化
    }

    /**
     * 创建移动端UI
     */
    private createUI(): void {
        // 创建主容器
        this.container = document.createElement('div');
        this.container.className = 'mobile-bottom-sheet';
        
        // 创建背景遮罩
        this.backdrop = document.createElement('div');
        this.backdrop.className = 'bottom-sheet-backdrop';
        
        // 创建抽屉容器
        this.sheetContainer = document.createElement('div');
        this.sheetContainer.className = 'bottom-sheet-container';
        
        // 创建拖拽手柄
        this.handle = document.createElement('div');
        this.handle.className = 'bottom-sheet-handle';
        this.handle.innerHTML = '<div class="handle-bar"></div>';
        
        // 创建预览内容（PEEK状态显示）
        this.peekContent = document.createElement('div');
        this.peekContent.className = 'bottom-sheet-peek-content';
        
        // 创建完整内容容器
        this.fullContent = document.createElement('div');
        this.fullContent.className = 'bottom-sheet-full-content';
        
        // 创建带滚动的真正内容
        const mainHTML = this.uiRenderer.createMainHTML();
        this.fullContent.innerHTML = `
            <div style="height: 70vh; overflow-y: scroll; -webkit-overflow-scrolling: touch; background: var(--kinfo-bg-primary);">
                ${mainHTML}
            </div>
        `;
        
        // 组装DOM结构
        this.sheetContainer.appendChild(this.handle);
        this.sheetContainer.appendChild(this.peekContent);
        this.sheetContainer.appendChild(this.fullContent);
        
        this.container.appendChild(this.backdrop);
        this.container.appendChild(this.sheetContainer);
        
        // 添加到body
        if (document.body) {
            document.body.appendChild(this.container);
            this.log('移动端UI创建完成并添加到DOM');
        } else {
            this.log('错误: document.body不存在，无法添加DOM元素');
        }
        
        // 在DOM创建后初始化导航器和事件处理器
        this.initNavigatorAndEventHandler();
        
        // 绑定事件
        this.bindEvents();
        
        // 初始状态设置
        this.setState(BottomSheetState.PEEK);
    }

    /**
     * 初始化导航器和事件处理器
     */
    private initNavigatorAndEventHandler(): void {
        // 导航器
        this.navigator = new FormattedTextNavigator(
            this.parser,
            this.formattedTexts,
            this.enabledFormats,
            this.fullContent,
            this.i18n,
            this.logger
        );

        // 事件处理器
        this.eventHandler = new FormattedTextEventHandler(
            this.fullContent,
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
     * 绑定事件
     */
    private bindEvents(): void {
        // 双击handle事件（主要交互方式）
        const handle = this.sheetContainer.querySelector('.bottom-sheet-handle') as HTMLElement;
        if (handle) {
            handle.addEventListener('touchstart', this.handleHandleTouch.bind(this), { passive: false });
            handle.addEventListener('click', this.handleHandleClick.bind(this));
        }
        
        // 点击横杠区域展开（在HALF状态下）
        if (handle) {
            handle.addEventListener('touchend', this.handleHandleExpandClick.bind(this));
        }
        
        // 触摸事件（用于向下拖拽收回）
        this.sheetContainer.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        this.sheetContainer.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        this.sheetContainer.addEventListener('touchend', this.handleTouchEnd.bind(this));
        
        // 鼠标事件（用于桌面端测试）
        this.sheetContainer.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.sheetContainer.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.sheetContainer.addEventListener('mouseup', this.handleMouseEnd.bind(this));
        
        // 背景点击关闭
        this.backdrop.addEventListener('click', () => {
            this.setState(BottomSheetState.PEEK);
        });
        
        // 绑定内容区域的事件
        this.eventHandler.bindEvents();
    }

    /**
     * 处理handle双击/点击事件
     */
    private handleHandleTouch(e: TouchEvent): void {
        e.preventDefault();
        e.stopPropagation();
        
        const currentTime = Date.now();
        const timeDiff = currentTime - this.lastTapTime;
        
        if (timeDiff < 300) { // 双击检测
            // 清除单击延时
            if (this.tapTimeout) {
                clearTimeout(this.tapTimeout);
                this.tapTimeout = null;
            }
            this.handleDoubleClick();
        } else {
            // 单击，设置延时检测
            if (this.tapTimeout) {
                clearTimeout(this.tapTimeout);
            }
            this.tapTimeout = window.setTimeout(() => {
                this.handleSingleClick();
            }, 300);
        }
        
        this.lastTapTime = currentTime;
    }
    
    /**
     * 处理handle展开点击事件（touchend）
     */
    private handleHandleExpandClick(e: TouchEvent): void {
        // 只在HALF状态下处理单击展开
        if (this.currentState !== BottomSheetState.HALF) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        // 延时处理，避免与双击冲突
        setTimeout(() => {
            if (this.currentState === BottomSheetState.HALF) {
                this.setState(BottomSheetState.FULL);
            }
        }, 350); // 稍微延时，确保双击检测完成
    }
    
    /**
     * 处理单击事件
     */
    private handleSingleClick(): void {
        if (this.currentState === BottomSheetState.HALF) {
            // 在HALF状态下单击 → 完全展开（FULL状态）
            this.setState(BottomSheetState.FULL);
        }
        // 其他状态下单击不做任何操作
    }
    
    /**
     * 处理handle点击事件（桌面端）
     */
    private handleHandleClick(e: MouseEvent): void {
        e.preventDefault();
        e.stopPropagation();
        
        const currentTime = Date.now();
        const timeDiff = currentTime - this.lastTapTime;
        
        if (timeDiff < 300) { // 双击检测
            this.handleDoubleClick();
        }
        
        this.lastTapTime = currentTime;
    }
    
    /**
     * 处理双击事件
     */
    private handleDoubleClick(): void {
        if (this.currentState === BottomSheetState.PEEK) {
            // 从PEEK状态双击 → 显示预览头部（HALF状态）
            this.setState(BottomSheetState.HALF);
        } else {
            // 从其他状态双击 → 收回到PEEK状态
            this.setState(BottomSheetState.PEEK);
        }
    }

    /**
     * 创建测试滚动内容（用于调试滚动问题）
     */
    private createTestScrollContent(): string {
        const testItems = Array.from({length: 50}, (_, i) => 
            `<div style="padding: 10px; border-bottom: 1px solid #eee;">测试项目 ${i + 1} - 这是一个测试滚动的长文本内容</div>`
        ).join('');
        
        return `
            <div style="
                display: flex; 
                flex-direction: column; 
                height: 300px; 
                background: #f5f5f5; 
                border: 2px solid red;
            ">
                <div style="
                    padding: 10px; 
                    background: #333; 
                    color: white; 
                    flex-shrink: 0;
                ">滚动测试头部</div>
                <div style="
                    flex: 1; 
                    overflow-y: auto; 
                    overflow-x: hidden;
                    background: white;
                    border: 2px solid blue;
                ">
                    ${testItems}
                </div>
            </div>
        `;
    }

    /**
     * 设置滚动样式（确认工作状态）
     */
    private forceScrollStyles(): void {
        setTimeout(() => {
            const scrollDiv = this.container.querySelector('div[style*="overflow-y: scroll"]');
            if (scrollDiv) {
                const formattedDock = scrollDiv.querySelector('.formatted-text-dock');
                
                // 确保事件绑定
                if (formattedDock) {
                    this.eventHandler.bindEvents();
                }
            }
        }, 200);
    }

    /**
     * 触摸开始（仅用于向下拖拽收回，不干扰内容滚动）
     */
    private handleTouchStart(e: TouchEvent): void {
        // 如果是handle区域，不处理拖拽（由双击处理）
        if ((e.target as Element).closest('.bottom-sheet-handle')) {
            return;
        }
        
        // 如果是内容区域，不处理拖拽，让它自由滚动
        if ((e.target as Element).closest('.formatted-text-dock__content')) {
            return;
        }
        
        // 只有在非PEEK状态下才允许拖拽收回
        if (this.currentState === BottomSheetState.PEEK) return;
        if (e.touches.length !== 1) return;
        
        this.isDragging = true;
        this.startY = e.touches[0].clientY;
        this.startTranslateY = this.currentTranslateY;
    }

    /**
     * 触摸移动（仅用于向下拖拽收回，不干扰内容滚动）
     */
    private handleTouchMove(e: TouchEvent): void {
        if (!this.isDragging || e.touches.length !== 1) return;
        
        // 如果是内容区域，不处理拖拽
        if ((e.target as Element).closest('.formatted-text-dock__content')) {
            return;
        }
        
        const currentY = e.touches[0].clientY;
        const deltaY = currentY - this.startY;
        
        // 只允许向下拖拽（deltaY > 0）
        if (deltaY <= 0) return;
        
        // 计算新的位置
        const newTranslateY = this.startTranslateY + deltaY;
        this.updatePosition(newTranslateY);
        this.currentTranslateY = newTranslateY;
        
        e.preventDefault();
    }

    /**
     * 触摸结束（仅用于向下拖拽收回，不干扰内容滚动）
     */
    private handleTouchEnd(e: TouchEvent): void {
        if (!this.isDragging) return;
        
        this.isDragging = false;
        
        const deltaY = e.changedTouches[0].clientY - this.startY;
        
        // 如果向下拖拽超过50px，则收回到PEEK状态
        if (deltaY > 50) {
            this.setState(BottomSheetState.PEEK);
        } else {
            // 否则回弹到当前状态
            this.updatePositionForState(this.currentState);
        }
    }

    /**
     * 鼠标事件处理（用于桌面端测试）
     */
    private handleMouseDown(e: MouseEvent): void {
        this.isDragging = true;
        this.startY = e.clientY;
        e.preventDefault();
    }

    private handleMouseMove(e: MouseEvent): void {
        if (!this.isDragging) return;
        
        const deltaY = e.clientY - this.startY;
        // 鼠标移动处理
    }

    private handleMouseEnd(e: MouseEvent): void {
        if (!this.isDragging) return;
        
        this.isDragging = false;
        
        const deltaY = e.clientY - this.startY;
        const velocity = Math.abs(deltaY);
        
        this.determineTargetState(deltaY, velocity);
    }

    /**
     * 根据移动距离和速度决定目标状态
     */
    private determineTargetState(deltaY: number, velocity: number): void {
        const threshold = 50;
        const fastSwipeThreshold = 100;
        
        let targetState = this.currentState;
        
        if (velocity > fastSwipeThreshold) {
            // 快速滑动
            if (deltaY > 0) {
                // 向下快速滑动
                targetState = BottomSheetState.PEEK;
            } else {
                // 向上快速滑动
                targetState = BottomSheetState.FULL;
            }
        } else {
            // 慢速滑动，根据距离判断
            if (this.currentState === BottomSheetState.PEEK) {
                if (deltaY < -threshold) {
                    targetState = BottomSheetState.HALF;
                }
            } else if (this.currentState === BottomSheetState.HALF) {
                if (deltaY < -threshold) {
                    targetState = BottomSheetState.FULL;
                } else if (deltaY > threshold) {
                    targetState = BottomSheetState.PEEK;
                }
            } else if (this.currentState === BottomSheetState.FULL) {
                if (deltaY > threshold) {
                    targetState = BottomSheetState.HALF;
                }
            }
        }
        
        this.setState(targetState);
    }

    /**
     * 设置抽屉状态
     */
    private setState(state: BottomSheetState): void {
        this.log(`设置底部抽屉状态: ${state}`);
        this.currentState = state;
        
        // 更新CSS类
        this.container.className = `mobile-bottom-sheet state-${state}`;
        
        // 更新位置
        this.updatePositionForState(state);
        
        // 更新背景遮罩
        this.updateBackdrop(state);
        
        // 如果是FULL状态，强制设置滚动样式
        if (state === BottomSheetState.FULL) {
            setTimeout(() => {
                this.forceScrollStyles();
            }, 100);
        }
    }

    /**
     * 根据状态更新位置
     */
    private updatePositionForState(state: BottomSheetState): void {
        let translateY: string;
        
        switch (state) {
            case BottomSheetState.CLOSED:
                translateY = '100%'; // 完全隐藏
                break;
            case BottomSheetState.PEEK:
                translateY = 'calc(100% - 12px)'; // 调整为12px高度，极致压缩
                break;
            case BottomSheetState.HALF:
                translateY = '50%'; // 半屏
                break;
            case BottomSheetState.FULL:
                translateY = '10vh'; // 使用视口高度单位，占用90%的屏幕高度
                break;
            default:
                translateY = 'calc(100% - 12px)'; // 默认PEEK状态，极致压缩
        }
        
        this.updatePosition(translateY, true);
    }

    /**
     * 更新位置
     */
    private updatePosition(translateY: string | number, animated = false): void {
        const style = this.sheetContainer.style;
        
        if (animated) {
            style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        } else {
            style.transition = 'none';
        }
        
        const transformValue = typeof translateY === 'string' ? translateY : `${translateY}px`;
        style.transform = `translateY(${transformValue})`;
        
        // 清除动画样式
        if (animated) {
            setTimeout(() => {
                style.transition = '';
            }, 300);
        }
    }

    /**
     * 更新背景遮罩
     */
    private updateBackdrop(state: BottomSheetState): void {
        let opacity: number;
        let pointerEvents: string;
        
        switch (state) {
            case BottomSheetState.CLOSED:
            case BottomSheetState.PEEK:
                opacity = 0;
                pointerEvents = 'none'; // PEEK状态不需要遮罩
                break;
            case BottomSheetState.HALF:
                opacity = 0.2; // 减少遮罩透明度
                pointerEvents = 'auto';
                break;
            case BottomSheetState.FULL:
                opacity = 0.3; // 减少遮罩透明度
                pointerEvents = 'auto';
                break;
            default:
                opacity = 0;
                pointerEvents = 'none';
        }
        
        this.backdrop.style.opacity = opacity.toString();
        this.backdrop.style.pointerEvents = pointerEvents;
    }

    /**
     * 文档变更时调用 - 复用现有逻辑
     */
    public onDocumentChange(): void {
        this.log('文档变更事件被触发');
        
        // 清除之前的定时器
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }
        
        this.refreshTimer = window.setTimeout(() => {
            this.log('延迟刷新开始执行');
            
            const currentEditor = EditorUtils.getCurrentActiveEditor(this.logger);
            const newBlockId = currentEditor?.protyle?.block?.rootID;
            
            if (newBlockId && newBlockId !== this.currentBlockId) {
                this.log(`检测到文档切换: ${this.currentBlockId} -> ${newBlockId}`);
                this.refresh(true);
            } else if (newBlockId === this.currentBlockId) {
                this.log('同一文档，使用缓存刷新');
                this.refresh(false);
            } else {
                this.log('无有效文档，跳过刷新');
            }
            
            this.refreshTimer = undefined;
        }, 200);
    }

    /**
     * 处理文档只读状态变化
     */
    private onReadonlyStateChange(isReadonly: boolean): void {
        this.log(`处理状态变化: ${isReadonly ? '🔒 锁定' : '✏️ 解锁'}`);
        this.renderList();
    }

    /**
     * 刷新数据 - 复用现有逻辑
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
                enabledFormats: this.enabledFormats,
                maxResults: 200,
                includeContext: true
            };

            this.formattedTexts = await this.parser.parseFormattedTexts(blockId, options);
            this.log(`数据库查询结果: ${this.formattedTexts.length} 项`);
            
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
        // 更新peek内容
        this.updatePeekContent();
        
        // 更新完整内容
        const content = this.fullContent.querySelector<HTMLElement>(".formatted-text-dock__content");
        if (!content) {
            this.log('未找到内容容器元素');
            return;
        }

        const activeFormats = this.getActiveFormats();
        const filteredItems = this.formattedTexts.filter(item => activeFormats.indexOf(item.type) !== -1);
        
        if (filteredItems.length === 0) {
            this.showEmpty(this.i18n.noMatchingFormat);
            return;
        }

        const groupedItems = FormattedTextUtils.groupItems(filteredItems);
        const listHTML = this.uiRenderer.createListHTML(groupedItems);

        content.innerHTML = `<div class="formatted-text-dock__list">${listHTML}</div>`;
        
        // 绑定点击事件
        this.eventHandler.bindItemEvents(content);
        this.log('列表渲染完成');
    }

    /**
     * 更新peek内容（预览状态显示的简要信息）
     */
    private updatePeekContent(): void {
        const activeFormats = this.getActiveFormats();
        const filteredItems = this.formattedTexts.filter(item => activeFormats.indexOf(item.type) !== -1);
        
        if (filteredItems.length === 0) {
            this.peekContent.innerHTML = `
                <div class="peek-summary">
                    <span class="peek-title">${this.i18n.dockTitle || '格式化文本'}</span>
                    <span class="peek-subtitle">${this.i18n.noFormattedText || '暂无内容'}</span>
                </div>
            `;
        } else {
            // 显示各类型的数量统计
            const typeGroups = FormattedTextUtils.groupItems(filteredItems);
            const summary = Array.from(typeGroups.keys()).slice(0, 3).join(', ');
            
            this.peekContent.innerHTML = `
                <div class="peek-summary">
                    <span class="peek-title">${this.i18n.dockTitle || '格式化文本'}</span>
                    <span class="peek-subtitle">找到 ${filteredItems.length} 个内容 · ${summary}${typeGroups.size > 3 ? '...' : ''}</span>
                </div>
                <div class="peek-action">
                    <div class="peek-arrow">⌃</div>
                </div>
            `;
        }
    }

    /**
     * 其他复用方法
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
        
        this.eventHandler.updateEnabledFormats(this.enabledFormats);
        this.log('当前启用的格式类型:', this.enabledFormats);
        
        // 保存筛选状态
        if (this.onFilterChange) {
            this.onFilterChange(this.enabledFormats);
        }
        
        this.renderList();
    }

    private getActiveFormats(): TextFormatType[] {
        return [...this.enabledFormats];
    }

    private showLoading(): void {
        this.updatePeekContent();
        const content = this.fullContent.querySelector<HTMLElement>(".formatted-text-dock__content");
        if (content) {
            content.innerHTML = this.uiRenderer.createLoadingHTML();
        }
    }

    private showEmpty(message: string): void {
        this.updatePeekContent();
        const content = this.fullContent.querySelector<HTMLElement>(".formatted-text-dock__content");
        if (content) {
            content.innerHTML = this.uiRenderer.createEmptyHTML(message);
        }
    }

    /**
     * 销毁组件
     */
    public destroy(): void {
        this.log('开始销毁组件');
        
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = undefined;
        }
        
        // 移除文档状态变化监听器
        if (this.readonlyStateChangeHandler) {
            DocumentReadonlyChecker.removeStateChangeListener(this.readonlyStateChangeHandler);
        }
        
        // 销毁各个模块
        this.memoManager?.destroy();
        this.navigator?.destroy();
        
        // 移除DOM元素
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        
        this.log('组件销毁完成');
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
