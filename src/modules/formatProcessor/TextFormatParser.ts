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
            const processors = FormatProcessorFactory.getProcessors(options.enabledFormats);
            const sqlTypes = this.collectSqlTypes(processors);
            
            if (sqlTypes.length === 0) {
                this.log('没有可用的SQL类型');
                return [];
            }
            
            const stmt = this.buildSqlQuery(rootBlockId, sqlTypes, options.maxResults);
            this.log('执行SQL查询:', stmt);
            
            const response = await fetchPost("/api/query/sql", { stmt });
            
            if (response.code !== 0) {
                this.log('SQL查询失败:', response);
                return [];
            }
            
            return this.processQueryResults(response.data, processors, options);
            
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
        
        return this.extractFromHTML(
            protyle.wysiwyg.element.innerHTML, 
            blockId, 
            processors,
            options
        );
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
        // 去重
        const uniqueItems = new Map<string, FormattedTextItem>();
        
        for (const item of items) {
            const key = `${item.type}_${item.text}_${item.blockId}`;
            if (!uniqueItems.has(key) || uniqueItems.get(key)!.position > item.position) {
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
     * 日志输出
     */
    private log(...args: any[]): void {
        if (this.logger) {
            this.logger('[TextFormatParser]', ...args);
        }
    }
}
