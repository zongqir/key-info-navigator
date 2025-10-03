import { ISorter, SortStrategy } from "./interfaces";
import { FormattedTextItem } from "../formatProcessor";

/**
 * 排序器基类
 */
export abstract class BaseSorter implements ISorter {
    public abstract readonly strategy: SortStrategy;
    
    constructor(protected logger?: (...args: any[]) => void) {}
    
    /**
     * 排序方法（子类实现）
     */
    public abstract sort(items: FormattedTextItem[]): Promise<FormattedTextItem[]>;
    
    /**
     * 日志输出
     */
    protected log(...args: any[]): void {
        if (this.logger) {
            this.logger(...args);
        }
    }
    
    /**
     * 辅助方法：在同一块内按位置排序
     */
    protected sortByPositionWithinBlock(items: FormattedTextItem[]): FormattedTextItem[] {
        return [...items].sort((a, b) => {
            // 如果在同一个块内，按位置排序
            if (a.blockId === b.blockId) {
                return a.position - b.position;
            }
            // 否则保持原顺序
            return 0;
        });
    }
}

