# Changelog

## v2.4.0 2025-10-05

### ✨ New Features
* 智能反向导航 - Smart reverse navigation (only active in reading mode)
* 精准批量操作 - Intelligent batch operations (Ctrl+click multi-select and batch format removal)

### 🐛 Bug Fixes
* 备注系统全面修复 - Comprehensive memo system fixes
* 备注UI问题解决 - Resolved memo UI issues

### 🎨 UI/UX Improvements
* 反向导航仅阅读模式激活 - Reverse navigation only activates in reading mode to eliminate editing distractions
* 备注界面深度优化 - Deep memo interface optimizations for better visual consistency
* 批量操作体验提升 - Enhanced batch operations user experience

## v2.3.0 2025-10-04

### ✨ New Features
* 支持多种高亮样式展示 - Support for multiple highlight styles display
* UI筛选逻辑优化 - Optimized UI filtering logic

### 🐛 Bug Fixes
* 修复复合场景识别逻辑 - Fixed compound scenario recognition logic

### 🎨 UI/UX Improvements
* 夜间模式深度美化 - Enhanced dark mode visual experience
* 界面布局更加紧凑 - More compact interface layout
* 卡片UI全面优化 - Comprehensive card UI optimization
* 整体视觉体验提升 - Overall visual experience enhancement

## v2.2.0 2025-10-03

### ✨ New Features
* 图标统一 - Unified icon design across the plugin
* 默认按照文章出现的顺序排序 - Default sorting by document appearance order
* 备注栏UI调整美化 - Enhanced and beautified memo panel UI

### 🐛 Bug Fixes
* 修复滚动条影响其他主题的BUG - Fixed scrollbar affecting other themes

## v2.0.0 2025-10-02

### 🐛 Bug Fixes
* 修复不会监听dock的问题 - Fixed dock monitoring issue

### ✨ Features
* UI调整能力增强 - Enhanced UI customization capabilities
* 更换dock图标为定位标记 - Changed dock icon to location marker
* 优化刷新按钮图标 - Optimized refresh button icon
* 标签和TODO项移除备注按钮 - Removed memo button for tags and TODOs
* 修复标签删除功能 - Fixed tag deletion functionality
* 优化项目间距和视觉效果 - Improved item spacing and visual effects

## v0.4.2 2025-08-26

