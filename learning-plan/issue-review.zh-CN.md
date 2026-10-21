# 上游 Issue 学习价值筛选

日期：2026-10-21；基线：`3cc83ef18ed502929e55d0e598129c7525e5f993`。

## 结论与检查范围

175 个 Issue：31 个开放、144 个关闭。GitHub 仓库元数据的 37 个开放项包含 6 个 PR，不能当作开放 Issue 数。

31 个开放项正文均已覆盖；#206 正文为空，另读评论。所有 Issue 正文由 API 获取，但部分关闭项批次输出截断，因此关闭项下面是主题筛选，不是全部逐字审读或事实审计。未全量检查评论、附件、视频、外部文章，也未运行集群实验。

以下编号均为 https://github.com/pacoxu/AI-Infra/issues/ 对应编号。分类为教学建议，不是上游官方级别。

## 全部 31 个开放项

| Issue | 分类 | 为什么值得看／怎么处理 |
| --- | --- | --- |
| #297 平台内核线 | 主线核心 | 资源、准入、拓扑、跨集群总路线；用 Kubernetes 导航、调度与 DRA 正文承接，不当完整实验教程 |
| #296 训练/MLOps | 主线核心 | 训练平台化、观测、成本路线；已有 `docs/training/` 和观测正文，平台验收仍待核实 |
| #295 推理性能线 | 主线核心 | 指标→基准→治理→回归；已有推理导航与性能指南，不能宣称完整回归体系已建成 |
| #285 DRA+Kueue | 主线核心 | 设备分配、排队、调度、回收的组合练习；已有 DRA/调度背景，联合实验是未完成交付；关联 PR #387 为模拟 PoC |
| #286 AI Conformance | 主线核心 | 标准与平台能力对照；完整 1.36 gap 分析未证实，区别于推理发布门禁 |
| #288 vLLM 基准 | 主线核心 | 同时看 TTFT、TPOT、吞吐、显存和成本；现有 `performance-testing.md` 是背景，负载与回归结果未独立验证 |
| #289 KServe Gateway | 主线核心 | 从模型部署到路由、灰度、限流和恢复；可运行 PoC 与故障注入结果未证实 |
| #293 Trainer v2 | 主线核心 | 模板化训练入口；`docs/training/kubeflow.md` 已有介绍与例子，多团队接入验收未证实 |
| #294 OTel GenAI | 主线核心 | 模型/工具/sandbox 关联；`docs/observability/agent-otel-genai.md` 已存在，不再列为缺少正文，运行看板待核实 |
| #361 调度/LWS 路线 | 主线核心 | 有序 KEP 阅读；已有 `lws-keps-learning-path.md` 和调度框架文章，总勾选不能替代细项检查 |
| #376 Kueue KEP | 主线核心 | 配额、公平、抢占、TAS、MultiKueue；未找到独立学习专篇，可把 Issue 用作阅读清单 |
| #388 DRA 后续 | 主线核心 | 讲清 API 成熟不等于驱动生产就绪；已有 DRA/driver matrix，未来版本支持须重新核实 |
| #390 WAS | 进阶专题 | PodGroup、抢占、拓扑与 controller；Issue 已注明部分阶段来源冲突，不替它消除不确定性 |
| #396 LWS/WAS | 进阶专题 | 生命周期分组与调度准入分组不同；整合 LWS 旧基线及 2026-09-28 更新文章，不混用日期 |
| #359 层级 PodGroup | 进阶专题 | 分层 gang、quorum、拓扑的场景；现有 LWS/TAS 只覆盖部分，完整矩阵未找到且状态需更新 |
| #363 MultiKueue | 进阶专题 | 跨集群 dispatch 与容量治理；已有全球调度背景，双集群实验未证实 |
| #313 SGLang/vLLM | 进阶专题 | 同条件选型练习；有基础材料，没有已核实的统一对比实验结论 |
| #330 KServe/Seldon | 进阶专题 | 连续学习路线有用；所指 `docs/inference/kserve-seldon-core.md` 本地不存在，对应 PR #332 尚未合并 |
| #333 推理控制面矩阵 | 进阶专题 | 引擎、平台、编排、路由职责边界；已有多平台介绍，统一七框架矩阵/PoC 未证实 |
| #370 AI Gateway | 进阶专题 | token/model/tenant/cost 治理；拟建 `envoy-ai-gateway.md` 本地未找到 |
| #366 llm-d/FlagOS | 待验证设想 | variant profile 是提议，不是确认的标准 API；指标契约、支持矩阵与收益未验证 |
| #323 AI Runway | 待验证设想 | 多 Provider 交付层仍在评估，端到端产物交付未验证 |
| #262 Sandbox 配额 | 待验证设想 | 目标合理，但具体配置与压力数据未证实 |
| #261 Warm pool/snapshot | 待验证设想 | 已有相关机制，组合后的 P95/P99 与资源浪费仍需实验 |
| #258 GPU sandbox | 待验证设想 | MIG、Kata、VM 是不同层面的机制，统一兼容/性能实验未证实 |
| #257 OpenClaw/OpenShell | 待验证设想 | 有架构背景，部署和成功工具链验收未证实 |
| #256 Pod/VM 准入 | 待验证设想 | 人工选择建议不等于已实现自动 admission policy；分流、审计、豁免待验证 |
| #206 vLLM 长期笔记 | 资料入口 | 评论有日志、异步调度、推测解码等资料；不是系统课程，基准和选型另归 #288/#313 |
| #103 资料收集 | 资料入口 | 可放资料库；外链和评论池未全量核实 |
| #158 CoEvolving | 资料入口 | 用已有跨项目协同案例作索引，不新增重复正文 |
| #159 月度目标 | 维护 | 优先级/季度快照，不作知识课，进度有落后于本地文章的情况 |

