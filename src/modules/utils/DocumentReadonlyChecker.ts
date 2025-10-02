import { isCurrentDocumentReadonly, getDocumentStatusText } from './ReadonlyButtonUtils';

/**
 * 文档只读状态检查器（监听器版本）
 * 提供文档只读状态的实时监听和变化通知功能
 * 
 * 核心功能：
 * - 使用 ReadonlyButtonUtils 获取准确的状态
 * - 监听 DOM 变化，实时检测状态变更
 * - 支持订阅/取消订阅状态变化事件
 * 
 * 注意：本类主要用于需要监听状态变化的场景
 * 如果只是一次性检查状态，请直接使用 ReadonlyButtonUtils
 */
export class DocumentReadonlyChecker {
    private static observer: MutationObserver | null = null;
    private static currentState: boolean | null = null;
    private static changeCallbacks: Array<(isReadonly: boolean) => void> = [];
    private static pollingTimer: number | null = null; // 定时检查的定时器ID
    
    /**
     * 检查文档是否处于只读状态（锁定编辑）
     * @returns true = 只读（锁定），false = 可编辑（解锁）
     * @deprecated 建议直接使用 ReadonlyButtonUtils.isCurrentDocumentReadonly()
     */
    public static checkDocumentReadonly(): boolean {
        // 使用统一的工具类，确保多策略查找的准确性
        return isCurrentDocumentReadonly();
    }
    
    /**
     * 获取用户友好的文档状态描述
     * @deprecated 建议直接使用 ReadonlyButtonUtils.getDocumentStatusText()
     */
    public static getDocumentStatusText(): string {
        return getDocumentStatusText();
    }
    
    /**
     * 获取解锁提示消息
     */
    public static getUnlockPromptMessage(): string {
        return '当前文档处于只读状态，请先点击面包屑中的🔒锁定按钮解锁后再进行编辑操作';
    }
    
    /**
     * 显示解锁提示
     */
    public static showUnlockPrompt(
        showMessage?: (msg: string, timeout?: number, type?: string) => void, 
        customMessage?: string
    ): void {
        const message = customMessage || this.getUnlockPromptMessage();
        console.warn('🔒 文档只读状态提示:', message);
        
        if (showMessage) {
            showMessage(`🔒 ${message}`, 4000, 'warning');
        } else {
            // 降级到浏览器原生提示
            alert(`🔒 ${message}`);
        }
    }
    
    /**
     * 添加状态变化监听器
     * @param callback 状态变化回调函数
     * @param enablePolling 是否启用定时检查兜底（默认false，使用纯事件驱动）
     */
    public static addStateChangeListener(
        callback: (isReadonly: boolean) => void, 
        enablePolling: boolean = false
    ): void {
        this.changeCallbacks.push(callback);
        console.log(`🔄 [DocumentReadonlyChecker] 添加状态变化监听器，当前监听器数量: ${this.changeCallbacks.length}`);
        
        // 如果是第一个监听器，开始监听DOM变化
        if (this.changeCallbacks.length === 1) {
            this.startMonitoring(enablePolling);
        }
    }
    
    /**
     * 移除状态变化监听器
     */
    public static removeStateChangeListener(callback: (isReadonly: boolean) => void): void {
        const index = this.changeCallbacks.indexOf(callback);
        if (index > -1) {
            this.changeCallbacks.splice(index, 1);
            console.log(`🔄 [DocumentReadonlyChecker] 移除状态变化监听器，剩余监听器数量: ${this.changeCallbacks.length}`);
        }
        
        // 如果没有监听器了，停止监听DOM变化
        if (this.changeCallbacks.length === 0) {
            this.stopMonitoring();
        }
    }
    
