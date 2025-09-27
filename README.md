[中文](README_zh_CN.md)

# Key Info Navigator | 关键信息导航

一个帮助您在思源笔记文档中快速定位和导航关键信息的插件。通过侧边栏展示文档中的重要内容，让您的阅读和编辑更加高效。

## 功能介绍

这个插件可以帮助您：
- 🔍 快速找到文档中的重要信息（加粗、斜体、高亮等格式化文本）
- 📍 在侧边栏中一目了然地查看所有关键内容
- ⚡ 一键跳转到文档中的任意位置
- 📝 为重要内容添加备注和说明

## 如何使用

1. 在思源笔记集市中搜索"关键信息导航"并安装
2. 打开任意文档，侧边栏会自动显示关键信息导航面板
3. 点击任意条目即可快速跳转到对应位置

## Development Setup

* Clone this repository to your local development folder
* For convenience, you can place this folder in your `{workspace}/data/plugins/` folder
* Install [NodeJS](https://nodejs.org/en/download) and [pnpm](https://pnpm.io/installation), then run `pnpm i`
* Execute `pnpm run dev` for real-time compilation
* Open SiYuan marketplace and enable plugin in downloaded tab

## Development

* i18n/*
* icon.png (160*160)
* index.css
* index.js
* plugin.json
* preview.png (1024*768)
* README*.md
* [Fontend API](https://github.com/siyuan-note/petal)
* [Backend API](https://github.com/siyuan-note/siyuan/blob/master/API.md)

## I18n

In terms of internationalization, our main consideration is to support multiple languages. Specifically, we need to
complete the following tasks:

* Meta information about the plugin itself, such as plugin description and readme
    * `description` and `readme` fields in plugin.json, and the corresponding README*.md file
* Text used in the plugin, such as button text and tooltips
    * src/i18n/*.json language configuration files
    * Use `this.i18.key` to get the text in the code
* Finally, declare the language supported by the plugin in the `i18n` field in plugin.json

It is recommended that the plugin supports at least English and Simplified Chinese, so that more people can use it more
conveniently.


## Support ME

Give Me A Coffee, Thanks!

<div align="center">
<img src="https://i0.hdslb.com/bfs/openplatform/3b4d37a5285096d3493d09ca88280d9acf90129e.png@1e_1c.webp" width="200" alt="赞助二维码"/>
</div>

---

**Thank you for your support! 感谢您的支持！**
