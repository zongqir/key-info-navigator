import { getAllEditor } from "siyuan";

/**
 * 编辑器工具类
 * 提供编辑器相关的通用方法
 */
export class EditorUtils {
    /**
     * 获取当前活跃的编辑器
     * 优先级：焦点编辑器 > 可见编辑器 > 第一个有效编辑器
     */
    public static getCurrentActiveEditor(logger?: (...args: any[]) => void): any {
        const editors = getAllEditor();
        const log = logger || (() => {});
        
        log(`获取到 ${editors.length} 个编辑器`);
        
        if (editors.length === 0) {
            return null;
        }
        
        // 如果只有一个编辑器，直接返回
        if (editors.length === 1) {
            log('只有一个编辑器，直接使用');
            return editors[0];
        }
        
        // 寻找当前活跃的编辑器
        // 1. 尝试找到具有焦点的编辑器
        for (const editor of editors) {
            if (editor?.protyle?.element?.contains(document.activeElement)) {
                log('找到具有焦点的编辑器');
                return editor;
            }
        }
        
        // 2. 尝试找到最近被访问的编辑器（通过检查 element 的可见性）
        for (const editor of editors) {
            if (editor?.protyle?.element) {
                const rect = editor.protyle.element.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    log('找到可见的编辑器');
                    return editor;
                }
            }
        }
        
        // 3. 如果都没找到，返回第一个有效的编辑器
        log('使用第一个有效的编辑器作为备选');
        return editors.find(editor => editor?.protyle?.block) || editors[0];
    }

    /**
     * 获取编辑器的文档ID
     */
    public static getEditorBlockId(editor: any): string | null {
        return editor?.protyle?.block?.rootID || null;
    }

    /**
     * 检查编辑器是否有效
     */
    public static isValidEditor(editor: any): boolean {
        return !!(editor?.protyle?.block);
    }

    /**
     * 检查编辑器是否可见
     */
    public static isEditorVisible(editor: any): boolean {
        if (!editor?.protyle?.element) {
            return false;
        }
        
        const rect = editor.protyle.element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    /**
     * 检查编辑器是否有焦点
     */
    public static isEditorFocused(editor: any): boolean {
        return !!(editor?.protyle?.element?.contains(document.activeElement));
    }
}
