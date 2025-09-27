import { BaseFormatProcessor } from '../BaseFormatProcessor';
import { TextFormatType, FormatConfig, DisplayMode } from '../interfaces';

/**
 * 斜体格式处理器
 */
export class ItalicProcessor extends BaseFormatProcessor {
    public readonly formatType = TextFormatType.ITALIC;
    
    protected readonly config: FormatConfig = {
        sqlType: ["em"],
        htmlSelectors: ["em", "i", '[data-type="em"]'],
        kramdownRegex: /(?<!\*)\*([^*]+?)\*(?!\*)|(?<!_)_([^_]+?)_(?!_)/g,
        icon: "iconItalic",
        color: "#ffd93d",
        displayMode: DisplayMode.SIMPLE, // 简单模式，只显示斜体内容
    };
}
