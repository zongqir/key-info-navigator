import { BaseFormatProcessor } from '../BaseFormatProcessor';
import { TextFormatType, FormatConfig } from '../interfaces';

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
        color: "#ffeb3b",
    };
}
