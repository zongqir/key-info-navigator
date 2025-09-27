import { BaseFormatProcessor } from '../BaseFormatProcessor';
import { TextFormatType, FormatConfig } from '../interfaces';

/**
 * 下划线格式处理器
 */
export class UnderlineProcessor extends BaseFormatProcessor {
    public readonly formatType = TextFormatType.UNDERLINE;
    
    protected readonly config: FormatConfig = {
        sqlType: ["u"],
        htmlSelectors: ["u", '[data-type="u"]'],
        kramdownRegex: /(~)(.*?)\1/g,
        icon: "iconUnderline",
        color: "#4ecdc4",
    };
}
