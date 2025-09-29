import {
    Plugin,
    getFrontend,
    Menu,
    openTab
} from "siyuan";
import "./index.scss";
import { FormattedTextDock } from "./modules/formattedTextDock";
import { Logger, ThemeManager, ThemeMode } from "./modules/utils";

const FORMATTED_TEXT_DOCK_TYPE = "formatted_text_dock";

export default class KeyInfoNavigatorPlugin extends Plugin {

    private isMobile: boolean;
    private formattedTextDock?: FormattedTextDock;
    private themeManager?: ThemeManager;
    
    // 默认设置
    private settings = {
        enableDebugLog: false  // 默认关闭调试日志
    };

    async onload() {
        const frontEnd = getFrontend();
        this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";

        // 加载设置
        await this.loadSettings();
        
        // 配置日志器
        Logger.setDebugEnabled(this.settings.enableDebugLog);
        Logger.log('插件启动，调试模式:', this.settings.enableDebugLog ? '开启' : '关闭');

        // 初始化主题管理器
        this.themeManager = ThemeManager.getInstance(Logger.log);
        await this.initializeTheme();

        // 添加导航侧边栏
        this.addDock({
            config: {
                position: "RightTop",
                size: {width: 280, height: 0},
                icon: "iconFocus",
                title: "",
                hotkey: "⌥⌘F",
            },
            data: {},
            type: FORMATTED_TEXT_DOCK_TYPE,
            resize: () => {
                this.formattedTextDock?.onDocumentChange();
            },
            update: () => {
                this.formattedTextDock?.onDocumentChange();
            },
            init: (dock) => {
                const moduleLogger = Logger.createModuleLogger('FormattedTextDock');
                this.formattedTextDock = new FormattedTextDock(
                    dock.element as HTMLElement,
                    this.i18n,
                    moduleLogger.log
                );
            },
            destroy: () => {
                this.formattedTextDock?.destroy();
                this.formattedTextDock = undefined;
            }
        });

        // 监听文档变更事件
        this.eventBus.on("switch-protyle", () => {
            Logger.log('事件触发: switch-protyle');
            this.formattedTextDock?.onDocumentChange();
        });
        
        this.eventBus.on("loaded-protyle-dynamic", () => {
            Logger.log('事件触发: loaded-protyle-dynamic');
            this.formattedTextDock?.onDocumentChange();
        });
        
        this.eventBus.on("loaded-protyle-static", () => {
            Logger.log('事件触发: loaded-protyle-static');
            this.formattedTextDock?.onDocumentChange();
        });

        // 添加更多 tab 切换相关的事件监听
        // 注意：某些事件名称可能不在官方类型定义中，使用 as any 进行类型断言
        (this.eventBus as any).on("open-tab", () => {
            Logger.log('事件触发: open-tab');
            this.formattedTextDock?.onDocumentChange();
        });

        (this.eventBus as any).on("close-tab", () => {
            Logger.log('事件触发: close-tab');
            this.formattedTextDock?.onDocumentChange();
        });

        (this.eventBus as any).on("switch-tab", () => {
            Logger.log('事件触发: switch-tab');
            this.formattedTextDock?.onDocumentChange();
        });

        (this.eventBus as any).on("layout-tab-switch", () => {
            Logger.log('事件触发: layout-tab-switch');
            this.formattedTextDock?.onDocumentChange();
        });

        // 监听编辑器焦点变化
        (this.eventBus as any).on("focus-protyle", () => {
            Logger.log('事件触发: focus-protyle');
            this.formattedTextDock?.onDocumentChange();
        });

        // 监听文档打开事件
        (this.eventBus as any).on("open-document", () => {
            Logger.log('事件触发: open-document');
            this.formattedTextDock?.onDocumentChange();
        });

        Logger.log(this.i18n.helloPlugin);
    }

    onLayoutReady() {
        Logger.log("插件加载完成");
    }