* [Upgrade ESLint to 9.33.0](https://github.com/siyuan-note/plugin-sample/issues/30)
* [Adjust `addTopBar` and `addStatusBar` from `onload` lifecycle to `onLayoutReady`](https://github.com/siyuan-note/siyuan/issues/15455)

## v0.4.1 2025-07-22

* [Add plugin function `saveLayout`](https://github.com/siyuan-note/siyuan/issues/15308)

## v0.4.0 2025-04-08

* [Add plugin function `openAttributePanel`](https://github.com/siyuan-note/siyuan/issues/14276)

## v0.3.9 2025-03-04

* [Add parameter `nodeElement` to `protyleSlash.callback`](https://github.com/siyuan-note/siyuan/issues/14036)

## v0.3.8 2025-02-11

* [Add plugin util `openSetting`](https://github.com/siyuan-note/siyuan/pull/13761)
* [Add plugin method `updateProtyleToolbar`](https://github.com/siyuan-note/plugin-sample/issues/24)

## v0.3.7 2024-11-05

* [Add plugin util `platformUtils`](https://github.com/siyuan-note/siyuan/issues/12930)
* [Add plugin function `getAllEditor`](https://github.com/siyuan-note/siyuan/issues/12884)
* [Add plugin function `getModelByDockType`](https://github.com/siyuan-note/siyuan/issues/11782)
* [Replace `any` in IProtyle with the corresponding type](https://github.com/siyuan-note/petal/issues/34)
* [Add `data-id` attribute to menu button](https://github.com/siyuan-note/plugin-sample/pull/20)

## v0.3.6 2024-09-27

* [Add plugin event bus `opened-notebook` & `closed-notebook`](https://github.com/siyuan-note/siyuan/issues/11974)
* [⬆️ Bump braces from 3.0.2 to 3.0.3](https://github.com/siyuan-note/plugin-sample/pull/16)

## v0.3.5 2024-04-30

* [Add `direction` to plugin method `Setting.addItem`](https://github.com/siyuan-note/siyuan/issues/11183)

## v0.3.4 2024-02-20

* [Add plugin event bus `click-flashcard-action`](https://github.com/siyuan-note/siyuan/issues/10318)

## v0.3.3 2024-01-24

* Update dock icon class

## v0.3.2 2024-01-09

* [Add plugin `protyleOptions`](https://github.com/siyuan-note/siyuan/issues/10090)
* [Add plugin api `uninstall`](https://github.com/siyuan-note/siyuan/issues/10063)
* [Add plugin method `updateCards`](https://github.com/siyuan-note/siyuan/issues/10065)
* [Add plugin function `lockScreen`](https://github.com/siyuan-note/siyuan/issues/10063)
* [Add plugin event bus `lock-screen`](https://github.com/siyuan-note/siyuan/pull/9967)
* [Add plugin event bus `open-menu-inbox`](https://github.com/siyuan-note/siyuan/pull/9967)

## v0.3.1 2023-12-06

* [Support `Dock Plugin` and `Command Palette` on mobile](https://github.com/siyuan-note/siyuan/issues/9926)

## v0.3.0 2023-12-05

* Upgrade Siyuan to 0.9.0
* Support more platforms

## v0.2.9 2023-11-28

* [Add plugin method `openMobileFileById`](https://github.com/siyuan-note/siyuan/issues/9738)

## v0.2.8 2023-11-15

* [`resize` cannot be triggered after dragging to unpin the dock](https://github.com/siyuan-note/siyuan/issues/9640)

## v0.2.7 2023-10-31

* [Export `Constants` to plugin](https://github.com/siyuan-note/siyuan/issues/9555)
* [Add plugin `app.appId`](https://github.com/siyuan-note/siyuan/issues/9538)
* [Add plugin event bus `switch-protyle`](https://github.com/siyuan-note/siyuan/issues/9454)

## v0.2.6 2023-10-24

* [Deprecated `loaded-protyle` use `loaded-protyle-static` instead](https://github.com/siyuan-note/siyuan/issues/9468)

## v0.2.5 2023-10-10

* [Add plugin event bus `open-menu-doctree`](https://github.com/siyuan-note/siyuan/issues/9351)

## v0.2.4 2023-09-19

* Supports use in windows
* [Add plugin function `transaction`](https://github.com/siyuan-note/siyuan/issues/9172)

## v0.2.3 2023-09-05

* [Add plugin function `transaction`](https://github.com/siyuan-note/siyuan/issues/9172)
* [Plugin API add openWindow and command.globalCallback](https://github.com/siyuan-note/siyuan/issues/9032)

## v0.2.2 2023-08-29

* [Add plugin event bus `destroy-protyle`](https://github.com/siyuan-note/siyuan/issues/9033)
* [Add plugin event bus `loaded-protyle-dynamic`](https://github.com/siyuan-note/siyuan/issues/9021)

## v0.2.1 2023-08-21

* [Plugin API add getOpenedTab method](https://github.com/siyuan-note/siyuan/issues/9002)
* [Plugin API custom.fn => custom.id in openTab](https://github.com/siyuan-note/siyuan/issues/8944)

## v0.2.0 2023-08-15

* [Add plugin event bus `open-siyuan-url-plugin` and `open-siyuan-url-block`](https://github.com/siyuan-note/siyuan/pull/8927)

## v0.1.12 2023-08-01

* Upgrade siyuan to 0.7.9

## v0.1.11

* [Add `input-search` event bus to plugins](https://github.com/siyuan-note/siyuan/issues/8725)

## v0.1.10

* [Add `bind this` example for eventBus in plugins](https://github.com/siyuan-note/siyuan/issues/8668)
* [Add `open-menu-breadcrumbmore` event bus to plugins](https://github.com/siyuan-note/siyuan/issues/8666)

## v0.1.9

* [Add `open-menu-xxx` event bus for plugins ](https://github.com/siyuan-note/siyuan/issues/8617)

## v0.1.8

* [Add protyleSlash to the plugin](https://github.com/siyuan-note/siyuan/issues/8599)
* [Add plugin API protyle](https://github.com/siyuan-note/siyuan/issues/8445)

## v0.1.7

* [Support build js and json](https://github.com/siyuan-note/plugin-sample/pull/8)

## v0.1.6

* add `fetchPost` example
