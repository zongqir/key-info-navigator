import {
    Plugin,
    getFrontend,
    Menu,
    openTab
} from "siyuan";
import "./index.scss";
import "./styles/formattedTextDock.scss";
import "./styles/memoDialog.scss";
import { FormattedTextDock } from "./modules/formattedTextDock";
import { Logger } from "./modules/utils/Logger";

const FORMATTED_TEXT_DOCK_TYPE = "formatted_text_dock";

export default class KeyInfoNavigatorPlugin extends Plugin {

    private isMobile: boolean;
    private formattedTextDock?: FormattedTextDock;
    
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
            this.formattedTextDock?.onDocumentChange();
        });
        
        this.eventBus.on("loaded-protyle-dynamic", () => {
            this.formattedTextDock?.onDocumentChange();
        });
        
        this.eventBus.on("loaded-protyle-static", () => {
            this.formattedTextDock?.onDocumentChange();
        });

        Logger.log(this.i18n.helloPlugin);
    }

    onLayoutReady() {
        Logger.log("插件加载完成");
    }

    onunload() {
        Logger.log("插件卸载");
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

}