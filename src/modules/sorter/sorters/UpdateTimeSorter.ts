import { BaseSorter } from "../BaseSorter";
import { SortStrategy } from "../interfaces";
import { FormattedTextItem } from "../../formatProcessor";

/**
 * 更新时间排序器
 * 根据块的更新时间进行排序
 */
export class UpdateTimeSorter extends BaseSorter {
    public readonly strategy = SortStrategy.UPDATE_TIME;
    
    /**
     * 根据更新时间排序
     */
    public async sort(items: FormattedTextItem[]): Promise<FormattedTextItem[]> {
        if (items.length === 0) {
            return items;
        }
        
        this.log('[UpdateTimeSorter] 开始按更新时间排序，项目数:', items.length);
        
        // 获取所有唯一的 blockId
        const uniqueBlockIds = Array.from(new Set(items.map(item => item.blockId)));
        
        // 获取块的更新时间
        const updateTimes = await this.getBlockUpdateTimes(uniqueBlockIds);
        this.log('[UpdateTimeSorter] 块更新时间映射数量:', updateTimes.size);
        
        // 根据更新时间排序
        const sortedItems = [...items].sort((a, b) => {
            const timeA = updateTimes.get(a.blockId);
            const timeB = updateTimes.get(b.blockId);
            
            // 如果两个块的更新时间都存在且不同，按更新时间排序（新的在前）
            if (timeA !== undefined && timeB !== undefined && timeA !== timeB) {
                return timeB - timeA; // 降序：新的在前
            }
            
            // 如果在同一个块内，按 position 排序
            if (a.blockId === b.blockId) {
                return a.position - b.position;
            }
            
            // 如果某个块没有更新时间信息，使用 blockId 字符串排序作为后备
            return a.blockId.localeCompare(b.blockId);
        });
        
        this.log('[UpdateTimeSorter] 排序完成');
        return sortedItems;
    }
    
    /**
     * 从数据库获取块的更新时间
     */
    private async getBlockUpdateTimes(blockIds: string[]): Promise<Map<string, number>> {
        const timeMap = new Map<string, number>();
        
        if (blockIds.length === 0) {
            return timeMap;
        }
        
        try {
            const idList = blockIds.map(id => `"${id}"`).join(',');
            const stmt = `
                SELECT id, updated
                FROM blocks
                WHERE id IN (${idList})
            `.trim();
            
            this.log('[UpdateTimeSorter] 执行数据库查询:', stmt);
            
            const response = await fetch('/api/query/sql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ stmt })
            });
            
            const result = await response.json();
            
            if (result.code === 0 && result.data && Array.isArray(result.data)) {
                result.data.forEach((block: any) => {
                    if (block.id && block.updated) {
                        // updated 是时间戳字符串，转换为数字
                        const timestamp = parseInt(block.updated, 10);
                        if (!isNaN(timestamp)) {
                            timeMap.set(block.id, timestamp);
                        }
                    }
                });
                this.log('[UpdateTimeSorter] 从数据库获取的更新时间映射数量:', timeMap.size);
            } else {
                this.log('[UpdateTimeSorter] 数据库查询失败或返回无效数据:', result);
            }
            
        } catch (error) {
            this.log('[UpdateTimeSorter] 数据库查询出错:', error);
        }
        
        return timeMap;
    }
}

