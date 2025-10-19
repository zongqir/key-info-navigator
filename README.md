[中文](README_zh_CN.md)

# Key Info Navigator

> Current Version: v2.4.4 | Release Date: 2025-10-19

A plugin that helps you quickly locate and navigate key information in SiYuan notes. Display important content in your documents through a sidebar to make your reading and editing more efficient.

## Features

This plugin helps you:
- 🔍 Quickly find important information in documents (bold, italic, highlight and other formatted text)
- 📍 View all key content at a glance in the sidebar
- ⚡ Jump to any position in the document with one click
- 📝 Add notes and comments to important content
- 🗑️ Batch delete formatting with Ctrl+Shift multi-select

## ✨ What's New in v2.4.4

- 🐛 **Fixed Persistence Issue**: Resolved the critical problem where deleted items would reappear after page refresh - deletion now properly updates the internal spans database
- ⚡ **Enhanced Deletion Reliability**: Both single and batch deletions now use the transactions API to ensure database synchronization
- 🔧 **Simplified Architecture**: Streamlined batch deletion logic using simple for loops, reducing codebase by 110 lines for better maintainability

## ✨ What's New in v2.4.3

- 🐛 **Fixed Cursor Loss Issue**: Resolved the problem where cursor would disappear during batch deletion operations
- ⚡ **Optimized Refresh Timing**: Improved refresh timing after batch deletion - cursor restoration and list refresh now complete within 200ms
- 🔧 **Intelligent Cursor Recovery**: Implemented dual-layer protection strategy to ensure cursor position is always restored correctly

## What's New in v2.4.0

- 🎯 **Smart Reverse Navigation**: Enhanced reverse navigation now activates only in reading mode, eliminating distractions during editing for a cleaner writing experience
- 🚀 **Intelligent Batch Operations**: Press Ctrl+Shift and click to multi-select format items, then perform batch format removal - streamline your document cleanup workflow with precision
- 💎 **Refined Memo System**: Comprehensive memo UI fixes and optimizations for smoother annotation experience and improved visual consistency

## What's New in v2.3.0

- 🌈 Support for multiple highlight styles display
- 🔧 Fixed compound scenario recognition logic
- 🎨 Enhanced dark mode with beautiful visual improvements
- 📦 More compact interface layout for better space utilization
- 💎 Comprehensive card UI optimization with refined details
- ✨ Overall visual experience enhancement

## What's New in v2.2.0

- 🎨 Unified icon design for better visual consistency
- 🔄 Default sorting by document appearance order for natural reading flow
- 💄 Enhanced and beautified memo panel UI
- 🐛 Fixed scrollbar affecting other themes

## What's New in v2.1.0

- 📱 Added mobile support for better experience on phones and tablets

## What's New in v2.0.0

- 🐛 Fixed dock monitoring issue for real-time synchronization
- 🎨 Enhanced UI customization capabilities with improved visual design
- 📍 Updated dock icon to location marker for better representation
- ♻️ Optimized refresh button icon for better visual experience
- 🏷️ Smart button display: Auto-hide memo buttons for tags and TODOs
- ✅ Fixed tag deletion functionality for smoother operations

## 🎯 Future Plans

- ⚙️ Support customizable TODO list icons for personalization
- 🎭 Support extraction and display of other style formats
- 🔀 Configurable multi-dimensional sorting options
- 📁 Support document-level persistence for sorting and filtering preferences instead of global storage

## How to Use

### Basic Navigation
1. Search for "Key Info Navigator" in the SiYuan marketplace and install it
2. Open any document, and the key information navigation panel will automatically appear in the sidebar
3. Click any item to quickly jump to the corresponding position

### Batch Operations
1. **Multi-Select**: Hold `Ctrl+Shift` and click on items to select multiple formatted text entries
2. **Batch Delete**: After selecting items, click the "Batch Delete" button to remove formatting from all selected entries
3. **Select All**: Click the "Select All" button to select all items at once
4. **Deselect All**: Click the "Deselect All" button to clear your selection

> **Note**: Multi-select requires pressing both `Ctrl` and `Shift` keys simultaneously while clicking to prevent accidental selections.

## Acknowledgments

Special thanks to **JeffreyChen** for providing help and support.

## Support

Give me a coffee, thanks! 请我喝杯咖啡，谢谢！

<div align="center">
<img src="https://i0.hdslb.com/bfs/openplatform/3b4d37a5285096d3493d09ca88280d9acf90129e.png@1e_1c.webp" width="200" alt="Support QR Code 赞助二维码"/>
</div>

---

**Thank you for your support! 感谢您的支持！**
