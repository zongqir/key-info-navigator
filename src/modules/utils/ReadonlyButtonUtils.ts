/**
 * 锁按钮工具类
 * 提供统一的"获取当前激活tab的锁按钮"和"判断文档只读状态"的功能
 * 
 * 核心功能：
 * - getCurrentActiveReadonlyButton() - 多策略获取当前激活文档的锁按钮
 * - isCurrentDocumentReadonly() - 检查当前文档是否只读（已锁定）
 * - isCurrentDocumentEditable() - 检查当前文档是否可编辑（已解锁）
 */

import { Logger } from './Logger';

/**
 * 获取当前激活文档的锁按钮
 * 使用多策略查找，确保在多tab场景下准确找到当前激活的tab的锁按钮
 * 
 * 查找策略（按优先级）：
 * 1. 🥇 优先：通过思源 getActiveTab() API 获取（最准确）
 * 2. 🥈 次选：通过焦点元素 document.activeElement 向上查找
 * 3. 🥉 备选：查找活跃窗口 .layout__wnd--active
 * 4. 🆘 兜底：全局查找第一个（可能不准确，会有警告日志）
 * 
 * @returns HTMLElement | null - 找到的锁按钮元素，未找到返回null
 */
export function getCurrentActiveReadonlyButton(): HTMLElement | null {
    Logger.debug('🔍 [ReadonlyButton] 开始查找当前活跃文档的锁按钮...');
    
    // ========== 策略1: 尝试使用思源 getActiveTab API（最准确）==========
    try {
        // 动态导入思源API，避免在非思源环境下报错
        const siyuan = (window as any).siyuan;
        
        if (siyuan?.getActiveTab) {
            const activeTab = siyuan.getActiveTab();
            Logger.debug('🔍 [ReadonlyButton] 思源getActiveTab返回:', {
                hasActiveTab: !!activeTab,
                tabId: activeTab?.id,
                type: activeTab?.type
            });
            
            // 尝试从 protyle 对象中获取锁按钮
            if (activeTab?.model?.editor?.protyle) {
                const protyle = activeTab.model.editor.protyle;
                const readonlyBtn = protyle.element?.querySelector(
                    '.protyle-breadcrumb button[data-type="readonly"]'
                ) as HTMLElement;
                
                if (readonlyBtn) {
                    const iconHref = readonlyBtn.querySelector('use')?.getAttribute('xlink:href') || '';
                    Logger.log('✅ [ReadonlyButton] 策略1成功 - 通过getActiveTab找到锁按钮:', {
                        iconHref,
                        ariaLabel: readonlyBtn.getAttribute('aria-label')
                    });
                    return readonlyBtn;
                }
            }
            
            // 尝试从 activeTab.element 中获取
            if (activeTab?.element) {
                const readonlyBtn = activeTab.element.querySelector(
                    '.protyle-breadcrumb button[data-type="readonly"]'
                ) as HTMLElement;
                
                if (readonlyBtn) {
                    const iconHref = readonlyBtn.querySelector('use')?.getAttribute('xlink:href') || '';
                    Logger.log('✅ [ReadonlyButton] 策略1成功 - 通过activeTab.element找到锁按钮:', {
                        iconHref,
                        ariaLabel: readonlyBtn.getAttribute('aria-label')
                    });
                    return readonlyBtn;
                }
            }
        }
    } catch (error) {
        Logger.debug('⚠️ [ReadonlyButton] getActiveTab API不可用:', error);
    }
    
    // ========== 策略2: 通过焦点元素查找 ==========
    const focusedElement = document.activeElement;
    Logger.debug('🔍 [ReadonlyButton] 当前焦点元素:', {
        tagName: focusedElement?.tagName,
        className: (focusedElement as HTMLElement)?.className
    });
    
    if (focusedElement) {
        // 向上查找到 .protyle 容器
        const protyleContainer = focusedElement.closest('.protyle');
        
        if (protyleContainer) {
            const readonlyBtn = protyleContainer.querySelector(
                '.protyle-breadcrumb button[data-type="readonly"]'
            ) as HTMLElement;
            
            if (readonlyBtn) {
                const iconHref = readonlyBtn.querySelector('use')?.getAttribute('xlink:href') || '';
                Logger.log('✅ [ReadonlyButton] 策略2成功 - 通过焦点元素找到锁按钮:', {
                    iconHref,
                    ariaLabel: readonlyBtn.getAttribute('aria-label')
                });
                return readonlyBtn;
            }
        }
    }
    
    // ========== 策略3: 查找活跃窗口 ==========
    const activeWnd = document.querySelector('.layout__wnd--active');
    Logger.debug('🔍 [ReadonlyButton] 活跃窗口:', {
        found: !!activeWnd
    });
    
    if (activeWnd) {
        const readonlyBtn = activeWnd.querySelector(
            '.protyle-breadcrumb button[data-type="readonly"]'
        ) as HTMLElement;
        
        if (readonlyBtn) {
            const iconHref = readonlyBtn.querySelector('use')?.getAttribute('xlink:href') || '';
            Logger.log('✅ [ReadonlyButton] 策略3成功 - 通过活跃窗口找到锁按钮:', {
                iconHref,
                ariaLabel: readonlyBtn.getAttribute('aria-label')
            });
            return readonlyBtn;
        }
    }
    
    // ========== 策略4: 兜底方案 - 全局查找第一个（可能不准确）==========
    const readonlyBtn = document.querySelector(
        '.protyle-breadcrumb button[data-type="readonly"]'
    ) as HTMLElement;
    
    if (readonlyBtn) {
        const iconHref = readonlyBtn.querySelector('use')?.getAttribute('xlink:href') || '';
        Logger.warn('⚠️ [ReadonlyButton] 策略4兜底 - 使用第一个找到的锁按钮（可能不准确）:', {
            iconHref,
            ariaLabel: readonlyBtn.getAttribute('aria-label'),
            hint: '在多tab场景下可能拿到错误的锁按钮'
        });
        return readonlyBtn;
    }
    
    // ========== 未找到 ==========
    Logger.warn('❌ [ReadonlyButton] 未找到锁按钮（所有策略都失败）');
    return null;
}

