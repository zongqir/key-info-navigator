import { fetchPost } from 'siyuan';
import { IFormatProcessor, TextFormatType, FormattedTextItem, ParseOptions } from './interfaces';
import { FormatProcessorFactory } from './FormatProcessorFactory';

/**
 * 文本格式解析器
 */
export class TextFormatParser {
    private processors: Map<TextFormatType, IFormatProcessor> = new Map();
    
    constructor(private logger?: (...args: any[]) => void) {
        if (logger) {
            FormatProcessorFactory.setLogger(logger);
        }
    }
    
    /**
     * 解析文档中的格式化文本
     */
    public async parseFormattedTexts(
        rootBlockId: string, 
        options: ParseOptions
    ): Promise<FormattedTextItem[]> {
        try {
            const allItems: FormattedTextItem[] = [];
            
            // 直接查询标签块
            if (options.enabledFormats.includes(TextFormatType.TAG)) {
                const tagItems = await this.queryTagBlocks(rootBlockId, options.maxResults);
                allItems.push(...tagItems);
            }
            
            // 直接查询Todo块
            if (options.enabledFormats.includes(TextFormatType.TODO)) {
                const todoItems = await this.queryTodoBlocks(rootBlockId, options.maxResults);
                allItems.push(...todoItems);
            }
            
            // 查询spans（原有的格式化文本）
            const spanFormats = options.enabledFormats.filter(f => 
                f !== TextFormatType.TAG && f !== TextFormatType.TODO
            );
            
            if (spanFormats.length > 0) {
                const processors = FormatProcessorFactory.getProcessors(spanFormats);
                const spanItems = await this.querySpans(rootBlockId, processors, options);
                allItems.push(...spanItems);
            }
            
            return allItems;
            
        } catch (error) {
            this.log('解析格式化文本时出错:', error);
            return [];
        }
    }
    
    /**
     * 从当前编辑器获取格式化文本
     */
    public getCurrentEditorFormattedTexts(
        protyle: any, 
        options: ParseOptions
    ): FormattedTextItem[] {
        if (!protyle?.wysiwyg?.element) {
            this.log('编辑器元素不可用');
            return [];
        }
        
        const processors = FormatProcessorFactory.getProcessors(options.enabledFormats);
        const blockId = protyle.block?.rootID || "";
        
        // 统一使用标准HTML提取方法，包括备注
        return this.extractFromHTML(
            protyle.wysiwyg.element.innerHTML, 
            blockId, 
            processors,
            options
        );
    }
    
    
    /**
     * 清理文本
     */
    private cleanText(text: string): string {
        return text.trim().replace(/\s+/g, ' ');
    }
    
    /**
     * 获取格式处理器
     */
    public getFormatProcessor(type: TextFormatType): IFormatProcessor {
        return FormatProcessorFactory.getProcessor(type);
    }
    
    /**
     * 从HTML中提取格式化文本
     */
    private extractFromHTML(
        html: string, 
        blockId: string, 
        processors: IFormatProcessor[],
        options: ParseOptions
    ): FormattedTextItem[] {
        const allItems: FormattedTextItem[] = [];
        
        for (const processor of processors) {
            try {
                const items = processor.extractFromHTML(html, blockId);
                allItems.push(...items);
            } catch (error) {
                this.log(`${processor.formatType}处理器HTML提取失败:`, error);
            }
        }
        
        return this.filterAndSortResults(allItems, options);
    }
    
    /**
     * 收集SQL类型
     */
    private collectSqlTypes(processors: IFormatProcessor[]): string[] {
        const sqlTypes = new Set<string>();
        
        for (const processor of processors) {
            const config = processor.getConfig();
            config.sqlType.forEach(type => sqlTypes.add(type));
        }
        
        return Array.from(sqlTypes);
    }
    
    /**
     * 构建SQL查询语句
     */
    private buildSqlQuery(rootBlockId: string, sqlTypes: string[], maxResults?: number): string {
        const typeConditions = sqlTypes.map(t => `'${t}'`).join(",");
        const limit = maxResults ? `LIMIT ${maxResults}` : 'LIMIT 200';
        
        return `
            SELECT *
            FROM spans
            WHERE root_id = "${rootBlockId}"
              AND type IN (${typeConditions})
            ORDER BY block_id, start_offset
            ${limit}
        `.trim();
    }
    
