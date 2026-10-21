# 上游 PR 学习价值筛选

快照：2026-10-21；本地基线：`3cc83ef18ed502929e55d0e598129c7525e5f993`。

## 数量与证据范围

共 233 个 PR：201 个已合并、6 个开放、26 个关闭未合并。

已批量读取全部元数据与正文；32 个未合并 PR 均检查正文与文件列表，并抽看文本补丁和实质章节。不是全部补丁逐行审查。已合并部分按主题与现存正文建立阅读索引，未逐个审查 diff。未运行集群实验、部署模板或性能复测，未核验全部外部技术主张。

## 6 个开放 PR

| PR | 学习价值 | 本地处理建议 |
| --- | --- | --- |
| [#393 AI Factory](https://github.com/pacoxu/AI-Infra/pull/393) | 高：把 GPU、网络、租户、存储、调度、安全和计费串成完整平台 | 目标文章不存在。优先补平台如何串起来，不把项目名单扩成必修课程 |
| [#387 DRA + Kueue + KWOK](https://github.com/pacoxu/AI-Infra/pull/387) | 高：实验设计、准入、队列、配额和失败场景 | 精简提取方法与结果说明。329 个文件、约 261 万新增行，不能把原始采样全部搬进教材；模拟控制面不等于真实 GPU/NIC 性能，作者报告的 PASS 未在本次复跑 |
| [#332 KServe/Seldon 学习路径](https://github.com/pacoxu/AI-Infra/pull/332) | 高：从介绍进入部署、评测和回滚的连续路径 | 本地目标指南不存在；先明确 Seldon Core 代际，核对 API，再纳入可执行教程 |
| [#354 Pod 生命周期拆图](https://github.com/pacoxu/AI-Infra/pull/354) | 中高：主流程、探针、删除驱逐分图，降低理解难度 | 结合版本状态更新主文；先检查图生成结果和 1.36 声明，不能只替换图片 |
| [#400 containerd 2.4](https://github.com/pacoxu/AI-Infra/pull/400) | 中：运行时变更及升级风险 | 节选 AI 冷启动、CRI/NRI、CDI、废弃配置等相关内容；支持窗口与版本事实另核，不搬贡献者名单 |
| [#369 Agent OTel 草稿](https://github.com/pacoxu/AI-Infra/pull/369) | 主题有价值，但不是新增缺口 | 当前 `docs/observability/agent-otel-genai.md` 已由 [#404](https://github.com/pacoxu/AI-Infra/pull/404) 扩充，直接学习现稿，不再重复收录 |

优先顺序是学习内容编排建议，不是合并指令；本轮未合并、cherry-pick 或修改这些补丁。

## 26 个关闭未合并 PR

“已吸收”指教学主题有现存版本，不代表逐字相同，也不推断作者关闭原因。

### 已有更新版本或主题已吸收：11 项

- #357：DisaggregatedSet，读 `docs/blog/2026-06-15/` 当前文章。
- #341：PSI、组快照、CBT、DRA，读 `docs/blog/2026-04-15/` 和 `docs/kubernetes/dra.md`。
- #326：1.36 发布材料，读 `docs/kubernetes/sig-release/v1.36/release.md` 和 `v1.36-ai-infra-highlights.md`。
- #281、#222：Pod/GPU 冷启动，读 `pod-startup-speed.md`、`gpu-pod-cold-start.md` 和 2026-04-06 博客。
- #266：AICR，读 `docs/kubernetes/nvidia-aicr.md`。
- #231：browser-use 沙箱，已有 `agent-infra/README.md` 与 `docs/kubernetes/isolation.md`。
- #216：SuperNode，已有更新的 `docs/hardware/supernode.md`。
- #114：Agentic Systems，读当前 `agent-infra/README.md`。
- #94：Transformers，读 `docs/training/transformers.md`。
- #92：MoE 预训练，读 `docs/training/pre-training.md` 与相关模型结构文档。

### 有独立增量，但需要择要与复核：10 项

- [#339](https://github.com/pacoxu/AI-Infra/pull/339)：AML/PAI 平台分层比较；适合作为案例，不沿用旧季度承诺和缺口判断。
- [#334](https://github.com/pacoxu/AI-Infra/pull/334)：SIG etcd 治理和参与路径；低优先级扩展。
- [#282](https://github.com/pacoxu/AI-Infra/pull/282)：c-ray 容器运行时排障；适合进阶专题。
- [#276](https://github.com/pacoxu/AI-Infra/pull/276)：MCP/A2A 职责与部署边界；优先补清工具连接和 Agent 协作的区别，原文概览有易混淆说法。
- [#265](https://github.com/pacoxu/AI-Infra/pull/265)：只补 MIG profile 和碎片例子；共享总览已有 `hami-gpu-sharing.md`。
- [#227](https://github.com/pacoxu/AI-Infra/pull/227)：Ingress/Gateway 统一维度比较；版本、认证与退役状态需重新核查。
- [#220](https://github.com/pacoxu/AI-Infra/pull/220)：论文阅读索引；先逐项校验来源，连接到现有教程，不复制长摘要。
- [#218](https://github.com/pacoxu/AI-Infra/pull/218)：GKE B200/DRANET/NCCL 实操链路；硬件、费用与命令未实测，属于有条件实验。
- [#186](https://github.com/pacoxu/AI-Infra/pull/186)：Pod index/Start ordinal 小例子；补入工作负载学习路径。
- [#178](https://github.com/pacoxu/AI-Infra/pull/178)：历史 Kubernetes AI 调研；不把当时样本数字当当前通用基线。

### 维护、展示或旧计划：5 项

#127 目标图、#60 landscape 图片、#16 SVG/logo、#28 与 #29 的 2025 年 9 月学习计划，不作为新增技术正文。旧计划结构可参考，但不恢复过时版本和缺口列表。

所有编号均指上游 `https://github.com/pacoxu/AI-Infra/pull/<编号>`。

## 已合并内容：直接读现有正文

| 主题 | 代表 PR | 当前入口 |
| --- | --- | --- |
| Pod 生命周期与启动 | #19、#68、#176、#319 | `docs/kubernetes/pod-lifecycle.md`、`pod-startup-speed.md`、`gpu-pod-cold-start.md` |
| DRA 与设备管理 | #99、#107、#345、#347、#392 | `docs/kubernetes/dra.md`、`dra-driver-feature-matrix.md`、`dra-performance-testing.md` |
| 调度、队列、拓扑 | #70、#368、#375、#381、#382、#386 | `scheduling-optimization.md`、`tas-validation.md`、`lws-keps-learning-path.md` |
| GPU 共享与可靠性 | #40、#196、#379 | `isolation.md`、`hami-gpu-sharing.md`、`gpu-fault-detection.md` |
| 推理与 PD 编排 | #21、#23、#36、#49、#292、#358 | `docs/inference/README.md`、`ome.md`、`aibrix.md`、`pd-disaggregation.md`、`grove.md` |
| 缓存与模型生命周期 | #25、#64、#66、#350、#383、#395、#407 | `caching.md`、`model-lifecycle.md`、`model-switching.md`、`model-distribution-stack.md` |
| 训练与模型结构 | #44、#56、#86、#91、#93、#95、#96、#213 | `docs/training/`；`docs/inference/model-architectures.md` |
| Agent 与沙箱 | #208、#232、#263、#344、#377、#398、#409 | `agent-infra/`；`docs/blog/2026-09-16/`、`2026-10-21/` |
| 观测与性能验收 | #105、#106、#403、#404 | `docs/observability/`；`performance-testing.md`、`inference-conformance.md` |
| 硬件与服务栈 | #405、#406、#408 | `docs/hardware/supernode.md`、`docs/inference/deepseek-serving.md` |
| 厂商和大集群 | #140、#287、#312、#314、#316、#317、#331 | `case-study/`、`docs/kubernetes/large-scale-clusters.md` |

## 后续内容更新边界

建议先收敛 #393、#387、#332、#354、#276 五个主题。每项先核官方来源与适用版本，再更新本地学习正文。当前只是筛选，不代表这些 PR 的技术主张、脚本和版本状态已独立验证。
