import { showMessage } from 'siyuan';

/**
 * 自定义备注对话框
 */
export class MemoDialog {
    private dialog?: HTMLElement;
    private overlay?: HTMLElement;
    private keyDownHandler?: (e: KeyboardEvent) => void;
    
    constructor(
        private i18n: any,
        private logger?: (...args: any[]) => void
    ) {}

    /**
     * 显示添加备注对话框
     */
    public show(text: string, onConfirm: (memoContent: string) => void): void {
        this.createDialog(text, onConfirm);
        this.showDialog();
    }

    /**
     * 显示编辑备注对话框
     */
    public showEdit(text: string, existingMemo: string, onConfirm: (memoContent: string) => void): void {
        this.createDialog(text, onConfirm, existingMemo, true);
        this.showDialog();
    }

    /**
     * 隐藏对话框
     */
    public hide(): void {
        // 清理键盘事件监听器
        if (this.keyDownHandler) {
            document.removeEventListener('keydown', this.keyDownHandler);
            this.keyDownHandler = undefined;
        }
        
        if (this.overlay) {
            this.overlay.remove();
        }
        this.dialog = undefined;
        this.overlay = undefined;
    }

    /**
     * 创建对话框
     */
    private createDialog(text: string, onConfirm: (memoContent: string) => void, existingMemo?: string, isEdit?: boolean): void {
        // 创建遮罩层
        this.overlay = document.createElement('div');
        this.overlay.className = 'memo-dialog-overlay';
        
        // 创建对话框
        this.dialog = document.createElement('div');
        this.dialog.className = 'memo-dialog';
        
        const dialogTitle = isEdit ? (this.i18n.editMemo || '编辑备注') : (this.i18n.addMemo || '添加备注');
        const targetLabel = isEdit ? (this.i18n.editMemoTargetLabel || '编辑以下内容的备注：') : (this.i18n.memoTargetLabel || '为以下内容添加备注：');
        const confirmText = isEdit ? (this.i18n.save || '保存') : (this.i18n.confirm || '确认');
        
        this.dialog.innerHTML = `
            <div class="memo-dialog__header">
                <div class="memo-dialog__title">
                    <svg class="memo-dialog__icon">
                        <use xlink:href="#iconMessage"></use>
                    </svg>
                    <span>${dialogTitle}</span>
                </div>
                <button class="memo-dialog__close" data-action="close">
                    <svg>
                        <use xlink:href="#iconClose"></use>
                    </svg>
                </button>
            </div>
            
            <div class="memo-dialog__body">
                <div class="memo-dialog__target">
                    <div class="memo-dialog__target-label">${targetLabel}</div>
                    <div class="memo-dialog__target-text">${this.escapeHtml(text)}</div>
                </div>
                
                <div class="memo-dialog__input-section">
                    <label class="memo-dialog__label">${this.i18n.memo || '备注'}内容：</label>
                    <textarea class="memo-dialog__textarea" 
                              placeholder="${this.i18n.memoPlaceholder || '请输入备注内容...'}"
                              rows="4"
                              maxlength="500">${existingMemo ? this.escapeHtml(existingMemo) : ''}</textarea>
                    <div class="memo-dialog__char-count">
                        <span class="memo-dialog__current-count">${existingMemo ? existingMemo.length : 0}</span> / 500
                    </div>
                </div>
            </div>
            
            <div class="memo-dialog__footer">
                <button class="memo-dialog__btn memo-dialog__btn--secondary" data-action="cancel">
                    ${this.i18n.cancel || '取消'}
                </button>
                <button class="memo-dialog__btn memo-dialog__btn--primary" data-action="confirm">
                    ${confirmText}
                </button>
            </div>
        `;
        
        // 绑定事件
        this.bindDialogEvents(onConfirm);
        
        // 添加到DOM
        this.overlay.appendChild(this.dialog);
        document.body.appendChild(this.overlay);
    }

    /**
     * 绑定对话框事件
     */
    private bindDialogEvents(onConfirm: (memoContent: string) => void): void {
        if (!this.dialog) return;

        const textarea = this.dialog.querySelector('.memo-dialog__textarea') as HTMLTextAreaElement;
        const charCount = this.dialog.querySelector('.memo-dialog__current-count') as HTMLElement;
        const closeBtn = this.dialog.querySelector('[data-action="close"]') as HTMLButtonElement;
        const cancelBtn = this.dialog.querySelector('[data-action="cancel"]') as HTMLButtonElement;
        const confirmBtn = this.dialog.querySelector('[data-action="confirm"]') as HTMLButtonElement;

        // 字符计数
        if (textarea && charCount) {
            textarea.addEventListener('input', () => {
                const count = textarea.value.length;
                charCount.textContent = count.toString();
                
                // 字符数接近限制时变红
                if (count > 450) {
                    charCount.style.color = '#f44336';
                } else if (count > 400) {
                    charCount.style.color = '#ff9800';
                } else {
                    charCount.style.color = 'var(--b3-theme-on-surface)';
                }
            });
        }

        // 关闭按钮
        closeBtn?.addEventListener('click', () => {
            this.hide();
        });

        // 取消按钮
        cancelBtn?.addEventListener('click', () => {
            this.hide();
        });

        // 确认按钮
        confirmBtn?.addEventListener('click', () => {
            const content = textarea?.value.trim() || '';
            if (content) {
                try {
                    onConfirm(content);
                    this.hide();
                } catch (error) {
                    this.log('确认回调执行失败:', error);
                    showMessage('❌ 备注保存失败', 2000, 'error');
                }
            } else {
                showMessage('❌ 请输入备注内容', 2000, 'error');
                textarea?.focus();
            }
        });

        // 点击遮罩层关闭
        this.overlay?.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.hide();
            }
        });

        // ESC键关闭
        this.keyDownHandler = this.handleKeyDown.bind(this);
        document.addEventListener('keydown', this.keyDownHandler);
        
        // 自动聚焦到textarea
        setTimeout(() => {
            textarea?.focus();
        }, 100);
    }

    /**
     * 处理键盘事件
     */
    private handleKeyDown(e: KeyboardEvent): void {
        if (e.key === 'Escape') {
            this.hide();
        } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            // Ctrl+Enter 或 Cmd+Enter 确认
            const confirmBtn = this.dialog?.querySelector('[data-action="confirm"]') as HTMLButtonElement;
            confirmBtn?.click();
        }
    }

    /**
     * 显示对话框
     */
    private showDialog(): void {
        if (this.overlay) {
            // 添加显示动画
            this.overlay.style.opacity = '0';
            this.overlay.style.display = 'flex';
            
            setTimeout(() => {
                if (this.overlay) {
                    this.overlay.style.opacity = '1';
                }
                if (this.dialog) {
                    this.dialog.style.transform = 'translate(-50%, -50%) scale(1)';
                }
            }, 10);
        }
    }

    /**
     * 转义HTML
     */
    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 日志输出
     */
    private log(...args: any[]): void {
        if (this.logger) {
            this.logger('[MemoDialog]', ...args);
        }
    }
}