    /**
     * 处理查询结果
     */
    private processQueryResults(
        spans: any[], 
        processors: IFormatProcessor[],
        options: ParseOptions
    ): FormattedTextItem[] {
        const allItems: FormattedTextItem[] = [];
        
        // 检查spans是否为有效数组
        if (!spans || !Array.isArray(spans)) {
            this.log('查询结果不是有效数组:', spans);
            return [];
        }
        
        for (const span of spans) {
            // 检查span是否为有效对象
            if (!span || typeof span !== 'object') {
                this.log('跳过无效的span对象:', span);
                continue;
            }
            
            for (const processor of processors) {
                try {
                    const config = processor.getConfig();
                    if (config.sqlType.includes(span.type)) {
                        const items = processor.extractFromSpan(span);
                        allItems.push(...items);
                        break; // 避免重复处理同一个span
                    }
                } catch (error) {
                    this.log(`${processor.formatType}处理器Span提取失败:`, error);
                }
            }
        }
        
        return this.filterAndSortResults(allItems, options);
    }
    
    /**
     * 过滤和排序结果
     */
    private filterAndSortResults(items: FormattedTextItem[], options: ParseOptions): FormattedTextItem[] {
        // 去重 - 包含位置信息，确保相同文本不同位置的项目都被保留
        const uniqueItems = new Map<string, FormattedTextItem>();
        
        for (const item of items) {
            // 使用更精确的key，包含位置信息，避免相同文本被错误去重
            const key = `${item.type}_${item.text}_${item.blockId}_${item.position}`;
            if (!uniqueItems.has(key)) {
                uniqueItems.set(key, item);
            }
        }
        
        let result = Array.from(uniqueItems.values());
        
        // 排序：按块ID和位置
        result.sort((a, b) => {
            if (a.blockId !== b.blockId) {
                return a.blockId.localeCompare(b.blockId);
            }
            return a.position - b.position;
        });
        
        // 应用最大结果限制
        if (options.maxResults && result.length > options.maxResults) {
            result = result.slice(0, options.maxResults);
        }
        
        return result;
    }
    
    
    /**
     * 查询spans表
     */
    private async querySpans(
        rootBlockId: string, 
        processors: IFormatProcessor[],
        options: ParseOptions
    ): Promise<FormattedTextItem[]> {
        const sqlTypes = this.collectSqlTypes(processors);
        
        if (sqlTypes.length === 0) {
            return [];
        }
        
        const stmt = this.buildSqlQuery(rootBlockId, sqlTypes, options.maxResults);
        this.log('执行Span SQL查询:', stmt);
        
        try {
            const response = await fetchPost("/api/query/sql", { stmt }) as any;
            
            if (!response) {
                this.log('Span SQL查询无响应');
                return [];
            }
            
            if (response.code !== 0) {
                this.log('Span SQL查询失败:', response);
                return [];
            }
            
            // 确保response.data是有效数组
            if (!response.data || !Array.isArray(response.data)) {
                this.log('Span SQL查询返回无效数据:', response.data);
                return [];
            }
            
            return this.processQueryResults(response.data, processors, options);
        } catch (error) {
            this.log('Span SQL查询异常:', error);
            return [];
        }
    }
    
    
    
    /**
     * 查询标签块
     */
    private async queryTagBlocks(rootBlockId: string, maxResults?: number): Promise<FormattedTextItem[]> {
        const limit = maxResults ? `LIMIT ${maxResults}` : 'LIMIT 200';
        
        const stmt = `
            SELECT *
            FROM blocks
            WHERE root_id = "${rootBlockId}"
              AND tag IS NOT NULL
            ORDER BY created ASC
            ${limit}
        `.trim();
        
        try {
            const response = await fetchPost("/api/query/sql", { stmt }) as any;
            
            if (!response) {
                this.log('标签块查询无响应');
                return [];
            }
            
            if (response.code !== 0) {
                this.log('标签块查询失败:', response);
                return [];
            }
            
            // 确保response.data是有效数组
            if (!response.data || !Array.isArray(response.data)) {
                this.log('标签块查询返回无效数据:', response.data);
                return [];
            }
            
            return this.processTagBlocks(response.data);
        } catch (error) {
            this.log('标签块查询异常:', error);
            return [];
        }
    }
    