    /**
     * 开始监听文档状态变化
     * @param enablePolling 是否启用定时检查兜底（默认false）
     */
    private static startMonitoring(enablePolling: boolean = false): void {
        if (this.observer) {
            console.log('🔄 [DocumentReadonlyChecker] 监听器已经在运行');
            return;
        }
        
        console.log('🔄 [DocumentReadonlyChecker] 开始监听文档状态变化', 
            enablePolling ? '(MutationObserver + 定时检查兜底)' : '(纯 MutationObserver)');
        
        // 初始化当前状态
        this.currentState = this.checkDocumentReadonly();
        console.log('🔄 [DocumentReadonlyChecker] 初始状态:', this.currentState ? '🔒 锁定' : '✏️ 解锁');
        
        // 创建MutationObserver监听面包屑区域的变化（主要监听机制）
        this.observer = new MutationObserver((mutations) => {
            let shouldCheck = false;
            
            mutations.forEach((mutation) => {
                // 监听属性变化和子树变化
                if (mutation.type === 'attributes' || mutation.type === 'childList') {
                    const target = mutation.target as Element;
                    
                    // 检查是否是面包屑区域的相关变化
                    if (target.closest('.protyle-breadcrumb') || 
                        target.matches('.protyle-breadcrumb *') ||
                        (mutation.type === 'attributes' && 
                         (mutation.attributeName === 'aria-label' || 
                          mutation.attributeName === 'data-subtype' ||
                          mutation.attributeName === 'xlink:href'))) {
                        shouldCheck = true;
                    }
                }
            });
            
            if (shouldCheck) {
                this.checkStateChange();
            }
        });
        
        // 监听整个文档的变化，但重点关注面包屑区域
        const targetNode = document.querySelector('.protyle-breadcrumb') || document.body;
        this.observer.observe(targetNode, {
            attributes: true,
            childList: true,
            subtree: true,
            attributeFilter: ['aria-label', 'data-subtype', 'xlink:href']
        });
        
        console.log('🔄 [DocumentReadonlyChecker] MutationObserver已启动，监听节点:', targetNode);
        
        // 可选：启动定时检查作为兜底（防止MutationObserver漏检）
        if (enablePolling) {
            this.pollingTimer = window.setInterval(() => {
                this.checkStateChange();
            }, 3000); // 每3秒检查一次作为兜底
            
            console.log('🔄 [DocumentReadonlyChecker] 定时检查兜底已启动（每3秒）');
        }
    }
    
    /**
     * 停止监听文档状态变化
     */
    private static stopMonitoring(): void {
        if (this.observer) {
            console.log('🔄 [DocumentReadonlyChecker] 停止 MutationObserver 监听');
            this.observer.disconnect();
            this.observer = null;
        }
        
        // 停止定时检查
        if (this.pollingTimer !== null) {
            console.log('🔄 [DocumentReadonlyChecker] 停止定时检查兜底');
            clearInterval(this.pollingTimer);
            this.pollingTimer = null;
        }
        
        this.currentState = null;
    }
    
    /**
     * 检查状态是否发生变化
     */
    private static checkStateChange(): void {
        const newState = this.checkDocumentReadonly();
        
        if (this.currentState !== newState) {
            console.log(`🔄 [DocumentReadonlyChecker] 状态发生变化: ${this.currentState ? '🔒' : '✏️'} → ${newState ? '🔒' : '✏️'}`);
            
            this.currentState = newState;
            
            // 通知所有监听器
            this.changeCallbacks.forEach(callback => {
                try {
                    callback(newState);
                } catch (error) {
                    console.error('🔄 [DocumentReadonlyChecker] 监听器回调执行失败:', error);
                }
            });
        }
    }
    
    /**
     * 手动触发状态检查（用于调试或强制检查）
     */
    public static forceCheckStateChange(): void {
        console.log('🔄 [DocumentReadonlyChecker] 手动触发状态检查');
        this.checkStateChange();
    }
    
    /**
     * 获取当前监听器状态信息
     */
    public static getMonitoringStatus(): { 
        isMonitoring: boolean; 
        isPollingEnabled: boolean;
        listenerCount: number; 
        currentState: boolean | null;
    } {
        return {
            isMonitoring: this.observer !== null,
            isPollingEnabled: this.pollingTimer !== null,
            listenerCount: this.changeCallbacks.length,
            currentState: this.currentState
        };
    }
}
