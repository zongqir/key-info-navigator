const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// 获取命令行参数
const args = process.argv.slice(2);
const isDist = args.includes("--dist");

// 读取插件配置
const pluginJson = JSON.parse(fs.readFileSync("plugin.json", "utf8"));
const pluginName = pluginJson.name;

// 查找思源笔记工作空间路径
function findSiyuanWorkspace() {
    const possiblePaths = [
        process.env.SIYUAN_WORKSPACE || "",
        path.join(require('os').homedir(), "Documents", "SiYuan"),
        path.join(require('os').homedir(), "SiYuan"),
        "C:\\SiYuan",
        "D:\\SiYuan"
    ];

    for (const workspacePath of possiblePaths) {
        if (!workspacePath) continue;
        const pluginPath = path.join(workspacePath, "data", "plugins");
        if (fs.existsSync(pluginPath)) {
            return workspacePath;
        }
    }

    return null;
}

// 获取目标路径
function getTargetPath() {
    // 首先尝试环境变量
    if (process.env.SIYUAN_PLUGIN_DIR) {
        return process.env.SIYUAN_PLUGIN_DIR;
    }

    // 查找思源工作空间
    const workspace = findSiyuanWorkspace();
    if (workspace) {
        return path.join(workspace, "data", "plugins", pluginName);
    }

    // 默认路径
    console.log("警告：未找到思源工作空间，使用默认路径");
    return path.join(require('os').homedir(), "Documents", "SiYuan", "data", "plugins", pluginName);
}

// 复制文件
function copyFile(src, dest) {
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
}

// 复制目录
function copyDir(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    
    const files = fs.readdirSync(src);
    files.forEach(file => {
        const srcPath = path.join(src, file);
        const destPath = path.join(dest, file);
        
        if (fs.statSync(srcPath).isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            copyFile(srcPath, destPath);
        }
    });
}

// 部署函数
function deploy() {
    const targetPath = getTargetPath();
    
    console.log(`开始部署插件到: ${targetPath}`);
    
    // 确保目标目录存在
    if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true });
    }

    try {
        // 如果是生产模式部署，使用dist目录
        if (isDist && fs.existsSync("package.zip")) {
            console.log("检测到 package.zip，正在解压到插件目录...");
            const AdmZip = require('adm-zip');
            const zip = new AdmZip("package.zip");
            zip.extractAllTo(targetPath, true);
        } else {
            // 开发模式，直接复制文件
            const filesToCopy = [
                "index.js",
                "index.css",
                "plugin.json",
                "icon.png",
                "preview.png"
            ];
            
            // 复制主要文件
            filesToCopy.forEach(file => {
                if (fs.existsSync(file)) {
                    copyFile(file, path.join(targetPath, file));
                    console.log(`已复制: ${file}`);
                }
            });
            
            // 复制i18n目录
            if (fs.existsSync("i18n")) {
                copyDir("i18n", path.join(targetPath, "i18n"));
                console.log("已复制: i18n/");
            }
            
            // 复制README文件
            const readmeFiles = fs.readdirSync(".")
                .filter(file => file.startsWith("README") && file.endsWith(".md"));
            readmeFiles.forEach(file => {
                copyFile(file, path.join(targetPath, file));
                console.log(`已复制: ${file}`);
            });
        }
        
        console.log(`✅ 部署成功！插件已部署到: ${targetPath}`);
        console.log("请在思源笔记中刷新插件或重启应用以加载更新。");
        
    } catch (error) {
        console.error("❌ 部署失败:", error.message);
        process.exit(1);
    }
}

// 检查依赖（如果需要zip功能）
if (isDist && fs.existsSync("package.zip")) {
    try {
        require('adm-zip');
    } catch (e) {
        console.log("正在安装 adm-zip 依赖...");
        execSync("npm install adm-zip", { stdio: "inherit" });
    }
}

// 执行部署
deploy();