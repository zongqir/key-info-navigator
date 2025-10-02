import {
    Plugin,
    getFrontend,
    Menu,
    openTab
} from "siyuan";
import "./index.scss";
import { FormattedTextDock, MobileBottomSheet } from "./modules/formattedTextDock";
import { 
    Logger, 
    ThemeManager, 
    ThemeMode,
    getCurrentActiveReadonlyButton,
    isCurrentDocumentReadonly,
    isCurrentDocumentEditable,
    getDocumentStatusDetail
} from "./modules/utils";

const FORMATTED_TEXT_DOCK_TYPE = "formatted_text_dock";

export default class KeyInfoNavigatorPlugin extends Plugin {

    private isMobile: boolean;
    private formattedTextDock?: FormattedTextDock;
    private mobileBottomSheet?: MobileBottomSheet;
    private themeManager?: ThemeManager;
    
    // 默认设置
    private settings = {
        enableDebugLog: false  // 默认关闭调试日志
    };

    async onload() {
        const frontEnd = getFrontend();
        this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";

        // 强制调试信息（不受日志开关控制）
        console.log(`[Key Info Navigator] 前端类型: ${frontEnd}`);
        console.log(`[Key Info Navigator] 是否移动端: ${this.isMobile}`);
        console.log(`[Key Info Navigator] User Agent: ${navigator.userAgent}`);

        // 加载设置
        await this.loadSettings();
        
        // 配置日志器
        Logger.setDebugEnabled(this.settings.enableDebugLog);
        Logger.log('插件启动，调试模式:', this.settings.enableDebugLog ? '开启' : '关闭');

        // 暴露全局控制接口（用于控制台调试）
        this.exposeGlobalControls();

        // 初始化主题管理器
        this.themeManager = ThemeManager.getInstance(Logger.log);
        await this.initializeTheme();

        // 根据设备类型初始化不同的UI组件
        if (this.isMobile) {
            console.log('[Key Info Navigator] 🚀 检测到移动端环境，初始化底部抽屉面板');
            Logger.log('检测到移动端环境，初始化底部抽屉面板');
            await this.initMobileUI();
        } else {
            console.log('[Key Info Navigator] 🖥️ 检测到桌面端环境，初始化侧边栏');
            Logger.log('检测到桌面端环境，初始化侧边栏');
            await this.initDesktopUI();
        }

        // 监听文档变更事件
        this.eventBus.on("switch-protyle", () => {
            Logger.log('事件触发: switch-protyle');
            this.notifyDocumentChange();
        });
        
        this.eventBus.on("loaded-protyle-dynamic", () => {
            Logger.log('事件触发: loaded-protyle-dynamic');
            this.notifyDocumentChange();
        });
        
        this.eventBus.on("loaded-protyle-static", () => {
            Logger.log('事件触发: loaded-protyle-static');
            this.notifyDocumentChange();
        });

        // 添加更多 tab 切换相关的事件监听
        // 注意：某些事件名称可能不在官方类型定义中，使用 as any 进行类型断言
        (this.eventBus as any).on("open-tab", () => {
            Logger.log('事件触发: open-tab');
            this.notifyDocumentChange();
        });

        (this.eventBus as any).on("close-tab", () => {
            Logger.log('事件触发: close-tab');
            this.notifyDocumentChange();
        });

        (this.eventBus as any).on("switch-tab", () => {
            Logger.log('事件触发: switch-tab');
            this.notifyDocumentChange();
        });

        (this.eventBus as any).on("layout-tab-switch", () => {
            Logger.log('事件触发: layout-tab-switch');
            this.notifyDocumentChange();
        });

        // 监听编辑器焦点变化
        (this.eventBus as any).on("focus-protyle", () => {
            Logger.log('事件触发: focus-protyle');
            this.notifyDocumentChange();
        });

        // 监听文档打开事件
        (this.eventBus as any).on("open-document", () => {
            Logger.log('事件触发: open-document');
            this.notifyDocumentChange();
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
     * 暴露全局控制接口
     * 在控制台中可以使用以下命令：
     * 
     * 【调试日志控制】
     * - KeyInfoNavigator.toggleDebug() - 切换调试日志
     * - KeyInfoNavigator.enableDebug() - 开启调试日志
     * - KeyInfoNavigator.disableDebug() - 关闭调试日志
     * - KeyInfoNavigator.getDebugStatus() - 查看当前状态
     * 
     * 【文档状态检查】
     * - KeyInfoNavigator.checkDocStatus() - 检查当前文档只读状态
     * - KeyInfoNavigator.isReadonly() - 当前文档是否只读
     * - KeyInfoNavigator.isEditable() - 当前文档是否可编辑
     * - KeyInfoNavigator.getReadonlyButton() - 获取当前文档的锁按钮
     */
    private exposeGlobalControls(): void {
        // 使用 window 对象暴露控制接口
        (window as any).KeyInfoNavigator = {
            // ========== 调试日志控制 ==========
            toggleDebug: () => {
                this.toggleDebugMode();
                return `调试日志已${this.settings.enableDebugLog ? '开启' : '关闭'}`;
            },
            enableDebug: () => {
                if (!this.settings.enableDebugLog) {
                    this.toggleDebugMode();
                }
                return '调试日志已开启 ✅';
            },
            disableDebug: () => {
                if (this.settings.enableDebugLog) {
                    this.toggleDebugMode();
                }
                return '调试日志已关闭 🔇';
            },
            getDebugStatus: () => {
                return {
                    enabled: this.settings.enableDebugLog,
                    message: this.settings.enableDebugLog ? 
                        '调试日志: 开启 ✅ (控制台会输出详细信息)' : 
                        '调试日志: 关闭 🔇 (仅输出错误信息)'
                };
            },
            
            // ========== 移动端UI测试工具 ==========
            forceMobileUI: () => {
                console.log('[Key Info Navigator] 🚀 强制启用移动端UI');
                this.forceEnableMobileUI();
                return '移动端UI已强制启用 📱';
            },
            forceDesktopUI: () => {
                console.log('[Key Info Navigator] 🖥️ 强制启用桌面端UI');
                this.forceEnableDesktopUI();
                return '桌面端UI已强制启用 🖥️';
            },
            getCurrentUI: () => {
                const isMobile = !!this.mobileBottomSheet;
                const isDesktop = !!this.formattedTextDock;
                return {
                    mobile: isMobile ? '✅ 活跃' : '❌ 未活跃',
                    desktop: isDesktop ? '✅ 活跃' : '❌ 未活跃',
                    detected: this.isMobile ? '📱 移动端' : '🖥️ 桌面端'
                };
            },
            
            // ========== 文档状态检查工具 ==========
            checkDocStatus: () => {
                const detail = getDocumentStatusDetail();
                console.log('%c📄 当前文档状态详情', 'color: #2196F3; font-weight: bold;', detail);
                return detail;
            },
            isReadonly: () => {
                const readonly = isCurrentDocumentReadonly();
                console.log(readonly ? '🔒 当前文档已锁定（只读模式）' : '✏️ 当前文档已解锁（可编辑）');
                return readonly;
            },
            isEditable: () => {
                const editable = isCurrentDocumentEditable();
                console.log(editable ? '✏️ 当前文档可编辑（已解锁）' : '🔒 当前文档只读（已锁定）');
                return editable;
            },
            getReadonlyButton: () => {
                const btn = getCurrentActiveReadonlyButton();
                if (btn) {
                    console.log('✅ 找到锁按钮:', btn);
                    console.log('按钮属性:', {
                        ariaLabel: btn.getAttribute('aria-label'),
                        dataSubtype: btn.getAttribute('data-subtype'),
                        iconHref: btn.querySelector('use')?.getAttribute('xlink:href')
                    });
                } else {
                    console.log('❌ 未找到锁按钮');
                }
                return btn;
            }
        };

        console.log('%c[Key Info Navigator] 控制台调试接口已就绪', 'color: #4CAF50; font-weight: bold;');
        console.log('%c【调试日志控制】', 'color: #2196F3; font-weight: bold;');
        console.log('  KeyInfoNavigator.toggleDebug()    - 切换调试模式');
        console.log('  KeyInfoNavigator.enableDebug()    - 开启调试日志');
        console.log('  KeyInfoNavigator.disableDebug()   - 关闭调试日志');
        console.log('  KeyInfoNavigator.getDebugStatus() - 查看当前状态');
        console.log('%c【移动端UI测试工具】', 'color: #FF5722; font-weight: bold;');
        console.log('  KeyInfoNavigator.forceMobileUI()  - 强制启用移动端UI');
        console.log('  KeyInfoNavigator.forceDesktopUI() - 强制启用桌面端UI');
        console.log('  KeyInfoNavigator.getCurrentUI()   - 查看当前UI状态');
        console.log('%c【文档状态检查】', 'color: #2196F3; font-weight: bold;');
        console.log('  KeyInfoNavigator.checkDocStatus()    - 检查当前文档只读状态');
        console.log('  KeyInfoNavigator.isReadonly()        - 当前文档是否只读');
        console.log('  KeyInfoNavigator.isEditable()        - 当前文档是否可编辑');
        console.log('  KeyInfoNavigator.getReadonlyButton() - 获取当前文档的锁按钮');
        console.log(`%c当前状态: ${this.settings.enableDebugLog ? '调试日志已开启 ✅' : '调试日志已关闭 🔇'} | UI: ${this.isMobile ? '📱 移动端' : '🖥️ 桌面端'}`, 
            this.settings.enableDebugLog ? 'color: #FF9800;' : 'color: #9E9E9E;');
        console.log('%c💡 如果移动端面板影响正常使用，请执行: KeyInfoNavigator.forceDesktopUI()', 'color: #9C27B0; font-weight: bold;');
    }

    /**
     * 切换调试模式
     */
    public toggleDebugMode(): void {
        this.settings.enableDebugLog = !this.settings.enableDebugLog;
        Logger.setDebugEnabled(this.settings.enableDebugLog);
        this.saveSettings();
        
        // 在控制台输出状态变更（不受日志开关控制）
        const message = this.settings.enableDebugLog ? 
            '🔧 调试日志已开启，将在控制台输出详细信息' : 
            '🔇 调试日志已关闭，减少内存占用';
        console.log(`[Key Info Navigator] ${message}`);
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
                
                // 通知组件主题已变化
                this.notifyDocumentChange();
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
        
        // 清理UI组件
        this.formattedTextDock?.destroy();
        this.formattedTextDock = undefined;
        
        this.mobileBottomSheet?.destroy();
        this.mobileBottomSheet = undefined;
        
        // 清理主题管理器
        if (this.themeManager) {
            this.themeManager.destroy();
            this.themeManager = undefined;
        }

        // 清理全局控制接口
        if ((window as any).KeyInfoNavigator) {
            delete (window as any).KeyInfoNavigator;
            console.log('[Key Info Navigator] 控制台调试接口已清理');
        }
    }

    /**
     * 初始化桌面端UI（侧边栏）
     */
    private async initDesktopUI(): Promise<void> {
        this.addDock({
            config: {
                position: "RightTop",
                size: {width: 280, height: 0},
                icon: "iconFocus",
                title: this.i18n.dockTitle,
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
    }

    /**
     * 初始化移动端UI（底部抽屉面板）
     */
    private async initMobileUI(): Promise<void> {
        try {
            console.log('[Key Info Navigator] 🚀 开始初始化移动端UI');
            const moduleLogger = Logger.createModuleLogger('MobileBottomSheet');
            console.log('[Key Info Navigator] 📱 创建MobileBottomSheet实例');
            
            this.mobileBottomSheet = new MobileBottomSheet(
                this.i18n,
                moduleLogger.log
            );
            
            console.log('[Key Info Navigator] ✅ 移动端UI初始化完成');
            console.log('[Key Info Navigator] 🔍 检查DOM中是否存在mobile-bottom-sheet元素');
            
            // 延迟检查DOM元素是否创建成功
            setTimeout(() => {
                const elements = document.querySelectorAll('.mobile-bottom-sheet');
                console.log(`[Key Info Navigator] 📊 找到 ${elements.length} 个 mobile-bottom-sheet 元素`);
                elements.forEach((el, index) => {
                    console.log(`[Key Info Navigator] 📍 元素 ${index + 1}:`, el);
                });
            }, 1000);
            
        } catch (error) {
            console.error('[Key Info Navigator] ❌ 移动端UI初始化失败:', error);
            throw error;
        }
    }

    /**
     * 通知文档变更（统一处理桌面端和移动端）
     */
    private notifyDocumentChange(): void {
        this.formattedTextDock?.onDocumentChange();
        this.mobileBottomSheet?.onDocumentChange();
    }

    /**
     * 强制启用移动端UI（调试用）
     */
    public forceEnableMobileUI(): void {
        console.log('[Key Info Navigator] 🚀 强制启用移动端UI');
        
        // 清理现有组件
        this.formattedTextDock?.destroy();
        this.formattedTextDock = undefined;
        
        this.mobileBottomSheet?.destroy();
        this.mobileBottomSheet = undefined;
        
        // 启用移动端UI
        this.initMobileUI();
    }

    /**
     * 强制启用桌面端UI（调试用）
     */
    public forceEnableDesktopUI(): void {
        console.log('[Key Info Navigator] 🖥️ 强制启用桌面端UI');
        
        // 清理现有组件
        this.formattedTextDock?.destroy();
        this.formattedTextDock = undefined;
        
        this.mobileBottomSheet?.destroy();
        this.mobileBottomSheet = undefined;
        
        // 启用桌面端UI
        this.initDesktopUI();
    }

}