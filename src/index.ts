import {
    Plugin,
    getFrontend
} from "siyuan";
import "./index.scss";
import "./styles/formattedTextDock.scss";
import "./styles/memoDialog.scss";
import { FormattedTextDock } from "./modules/formattedTextDock";

const FORMATTED_TEXT_DOCK_TYPE = "formatted_text_dock";

export default class KeyInfoNavigatorPlugin extends Plugin {

    private isMobile: boolean;
    private formattedTextDock?: FormattedTextDock;


    onload() {
        const frontEnd = getFrontend();
        this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";

        // 添加关键信息导航侧边栏
        this.addDock({
            config: {
                position: "RightTop",
                size: {width: 280, height: 0},
                icon: "iconFocus",
                title: "关键信息",
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
                this.formattedTextDock = new FormattedTextDock(
                    dock.element as HTMLElement,
                    this.i18n,
                    console.log.bind(console)
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

        console.log(this.i18n.helloPlugin);
    }

    onLayoutReady() {
        console.log("Key Info Navigator plugin loaded");
    }

    onunload() {
        console.log("Key Info Navigator plugin unloaded");
    }

}