/**
 * 检查当前激活文档是否处于只读状态（已锁定）
 * 
 * @returns boolean
 *  - true: 只读模式（已锁定🔒）
 *  - false: 可编辑模式（已解锁✏️）或未找到锁按钮
 */
export function isCurrentDocumentReadonly(): boolean {
    const readonlyBtn = getCurrentActiveReadonlyButton();
    
    if (!readonlyBtn) {
        Logger.debug('🔍 [ReadonlyButton] 未找到锁按钮，默认返回false（可编辑）');
        return false; // 找不到按钮，默认认为可编辑
    }
    
    // 获取按钮的状态属性
    const ariaLabel = readonlyBtn.getAttribute('aria-label') || '';
    const dataSubtype = readonlyBtn.getAttribute('data-subtype') || '';
    const iconHref = readonlyBtn.querySelector('use')?.getAttribute('xlink:href') || '';
    
    // 判断是否解锁状态（可编辑）
    // 解锁状态的特征（基于思源源码）：
    // 1. data-subtype="unlock" → 已解锁（可编辑）
    // 2. aria-label 包含 "取消" → 已解锁（"取消临时解锁"）
    // 3. 图标是 #iconUnlock → 已解锁
    const isUnlocked = 
        dataSubtype === 'unlock' || 
        ariaLabel.includes('取消') ||   // "取消临时解锁" → 当前已解锁
        iconHref === '#iconUnlock';
    
    const isReadonly = !isUnlocked;  // 只读 = 非解锁状态
    
    Logger.debug('🔍 [ReadonlyButton] 文档状态检查:', {
        'aria-label': ariaLabel,
        'data-subtype': dataSubtype,
        '图标href': iconHref,
        '是否解锁': isUnlocked ? '✏️ 是（可编辑）' : '🔒 否（已锁定）',
        '是否只读': isReadonly ? '🔒 是（锁定）' : '✏️ 否（解锁）'
    });
    
    return isReadonly;
}

/**
 * 检查当前激活文档是否可编辑（已解锁）
 * 
 * @returns boolean
 *  - true: 可编辑（已解锁🔓）
 *  - false: 只读（已锁定🔒）或未找到锁按钮
 */
export function isCurrentDocumentEditable(): boolean {
    return !isCurrentDocumentReadonly();
}

/**
 * 获取用户友好的文档状态描述
 */
export function getDocumentStatusText(): string {
    const isReadonly = isCurrentDocumentReadonly();
    return isReadonly ? '文档已锁定🔒（只读模式）' : '文档已解锁✏️（可编辑）';
}

/**
 * 获取当前文档的详细状态信息（用于调试）
 */
export function getDocumentStatusDetail(): {
    hasButton: boolean;
    isReadonly: boolean;
    isEditable: boolean;
    ariaLabel: string;
    dataSubtype: string;
    iconHref: string;
    statusText: string;
} {
    const readonlyBtn = getCurrentActiveReadonlyButton();
    
    if (!readonlyBtn) {
        return {
            hasButton: false,
            isReadonly: false,
            isEditable: true,
            ariaLabel: '',
            dataSubtype: '',
            iconHref: '',
            statusText: '未找到锁按钮'
        };
    }
    
    const ariaLabel = readonlyBtn.getAttribute('aria-label') || '';
    const dataSubtype = readonlyBtn.getAttribute('data-subtype') || '';
    const iconHref = readonlyBtn.querySelector('use')?.getAttribute('xlink:href') || '';
    const isReadonly = isCurrentDocumentReadonly();
    
    return {
        hasButton: true,
        isReadonly,
        isEditable: !isReadonly,
        ariaLabel,
        dataSubtype,
        iconHref,
        statusText: getDocumentStatusText()
    };
}

