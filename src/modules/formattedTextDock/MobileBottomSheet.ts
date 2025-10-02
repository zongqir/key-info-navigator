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
    
    // 状态监听器
    private readonlyStateChangeHandler: (isReadonly: boolean) => void;

    constructor(
        private i18n: any,
        private logger?: (...args: any[]) => void
    ) {
        console.log('[MobileBottomSheet] 🚀 构造函数开始初始化');
        this.log('MobileBottomSheet 构造函数开始初始化');
        this.parser = new TextFormatParser(logger);
        
        // 初始化状态变化处理器
        this.readonlyStateChangeHandler = (isReadonly: boolean) => {
            this.log(`🔄 [MobileBottomSheet] 文档状态变化: ${isReadonly ? '🔒 锁定' : '✏️ 解锁'}`);
            this.onReadonlyStateChange(isReadonly);
        };
        
        // 初始化功能模块
        console.log('[MobileBottomSheet] 📦 初始化功能模块');
        this.log('初始化功能模块');
        this.initModules();
        
        // 创建UI
        console.log('[MobileBottomSheet] 🎨 创建移动端UI');
        this.log('创建移动端UI');
        this.createUI();
        
        // 添加文档状态变化监听器
        console.log('[MobileBottomSheet] 👂 添加文档状态变化监听器');
        this.log('添加文档状态变化监听器');
        DocumentReadonlyChecker.addStateChangeListener(this.readonlyStateChangeHandler);
        
        console.log('[MobileBottomSheet] 🔄 开始初始刷新');
        this.log('开始初始刷新');
        this.refresh(true); // 初始化时强制刷新
        
        console.log('[MobileBottomSheet] ✅ 构造函数初始化完成');
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
        console.log('[MobileBottomSheet] 🎨 开始创建移动端UI DOM结构');
        
        // 创建主容器
        this.container = document.createElement('div');
        this.container.className = 'mobile-bottom-sheet';
        console.log('[MobileBottomSheet] 📦 创建主容器:', this.container);
        
        // 创建背景遮罩
        this.backdrop = document.createElement('div');
        this.backdrop.className = 'bottom-sheet-backdrop';
        console.log('[MobileBottomSheet] 🌫️ 创建背景遮罩:', this.backdrop);
        
        // 创建抽屉容器
        this.sheetContainer = document.createElement('div');
        this.sheetContainer.className = 'bottom-sheet-container';
        console.log('[MobileBottomSheet] 📋 创建抽屉容器:', this.sheetContainer);
        
        // 创建拖拽手柄
        this.handle = document.createElement('div');
        this.handle.className = 'bottom-sheet-handle';
        this.handle.innerHTML = '<div class="handle-bar"></div>';
        console.log('[MobileBottomSheet] ✋ 创建拖拽手柄:', this.handle);
        
        // 创建预览内容（PEEK状态显示）
        this.peekContent = document.createElement('div');
        this.peekContent.className = 'bottom-sheet-peek-content';
        console.log('[MobileBottomSheet] 👀 创建预览内容容器:', this.peekContent);
        
        // 创建完整内容容器
        this.fullContent = document.createElement('div');
        this.fullContent.className = 'bottom-sheet-full-content';
        this.fullContent.innerHTML = this.uiRenderer.createMainHTML();
        console.log('[MobileBottomSheet] 📄 创建完整内容容器:', this.fullContent);
        
        // 组装DOM结构
        this.sheetContainer.appendChild(this.handle);
        this.sheetContainer.appendChild(this.peekContent);
        this.sheetContainer.appendChild(this.fullContent);
        
        this.container.appendChild(this.backdrop);
        this.container.appendChild(this.sheetContainer);
        
        console.log('[MobileBottomSheet] 🌳 DOM结构组装完成');
        console.log('[MobileBottomSheet] 📍 准备添加到document.body');
        console.log('[MobileBottomSheet] 🔍 当前document.body存在吗?', !!document.body);
        
        // 添加到body
        if (document.body) {
            document.body.appendChild(this.container);
            console.log('[MobileBottomSheet] ✅ 成功添加到document.body');
            console.log('[MobileBottomSheet] 📊 document.body子元素数量:', document.body.children.length);
        } else {
            console.error('[MobileBottomSheet] ❌ document.body不存在，无法添加DOM元素');
        }
        
        // 在DOM创建后初始化导航器和事件处理器
        console.log('[MobileBottomSheet] 🔧 初始化导航器和事件处理器');
        this.initNavigatorAndEventHandler();
        
        // 绑定事件
        console.log('[MobileBottomSheet] 🔗 绑定事件');
        this.bindEvents();
        
        // 初始状态设置
        console.log('[MobileBottomSheet] 🎯 设置初始状态为PEEK');
        this.setState(BottomSheetState.PEEK);
        
        console.log('[MobileBottomSheet] ✅ UI创建完成');
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
        // 触摸事件
        this.sheetContainer.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        this.sheetContainer.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        this.sheetContainer.addEventListener('touchend', this.handleTouchEnd.bind(this));
        
        // 鼠标事件（用于桌面端测试）
        this.sheetContainer.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.sheetContainer.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.sheetContainer.addEventListener('mouseup', this.handleMouseEnd.bind(this));
        
        // 背景点击关闭
        this.backdrop.addEventListener('click', () => {
            if (this.currentState !== BottomSheetState.PEEK) {
                this.setState(BottomSheetState.PEEK);
            }
        });
        
        // 绑定内容区域的事件
        this.eventHandler.bindEvents();
    }

    /**
     * 触摸开始
     */
    private handleTouchStart(e: TouchEvent): void {
        if (e.touches.length !== 1) return;
        
        this.isDragging = true;
        this.startY = e.touches[0].clientY;
        this.startTranslateY = this.currentTranslateY;
        
        // 阻止默认滚动行为（仅在handle区域）
        if ((e.target as Element).closest('.bottom-sheet-handle')) {
            e.preventDefault();
        }
    }

    /**
     * 触摸移动
     */
    private handleTouchMove(e: TouchEvent): void {
        if (!this.isDragging || e.touches.length !== 1) return;
        
        const currentY = e.touches[0].clientY;
        const deltaY = currentY - this.startY;
        
        // 只在handle区域或者向下滑动时处理
        const isHandleArea = (e.target as Element).closest('.bottom-sheet-handle');
        const isSwipingDown = deltaY > 0;
        
        if (isHandleArea || isSwipingDown) {
            // 简化处理：只记录滑动方向和距离，最终状态在touchend时确定
            console.log(`[MobileBottomSheet] 👆 滑动: deltaY=${deltaY}px`);
            e.preventDefault();
        }
    }

    /**
     * 触摸结束
     */
    private handleTouchEnd(e: TouchEvent): void {
        if (!this.isDragging) return;
        
        this.isDragging = false;
        
        const deltaY = e.changedTouches[0].clientY - this.startY;
        const velocity = Math.abs(deltaY);
        
        console.log(`[MobileBottomSheet] 🏁 触摸结束: deltaY=${deltaY}px, velocity=${velocity}`);
        
        this.determineTargetState(deltaY, velocity);
    }

    /**
     * 鼠标事件处理（用于桌面端测试）
     */
    private handleMouseDown(e: MouseEvent): void {
        this.isDragging = true;
        this.startY = e.clientY;
        console.log(`[MobileBottomSheet] 🖱️ 鼠标按下: Y=${e.clientY}`);
        e.preventDefault();
    }

    private handleMouseMove(e: MouseEvent): void {
        if (!this.isDragging) return;
        
        const deltaY = e.clientY - this.startY;
        console.log(`[MobileBottomSheet] 🖱️ 鼠标移动: deltaY=${deltaY}px`);
    }

    private handleMouseEnd(e: MouseEvent): void {
        if (!this.isDragging) return;
        
        this.isDragging = false;
        
        const deltaY = e.clientY - this.startY;
        const velocity = Math.abs(deltaY);
        
        console.log(`[MobileBottomSheet] 🖱️ 鼠标释放: deltaY=${deltaY}px, velocity=${velocity}`);
        
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
    }

    /**
     * 根据状态更新位置
     */
    private updatePositionForState(state: BottomSheetState): void {
        let translateY: string;
        
        console.log(`[MobileBottomSheet] 🎯 更新位置状态: ${state}`);
        console.log(`[MobileBottomSheet] 📏 当前屏幕高度: ${window.innerHeight}px`);
        
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
                translateY = '80px'; // 增加顶部空间，确保不遮挡闪卡等重要内容
                break;
            default:
                translateY = 'calc(100% - 12px)'; // 默认PEEK状态，极致压缩
        }
        
        console.log(`[MobileBottomSheet] 📐 计算得到的translateY: ${translateY}`);
        
        this.updatePosition(translateY, true);
    }

    /**
     * 更新位置
     */
    private updatePosition(translateY: string | number, animated = false): void {
        const style = this.sheetContainer.style;
        
        console.log(`[MobileBottomSheet] 🎨 更新位置: ${translateY}, 动画: ${animated}`);
        
        if (animated) {
            style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        } else {
            style.transition = 'none';
        }
        
        const transformValue = typeof translateY === 'string' ? translateY : `${translateY}px`;
        style.transform = `translateY(${transformValue})`;
        
        console.log(`[MobileBottomSheet] ✅ 应用transform: translateY(${transformValue})`);
        
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
        
        console.log(`[MobileBottomSheet] 🌫️ 更新遮罩: opacity=${opacity}, pointerEvents=${pointerEvents}`);
        
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
        this.log(`🔄 [MobileBottomSheet] 处理状态变化: ${isReadonly ? '🔒 锁定' : '✏️ 解锁'} - 开始刷新`);
        this.renderList();
        this.log('🔄 [MobileBottomSheet] 状态变化处理完成');
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
        this.log('开始渲染移动端列表');
        
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
            this.log('没有匹配的格式化文本，显示空状态');
            this.showEmpty(this.i18n.noMatchingFormat);
            return;
        }

        const groupedItems = FormattedTextUtils.groupItems(filteredItems);
        const listHTML = this.uiRenderer.createListHTML(groupedItems);

        content.innerHTML = `<div class="formatted-text-dock__list">${listHTML}</div>`;
        
        // 绑定点击事件
        this.eventHandler.bindItemEvents(content);
        this.log('移动端列表渲染完成并绑定事件');
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
        this.log('🔄 [MobileBottomSheet] 开始销毁组件');
        
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = undefined;
        }
        
        // 移除文档状态变化监听器
        if (this.readonlyStateChangeHandler) {
            this.log('🔄 [MobileBottomSheet] 移除状态变化监听器');
            DocumentReadonlyChecker.removeStateChangeListener(this.readonlyStateChangeHandler);
        }
        
        // 销毁各个模块
        this.memoManager?.destroy();
        this.navigator?.destroy();
        
        // 移除DOM元素
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        
        this.log('🔄 [MobileBottomSheet] 组件销毁完成');
    }

    /**
     * 日志输出
     */
    private log(...args: any[]): void {
        if (this.logger) {
            this.logger('[MobileBottomSheet]', ...args);
        }
    }
}
