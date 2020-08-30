#!/usr/bin/env node

const fs = require("fs")
const path = require("path")
const chalk = require('chalk');
const { spawn } = require("child_process")

const log = console.log;

// 用于resolve使用工程中的文件路径
const resolveApp = relativePath => path.resolve(process.cwd(), relativePath)

const appPkgPath = resolveApp("./package.json")

// 判断 package.json 文件是否存在
if(!fs.existsSync(appPkgPath) || fs.statSync(appPkgPath).isDirectory()) {
  log("package.json文件不存在")
  return;
}

// 读取工程中的 package.json
const appPkg = require(appPkgPath) || {}

// 读取依赖列表
const dependencies = { ...(appPkg.devDependencies || {}), ...(appPkg.dependencies || {}) }

// 过滤已安装的依赖 TODO:是否需要过滤
const installPkgs = [
  "git-cz",
  "commitizen",
  "commitlint",
  "conventional-changelog-cli",
  "husk"
].filter(p => !dependencies[p])

// 执行依赖安装
if (installPkgs.length > 0) {
  const childProcess = spawn("npm", ["install", ...installPkgs, "-D"], { cwd: process.cwd(), stdio: 'inherit' })
  childProcess.on("error", err => {
    log(err)
  })
  childProcess.on("exit", exitCode => {
    if (exitCode === 0) {
      log("依赖安装完成！")
      log([
        '你可以运行 以下命令:',
        '',
        '`npm run log`: 生成changelog',
        '`npm run commit`: 用于代替`git commit`提交，并自动执行`git add.`和`npm run log`',
        '',
      ].join('\n'))
    }
  })
}

// 添加相关配置到项目package.json中
// 添加config配置
appPkg.config = {
  ...(appPkg.config || {}),
  "commitizen": {
    "path": "./node_modules/commitlint-cli/lib/cz"
  }
}

// 添加husky钩子
if (appPkg.husky) {
  if (appPkg.husky.hooks) {
    appPkg.husky.hooks["commit-msg"] = "commitlint -E HUSKY_GIT_PARAMS"
  } else {
    appPkg.husky.hooks = {
      "commit-msg": "commitlint -E HUSKY_GIT_PARAMS"
    }
  }
} else {
  appPkg.husky = {
    "hooks": {
      "commit-msg": "commitlint -E HUSKY_GIT_PARAMS"
    }
  }
}

// 动态添加命令到package.json
appPkg.scripts = {
  ...(appPkg.scripts || {}),
  "log": "conventional-changelog --config ./node_modules/commitlint-cli/lib/log -i CHANGELOG.md -s -r 0",
  "commit": "npm run log && git add . && git-cz"
}

// 重新写入package.json
fs.writeFileSync(resolveApp("./package.json"), JSON.stringify(appPkg, null, 2))
// 添加commitlint.config.js到项目中
fs.createReadStream(path.resolve(__dirname, "../template/commitlint.config.js")).pipe(fs.createWriteStream(resolveApp("./commitlint.config.js")))
