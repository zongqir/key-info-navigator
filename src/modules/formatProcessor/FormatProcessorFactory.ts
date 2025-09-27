import { IFormatProcessor, TextFormatType } from './interfaces';
import { BoldProcessor } from './processors/BoldProcessor';
import { ItalicProcessor } from './processors/ItalicProcessor';
import { UnderlineProcessor } from './processors/UnderlineProcessor';
import { HighlightProcessor } from './processors/HighlightProcessor';
import { MemoProcessor } from './processors/MemoProcessor';
import { TagProcessor } from './processors/TagProcessor';
import { TodoProcessor } from './processors/TodoProcessor';

/**
 * 格式处理器工厂
 */
export class FormatProcessorFactory {
    private static processors = new Map<TextFormatType, IFormatProcessor>();
    private static logger?: (...args: any[]) => void;
    
    /**
     * 设置日志记录器
     */
    public static setLogger(logger: (...args: any[]) => void): void {
        FormatProcessorFactory.logger = logger;
    }
    
    /**
     * 获取格式处理器
     */
    public static getProcessor(type: TextFormatType): IFormatProcessor {
        if (!FormatProcessorFactory.processors.has(type)) {
            FormatProcessorFactory.processors.set(type, FormatProcessorFactory.createProcessor(type));
        }
        return FormatProcessorFactory.processors.get(type)!;
    }
    
    /**
     * 获取多个格式处理器
     */
    public static getProcessors(types: TextFormatType[]): IFormatProcessor[] {
        return types.map(type => FormatProcessorFactory.getProcessor(type));
    }
    
    /**
     * 获取所有可用的格式处理器
     */
    public static getAllProcessors(): IFormatProcessor[] {
        const allTypes = Object.values(TextFormatType) as TextFormatType[];
        return FormatProcessorFactory.getProcessors(allTypes);
    }
    
    /**
     * 注册自定义处理器
     */
    public static registerProcessor(type: TextFormatType, processor: IFormatProcessor): void {
        FormatProcessorFactory.processors.set(type, processor);
    }
    
    /**
     * 创建格式处理器实例
     */
    private static createProcessor(type: TextFormatType): IFormatProcessor {
        const logger = FormatProcessorFactory.logger;
        
        switch (type) {
            case TextFormatType.BOLD:
                return new BoldProcessor(logger);
            case TextFormatType.ITALIC:
                return new ItalicProcessor(logger);
            case TextFormatType.UNDERLINE:
                return new UnderlineProcessor(logger);
            case TextFormatType.HIGHLIGHT:
                return new HighlightProcessor(logger);
            case TextFormatType.MEMO:
                return new MemoProcessor(logger);
            case TextFormatType.TAG:
                return new TagProcessor(logger);
            case TextFormatType.TODO:
                return new TodoProcessor(logger);
            default:
                throw new Error(`不支持的格式类型: ${type}`);
        }
    }
    
    /**
     * 清理所有缓存的处理器
     */
    public static clear(): void {
        FormatProcessorFactory.processors.clear();
    }
}
