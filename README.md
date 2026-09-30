# 八字命理

一个基于 Electron 的八字命理桌面应用。排盘、命理分析、流年运势和六爻占卜都由 Claude 生成。

## 功能

- **多人管理**：可以添加多个人物并上传头像。数据自动保存，也能导入或导出 JSON 文件。
- **八字排盘**：输入姓名、性别、出生日期、时辰、出生地和常居地，生成完整命盘：
  - 四柱、十神、藏干和藏干十神
  - 十二长生（地势）、日柱自坐、纳音、神煞
  - 日主强弱、大运（8 步）、五行统计
- **命理推理**：分析性格、事业、财运、学业和爱情姻缘，分幼年、少年、中年、晚年四个阶段解读，并逐个分析大运。
- **流年运势**：选择年份查看当年总评、主题、分析和建议，每个月附一句简评和吉凶。
- **六爻占卜**：输入问题，点击硬币起卦，得出本卦、变卦、六亲、世应、详细分析和结论。占卜结果会保存到历史记录。
- **PDF 导出**：可以选择导出性格、事业、财运、学业、姻缘、大运、流年等内容。占卜结果也能单独导出。

## 运行原理

应用本身不包含 API key。所有分析都通过调用本机的 **Claude Code 命令行**完成（`claude -p --output-format json`），因此会使用你自己的 Claude 订阅额度。

## 环境要求

- [Node.js](https://nodejs.org/)
- [Claude Code](https://docs.claude.com/en/docs/claude-code)：需要已经安装，并且登录成功（在终端运行 `claude` 能正常对话）

### 代理设置（国内使用）

应用启动的 Claude Code 不会读取 PowerShell 里临时设置的代理，建议把代理写进 `C:\Users\你的用户名\.claude\settings.json`：

```json
{
  "env": {
    "HTTPS_PROXY": "http://127.0.0.1:7890",
    "HTTP_PROXY": "http://127.0.0.1:7890"
  }
}
```

端口请改成你的代理软件实际使用的端口。

## 安装与运行

```bash
git clone https://github.com/你的用户名/bazi-app.git
cd bazi-app
npm install
npm start
```

## 数据存放位置

| 内容 | 位置 |
| --- | --- |
| 人物数据 | Electron 用户数据目录下的 `bazi-persons.json` |
| 占卜历史 | Electron 用户数据目录下的 `divine-history.json` |
| 导出的 PDF | `F:\八字`（可以在 `main.js` 的 `export-pdf` 部分修改） |

在 Windows 上，用户数据目录一般是 `%APPDATA%\bazi-app`。

## 项目结构

```
bazi-app/
├── main.js       # 主进程：调用 Claude、提示词、数据读写、PDF 导出
├── preload.js    # 向页面暴露的接口
├── renderer.js   # 页面逻辑：表单、命盘渲染、流年、占卜、导出
├── index.html    # 页面结构
├── styles.css    # 样式
└── package.json
```

## 调试

每次调用 Claude 的输出会记录在系统临时目录下的 `bazi_debug.log` 中，排查问题时可以查看这个文件。

## 免责声明

本项目仅供娱乐和传统文化研究。排盘和分析由 AI 生成，可能存在错误，请勿作为人生决策的依据。
