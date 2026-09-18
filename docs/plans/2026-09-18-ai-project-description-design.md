# AI 项目描述修复设计

## 问题

新建项目先产生一个带 slug 的草稿。部署服务当前把“已有 slug”误判为“元数据已完整”，因此直接跳过源码上下文提取和 AI 元数据生成。项目没有持久化描述时，探索页只能展示统一的 `Deployed AI app deployed with GemiGo.`。

生产只读查询确认这是系统性问题：434 个在线项目中有 375 个描述为空。

## 产品决策

用户手填内容始终优先。发布时只补齐缺失的描述、分类、标签或 slug，不覆盖已有值。AI 成功时使用 AI 介绍；AI 不可用或返回空结果时，仅从 `package.json` 描述、README、HTML meta、标题或正文提取真实信息；提取不到就保持为空。

已有空描述项目继续允许展示，但前端不再把项目名塞进固定模板冒充介绍。没有真实描述时直接省略介绍区域；维护脚本通过生产 Worker 的 AI 分析入口补全已有项目，且默认 dry-run，只有显式传入 `--apply` 才写入 D1。

## 架构决策

把 Worker 发布服务中的判断从“ensure slug”提升为“enrich missing metadata”。引入独立的 `DeploymentMetadataPolicy` class，集中负责：判断是否需要补全、合并生成结果且保护用户字段、从源码上下文构造非 AI 兜底描述。

Worker 是 AI 元数据生成的唯一配置源。`/api/v1/analyze` 不再转发给持有另一份本地 Key 的 Node builder，而是直接使用 Worker 的 `DASHSCOPE_API_KEY`；builder 只负责源码提取和部署。健康检查必须得到 description、非 `Other` 分类和至少一个 tag 才算 AI 可用。

## 验收标准

1. 项目已有 slug、但描述为空时，仍进入上下文分析和 AI 生成。
2. 用户已有描述时不会被 AI 覆盖。
3. 分类为 `Other` 或标签为空时允许 AI 补全。
4. AI 失败时仍产生项目专属描述并正常发布。
5. 已有空描述项目在补全前不展示任何编造的模板介绍。
6. lint、type check、回归测试、生产构建、Worker dry-run 和生产冒烟检查全部通过。
7. 生产 `/analyze` 返回真实 description、分类和 tags 后，才允许执行旧数据回填。
