# 文档盘点与翻译规模

日期：2026-10-21；基线：`3cc83ef18ed502929e55d0e598129c7525e5f993`。

## 结论

原仓库有 145 个受 Git 跟踪的 Markdown。按正文字符比例初筛：英文为主 71 篇、中文为主 60 篇、混合 14 篇。此分类是定位工具，不等于逐篇人工语言审核。

已有 19 组中英对应候选，尚未逐段核对完整性和同步状态。排除已有中文对应与自动化指令后，约有 53 篇学习相关候选待翻译或补齐，总计约 8.20 万英文词形单位。此数字剔除了代码、URL 等，不能当成精确翻译工作量。

## 目录分布

| 目录 | 文档数 | 英文为主 | 中文为主 | 混合 |
| --- | ---: | ---: | ---: | ---: |
| 根目录 | 5 | 3 | 1 | 1 |
| .github | 1 | 1 | 0 | 0 |
| agent-infra | 3 | 2 | 1 | 0 |
| case-study | 14 | 0 | 4 | 10 |
| docs/archive-blog | 42 | 17 | 25 | 0 |
| docs/blog | 27 | 3 | 23 | 1 |
| docs/hardware | 1 | 0 | 1 | 0 |
| docs/inference | 19 | 19 | 0 | 0 |
| docs/kubernetes | 22 | 16 | 4 | 2 |
| docs/observability | 2 | 2 | 0 | 0 |
| docs/planning | 1 | 0 | 1 | 0 |
| docs/training | 8 | 8 | 0 | 0 |
| 合计 | 145 | 71 | 60 | 14 |

## 主要新增翻译范围

- `docs/inference/`：19 篇，约 29,612 词。
- `docs/kubernetes/`：18 篇英文或部分双语候选，约 25,862 词。
- `docs/training/`：8 篇，约 10,299 词。
- `agent-infra/README.md` 与 `runtime-benchmark.md`：约 5,856 词。
- `docs/observability/`：2 篇，约 2,299 词。
- `docs/blog/README.md`：约 5,013 词，属于索引中文化。
- `docs/archive-blog/README.md`：约 34 词。
- `RoadMap.md` 与 `STRUCTURE.md`：约 2,981 词，属于附属资料。

`.github/copilot-instructions.md` 是自动化执行说明，不默认进入学习站。

`pod-lifecycle.md` 已含部分双语，需要按段补齐；案例目录含大量英文项目名，但多数正文已有中文，不能因英文文件名再次翻译。

## 已有中英对应候选

共 19 组，包括：

- 根目录中英文 README。
- 历史博客 16 组：gang-scheduling、topology-aware-scheduling、cgroup-v2、jobset-in-place-restart、agent-sandbox、aws-10k-node-clusters、inference-orchestration、safe-upgrade-rollback、kcd-hangzhou-observability、ant-group-large-scale-k8s、kubernetes-community-operations、bytedance-large-scale-k8s、multi-tenancy-isolation、sql-to-inference、oci-taking-over-everything、vllm-2025-retro-2026-roadmap。
- 2026-05-13 的 how-to-choose-inference-orchestration-stacks。
- 2026-04-01 的 Kubernetes Swap 文章：英文文件名含 `kubelet-and-memory-pressure`，中文含 `kubelet-memory-pressure_zh`，不能只靠删后缀配对。

这些条目应标“已有中文，待核对”，而不是“已完成复核”。

## 推荐入门顺序

1. 领域地图：训练、推理、基础设施分别解决什么问题。
2. 一次推理请求：输入、token、prefill、decode、首 token 延迟。
3. 运行载体：Pod、GPU、启动过程；容器与 Kubernetes 基础按需要补。
4. 性能与资源：指标、缓存、调度、并行与 PD 分离。
5. 可靠性：观测、故障、隔离与生命周期。
6. 按目标进入推理平台、训练平台或 Agent 平台；超大集群和版本提案作为进阶。

这不是假定学习者不会编程，而是按 AI-Infra 概念的依赖关系组织。

## 网站必须处理的格式

扫描发现约 487 个代码块、35 个 Mermaid 图、187 次图片引用、77 篇带表格文档，以及 675 次相对 Markdown 链接。数字是正则估算。

图片引用中远程约 167 次、本地 20 次；尚未逐一验证远程可达性。离线阅读不能只缓存 HTML，就宣称全部图片与发音也离线可用。

站点转换需保留 HTML 图片、表格、代码、图形关系与原文锚点；中英切换使用明确配对表，不能猜路径。

## 统计限制

语言分类使用汉字数与 ASCII 字母数的比例；大量项目名可能让中文文档被判为混合。已有中英版本未逐句核对；产品状态、性能数字和外部图片尚未全量核实。本文件是范围盘点，不是翻译完成报告。
