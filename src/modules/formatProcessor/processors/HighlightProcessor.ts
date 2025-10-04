import { BaseFormatProcessor } from '../BaseFormatProcessor';
import { TextFormatType, FormatConfig, DisplayMode } from '../interfaces';

/**
 * 高亮格式处理器
 */
export class HighlightProcessor extends BaseFormatProcessor {
    public readonly formatType = TextFormatType.HIGHLIGHT;
    
    protected readonly config: FormatConfig = {
        sqlType: ["mark", "text"],  // 支持mark和text两种类型
        htmlSelectors: ["mark", '[data-type="mark"]', '[data-type="textmark"]'],
        kramdownRegex: /==(.+?)==/g,
        icon: "iconHighlight",
        color: "#9a6700", // 现代简约琥珀色
        displayMode: DisplayMode.SIMPLE, // 简单模式，只显示高亮内容
    };
}
