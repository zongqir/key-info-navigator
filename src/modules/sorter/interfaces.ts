import { FormattedTextItem } from "../formatProcessor";

/**
 * 排序策略枚举
 */
export enum SortStrategy {
    /** 根据界面渲染顺序（block在文档中的实际位置） */
    RENDER_ORDER = "render_order",
    /** 根据block_id字符串本身排序 */
    BLOCK_ID = "block_id",
    /** 根据更新时间排序 */
    UPDATE_TIME = "update_time"
}

/**
 * 排序器接口
 */
export interface ISorter {
    /** 排序策略类型 */
    readonly strategy: SortStrategy;
    
    /** 
     * 对格式化文本项进行排序
     * @param items 待排序的项目列表
     * @returns 排序后的项目列表
     */
    sort(items: FormattedTextItem[]): Promise<FormattedTextItem[]>;
}

/**
 * 块位置信息（用于渲染顺序排序）
 */
export interface BlockPositionInfo {
    /** 块ID */
    blockId: string;
    /** 块在文档中的位置索引（从0开始） */
    index: number;
}

