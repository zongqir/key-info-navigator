// 导出所有工具类
export { Logger } from './Logger';
export { EditorUtils } from './EditorUtils';
export { ThemeManager, ThemeMode } from './ThemeManager';
export { DocumentReadonlyChecker } from './DocumentReadonlyChecker';

// 导出锁按钮工具函数（推荐使用）
export {
    getCurrentActiveReadonlyButton,
    isCurrentDocumentReadonly,
    isCurrentDocumentEditable,
    getDocumentStatusText,
    getDocumentStatusDetail
} from './ReadonlyButtonUtils';