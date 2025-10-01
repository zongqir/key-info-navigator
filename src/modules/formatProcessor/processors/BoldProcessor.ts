import { BaseFormatProcessor } from '../BaseFormatProcessor';
import { TextFormatType, FormatConfig, DisplayMode } from '../interfaces';

/**
 * 加粗格式处理器
 */
export class BoldProcessor extends BaseFormatProcessor {
    public readonly formatType = TextFormatType.BOLD;
    
    protected readonly config: FormatConfig = {
        sqlType: ["strong", "textmark"],
        htmlSelectors: ["strong", "b", '[data-type="strong"]'],
        kramdownRegex: /(\*\*|__)(.*?)\1/g,
        icon: "iconBold",
        color: "#0969da", // 现代简约深蓝
        displayMode: DisplayMode.SIMPLE, // 简单模式，只显示加粗内容
    };
}
