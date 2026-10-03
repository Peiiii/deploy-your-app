# 光与颜色实验室 · Color Lab

GemiGo 自主制作的首个互动科学内容样板。中文界面，静态 HTML/CSS/JavaScript，无外部字体、素材或模型接口。自由混光、五关颜色匹配、配方链接分享。

线上入口：[光与颜色实验室](https://color-lab.gemigo.app/)。免费、无需登录，在 GemiGo 探索页“学习与教育”分类可搜索找到。

## 本地使用

```sh
python3 -m http.server 5196 --bind 127.0.0.1 --directory content/color-lab/site
node --test content/color-lab/tests/model.test.mjs
node packages/gemigo-cli/dist/bin.js validate --config content/color-lab/gemigo.app.json
```

打开 `http://127.0.0.1:5196/`。源码无需构建，`site/` 即静态发布目录。Manifest 在目录外，不会混入发布包。

真实作品截图封面为 `cover.png`，保存在静态目录外，不参与应用加载。

首次发布使用仓库 CLI `deploy`。已有项目更新须复用交付记录中的 project ID，通过现有再次部署入口发布，避免运行首次发布命令重复新建项目。

## 内容与创作说明

从首批内容计划的 C1 选题自主制作；探索式解释作为形式参考，没有搬入外部作品。创作简报：用三束 RGB 光的实时交集直观呈现加色混合，用户无需教程即可调节；把科学现象接到五关有反馈、能完成和重玩的挑战；简短解释随当前配方更新。

图形由 CSS/SVG 原创绘制。源代码与说明属于本项目自有内容，未引入第三方素材。知识来源为 [Exploratorium](https://annex.exploratorium.edu/xref/phenomena/color_mixing_%28additive%29.html)、[MDN RGB](https://developer.mozilla.org/en-US/docs/Glossary/RGB)、[MDN color space](https://developer.mozilla.org/en-US/docs/Glossary/Color_space)。不复制原文或网页。

边界：屏幕 RGB 模型，不模拟光谱、真实光功率或颜料；匹配分数不代表专业感知色差。挑战只在当前页面保存，刷新会重新开始；分享 URL 保存配方，不保存通关记录。

设计及实际线上入口、版本、截图、验证和更新项目 ID 见[交付记录](../../docs/logs/2026-10-03-color-lab/README.md)。技术验收不代替目标使用者对有趣和价值的判断。
