/**
 * 文本格式类型枚举
 */
export enum TextFormatType {
    BOLD = "bold",
    ITALIC = "italic", 
    UNDERLINE = "underline",
    HIGHLIGHT = "highlight",
    MEMO = "memo",
}

/**
 * 格式化文本项
 */
export interface FormattedTextItem {
    /** 唯一标识 */
    id: string;
    /** 文本内容 */
    text: string;
    /** 格式类型 */
    type: TextFormatType;
    /** 所属块ID */
    blockId: string;
    /** 位置 */
    position: number;
    /** 上下文 */
    context: string;
    /** 图标 */
    icon: string;
    /** 颜色 */
    color: string;
    /** 备注内容（仅当type为MEMO时使用） */
    memoContent?: string;
    /** 原始DOM元素（用于精确定位） */
    element?: HTMLElement;
}

/**
 * 显示模式枚举
 */
export enum DisplayMode {
    /** 简单模式 - 只显示提取内容 */
    SIMPLE = "simple",
    /** 详细模式 - 显示内容+说明 */
    DETAILED = "detailed",
    /** 自定义模式 - 完全自定义显示 */
    CUSTOM = "custom"
}

/**
 * 格式配置
 */
export interface FormatConfig {
    /** SQL查询时的类型 */
    sqlType: string[];
    /** HTML选择器 */
    htmlSelectors: string[];
    /** Kramdown正则表达式 */
    kramdownRegex: RegExp;
    /** 图标 */
    icon: string;
    /** 颜色 */
    color: string;
    /** 显示模式 */
    displayMode: DisplayMode;
}

/**
 * 格式处理器接口
 */
export interface IFormatProcessor {
    /** 格式类型 */
    readonly formatType: TextFormatType;
    
    /** 获取格式配置 */
    getConfig(): FormatConfig;
    
    /** 从Span数据中提取格式文本 */
    extractFromSpan(span: any, blockId?: string): FormattedTextItem[];
    
    /** 从HTML中提取格式文本 */
    extractFromHTML(html: string, blockId: string): FormattedTextItem[];
    
    /** 验证文本是否匹配该格式 */
    matches(text: string): boolean;
    
    /** 渲染项目详细内容（用于自定义显示） */
    renderItemDetails?(item: FormattedTextItem, displayText: string): string;
    
    /** 是否支持添加备注功能 */
    supportAddMemo?(): boolean;
    
    /** 渲染操作按钮（如添加备注按钮） */
    renderActionButtons?(item: FormattedTextItem, i18n?: any): string;
    
    /** 删除格式化，保留纯文本 */
    removeFormatting?(text: string, blockId: string, itemIndex?: number): Promise<boolean>;
}

/**
 * 格式解析器选项
 */
export interface ParseOptions {
    /** 启用的格式类型 */
    enabledFormats: TextFormatType[];
    /** 最大结果数量 */
    maxResults?: number;
    /** 是否包含上下文 */
    includeContext?: boolean;
}