    /**
     * 加载设置
     */
    private async loadSettings() {
        try {
            const savedSettings = await this.loadData('settings.json');
            if (savedSettings) {
                this.settings = { ...this.settings, ...savedSettings };
            }
        } catch (error) {
            Logger.error('加载设置失败:', error);
        }
    }

    /**
     * 保存设置
     */
    private async saveSettings() {
        try {
            await this.saveData('settings.json', this.settings);
            Logger.log('设置已保存');
        } catch (error) {
            Logger.error('保存设置失败:', error);
        }
    }

    /**
     * 切换调试模式
     */
    public toggleDebugMode(): void {
        this.settings.enableDebugLog = !this.settings.enableDebugLog;
        Logger.setDebugEnabled(this.settings.enableDebugLog);
        this.saveSettings();
        
        Logger.log('调试模式已', this.settings.enableDebugLog ? '开启' : '关闭');
        // 显示状态消息
        const message = this.settings.enableDebugLog ? 
            '🔧 调试日志已开启，将在控制台输出详细信息' : 
            '🔇 调试日志已关闭，减少内存占用';
        // 可以在这里添加一个消息显示，但现在先简化
    }

    /**
     * 初始化主题
     */
    private async initializeTheme(): Promise<void> {
        try {
            if (!this.themeManager) {
                Logger.error('主题管理器未初始化');
                return;
            }

            // 初始化主题管理器
            await this.themeManager.initialize();
            
            // 应用当前主题到插件根元素
            this.applyCurrentTheme();
            
            // 监听主题变化
            this.themeManager.onThemeChange((theme: ThemeMode) => {
                Logger.log('主题已切换为:', theme === ThemeMode.DARK ? '暗色' : '明亮');
                this.applyCurrentTheme();
                
                // 通知 dock 组件主题已变化
                this.formattedTextDock?.onDocumentChange();
            });
            
            // 启动主题监听（每5秒检查一次）
            this.themeManager.startThemeWatching(5000);
            
            Logger.log('主题系统初始化完成');
            
        } catch (error) {
            Logger.error('主题初始化失败:', error);
        }
    }

    /**
     * 应用当前主题
     */
    private applyCurrentTheme(): void {
        if (!this.themeManager) return;

        try {
            // 获取插件的根容器元素
            const pluginContainer = document.querySelector('.key-info-navigator-plugin') as HTMLElement;
            if (pluginContainer) {
                this.themeManager.applyThemeToElement(pluginContainer);
            }

            // 应用主题到 dock 元素
            const dockElements = document.querySelectorAll('.formatted-text-dock');
            dockElements.forEach(element => {
                if (element instanceof HTMLElement) {
                    this.themeManager!.applyThemeToElement(element);
                }
            });

            // 应用主题到备注对话框
            const dialogElements = document.querySelectorAll('.memo-dialog');
            dialogElements.forEach(element => {
                if (element instanceof HTMLElement) {
                    this.themeManager!.applyThemeToElement(element);
                }
            });

            // 添加主题过渡动画类
            document.body.classList.add('theme-transition');
            setTimeout(() => {
                document.body.classList.remove('theme-transition');
            }, 300);

            Logger.log('主题应用完成:', this.themeManager.getThemeModeName());
            
        } catch (error) {
            Logger.error('应用主题失败:', error);
        }
    }

    /**
     * 获取当前主题模式
     */
    public getCurrentTheme(): ThemeMode | null {
        return this.themeManager?.getCurrentTheme() || null;
    }

    /**
     * 手动切换主题（用于调试）
     */
    public toggleTheme(): void {
        if (this.themeManager) {
            this.themeManager.toggleTheme();
            Logger.log('手动切换主题');
        }
    }

    /**
     * 销毁插件时清理主题管理器
     */
    onunload() {
        Logger.log("插件卸载");
        
        // 清理主题管理器
        if (this.themeManager) {
            this.themeManager.destroy();
            this.themeManager = undefined;
        }
    }

}