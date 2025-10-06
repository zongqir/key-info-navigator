import { FormattedTextItem, TextFormatType } from "../formatProcessor";
import { showMessage } from "siyuan";

/**
 * 格式化文本多选管理器
 * 负责管理多选状态、Ctrl/Shift 选择逻辑以及批量操作
 */
export class FormattedTextMultiSelectManager {
    private selectedItemIds = new Set<string>();
    private lastSelectedIndex = -1;
    private isMultiSelectMode = false;
    private isMobileDevice = false;

    constructor(
        private element: HTMLElement,
        private formattedTexts: FormattedTextItem[],
        private onSelectionChange: (selectedIds: Set<string>) => void,
        private onBatchDelete: (selectedItems: FormattedTextItem[]) => Promise<void>,
        private i18n: any,
        private logger?: (...args: any[]) => void
    ) {
        // 检测是否为移动设备
        this.isMobileDevice = this.detectMobileDevice();
        
        if (this.isMobileDevice) {
            this.log('检测到移动设备，禁用多选功能');
            return; // 移动端不启用多选功能
        }
        
        this.bindEvents();
    }

    /**
     * 检测是否为移动设备
     */
    private detectMobileDevice(): boolean {
        // 检测用户代理
        const userAgent = navigator.userAgent.toLowerCase();
        const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
        
        // 检测触摸屏
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        // 检测屏幕宽度
        const isSmallScreen = window.innerWidth <= 768;
        
        return isMobileUA || (isTouchDevice && isSmallScreen);
    }