合计：主线核心 12、进阶专题 8、待验证设想 7、资料入口 3、维护 1。

## 关闭项中的推荐学习主题

| 主题 | 代表 Issue | 现有正文入口 |
| --- | --- | --- |
| DRA 与设备 | #385、#111、#98、#47 | `docs/kubernetes/dra.md`、`dra-driver-feature-matrix.md`、`nvidia-gpu-operator.md`、`dra-performance-testing.md` |
| GPU 共享与隔离 | #372、#132、#39、#301 | `docs/kubernetes/hami-gpu-sharing.md`、`isolation.md` |
| 调度、拓扑、公平 | #303、#362、#69、#143、#141 | `scheduling-optimization.md`、`tas-validation.md`；2026-05-04 调度博客 |
| 训练平台与作业 | #300、#43、#54、#212、#322 | `docs/training/`；2026-04-13 作业管理博客 |
| 模型与并行 | #102、#84、#87、#88、#85、#5、#89、#50 | `docs/training/`；`docs/inference/model-architectures.md`、`large-scale-experts.md` |
| 推理编排与 PD | #155、#35、#52、#57、#48、#245、#309 | `docs/inference/pd-disaggregation.md`、`dynamo.md`、`grove.md`、`aibrix.md` |
| 缓存、LoRA、切换 | #59、#24、#31、#135、#133 | `caching.md`、`memory-context-db.md`、`model-switching.md`、`lora.md` |
| 冷启动与加载 | #299、#305、#120、#65、#221 | `gpu-pod-cold-start.md`、`pod-startup-speed.md`；`model-lifecycle.md`、`model-distribution-stack.md` |
| 生命周期与恢复 | #175、#147、#115、#1 | `pod-lifecycle.md`；2025-11-26 JobSet restart 中文归档，#1 的猜想不直接继承 |
| 测试与发布门禁 | #101、#371 | `performance-testing.md`、`inference-conformance.md`、`scripts/conformance/preflight.sh` |
| 观测与故障 | #260、#78、#195、#162 | `docs/observability/`；`gpu-fault-detection.md` |
| Agent/runtime | #307、#259、#149、#230、#255 | `agent-infra/`；`docs/kubernetes/isolation.md` |
| 大集群 | #2、#139、#151、#164、#179、#190、#192 | `large-scale-clusters.md`、`case-study/` 与对应归档 |
| 硬件与运行时 | #170、#166、#251、#374 | `docs/hardware/supernode.md`、`model-distribution-stack.md`、`nvidia-aicr.md` |
| 全球调度 | #184 | `docs/archive-blog/2026-01-07/2026-01-07-ambient-global-compute_zh.md` |

资料候选：#26 的 meetup PDF、#264 的 GPU placement 系列、#104 的 llm-d 路由来源。附件和外链未读完，不称为已提炼正文。

维护和旧排期通常不单独成课，例如 #17、#13、#73、#112、#203、#62、#82、#223、#233、#235、#239、#267、#283、#291。#304/#306/#308/#310/#311 已结束旧排期，不因关闭就标“文章已完成”。

## 必须保留的证据边界

- `tas-validation.md` 明确真实 GPU/NIC A/B 数据待执行。#362 关闭不代表完成硬件实测。
- `runtime-benchmark.md` 的数字是仓库测量声明，本次未复跑或审计原始采样。
- 推理 conformance preflight 是发布门禁，不是完整 benchmark，也不代替生产监控。
- DRA API 稳定、驱动支持和真实设备可用是三回事。
- Issue 中的发布阶段、版本支持、性能倍率没有在本次全量独立验证；应保留日期与待核标识。

建议学习站以现有文档为正文，Issue 分别挂为出处、延伸资料、待验证实验，而不是把待办直接变成完成教程。
