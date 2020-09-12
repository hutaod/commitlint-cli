#!/usr/bin/env node

const fs = require("fs")
const path = require("path")
const chalk = require('chalk');
const { spawn } = require("child_process")
const pkg = require("../package.json")

const log = console.log;

// 用于resolve使用工程中的文件路径
const resolveApp = relativePath => path.resolve(process.cwd(), relativePath)

function printHelp(code = 0) {
  const lines = [
    '',
    '  Usage:',
    '    npx init-commitlint',
    '',
    '  Options:',
    '    -v, -V, --version           print the version of commitlint-cli',
    '    -h, -H, --help              display this message',
    '    --cover                     覆盖已有依赖，暂未生效',
    '',
  ]
  log(chalk.yellow(lines.join('\n')))
  process.exit(code)
}

function printVersion() {
  log(chalk.magenta(`${pkg.name} ${pkg.version}`))
  process.exit()
}

/**
 * 程序主要任务
 * @param {boolean?} isCover 是否覆盖依赖，默认不覆盖
 */
function start(isCover) {
  const appPkgPath = resolveApp("./package.json")

  // 判断 package.json 文件是否存在
  if(!fs.existsSync(appPkgPath) || fs.statSync(appPkgPath).isDirectory()) {
    log(chalk.red("package.json文件不存在"))
    return;
  }

  // 读取工程中的 package.json
  const appPkg = require(appPkgPath) || {}

  // 读取依赖列表
  const dependencies = { ...(appPkg.devDependencies || {}), ...(appPkg.dependencies || {}) }

  // 过滤已安装的依赖
  const installPkgs = [
    "git-cz",
    "commitizen",
    "commitlint",
    "conventional-changelog-cli",
    "husky"
  ].filter(p => {
    if(isCover) {
      return true
    }
    return !dependencies[p]
  })

  // 执行依赖安装
  if (installPkgs.length > 0) {
    const childProcess = spawn("npm", ["install", ...installPkgs, "-D"], { cwd: process.cwd(), stdio: 'inherit' })
    childProcess.on("error", err => {
      console.error(err)
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
}

// 启动函数
function main(argv) {
  // 获取解析后的参数，获取一个就移出一个
  const getArg = function () {
    let args = argv.shift()
    args = args.split('=')
    return args
  }

  console.log("测试")
  
  while (argv.length) {
    // 获取合法命令，直到所有命令行参数都解析完毕或者程序退出
    const [key] = getArg()
    switch (key) {
      // 打印版本号
      case '-v':
      case '-V':
      case '--version':
        return printVersion()
      // 打印帮助信息
      case '-h':
      case '-H':
      case '--help':
        return printHelp()
      case '--cover':
        return start(true)
      default:
        break
    }
  }
  start()
}

// 启动程序就开始执行主函数
main(process.argv.slice(2))

module.exports = main