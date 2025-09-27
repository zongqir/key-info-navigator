import { getAllEditor, showMessage, fetchPost } from "siyuan";
import { TextFormatType, FormattedTextItem } from "../formatProcessor";
import { MemoDialog } from "../memoDialog";

/**
 * 格式化文本备注管理器
 * 负责处理备注的添加、编辑、删除等操作
 */
export class FormattedTextMemoManager {
    private memoDialog: MemoDialog;

    constructor(
        private i18n: any,
        private formattedTexts: FormattedTextItem[],
        private logger?: (...args: any[]) => void
    ) {
        this.memoDialog = new MemoDialog(i18n, logger);
    }

    /**
     * 为文本添加备注
     */
    public async addMemoToText(blockId: string, text: string): Promise<void> {
        try {
            this.log(`开始为文本添加备注: "${text}", 块ID: ${blockId}`);
            
            // 显示自定义备注对话框
            this.memoDialog.show(text, (memoContent: string) => {
                this.saveMemoToText(blockId, text, memoContent);
            });
            
        } catch (error) {
            this.log('显示备注对话框失败:', error);
            showMessage(`❌ ${this.i18n.addMemoFailed}: ${text}`, 3000, 'error');
        }
    }

    /**
     * 编辑已有备注
     */
    public async editExistingMemo(blockId: string, text: string): Promise<void> {
        try {
            this.log(`开始编辑备注: "${text}", 块ID: ${blockId}`);
            
            // 从已解析的数据中查找备注内容
            const memoItem = this.formattedTexts.find(item => 
                item.type === TextFormatType.MEMO && 
                item.text === text && 
                item.blockId === blockId
            );
            
            const existingMemo = memoItem?.memoContent || '';
            this.log(`找到已有备注内容: "${existingMemo}"`);
            
            // 显示编辑备注对话框
            this.memoDialog.showEdit(text, existingMemo, (memoContent: string) => {
                this.updateExistingMemo(blockId, text, memoContent);
            });
            
        } catch (error) {
            this.log('显示编辑备注对话框失败:', error);
            showMessage(`❌ ${this.i18n.editMemoFailed || '编辑备注失败'}: ${text}`, 3000, 'error');
        }
    }

    /**
     * 更新已有备注
     */
    public async updateExistingMemo(blockId: string, text: string, memoContent: string): Promise<void> {
        try {
            this.log(`更新备注: "${text}" -> "${memoContent}"`);
            
            // 查找备注元素
            const targetElement = this.findMemoElement(text);
            if (!targetElement) {
                showMessage(`❌ ${this.i18n.textNotFound}: ${text}`, 3000, 'error');
                return;
            }
            
            // 更新备注内容属性
            targetElement.setAttribute('data-inline-memo-content', memoContent);
            
            this.log('备注内容更新成功');
            
            // 更新块内容到后端
            await this.updateBlockContent();
            
            showMessage(`✅ ${this.i18n.editMemoSuccess || '备注编辑成功'}: ${text}`, 2000, 'info');
            
        } catch (error) {
            this.log('更新备注失败:', error);
            showMessage(`❌ ${this.i18n.editMemoFailed || '编辑备注失败'}: ${text}`, 3000, 'error');
        }
    }

    /**
     * 保存备注到文本
     */
    public async saveMemoToText(blockId: string, text: string, memoContent: string): Promise<void> {
        try {
            this.log(`保存备注: "${text}" -> "${memoContent}"`);
            
            // 获取当前编辑器
            const editor = getAllEditor()[0];
            if (!editor?.protyle) {
                showMessage('❌ 无法获取编辑器实例', 3000, 'error');
                return;
            }
            
            // 查找包含该文本的元素
            const targetElement = this.findTextElement(text);
            if (!targetElement) {
                showMessage(`❌ ${this.i18n.textNotFound}: ${text}`, 3000, 'error');
                return;
            }
            
            // 将目标元素包装成备注元素
            await this.wrapTextWithMemo(targetElement, text, memoContent);
            
            showMessage(`✅ ${this.i18n.addMemoSuccess || '备注添加成功'}: ${text}`, 2000, 'info');
            
        } catch (error) {
            this.log('保存备注失败:', error);
            showMessage(`❌ ${this.i18n.addMemoFailed}: ${text}`, 3000, 'error');
        }
    }

