---
status: Active
maintainer: pacoxu
last_updated: 2026-03-30
tags: inference, grove, kubernetes, gang-scheduling, disaggregated-inference, nvidia
canonical_path: docs/inference/grove.md
source_path: docs/inference/grove.md
source_commit: 3cc83ef18ed502929e55d0e598129c7525e5f993
translation_status: translated
---

<a id="grove-one-api-for-any-inference-architecture"></a>
# Grove：用一个 API 支持任意推理架构

[`Grove`](https://github.com/ai-dynamo/grove) 是一个 Kubernetes API，提供统一的声明式接口，用于编排任意 AI 推理工作负载——从简单的单 Pod 部署，到复杂的多节点解耦系统。Grove 可将多节点推理部署从单个副本扩展到数据中心规模，支持数万块 GPU。

Grove 允许你在 Kubernetes 中，将整个推理服务系统——例如 prefill、decode、路由或任何其他组件——描述为一个自定义资源（CR）。平台根据这一份规约，协调分层成组调度、拓扑感知放置、多级自动扩缩容和显式启动顺序。

<a id="overview"></a>
## 概述

现代 AI 推理工作负载需要 Kubernetes 原生并不提供的能力：

- **多节点/多 Pod 单元的扩缩容**——大模型被分片到多个节点。基本扩缩容单元不再是单个 Pod，而是共同构成一个模型实例的整组 Pod。
- **分层成组调度**——多节点模型实例要求 Pod 一起调度；仅调度部分 Pod 会使资源闲置，并可能导致死锁。解耦推理也有类似约束：必须至少调度一个 prefill 实例和一个 decode 实例，才能形成可工作的流水线。
- **启动顺序**——即使组件必须一起调度，它们通常仍需按特定顺序启动（例如，MPI 工作负载要求所有 worker 就绪后，leader 才能启动）。
- **拓扑感知放置**——推理组件间通信密集；经过网络优化的放置（例如在 NVLink 域内）对于最小化通信开销和最大化性能至关重要。

<a id="key-concepts"></a>
## 核心概念

Grove 引入了四个核心抽象：

| 概念 | 描述 |
| --- | --- |
| **PodClique** | 表示特定角色（例如 leader、worker、frontend）的一组 Pod。每个 clique 都有独立配置，并支持自定义扩缩容逻辑。 |
| **PodCliqueScalingGroup** | 一组作为一个 gang 共同扩缩容和调度的 PodClique。适合 prefill leader 与 worker 之类紧密耦合的角色。 |
| **PodCliqueSet** | Grove 的顶层对象，定义一组共同管理和共同放置的组件。支持自动扩缩容，并通过拓扑感知的分散放置保障可用性。 |
| **PodGang** | 定义成组调度单元的调度器 API——由多个 Pod 组构成，每组定义一个保证被调度的最小副本数。 |

<a id="key-features"></a>
## 核心功能

- **分层成组调度**——确保所有必需的 Pod（跨多个角色和扩缩容组）作为一个单元被原子地调度。
- **拓扑感知放置**——将 Pod 放置在 NVLink 域或其他网络拓扑边界内，以最小化节点间通信延迟。
- **多级自动扩缩容**——独立扩缩 PodClique，同时遵守 PodCliqueScalingGroup 级别的成组约束。
- **启动顺序**——保证各 clique 按指定顺序启动（例如 worker 在 leader 之前启动）。
- **滚动更新**——支持可配置的滚动更新，同时遵守成组调度不变量。
- **单一 CRD 的简洁性**——整个推理系统（prefill + decode + router）用一个 `PodCliqueSet` CR 表达——不需要脚本、多个 YAML 文件或自定义控制器。

<a id="example-use-cases"></a>
## 使用场景示例

- **多节点解耦推理**：面向大模型（例如 DeepSeek-R1、Llama-4-Maverick），跨数万块 GPU 运行。
- **单节点解耦推理**：按顺序启动 prefill 和 decode。
- **智能体流水线**：一系列专用模型必须共同放置和扩缩容。
- **标准聚合式推理**——具备完整生命周期管理的单节点或单 GPU 部署。

<a id="relationship-to-nvidia-dynamo"></a>
## 与 NVIDIA Dynamo 的关系

Grove 是 NVIDIA 分布式推理框架 [NVIDIA Dynamo](https://github.com/ai-dynamo/dynamo) 的 Kubernetes 编排层。Dynamo 支持两种部署模式：

- **Grove 模式**——NVIDIA 原生模式，使用 Grove CRD 提供完整的成组调度和拓扑感知能力。
- **LWS 模式**——Kubernetes 原生模式，使用 [LeaderWorkerSet](https://github.com/kubernetes-sigs/lws) 实现更轻量的多节点部署。

Grove 也可以独立于 Dynamo，与任意推理引擎一起使用。

<a id="quick-start"></a>
## 快速开始

```bash
# 1. Create a local kind cluster
cd operator && make kind-up

# 2. Deploy Grove
make deploy

# 3. Deploy your first workload
kubectl apply -f samples/simple/simple1.yaml

# 4. Inspect created resources
kubectl get pcs,pclq,pcsg,pg,pod -o wide
```

完整操作流程请参阅[快速入门指南](https://github.com/ai-dynamo/grove/blob/main/docs/quickstart.md)和[安装文档](https://github.com/ai-dynamo/grove/blob/main/docs/installation.md)。

<a id="roadmap"></a>
## 路线图

<a id="completed-2025"></a>
### 已完成（2025）

- 分层成组调度 ✅
- 多级水平自动扩缩容 ✅
- 启动顺序 ✅
- 滚动更新 ✅
- 拓扑感知调度 ✅

<a id="planned-2026"></a>
### 计划中（2026）

- 资源优化的滚动更新
- 拓扑分布约束
- 自动拓扑检测

<a id="learning-topics"></a>
## 学习主题

- 成组调度概念与 Kubernetes 调度器扩展点
- 基于 CRD 的工作负载编排模式
- NVLink / RDMA 网络的拓扑感知放置
- 解耦推理架构（prefill + decode）
- 推理系统的多级自动扩缩容策略

<a id="references"></a>
## 参考资料

- [GitHub：ai-dynamo/grove](https://github.com/ai-dynamo/grove)
- [核心概念概述](https://github.com/ai-dynamo/grove/blob/main/docs/user-guide/01_core-concepts/01_overview.md)
- [API 参考](https://github.com/ai-dynamo/grove/blob/main/docs/api-reference/operator-api.md)
- [NVIDIA Dynamo](https://github.com/ai-dynamo/dynamo)
- [Grove 邮件列表](https://groups.google.com/g/grove-k8s)
- [NVIDIA Dynamo Discord](https://discord.gg/UxcbxEYqS4)
