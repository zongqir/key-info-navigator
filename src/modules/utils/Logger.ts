/**
 * 日志管理工具
 * 提供可配置的控制台输出功能
 */
export class Logger {
    private static isDebugEnabled = false;
    private static prefix = '[Key Info Navigator]';

    /**
     * 设置是否启用调试输出
     */
    public static setDebugEnabled(enabled: boolean): void {
        Logger.isDebugEnabled = enabled;
    }

    /**
     * 获取当前调试状态
     */
    public static getDebugEnabled(): boolean {
        return Logger.isDebugEnabled;
    }

    /**
     * 设置日志前缀
     */
    public static setPrefix(prefix: string): void {
        Logger.prefix = prefix;
    }

    /**
     * 普通日志输出
     */
    public static log(...args: any[]): void {
        if (Logger.isDebugEnabled) {
            console.log(Logger.prefix, ...args);
        }
    }

    /**
     * 警告日志输出
     */
    public static warn(...args: any[]): void {
        if (Logger.isDebugEnabled) {
            console.warn(Logger.prefix, ...args);
        }
    }

    /**
     * 错误日志输出（总是输出，不受调试开关控制）
     */
    public static error(...args: any[]): void {
        console.error(Logger.prefix, ...args);
    }

    /**
     * 信息日志输出
     */
    public static info(...args: any[]): void {
        if (Logger.isDebugEnabled) {
            console.info(Logger.prefix, ...args);
        }
    }

    /**
     * 调试日志输出
     */
    public static debug(...args: any[]): void {
        if (Logger.isDebugEnabled) {
            console.debug(Logger.prefix, ...args);
        }
    }

    /**
     * 创建带模块名的日志器
     */
    public static createModuleLogger(moduleName: string) {
        return {
            log: (...args: any[]) => {
                if (Logger.isDebugEnabled) {
                    console.log(`${Logger.prefix}[${moduleName}]`, ...args);
                }
            },
            warn: (...args: any[]) => {
                if (Logger.isDebugEnabled) {
                    console.warn(`${Logger.prefix}[${moduleName}]`, ...args);
                }
            },
            error: (...args: any[]) => {
                console.error(`${Logger.prefix}[${moduleName}]`, ...args);
            },
            info: (...args: any[]) => {
                if (Logger.isDebugEnabled) {
                    console.info(`${Logger.prefix}[${moduleName}]`, ...args);
                }
            },
            debug: (...args: any[]) => {
                if (Logger.isDebugEnabled) {
                    console.debug(`${Logger.prefix}[${moduleName}]`, ...args);
                }
            }
        };
    }
}
