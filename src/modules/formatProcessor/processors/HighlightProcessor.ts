import { BaseFormatProcessor } from '../BaseFormatProcessor';
import { TextFormatType, FormatConfig, DisplayMode } from '../interfaces';

/**
 * 高亮格式处理器
 */
export class HighlightProcessor extends BaseFormatProcessor {
    public readonly formatType = TextFormatType.HIGHLIGHT;
    
    protected readonly config: FormatConfig = {
        sqlType: ["mark", "textmark"],
        htmlSelectors: ["mark", '[data-type="mark"]', '[data-type="textmark"]'],
        kramdownRegex: /==(.+?)==/g,
        icon: "iconHighlight",
        color: "#f4e4a1", // 柔和的淡黄色
        displayMode: DisplayMode.SIMPLE, // 简单模式，只显示高亮内容
    };
}
