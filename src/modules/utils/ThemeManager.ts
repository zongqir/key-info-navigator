import { fetchPost } from "siyuan";
import { Logger } from './Logger';
/**
 * 主题模式枚举
 */
export enum ThemeMode {
    LIGHT = 0,  // 明亮模式
    DARK = 1    // 暗黑模式
}

/**
 * SiYuan 配置响应接口
 */
interface SiYuanConfigResponse {
    code: number;
    msg: string;
    data: {
        conf: {
            appearance: {
                mode: number;           // 0=明亮模式，1=暗黑模式
                modeOS: boolean;        // 是否跟随系统
                darkThemes: string[];   // 暗黑主题列表
                lightThemes: string[];  // 明亮主题列表
                themeDark: string;      // 当前暗黑主题
                themeLight: string;     // 当前明亮主题
                codeBlockThemeLight: string;
                codeBlockThemeDark: string;
                lang: string;
                themeJS: boolean;
                closeButtonBehavior: number;
                hideStatusBar: boolean;
            };
        };
    };
}

/**
 * 主题管理器
 * 负责获取和管理 SiYuan 的主题状态
 */
export class ThemeManager {
    private static instance: ThemeManager;
    private currentTheme: ThemeMode = ThemeMode.LIGHT;
    private themeChangeCallbacks: Array<(theme: ThemeMode) => void> = [];
    private logger?: (...args: any[]) => void;

    constructor(logger?: (...args: any[]) => void) {
        this.logger = logger;
    }

    /**
     * 获取单例实例
     */
    public static getInstance(logger?: (...args: any[]) => void): ThemeManager {
        if (!ThemeManager.instance) {
            ThemeManager.instance = new ThemeManager(logger);
        }
        return ThemeManager.instance;
    }

    /**
     * 初始化主题管理器
     */
    public async initialize(): Promise<void> {
        try {
            await this.fetchCurrentTheme();
            this.log('主题管理器初始化完成，当前主题:', this.getThemeModeName());
        } catch (error) {
            this.log('主题管理器初始化失败:', error);
            // 降级处理：尝试从DOM检测主题
            this.detectThemeFromDOM();
        }
    }

    /**
     * 从 SiYuan API 获取当前主题
     */
    public async fetchCurrentTheme(): Promise<ThemeMode> {
        try {
            this.log('正在获取 SiYuan 主题配置...');
            
            const response: SiYuanConfigResponse = await fetchPost('/api/system/getConf', {});
            
            if (response.code === 0 && response.data?.conf?.appearance) {
                const appearance = response.data.conf.appearance;
                this.currentTheme = appearance.mode === 1 ? ThemeMode.DARK : ThemeMode.LIGHT;
                
                this.log('获取到主题配置:', {
                    mode: appearance.mode,
                    modeOS: appearance.modeOS,
                    themeDark: appearance.themeDark,
                    themeLight: appearance.themeLight,
                    resolvedTheme: this.getThemeModeName()
                });
                
                // 通知所有监听器
                this.notifyThemeChange();
                
                return this.currentTheme;
            } else {
                throw new Error(`API 返回错误: ${response.msg || '未知错误'}`);
            }
        } catch (error) {
            this.log('获取主题配置失败:', error);
            // 降级处理
            this.detectThemeFromDOM();
            throw error;
        }
    }

