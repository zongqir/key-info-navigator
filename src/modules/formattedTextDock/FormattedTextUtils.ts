import { FormattedTextItem } from "../formatProcessor";

/**
 * 格式化文本工具函数
 * 包含各种实用的辅助函数
 */
export class FormattedTextUtils {
    /**
     * 分组项目（相同文本内容的项目）
     */
    public static groupItems(items: FormattedTextItem[]): Map<string, FormattedTextItem[]> {
        const groups = new Map<string, FormattedTextItem[]>();
        
        for (const item of items) {
            const key = `${item.type}_${item.text}`;
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key)!.push(item);
        }
        
        return groups;
    }

    /**
     * 转义HTML
     */
    public static escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 截断文本
     */
    public static truncateText(text: string, maxLength: number): string {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    /**
     * 清理文本
     */
    public static cleanText(text: string): string {
        return text.trim().replace(/\s+/g, ' ');
    }

    /**
     * 防抖函数
     */
    public static debounce<T extends (...args: any[]) => any>(
        func: T,
        wait: number
    ): (...args: Parameters<T>) => void {
        let timeout: number | undefined;
        
        return (...args: Parameters<T>) => {
            if (timeout) {
                clearTimeout(timeout);
            }
            timeout = setTimeout(() => {
                func(...args);
            }, wait);
        };
    }

    /**
     * 节流函数
     */
    public static throttle<T extends (...args: any[]) => any>(
        func: T,
        wait: number
    ): (...args: Parameters<T>) => void {
        let inThrottle: boolean;
        
        return (...args: Parameters<T>) => {
            if (!inThrottle) {
                func(...args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, wait);
            }
        };
    }

    /**
     * 深度克隆对象
     */
    public static deepClone<T>(obj: T): T {
        if (obj === null || typeof obj !== "object") {
            return obj;
        }

        if (obj instanceof Date) {
            return new Date(obj.getTime()) as unknown as T;
        }

        if (obj instanceof Array) {
            return obj.map(item => FormattedTextUtils.deepClone(item)) as unknown as T;
        }

        if (typeof obj === "object") {
            const clonedObj = {} as T;
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    clonedObj[key] = FormattedTextUtils.deepClone(obj[key]);
                }
            }
            return clonedObj;
        }

        return obj;
    }

    /**
     * 获取元素的可见文本
     */
    public static getVisibleText(element: Element): string {
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') {
            return '';
        }
        return element.textContent?.trim() || '';
    }

    /**
     * 检查元素是否在视口中
     */
    public static isElementInViewport(element: Element): boolean {
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }

    /**
     * 获取元素相对于容器的位置
     */
    public static getElementOffset(element: Element, container?: Element): { top: number, left: number } {
        const elementRect = element.getBoundingClientRect();
        const containerRect = container ? container.getBoundingClientRect() : { top: 0, left: 0 };
        
        return {
            top: elementRect.top - containerRect.top,
            left: elementRect.left - containerRect.left
        };
    }

    /**
     * 创建唯一ID
     */
    public static generateUniqueId(prefix = 'id'): string {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 格式化时间戳
     */
    public static formatTimestamp(timestamp: number, format = 'YYYY-MM-DD HH:mm:ss'): string {
        const date = new Date(timestamp);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        return format
            .replace('YYYY', String(year))
            .replace('MM', month)
            .replace('DD', day)
            .replace('HH', hours)
            .replace('mm', minutes)
            .replace('ss', seconds);
    }

    /**
     * 比较两个数组是否相等
     */
    public static arrayEquals<T>(arr1: T[], arr2: T[]): boolean {
        if (arr1.length !== arr2.length) {
            return false;
        }
        
        for (let i = 0; i < arr1.length; i++) {
            if (arr1[i] !== arr2[i]) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * 安全地获取对象属性
     */
    public static safeGet<T>(obj: any, path: string, defaultValue: T): T {
        try {
            const keys = path.split('.');
            let current = obj;
            
            for (const key of keys) {
                if (current === null || current === undefined) {
                    return defaultValue;
                }
                current = current[key];
            }
            
            return current !== undefined ? current : defaultValue;
        } catch {
            return defaultValue;
        }
    }
}
