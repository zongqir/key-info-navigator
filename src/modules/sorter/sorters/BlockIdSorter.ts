import { BaseSorter } from "../BaseSorter";
import { SortStrategy } from "../interfaces";
import { FormattedTextItem } from "../../formatProcessor";

/**
 * Block ID 排序器
 * 根据 blockId 字符串本身进行字母排序
 */
export class BlockIdSorter extends BaseSorter {
    public readonly strategy = SortStrategy.BLOCK_ID;
    
    /**
     * 根据 blockId 字符串排序
     */
    public async sort(items: FormattedTextItem[]): Promise<FormattedTextItem[]> {
        this.log('[BlockIdSorter] 开始按 blockId 排序，项目数:', items.length);
        
        const sortedItems = [...items].sort((a, b) => {
            // 首先按 blockId 字符串排序
            if (a.blockId !== b.blockId) {
                return a.blockId.localeCompare(b.blockId);
            }
            
            // 同一块内按位置排序
            return a.position - b.position;
        });
        
        this.log('[BlockIdSorter] 排序完成');
        return sortedItems;
    }
}