    /**
     * 查询Todo块
     */
    private async queryTodoBlocks(rootBlockId: string, maxResults?: number): Promise<FormattedTextItem[]> {
        const limit = maxResults ? `LIMIT ${maxResults}` : 'LIMIT 200';
        
        const stmt = `
            SELECT *
            FROM blocks
            WHERE root_id = "${rootBlockId}"
              AND subtype = "t"
            ORDER BY created ASC
            ${limit}
        `.trim();
        
        try {
            const response = await fetchPost("/api/query/sql", { stmt }) as any;
            
            if (!response) {
                this.log('Todo块查询无响应');
                return [];
            }
            
            if (response.code !== 0) {
                this.log('Todo块查询失败:', response);
                return [];
            }
            
            // 确保response.data是有效数组
            if (!response.data || !Array.isArray(response.data)) {
                this.log('Todo块查询返回无效数据:', response.data);
                return [];
            }
            
            return this.processTodoBlocks(response.data);
        } catch (error) {
            this.log('Todo块查询异常:', error);
            return [];
        }
    }
    
    /**
     * 处理标签块数据
     */
    private processTagBlocks(blocks: any[]): FormattedTextItem[] {
        const items: FormattedTextItem[] = [];
        
        // 检查blocks是否为有效数组
        if (!blocks || !Array.isArray(blocks)) {
            this.log('标签块数据不是有效数组:', blocks);
            return [];
        }
        
        // 使用TagProcessor来处理标签块
        const tagProcessor = this.getFormatProcessor(TextFormatType.TAG);
        
        blocks.forEach((block, index) => {
            // 检查block是否为有效对象
            if (!block || typeof block !== 'object') {
                this.log('跳过无效的标签块对象:', block);
                return;
            }
            
            this.log('🔍 [DEBUG] 处理标签块详情:', {
                'block.id': block.id,
                'block.root_id': block.root_id,
                'block.tag': block.tag,
                'block.content': block.content?.substring(0, 100),
                'block.type': block.type,
                '完整block对象': block
            });
            
            if (block.tag) {
                // 使用TagProcessor的extractFromBlock方法，传递块索引
                const tagItems = tagProcessor.extractFromBlock(block, index);
                this.log('TagProcessor提取的标签项:', tagItems);
                items.push(...tagItems);
            }
        });
        
        return items;
    }
    
    /**
     * 处理Todo块数据
     */
    private processTodoBlocks(blocks: any[]): FormattedTextItem[] {
        this.log('🔍 [TextFormatParser] processTodoBlocks 开始处理Todo块数据');
        const items: FormattedTextItem[] = [];
        
        // 检查blocks是否为有效数组
        if (!blocks || !Array.isArray(blocks)) {
            this.log('❌ [TextFormatParser] Todo块数据不是有效数组:', blocks);
            return [];
        }
        
        this.log('✅ [TextFormatParser] 找到', blocks.length, '个Todo块');
        
        // 使用TodoProcessor来处理Todo块
        const todoProcessor = this.getFormatProcessor(TextFormatType.TODO);
        this.log('🎯 [TextFormatParser] 获得TodoProcessor:', todoProcessor);
        
        blocks.forEach((block, index) => {
            this.log(`📋 [TextFormatParser] 处理第${index + 1}个块:`, block);
            
            // 检查block是否为有效对象
            if (!block || typeof block !== 'object') {
                this.log('⚠️ [TextFormatParser] 跳过无效的Todo块对象:', block);
                return;
            }
            
            this.log('🔍 [TextFormatParser] 块的subtype:', block.subtype);
            
            if (block.subtype === 't') {
                this.log('✅ [TextFormatParser] 确认是Todo块，调用TodoProcessor');
                // 使用TodoProcessor的extractFromBlock方法，传递块索引
                const todoItems = todoProcessor.extractFromBlock(block, index);
                this.log('🎯 [TextFormatParser] TodoProcessor返回的项目:', todoItems);
                items.push(...todoItems);
            } else {
                this.log('⚠️ [TextFormatParser] 不是Todo块，subtype:', block.subtype);
            }
        });
        
        this.log('🎉 [TextFormatParser] processTodoBlocks 完成，总共', items.length, '个Todo项目');
        return items;
    }
    
    
    /**
     * 截断文本
     */
    private truncateText(text: string, maxLength: number): string {
        if (text.length <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength) + '...';
    }

    /**
     * 日志输出
     */
    private log(...args: any[]): void {
        if (this.logger) {
            this.logger('[TextFormatParser]', ...args);
        }
    }
}
