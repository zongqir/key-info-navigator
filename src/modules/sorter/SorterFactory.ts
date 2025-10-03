import { ISorter, SortStrategy } from "./interfaces";
import { RenderOrderSorter } from "./sorters/RenderOrderSorter";
import { BlockIdSorter } from "./sorters/BlockIdSorter";
import { UpdateTimeSorter } from "./sorters/UpdateTimeSorter";

/**
 * 排序器工厂
 * 负责创建和管理不同的排序器实例
 */
export class SorterFactory {
    private static logger?: (...args: any[]) => void;
    private static sorterInstances: Map<SortStrategy, ISorter> = new Map();
    
    /**
     * 设置日志函数
     */
    public static setLogger(logger: (...args: any[]) => void): void {
        SorterFactory.logger = logger;
    }
    
    /**
     * 获取指定策略的排序器实例
     */
    public static getSorter(strategy: SortStrategy): ISorter {
        // 检查缓存
        if (SorterFactory.sorterInstances.has(strategy)) {
            return SorterFactory.sorterInstances.get(strategy)!;
        }
        
        // 创建新实例
        let sorter: ISorter;
        
        switch (strategy) {
            case SortStrategy.RENDER_ORDER:
                sorter = new RenderOrderSorter(SorterFactory.logger);
                break;
                
            case SortStrategy.BLOCK_ID:
                sorter = new BlockIdSorter(SorterFactory.logger);
                break;
                
            case SortStrategy.UPDATE_TIME:
                sorter = new UpdateTimeSorter(SorterFactory.logger);
                break;
                
            default:
                // 默认使用渲染顺序排序
                SorterFactory.log(`未知的排序策略: ${strategy}，使用默认的渲染顺序排序`);
                sorter = new RenderOrderSorter(SorterFactory.logger);
        }
        
        // 缓存实例
        SorterFactory.sorterInstances.set(strategy, sorter);
        
        return sorter;
    }
    
    /**
     * 获取默认排序器（渲染顺序）
     */
    public static getDefaultSorter(): ISorter {
        return SorterFactory.getSorter(SortStrategy.RENDER_ORDER);
    }
    
    /**
     * 清除缓存的排序器实例
     */
    public static clearCache(): void {
        SorterFactory.sorterInstances.clear();
    }
    
    /**
     * 日志输出
     */
    private static log(...args: any[]): void {
        if (SorterFactory.logger) {
            SorterFactory.logger(...args);
        }
    }
}