    /**
     * 从 DOM 检测主题（降级方案）
     */
    private detectThemeFromDOM(): void {
        try {
            // 检查 SiYuan 的主题类名或属性
            const htmlElement = document.documentElement;
            const bodyElement = document.body;
            
            // 方法1: 检查 data-theme-mode 属性
            const themeMode = htmlElement.getAttribute('data-theme-mode') || 
                             bodyElement.getAttribute('data-theme-mode');
            
            if (themeMode === 'dark') {
                this.currentTheme = ThemeMode.DARK;
                this.log('从 DOM 检测到暗色主题');
                return;
            }
            
            // 方法2: 检查类名
            const isDark = htmlElement.classList.contains('theme--dark') ||
                          bodyElement.classList.contains('theme--dark') ||
                          htmlElement.classList.contains('dark') ||
                          bodyElement.classList.contains('dark');
            
            if (isDark) {
                this.currentTheme = ThemeMode.DARK;
                this.log('从 DOM 类名检测到暗色主题');
                return;
            }
            
            // 方法3: 检查 CSS 变量或计算样式
            const computedStyle = getComputedStyle(htmlElement);
            const bgColor = computedStyle.backgroundColor;
            
            // 简单的颜色检测（暗色背景通常 RGB 值较低）
            if (bgColor && bgColor.startsWith('rgb')) {
                const match = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
                if (match) {
                    const [, r, g, b] = match.map(Number);
                    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
                    if (brightness < 128) {
                        this.currentTheme = ThemeMode.DARK;
                        this.log('从背景色检测到暗色主题');
                        return;
                    }
                }
            }
            
            // 默认为明亮主题
            this.currentTheme = ThemeMode.LIGHT;
            this.log('DOM 检测默认为明亮主题');
            
        } catch (error) {
            this.log('DOM 主题检测失败，使用默认明亮主题:', error);
            this.currentTheme = ThemeMode.LIGHT;
        }
    }

    /**
     * 获取当前主题模式
     */
    public getCurrentTheme(): ThemeMode {
        return this.currentTheme;
    }

    /**
     * 获取主题模式名称
     */
    public getThemeModeName(): string {
        return this.currentTheme === ThemeMode.DARK ? 'dark' : 'light';
    }

    /**
     * 是否为暗色主题
     */
    public isDarkMode(): boolean {
        return this.currentTheme === ThemeMode.DARK;
    }

    /**
     * 是否为明亮主题
     */
    public isLightMode(): boolean {
        return this.currentTheme === ThemeMode.LIGHT;
    }

    /**
     * 监听主题变化
     */
    public onThemeChange(callback: (theme: ThemeMode) => void): void {
        this.themeChangeCallbacks.push(callback);
    }

    /**
     * 移除主题变化监听器
     */
    public offThemeChange(callback: (theme: ThemeMode) => void): void {
        const index = this.themeChangeCallbacks.indexOf(callback);
        if (index !== -1) {
            this.themeChangeCallbacks.splice(index, 1);
        }
    }

    /**
     * 通知主题变化
     */
    private notifyThemeChange(): void {
        this.themeChangeCallbacks.forEach(callback => {
            try {
                callback(this.currentTheme);
            } catch (error) {
                this.log('主题变化回调执行失败:', error);
            }
        });
    }

    /**
     * 手动设置主题（用于测试或特殊情况）
     */
    public setTheme(theme: ThemeMode): void {
        if (this.currentTheme !== theme) {
            this.currentTheme = theme;
            this.log('手动设置主题为:', this.getThemeModeName());
            this.notifyThemeChange();
        }
    }

    /**
     * 切换主题（明亮 ↔ 暗色）
     */
    public toggleTheme(): void {
        const newTheme = this.currentTheme === ThemeMode.DARK ? ThemeMode.LIGHT : ThemeMode.DARK;
        this.setTheme(newTheme);
    }

    /**
     * 获取主题相关的 CSS 类名
     */
    public getThemeClassName(): string {
        return this.isDarkMode() ? 'theme-dark' : 'theme-light';
    }

    /**
     * 应用主题到指定元素
     */
    public applyThemeToElement(element: HTMLElement): void {
        element.classList.remove('theme-light', 'theme-dark');
        element.classList.add(this.getThemeClassName());
        element.setAttribute('data-theme-mode', this.getThemeModeName());
    }

    /**
     * 启动主题监听（定期检查主题变化）
     */
    public startThemeWatching(interval: number = 5000): void {
        setInterval(async () => {
            try {
                await this.fetchCurrentTheme();
            } catch (error) {
                // 静默失败，避免频繁错误日志
            }
        }, interval);
    }

    /**
     * 日志输出
     */
    private log(...args: any[]): void {
        if (this.logger) {
            this.logger('[ThemeManager]', ...args);
        }
    }

    /**
     * 销毁主题管理器
     */
    public destroy(): void {
        this.themeChangeCallbacks = [];
    }
}