    /**
     * 绑定多选相关事件
     */
    private bindEvents(): void {
        // 绑定项目点击事件（支持Ctrl/Shift多选）
        this.element.addEventListener('click', (e) => {
            const itemElement = (e.target as HTMLElement).closest('.formatted-text-dock__item') as HTMLElement;
            if (itemElement && itemElement.dataset.itemId) {
                // 检查是否点击了操作按钮区域，如果是则不处理多选
                if ((e.target as HTMLElement).closest('.formatted-text-dock__item-actions')) {
                    return;
                }
                
                this.handleItemClick(itemElement, e);
            }
        });

        // 绑定批量操作按钮事件
        this.element.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const button = target.closest('button');
            
            if (!button || !button.dataset.action) return;

            switch (button.dataset.action) {
                case 'select-all':
                    this.selectAll();
                    break;
                case 'deselect-all':
                    this.deselectAll();
                    break;
                case 'batch-delete':
                    this.handleBatchDelete();
                    break;
            }
        });

        // 绑定键盘事件（Ctrl+A 全选）
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'a' && this.isInDockArea(e.target as HTMLElement)) {
                e.preventDefault();
                this.selectAll();
            }
        });
    }

    /**
     * 处理项目点击事件（需要Ctrl+Shift多选）
     */
    private handleItemClick(itemElement: HTMLElement, event: MouseEvent): void {
        const itemId = itemElement.dataset.itemId!;
        const itemIndex = parseInt(itemElement.dataset.index || '0');

        // 需要同时按下 Ctrl/Cmd + Shift 才能触发多选
        const isMultiSelectKey = (event.ctrlKey || event.metaKey) && event.shiftKey;

        if (isMultiSelectKey) {
            // Ctrl/Cmd + Shift 多选
            event.preventDefault();
            this.toggleSelection(itemId);
            this.lastSelectedIndex = itemIndex;
        } else {
            // 普通点击，不改变选择状态，但更新最后选择的索引
            this.lastSelectedIndex = itemIndex;
        }
    }

    /**
     * 切换单个项目的选择状态
     */
    private toggleSelection(itemId: string): void {
        const isSelected = this.selectedItemIds.has(itemId);
        
        if (isSelected) {
            this.selectedItemIds.delete(itemId);
        } else {
            this.selectedItemIds.add(itemId);
        }

        this.updateItemSelection(itemId, !isSelected);
        this.updateUI();
        this.onSelectionChange(this.selectedItemIds);
    }

    /**
     * 选择范围内的所有项目
     */
    private selectRange(startIndex: number, endIndex: number): void {
        const start = Math.min(startIndex, endIndex);
        const end = Math.max(startIndex, endIndex);

        const items = this.element.querySelectorAll('.formatted-text-dock__item');
        
        for (let i = start; i <= end && i < items.length; i++) {
            const item = items[i] as HTMLElement;
            const itemId = item.dataset.itemId;
            if (itemId) {
                this.selectedItemIds.add(itemId);
                this.updateItemSelection(itemId, true);
            }
        }

        this.updateUI();
        this.onSelectionChange(this.selectedItemIds);
    }

    /**
     * 全选
     */
    public selectAll(): void {
        const items = this.element.querySelectorAll('.formatted-text-dock__item');
        
        items.forEach(item => {
            const itemElement = item as HTMLElement;
            const itemId = itemElement.dataset.itemId;
            if (itemId) {
                this.selectedItemIds.add(itemId);
                this.updateItemSelection(itemId, true);
            }
        });

        this.updateUI();
        this.onSelectionChange(this.selectedItemIds);
        this.log('全选完成，选中项目数:', this.selectedItemIds.size);
    }

    /**
     * 取消全选
     */
    public deselectAll(): void {
        this.selectedItemIds.forEach(itemId => {
            this.updateItemSelection(itemId, false);
        });

        this.selectedItemIds.clear();
        this.updateUI();
        this.onSelectionChange(this.selectedItemIds);
        this.log('取消全选完成');
    }

    /**
     * 处理批量删除
     */
    private async handleBatchDelete(): Promise<void> {
        if (this.selectedItemIds.size === 0) {
            showMessage('请先选择要删除格式的项目', 3000, 'info');
            return;
        }

        const selectedItems = this.formattedTexts.filter(item => 
            this.selectedItemIds.has(item.id)
        );

        if (selectedItems.length === 0) {
            // 静默失败，不显示错误提示
            return;
        }

        // 确认对话框
        const confirmMessage = `确定要删除 ${selectedItems.length} 个项目的格式吗？此操作不可撤销。`;
        if (!confirm(confirmMessage)) {
            return;
        }

        this.log('开始批量删除格式，选中项目数:', selectedItems.length);
        
        try {
            await this.onBatchDelete(selectedItems);
            
            // 清除选择状态
            this.deselectAll();
            
            showMessage(`✅ 成功删除 ${selectedItems.length} 个项目的格式`, 3000, 'info');
            
        } catch (error) {
            this.log('批量删除失败:', error);
            // 静默失败，不显示错误提示
        }
    }

    /**
     * 更新项目的选择状态样式
     */
    private updateItemSelection(itemId: string, isSelected: boolean): void {
        const itemElement = this.element.querySelector(`[data-item-id="${itemId}"]`) as HTMLElement;
        if (itemElement) {
            if (isSelected) {
                itemElement.classList.add('selected');
            } else {
                itemElement.classList.remove('selected');
            }
        }
    }

    /**
     * 更新UI状态
     */
    private updateUI(): void {
        const batchControls = this.element.querySelector('.formatted-text-dock__batch-controls') as HTMLElement;
        const selectedCount = this.element.querySelector('.selected-count') as HTMLElement;

        if (this.selectedItemIds.size > 0) {
            // 显示批量操作控制栏
            if (batchControls) {
                batchControls.style.display = 'flex';
            }
            
            // 更新选中项目计数
            if (selectedCount) {
                selectedCount.textContent = `已选择 ${this.selectedItemIds.size} 项`;
            }
            
            this.isMultiSelectMode = true;
        } else {
            // 隐藏批量操作控制栏
            if (batchControls) {
                batchControls.style.display = 'none';
            }
            
            this.isMultiSelectMode = false;
        }
    }

    /**
     * 检查是否在 dock 区域内
     */
    private isInDockArea(target: HTMLElement): boolean {
        return this.element.contains(target);
    }

    /**
     * 更新格式化文本数据
     */
    public updateFormattedTexts(formattedTexts: FormattedTextItem[]): void {
        this.formattedTexts = formattedTexts;
        
        // 清理不存在的选择项
        const validIds = new Set(formattedTexts.map(item => item.id));
        const toRemove: string[] = [];
        
        this.selectedItemIds.forEach(id => {
            if (!validIds.has(id)) {
                toRemove.push(id);
            }
        });
        
        toRemove.forEach(id => this.selectedItemIds.delete(id));
        
        this.updateUI();
        this.onSelectionChange(this.selectedItemIds);
    }

    /**
     * 获取选中的项目ID集合
     */
    public getSelectedItemIds(): Set<string> {
        return new Set(this.selectedItemIds);
    }

    /**
     * 获取选中的项目数量
     */
    public getSelectedCount(): number {
        return this.selectedItemIds.size;
    }

    /**
     * 是否处于多选模式
     */
    public isInMultiSelectMode(): boolean {
        return this.isMultiSelectMode;
    }

    /**
     * 清理选择状态
     */
    public clearSelection(): void {
        this.deselectAll();
    }

    /**
     * 销毁管理器
     */
    public destroy(): void {
        this.selectedItemIds.clear();
        this.lastSelectedIndex = -1;
        this.isMultiSelectMode = false;
    }

    /**
     * 日志输出
     */
    private log(...args: any[]): void {
        if (this.logger) {
            this.logger('[MultiSelectManager]', ...args);
        }
    }
}
