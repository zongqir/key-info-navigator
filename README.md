[中文](README_zh_CN.md)

# Formatted Text Navigator

A powerful SiYuan plugin that helps you navigate and locate formatted text elements (bold, italic, underline, highlight) in your documents through an intuitive sidebar interface.

## Features

✨ **Smart Navigation**: Quickly locate and navigate to formatted text elements in your documents
📍 **Sidebar Integration**: Clean, intuitive sidebar showing all formatted content 
🎨 **Multiple Format Support**: Works with bold, italic, underline, and highlight text
🔍 **One-Click Navigation**: Click any item to instantly jump to its location in the document
📝 **Memo Support**: Add and manage custom memos for better organization
🎯 **Real-time Updates**: Automatically refreshes when document content changes

## Installation

### From SiYuan Marketplace
1. Open SiYuan and go to the Plugin Marketplace
2. Search for "Formatted Text Navigator" or "格式化文本导航器"
3. Click Install and Enable

### Manual Installation
1. Download the latest release from [GitHub Releases](https://github.com/siyuan-note/plugin-sample/releases)
2. Extract the plugin files to `{workspace}/data/plugins/formatted-text-navigator/`
3. Restart SiYuan and enable the plugin in Settings > Plugins

## Usage

1. Open any document in SiYuan
2. The Formatted Text Navigator will appear in the sidebar
3. All formatted text elements will be automatically detected and listed
4. Click on any item to navigate directly to that location in your document
5. Use the memo feature to add notes and organize your content

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

## plugin.json

```json
{
  "name": "plugin-sample",
  "author": "Vanessa",
  "url": "https://github.com/siyuan-note/plugin-sample",
  "version": "0.1.3",
  "minAppVersion": "2.8.8",
  "backends": ["windows", "linux", "darwin"],
  "frontends": ["desktop"],
  "displayName": {
    "default": "Plugin Sample",
    "zh_CN": "插件示例"
  },
  "description": {
    "default": "This is a plugin sample",
    "zh_CN": "这是一个插件示例"
  },
  "readme": {
    "default": "README.md",
    "zh_CN": "README_zh_CN.md"
  },
  "funding": {
    "openCollective": "",
    "patreon": "",
    "github": "",
    "custom": [
      "https://ld246.com/sponsor"
    ]
  },
  "keywords": [
    "sample", "示例"
  ]
}
```

* `name`: Plugin name, must be the same as the repo name, and must be unique globally (no duplicate plugin names in the
  marketplace)
* `author`: Plugin author name
* `url`: Plugin repo URL
* `version`: Plugin version number, it is recommended to follow the [semver](https://semver.org/) specification
* `minAppVersion`: Minimum version number of SiYuan required to use this plugin
* `disabledInPublish`: Whether to diable the plugin in publish service
* `backends`: Backend environment required by the plugin, optional values are `windows`, `linux`, `darwin`, `docker`, `android`, `ios`, `harmony` and `all`
  * `windows`: Windows desktop
  * `linux`: Linux desktop
  * `darwin`: macOS desktop
  * `docker`: Docker
  * `android`: Android APP
  * `ios`: iOS APP
  * `harmony`: HarmonyOS APP
  * `all`: All environments
* `frontends`: Frontend environment required by the plugin, optional values are `desktop`, `desktop-window`, `mobile`, `browser-desktop`, `browser-mobile` and `all`
  * `desktop`: Desktop
  * `desktop-window`: Desktop window converted from tab
  * `mobile`: Mobile APP
  * `browser-desktop`: Desktop browser
  * `browser-mobile`: Mobile browser
  * `all`: All environments
* `displayName`: Template display name, mainly used for display in the marketplace list, supports multiple languages
    * `default`: Default language, must exist
    * `zh_CN`, `en_US` and other languages: optional, it is recommended to provide at least Chinese and English
* `description`: Plugin description, mainly used for display in the marketplace list, supports multiple languages
    * `default`: Default language, must exist
    * `zh_CN`, `en_US` and other languages: optional, it is recommended to provide at least Chinese and English
* `readme`: readme file name, mainly used to display in the marketplace details page, supports multiple languages
    * `default`: Default language, must exist
    * `zh_CN`, `en_US` and other languages: optional, it is recommended to provide at least Chinese and English
* `funding`: Plugin sponsorship information
    * `openCollective`: Open Collective name
    * `patreon`: Patreon name
    * `github`: GitHub login name
    * `custom`: Custom sponsorship link list
* `keywords`: Search keyword list, used for marketplace search function

## Package

No matter which method is used to compile and package, we finally need to generate a package.zip, which contains at
least the following files:

* i18n/*
* icon.png (160*160)
* index.css
* index.js
* plugin.json
* preview.png (1024*768)
* README*.md

## List on the marketplace

* `pnpm run build` to generate package.zip
* Create a new GitHub release using your new version number as the "Tag version". See here for an
  example: https://github.com/siyuan-note/plugin-sample/releases
* Upload the file package.zip as binary attachments
* Publish the release

If it is the first release, please create a pull request to
the [Community Bazaar](https://github.com/siyuan-note/bazaar) repository and modify the plugins.json file in it. This
file is the index of all community plugin repositories, the format is:

```json
{
  "repos": [
    "username/reponame"
  ]
}
```

After the PR is merged, the bazaar will automatically update the index and deploy through GitHub Actions. When releasing
a new version of the plugin in the future, you only need to follow the above steps to create a new release, and you
don't need to PR the community bazaar repo.

Under normal circumstances, the community bazaar repo will automatically update the index and deploy every hour,
and you can check the deployment status at https://github.com/siyuan-note/bazaar/actions.

## Developer's Guide

Developers need to pay attention to the following specifications.

### 1. File Reading and Writing Specifications

If plugins or external extensions require direct reading or writing of files under the `data` directory, please use the kernel API to achieve this. **Do not call `fs` or other electron or nodejs APIs directly**, as it may result in data loss during synchronization and cause damage to cloud data.

Related APIs can be found at: `/api/file/*` (e.g., `/api/file/getFile`).

### 2. Daily Note Attribute Specifications

When creating a daily note in SiYuan, a custom-dailynote-yyyymmdd attribute will be automatically added to the document to distinguish it from regular documents.

> For more details, please refer to [Github Issue #9807](https://github.com/siyuan-note/siyuan/issues/9807).

Developers should pay attention to the following when developing the functionality to manually create Daily Notes:

* If `/api/filetree/createDailyNote` is called to create a daily note, the attribute will be automatically added to the document, and developers do not need to handle it separately
* If a document is created manually by developer's code (e.g., using the `createDocWithMd` API to create a daily note), please manually add this attribute to the document

## Support & Appreciation

If you find this plugin helpful, consider supporting the development:

### 💝 Donation Options

<table>
<tr>
<td align="center">
<img src="https://raw.githubusercontent.com/siyuan-note/plugin-sample/main/assets/payment-wechat.png" width="200" alt="微信支付"/>
<br>
<strong>微信支付 WeChat Pay</strong>
<br>
ZQ(*旗)
</td>
<td align="center">
<img src="https://raw.githubusercontent.com/siyuan-note/plugin-sample/main/assets/payment-alipay.png" width="200" alt="支付宝"/>
<br>
<strong>支付宝 Alipay</strong>
<br>
as(*旗)
</td>
</tr>
</table>

### 🌟 Other Ways to Support

- ⭐ Star this repository
- 🐛 Report bugs and suggest features
- 📢 Share with friends who use SiYuan
- 💬 Join the [SiYuan Community](https://ld246.com/tag/siyuan)

---

**Thank you for your support! 感谢您的支持！**