    /**
     * 将文本包装成备注元素
     */
    public async wrapTextWithMemo(element: HTMLElement, text: string, memoContent: string): Promise<void> {
        try {
            // 创建备注span元素
            const memoSpan = document.createElement('span');
            memoSpan.setAttribute('data-type', 'inline-memo');
            memoSpan.setAttribute('data-inline-memo-content', memoContent);
            memoSpan.textContent = text;
            
            // 复制原有的样式属性
            if (element.className) {
                memoSpan.className = element.className;
            }
            
            // 复制原有的data属性（如果有）
            Array.from(element.attributes).forEach(attr => {
                if (attr.name.startsWith('data-') && attr.name !== 'data-type') {
                    memoSpan.setAttribute(attr.name, attr.value);
                }
            });
            
            // 替换原元素
            element.parentNode?.replaceChild(memoSpan, element);
            
            this.log('备注元素创建成功');
            
            // 如果可能的话，通过API更新到后端
            await this.updateBlockContent();
            
        } catch (error) {
            this.log('包装备注元素失败:', error);
            throw error;
        }
    }

    /**
     * 更新块内容到后端
     */
    public async updateBlockContent(): Promise<void> {
        try {
            const editor = getAllEditor()[0];
            if (!editor?.protyle?.block) {
                return;
            }
            
            const blockId = editor.protyle.block.rootID;
            const blockElement = editor.protyle.wysiwyg.element;
            
            if (!blockId || !blockElement) {
                return;
            }
            
            // 获取更新后的HTML内容
            const newContent = blockElement.innerHTML;
            
            // 调用思源API更新块内容
            try {
                await fetchPost('/api/block/updateBlock', {
                    id: blockId,
                    data: newContent,
                    dataType: 'dom'
                });
                this.log('块内容更新成功');
            } catch (updateError) {
                this.log('块内容更新失败:', updateError);
            }
            
        } catch (error) {
            this.log('更新块内容失败:', error);
        }
    }

    /**
     * 查找文本元素
     */
    public findTextElement(text: string): HTMLElement | null {
        // 查找所有可能包含该文本的元素
        const selectors = [
            'strong', 'b', 'em', 'i', 'u', 'mark',
            '[data-type="strong"]', '[data-type="em"]', '[data-type="u"]', '[data-type="mark"]'
        ];
        
        for (const selector of selectors) {
            const elements = Array.from(document.querySelectorAll(selector));
            const found = elements.find(el => el.textContent?.trim() === text);
            if (found) {
                return found as HTMLElement;
            }
        }
        
        return null;
    }

    /**
     * 查找备注元素
     */
    public findMemoElement(text: string): HTMLElement | null {
        // 查找备注元素
        const memoSelectors = [
            'span[data-type*="inline-memo"]',
            '[data-inline-memo-content]'
        ];
        
        for (const selector of memoSelectors) {
            const elements = Array.from(document.querySelectorAll(selector));
            const found = elements.find(el => el.textContent?.trim() === text);
            if (found) {
                return found as HTMLElement;
            }
        }
        
        return null;
    }

    /**
     * 销毁组件
     */
    public destroy(): void {
        // 关闭可能打开的备注对话框
        this.memoDialog?.hide();
    }

    /**
     * 更新格式化文本数据
     */
    public updateFormattedTexts(formattedTexts: FormattedTextItem[]): void {
        this.formattedTexts = formattedTexts;
    }

    /**
     * 日志输出
     */
    private log(...args: any[]): void {
        if (this.logger) {
            this.logger('[FormattedTextMemoManager]', ...args);
        }
    }
}
