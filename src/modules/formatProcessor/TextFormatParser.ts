import { fetchPost } from 'siyuan';
import { IFormatProcessor, TextFormatType, FormattedTextItem, ParseOptions } from './interfaces';
import { FormatProcessorFactory } from './FormatProcessorFactory';
import { MemoProcessor } from './processors/MemoProcessor';

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
        
        // 检查是否包含备注，如果包含则使用特殊处理
        if (options.enabledFormats.includes(TextFormatType.MEMO)) {
            return this.extractWithMemoSupport(protyle.wysiwyg.element, blockId, processors, options);
        }
        
        return this.extractFromHTML(
            protyle.wysiwyg.element.innerHTML, 
            blockId, 
            processors,
            options
        );
    }
    
    /**
     * 支持备注的提取方法
     */
    private extractWithMemoSupport(
        element: HTMLElement,
        blockId: string,
        processors: IFormatProcessor[],
        options: ParseOptions
    ): FormattedTextItem[] {
        const allItems: FormattedTextItem[] = [];
        
        // 分别处理备注和其他格式
        const memoProcessor = processors.find(p => p.formatType === TextFormatType.MEMO) as MemoProcessor;
        const otherProcessors = processors.filter(p => p.formatType !== TextFormatType.MEMO);
        
        // 如果有备注处理器，使用特殊的页面提取方法
        if (memoProcessor) {
            this.log('使用备注特殊提取方法');
            const memoItems = memoProcessor.getAllMemosFromPage(element);
            allItems.push(...memoItems);
        }
        
        // 处理其他格式化文本
        if (otherProcessors.length > 0) {
            const otherItems = this.extractFromHTML(element.innerHTML, blockId, otherProcessors, options);
            allItems.push(...otherItems);
        }
        
        return this.filterAndSortResults(allItems, options);
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
        
        for (const span of spans) {
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
        
        const response = await fetchPost("/api/query/sql", { stmt }) as any;
        
        if (response.code !== 0) {
            this.log('Span SQL查询失败:', response);
            return [];
        }
        
        return this.processQueryResults(response.data, processors, options);
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
        
        const response = await fetchPost("/api/query/sql", { stmt }) as any;
        
        if (response.code !== 0) {
            this.log('标签块查询失败:', response);
            return [];
        }
        
        return this.processTagBlocks(response.data);
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
        
        const response = await fetchPost("/api/query/sql", { stmt }) as any;
        
        if (response.code !== 0) {
            this.log('Todo块查询失败:', response);
            return [];
        }
        
        return this.processTodoBlocks(response.data);
    }
    
    /**
     * 处理标签块数据
     */
    private processTagBlocks(blocks: any[]): FormattedTextItem[] {
        const items: FormattedTextItem[] = [];
        
        blocks.forEach((block, index) => {
            if (block.tag) {
                const tags = block.tag.split(',').map((tag: string) => tag.trim()).filter(Boolean);
                
                tags.forEach(tag => {
                    items.push({
                        id: `tag_${block.id}_${tag}`,
                        text: `#${tag}`,
                        type: TextFormatType.TAG,
                        blockId: block.id,
                        position: index,
                        context: this.truncateText(block.content || "", 50),
                        icon: "iconTags",
                        color: "#4285f4"
                    });
                });
            }
        });
        
        return items;
    }
    
    /**
     * 处理Todo块数据
     */
    private processTodoBlocks(blocks: any[]): FormattedTextItem[] {
        const items: FormattedTextItem[] = [];
        
        blocks.forEach((block, index) => {
            if (block.subtype === 't') {
                const content = this.extractTodoContent(block.content || "");
                const isCompleted = this.isTodoCompleted(block.content || "");
                
                items.push({
                    id: `todo_${block.id}`,
                    text: content,
                    type: TextFormatType.TODO,
                    blockId: block.id,
                    position: index,
                    context: this.truncateText(content, 80),
                    icon: isCompleted ? "iconCheck" : "iconUncheck",
                    color: isCompleted ? "#34a853" : "#ff9800"
                });
            }
        });
        
        return items;
    }
    
    /**
     * 提取Todo内容
     */
    private extractTodoContent(content: string): string {
        // 移除HTML标签，获取纯文本
        const text = content.replace(/<[^>]*>/g, '').trim();
        // 移除checkbox标记
        return text.replace(/^\s*[\[✓☑️✗✘x\]\s*]*/, '').trim();
    }
    
    /**
     * 检查Todo是否完成
     */
    private isTodoCompleted(content: string): boolean {
        // 检查是否包含完成标记
        return /\[✓\]|\[x\]|☑️/.test(content);
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
