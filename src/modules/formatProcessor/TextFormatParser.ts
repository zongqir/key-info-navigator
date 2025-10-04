import { fetchPost } from 'siyuan';
import { IFormatProcessor, TextFormatType, FormattedTextItem, ParseOptions } from './interfaces';
import { FormatProcessorFactory } from './FormatProcessorFactory';
import { SorterFactory } from '../sorter';

/**
 * 文本格式解析器
 */
export class TextFormatParser {
    private processors: Map<TextFormatType, IFormatProcessor> = new Map();
    
    constructor(private logger?: (...args: any[]) => void) {
        if (logger) {
            FormatProcessorFactory.setLogger(logger);
            SorterFactory.setLogger(logger);
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
            
            // 使用排序器进行排序（默认为渲染顺序排序）
            const sorter = SorterFactory.getDefaultSorter();
            const sortedItems = await sorter.sort(allItems);
            
            return sortedItems;
            
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
        // spans 表的 type 是 "textmark em"、"textmark strong" 这样的格式
        // 需要添加 textmark 前缀
        const actualTypes = sqlTypes.map(t => {
            // 如果已经有 textmark 前缀，就不加了
            if (t.startsWith('textmark ')) {
                return t;
            }
            // 否则添加 textmark 前缀
            return `textmark ${t}`;
        });
        
        // 使用 LIKE 匹配，支持多格式合并的情况（如 "textmark strong inline-memo"）
        const typeConditions = actualTypes.map(t => `type LIKE '%${t}%'`).join(" OR ");
        const limit = maxResults ? `LIMIT ${maxResults}` : 'LIMIT 200';
        
        const stmt = `
            SELECT *
            FROM spans
            WHERE root_id = "${rootBlockId}"
              AND (${typeConditions})
            ORDER BY block_id, start_offset
            ${limit}
        `.trim();
        
        return stmt;
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
        
        // 定义格式优先级（数字越小优先级越高）
        const formatPriority = new Map([
            [TextFormatType.MEMO, 1],      // 备注最高优先级
            [TextFormatType.HIGHLIGHT, 2], // 高亮第二
            [TextFormatType.BOLD, 3],      // 加粗第三
            [TextFormatType.ITALIC, 4],    // 斜体第四
            [TextFormatType.UNDERLINE, 5], // 下划线第五
        ]);
        
        for (const span of spans) {
            // 检查span是否为有效对象
            if (!span || typeof span !== 'object') {
                this.log('跳过无效的span对象:', span);
                continue;
            }
            
            // 收集所有匹配的处理器及其优先级
            const matchingProcessors: { processor: IFormatProcessor, priority: number }[] = [];
            
            for (const processor of processors) {
                try {
                    const config = processor.getConfig();
                    
                    // 精确匹配：span.type 必须完全等于 sqlType 中的某一个，或者包含完整的关键词
                    const isMatch = config.sqlType.some(sqlType => {
                        // 完整格式匹配，如 "textmark em" === "textmark em"
                        if (span.type === sqlType) return true;
                        // 或者 span.type 包含完整的关键词（用空格分隔）
                        const spanTypeParts = span.type.split(' ');
                        return spanTypeParts.includes(sqlType);
                    });
                    
                    if (isMatch) {
                        const priority = formatPriority.get(processor.formatType) || 999; // 未定义优先级的格式排在最后
                        matchingProcessors.push({ processor, priority });
                    }
                } catch (error) {
                    this.log(`${processor.formatType}处理器匹配检查失败:`, error);
                }
            }
            
            if (matchingProcessors.length === 0) {
                this.log('没有找到匹配的处理器，span类型:', span.type);
                continue;
            }
            
            // 按优先级排序，选择优先级最高的处理器
            // 注意：这里只对单个span中的多格式冲突进行优先级选择
            // 不同的span应该都被处理，在侧边栏中显示多个条目
            matchingProcessors.sort((a, b) => a.priority - b.priority);
            const selectedProcessor = matchingProcessors[0].processor;
            
            // 如果有多个匹配的处理器，记录优先级选择日志
            if (matchingProcessors.length > 1) {
                const formatTypes = matchingProcessors.map(mp => mp.processor.formatType).join(', ');
                this.log(`单个span多格式冲突，优先级选择: ${selectedProcessor.formatType} (span类型: ${span.type}, 可选格式: ${formatTypes})`);
            }
            
            // 使用选中的处理器提取内容
            try {
                const items = selectedProcessor.extractFromSpan(span);
                if (items.length > 0) {
                    allItems.push(...items);
                    this.log(`使用 ${selectedProcessor.formatType} 处理器成功提取:`, items.length, '个项目');
                }
            } catch (error) {
                this.log(`${selectedProcessor.formatType}处理器提取失败:`, error);
            }
        }
        
        return this.filterAndSortResults(allItems, options);
    }
    
    /**
     * 过滤结果（去重和限制数量）
     * 注意：排序已移至 parseFormattedTexts 方法中使用排序器完成
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
        this.log('启用的格式:', options.enabledFormats);
        this.log('处理器数量:', processors.length);
        
        try {
            // 使用原生 fetch（fetchPost 有问题）
            const fetchResponse = await fetch('/api/query/sql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ stmt })
            });
            const response = await fetchResponse.json();
            
            if (!response) {
                this.log('❌ Span SQL查询无响应');
                return [];
            }
            
            if (response.code !== 0) {
                this.log('❌ Span SQL查询失败:', response);
                return [];
            }
            
            // 确保response.data是有效数组
            if (!response.data || !Array.isArray(response.data)) {
                this.log('❌ Span SQL查询返回无效数据:', response.data);
                return [];
            }
            
            this.log('✅ 查询到', response.data.length, '个span');
            // 添加详细的span类型日志
            response.data.forEach((span: any, index: number) => {
                if (span && span.type) {
                    this.log(`Span ${index + 1}: type="${span.type}", content="${(span.content || '').substring(0, 50)}..."`);
                }
            });
            
            return this.processQueryResults(response.data, processors, options);
        } catch (error) {
            this.log('❌ Span SQL查询异常:', error);
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
            // 使用原生 fetch（fetchPost 有问题）
            const fetchResponse = await fetch('/api/query/sql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ stmt })
            });
            const response = await fetchResponse.json();
            
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
              AND type = "i"
              AND subtype = "t"
            ORDER BY created ASC
            ${limit}
        `.trim();
        
        try {
            // 使用原生 fetch（fetchPost 有问题，返回 undefined）
            const fetchResponse = await fetch('/api/query/sql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ stmt })
            });
            const response = await fetchResponse.json();
            
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
                if ('extractFromBlock' in tagProcessor) {
                    const tagItems = (tagProcessor as any).extractFromBlock(block, index);
                    this.log('TagProcessor提取的标签项:', tagItems);
                    items.push(...tagItems);
                }
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
            
            // 严格检查：subtype 必须是字符串 "t"，排除 null、undefined 等
            if (block.subtype === 't' && typeof block.subtype === 'string') {
                this.log('✅ [TextFormatParser] 确认是Todo块，调用TodoProcessor');
                // 使用TodoProcessor的extractFromBlock方法，传递块索引
                if ('extractFromBlock' in todoProcessor) {
                    const todoItems = (todoProcessor as any).extractFromBlock(block, index);
                    this.log('🎯 [TextFormatParser] TodoProcessor返回的项目:', todoItems);
                    items.push(...todoItems);
                }
            } else {
                this.log('⚠️ [TextFormatParser] 不是Todo块或subtype无效，subtype:', block.subtype, 'type:', typeof block.subtype);
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
            this.logger(...args);
        }
    }
}
