/**
 * 文档只读状态检查器
 * 检查当前文档是否处于只读状态（锁定编辑）
 */
export class DocumentReadonlyChecker {
    private static observer: MutationObserver | null = null;
    private static currentState: boolean | null = null;
    private static changeCallbacks: Array<(isReadonly: boolean) => void> = [];
    
    /**
     * 检查文档是否处于只读状态（锁定编辑）
     * @returns true = 只读（锁定），false = 可编辑（解锁）
     */
    public static checkDocumentReadonly(): boolean {
        // 查找面包屑锁按钮
        const readonlyBtn = document.querySelector('.protyle-breadcrumb button[data-type="readonly"]');
        
        if (!readonlyBtn) {
            console.warn('未找到面包屑锁按钮');
            return false; // 找不到按钮，默认认为可编辑
        }
        
        const ariaLabel = readonlyBtn.getAttribute('aria-label') || '';
        const dataSubtype = readonlyBtn.getAttribute('data-subtype') || '';
        const iconHref = readonlyBtn.querySelector('use')?.getAttribute('xlink:href') || '';
        
        // 判断是否解锁状态（可编辑）
        // 解锁状态的特征：
        // 1. data-subtype="unlock" → 已解锁（可编辑）
        // 2. aria-label 包含 "取消" → 已解锁（"取消临时解锁"）
        // 3. 图标是 #iconUnlock → 已解锁
        const isUnlocked = 
            dataSubtype === 'unlock' || 
            ariaLabel.includes('取消') ||   // "取消临时解锁" → 当前已解锁
            iconHref === '#iconUnlock';
        
        const isReadonly = !isUnlocked;  // 只读 = 非解锁状态
        
        console.log('文档状态检查:', {
            '找到按钮': !!readonlyBtn,
            'aria-label': ariaLabel,
            'data-subtype': dataSubtype,
            '图标href': iconHref,
            '是否解锁': isUnlocked ? '✏️ 是（可编辑）' : '🔒 否（已锁定）',
            '是否只读': isReadonly ? '🔒 是（锁定）' : '✏️ 否（解锁）'
        });
        
        return isReadonly;
    }
    
    /**
     * 获取用户友好的文档状态描述
     */
    public static getDocumentStatusText(): string {
        const isReadonly = this.checkDocumentReadonly();
        return isReadonly ? '文档已锁定，无法编辑' : '文档可编辑';
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
     */
    public static addStateChangeListener(callback: (isReadonly: boolean) => void): void {
        this.changeCallbacks.push(callback);
        console.log(`🔄 [DocumentReadonlyChecker] 添加状态变化监听器，当前监听器数量: ${this.changeCallbacks.length}`);
        
        // 如果是第一个监听器，开始监听DOM变化
        if (this.changeCallbacks.length === 1) {
            this.startMonitoring();
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
     */
    private static startMonitoring(): void {
        if (this.observer) {
            console.log('🔄 [DocumentReadonlyChecker] 监听器已经在运行');
            return;
        }
        
        console.log('🔄 [DocumentReadonlyChecker] 开始监听文档状态变化');
        
        // 初始化当前状态
        this.currentState = this.checkDocumentReadonly();
        console.log('🔄 [DocumentReadonlyChecker] 初始状态:', this.currentState ? '🔒 锁定' : '✏️ 解锁');
        
        // 创建MutationObserver监听面包屑区域的变化
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
        
        console.log('🔄 [DocumentReadonlyChecker] 监听器已启动，监听节点:', targetNode);
    }
    
    /**
     * 停止监听文档状态变化
     */
    private static stopMonitoring(): void {
        if (this.observer) {
            console.log('🔄 [DocumentReadonlyChecker] 停止监听文档状态变化');
            this.observer.disconnect();
            this.observer = null;
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
    public static getMonitoringStatus(): { isMonitoring: boolean; listenerCount: number; currentState: boolean | null } {
        return {
            isMonitoring: this.observer !== null,
            listenerCount: this.changeCallbacks.length,
            currentState: this.currentState
        };
    }
}
