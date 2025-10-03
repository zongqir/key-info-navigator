import { BaseSorter } from "../BaseSorter";
import { SortStrategy, BlockPositionInfo } from "../interfaces";
import { FormattedTextItem } from "../../formatProcessor";

/**
 * 界面渲染顺序排序器
 * 根据块在文档中的实际渲染位置进行排序
 */
export class RenderOrderSorter extends BaseSorter {
    public readonly strategy = SortStrategy.RENDER_ORDER;
    
    /**
     * 根据界面渲染顺序排序
     */
    public async sort(items: FormattedTextItem[]): Promise<FormattedTextItem[]> {
        if (items.length === 0) {
            return items;
        }
        
        this.log('[RenderOrderSorter] 开始按渲染顺序排序，项目数:', items.length);
        
        // 获取所有唯一的 blockId
        const uniqueBlockIds = Array.from(new Set(items.map(item => item.blockId)));
        this.log('[RenderOrderSorter] 唯一块ID数量:', uniqueBlockIds.length);
        
        // 获取块的位置信息
        const blockPositions = await this.getBlockPositions(uniqueBlockIds);
        this.log('[RenderOrderSorter] 块位置映射:', blockPositions);
        
        // 根据块的渲染顺序排序
        const sortedItems = [...items].sort((a, b) => {
            const posA = blockPositions.get(a.blockId);
            const posB = blockPositions.get(b.blockId);
            
            // 如果块位置不同，按块位置排序
            if (posA !== undefined && posB !== undefined && posA !== posB) {
                return posA - posB;
            }
            
            // 如果在同一个块内，按 position 排序
            if (a.blockId === b.blockId) {
                return a.position - b.position;
            }
            
            // 如果某个块没有位置信息，使用 blockId 字符串排序作为后备
            return a.blockId.localeCompare(b.blockId);
        });
        
        this.log('[RenderOrderSorter] 排序完成');
        return sortedItems;
    }
    
    /**
     * 获取块的位置信息
     * 通过查询数据库或遍历DOM来获取块在文档中的实际位置
     */
    private async getBlockPositions(blockIds: string[]): Promise<Map<string, number>> {
        const positionMap = new Map<string, number>();
        
        try {
            // 方法1: 从DOM中获取渲染顺序
            const domPositions = this.getBlockPositionsFromDOM(blockIds);
            if (domPositions.size > 0) {
                this.log('[RenderOrderSorter] 从DOM获取到位置信息，数量:', domPositions.size);
                return domPositions;
            }
            
            // 方法2: 如果DOM方法失败，从数据库查询（根据created时间）
            this.log('[RenderOrderSorter] DOM未找到位置信息，尝试从数据库获取');
            const dbPositions = await this.getBlockPositionsFromDB(blockIds);
            return dbPositions;
            
        } catch (error) {
            this.log('[RenderOrderSorter] 获取块位置时出错:', error);
            // 返回空Map，将使用 blockId 字符串排序作为后备
            return positionMap;
        }
    }
    
    /**
     * 从DOM中获取块的渲染位置
     */
    private getBlockPositionsFromDOM(blockIds: string[]): Map<string, number> {
        const positionMap = new Map<string, number>();
        
        try {
            // 获取当前编辑器的protyle元素
            const protyleElement = document.querySelector('.protyle-wysiwyg');
            if (!protyleElement) {
                this.log('[RenderOrderSorter] 未找到 protyle-wysiwyg 元素');
                return positionMap;
            }
            
            // 获取所有具有 data-node-id 属性的元素
            const allBlocks = protyleElement.querySelectorAll('[data-node-id]');
            this.log('[RenderOrderSorter] DOM中找到的块元素数量:', allBlocks.length);
            
            // 遍历所有块，记录它们的位置
            allBlocks.forEach((element, index) => {
                const blockId = element.getAttribute('data-node-id');
                if (blockId && blockIds.includes(blockId)) {
                    positionMap.set(blockId, index);
                }
            });
            
            this.log('[RenderOrderSorter] 从DOM获取的位置映射:', 
                Array.from(positionMap.entries()).map(([id, pos]) => `${id}:${pos}`).join(', '));
            
        } catch (error) {
            this.log('[RenderOrderSorter] 从DOM获取位置时出错:', error);
        }
        
        return positionMap;
    }
    
    /**
     * 从数据库获取块的位置（根据创建时间）
     */
    private async getBlockPositionsFromDB(blockIds: string[]): Promise<Map<string, number>> {
        const positionMap = new Map<string, number>();
        
        if (blockIds.length === 0) {
            return positionMap;
        }
        
        try {
            const idList = blockIds.map(id => `"${id}"`).join(',');
            const stmt = `
                SELECT id, created
                FROM blocks
                WHERE id IN (${idList})
                ORDER BY created ASC
            `.trim();
            
            this.log('[RenderOrderSorter] 执行数据库查询:', stmt);
            
            const response = await fetch('/api/query/sql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ stmt })
            });
            
            const result = await response.json();
            
            if (result.code === 0 && result.data && Array.isArray(result.data)) {
                result.data.forEach((block: any, index: number) => {
                    if (block.id) {
                        positionMap.set(block.id, index);
                    }
                });
                this.log('[RenderOrderSorter] 从数据库获取的位置映射数量:', positionMap.size);
            } else {
                this.log('[RenderOrderSorter] 数据库查询失败或返回无效数据:', result);
            }
            
        } catch (error) {
            this.log('[RenderOrderSorter] 数据库查询出错:', error);
        }
        
        return positionMap;
    }
}

