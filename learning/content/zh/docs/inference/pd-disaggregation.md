---
status: Active
maintainer: pacoxu
last_updated: 2026-04-15
tags: inference, pd-disaggregation, prefill-decode, llm-optimization
canonical_path: docs/inference/pd-disaggregation.md
source_path: docs/inference/pd-disaggregation.md
source_commit: 3cc83ef18ed502929e55d0e598129c7525e5f993
translation_status: translated
---

<a id="pd-disaggregation-in-llm-inference"></a>

# LLM 推理中的 PD 解耦

本文介绍大语言模型（LLM）推理中 Prefill–Decode（PD，预填充–解码）解耦的概念、优势、常见 AI Infra 项目中的当前实现状态，以及未来的采用路线图。

<a id="table-of-contents"></a>

## 目录

- [什么是 PD 解耦](#what-is-pd-disaggregation)
- [LLM 推理中的并行策略](#parallelism-strategies-in-llm-inference)
  - [Tensor Parallelism（TP）](#tensor-parallelism-tp)
  - [Data Parallelism（DP）](#data-parallelism-dp)
  - [Pipeline Parallelism（PP）](#pipeline-parallelism-pp)
  - [Expert Parallelism（EP）](#expert-parallelism-ep)
  - [Sequence Parallelism（SP）](#sequence-parallelism-sp)
  - [Zero Redundancy Parallelism（ZP）](#zero-redundancy-parallelism-zp)
- [工作负载方案](#workload-solutions)
  - [LWS（LeaderWorkSet）](#lws-leaderworkset)
  - [SGLang RBG](#sglang-rbg)
  - [AIBrix StormService](#aibrix-stormservice)
  - [Volcano Kthena](#volcano-kthena)
  - [llm-d](#llm-d)
- [项目支持状态](#project-support-status)
  - [NVIDIA Dynamo](#nvidia-dynamo)
  - [vLLM production stack](#vllm-production-stack)
  - [AIBrix](#aibrix)
  - [KServe](#kserve)
- [P/D 工作负载扩缩](#scaling-pd-workloads)
  - [传统自动扩缩的挑战](#challenges-with-traditional-autoscaling)
  - [使用 AIConfigurator 优化配置](#configuration-optimization-with-aiconfigurator)
  - [Kubernetes 中基于 SLA 的调度](#sla-based-scheduling-in-kubernetes)
- [参考资料](#references)

---

<a id="what-is-pd-disaggregation"></a>

## 什么是 PD 解耦

LLM 推理过程可分为两个不同阶段：

- **Prefill（预填充）**：并行处理整个输入提示词，构建 KV 缓存。
- **Decode（解码）**：使用 KV 缓存逐个生成输出 token。

在一体式部署中，预填充和解码都运行在同一 GPU 上，导致资源争用（例如预填充延迟影响解码吞吐量）。**PD 解耦**通过将预填充和解码阶段分离到独立的 GPU 工作进程或节点来解决这一问题。

**优势：**

- 改善延迟（TTFT 和 TPOT）
- 提高每块 GPU 的吞吐量
- 各阶段可独立扩缩和调优
- 灵活的调度与负载均衡

---

<a id="parallelism-strategies-in-llm-inference"></a>

## LLM 推理中的并行策略

大语言模型推理和训练需要分布式计算策略，以应对庞大模型规模与高计算需求。不同并行策略可以组合使用，优化性能、内存使用和吞吐量。在实现 PD 解耦架构时，这些策略尤为重要。

<a id="tensor-parallelism-tp"></a>

### Tensor Parallelism（TP，张量并行）

**Tensor Parallelism** 沿特定维度拆分张量（权重矩阵和激活），将神经网络的单个层分布到多个设备。

**工作原理：**

- 将权重矩阵与激活拆分到多个 GPU
- 每块 GPU 处理每层的一部分计算
- 通过 all-reduce 操作同步结果
- 所有 GPU 同时处理相同输入数据

**示例：**

```text
Input → [GPU 1: W1_part1] → AllReduce → Output
        [GPU 2: W1_part2] →
        [GPU 3: W1_part3] →
```

**特征：**

- **粒度**：层内并行
- **通信**：GPU 之间高频 all-reduce 操作
- **内存**：模型权重分布在设备之间
- **使用场景**：单块 GPU 无法容纳的大模型

**优势：**

- 能运行超出单块 GPU 显存的模型
- 小批量下延迟低
- 对注意力层和 FFN 网络高效

**挑战：**

- GPU 之间通信开销高
- 需要高速互联（NVLink、InfiniBand）
- 受可拆分维度数量限制

**PD 解耦场景：**

在 PD 解耦中，当模型规模超出单块 GPU 容量时，TP 常用于预填充或解码工作进程内部。例如，预填充工作进程可能使用 TP=4 将模型分布在 4 块 GPU 上，而解码工作进程使用 TP=2。

<a id="data-parallelism-dp"></a>

### Data Parallelism（DP，数据并行）

**Data Parallelism** 在每个设备上复制完整模型，并将不同批次的输入数据分布到各设备。

**工作原理：**

- 每块 GPU 保存完整模型副本
- 每块 GPU 处理不同输入样本
- 训练期间同步梯度（与推理关系较小）
- 独立处理不同请求

**示例：**

```text
Request 1 → [GPU 1: Full Model] → Response 1
Request 2 → [GPU 2: Full Model] → Response 2
Request 3 → [GPU 3: Full Model] → Response 3
```

**特征：**

- **粒度**：样本/批次级并行
- **通信**：推理时极少（仅训练期间需要）
- **内存**：每个设备复制完整模型
- **使用场景**：较小模型的高吞吐量服务

**优势：**

- 吞吐量随 GPU 数量线性扩展
- 推理期间没有 GPU 间通信
- 实现和调试简单
- 容错（一个副本故障不影响其他副本）

**挑战：**

- 内存效率低（每块 GPU 上保存完整模型）
- 仅适用于单块 GPU 可容纳的模型
- 对单个大型请求没有收益

**PD 解耦场景：**

DP 用于独立扩缩预填充和解码工作进程。例如，根据工作负载特征部署 4 个预填充副本与 8 个解码副本。每个副本独立处理不同请求。

<a id="pipeline-parallelism-pp"></a>

### Pipeline Parallelism（PP，流水线并行）

**Pipeline Parallelism** 将模型划分为顺序阶段，将每个阶段分配给不同设备，形成计算流水线。

**工作原理：**

- 模型拆分为顺序分块（第 1-10、11-20、21-30 层等）
- 每个阶段分配给不同 GPU
- 前向传播流经流水线
- 同时处理多个微批次以提高效率

**示例：**

```text
Input → [GPU 1: Layers 1-10] → [GPU 2: Layers 11-20] →
        [GPU 3: Layers 21-30] → [GPU 4: Layers 31-40] → Output
```

**特征：**

- **粒度**：层组并行
- **通信**：相邻阶段之间点对点通信
- **内存**：模型按顺序分区到设备
- **使用场景**：具有顺序依赖的极深模型

**优势：**

- 减少每块 GPU 的内存（仅保存部分层）
- 通信量低于 TP（仅阶段之间通信）
- 适用于极深模型
- 兼容异构 GPU 集群

**挑战：**

- 流水线气泡（填充/排空流水线时的空闲时间）
- 顺序依赖限制并行度
- 要提高效率需要复杂调度
- 阶段计算时间不同时存在负载不均衡

**PD 解耦场景：**

对于极大模型，可以在预填充或解码工作进程内部使用 PP。例如，预填充工作进程可能使用 PP=4，将一个 176B 参数模型拆成 4 个阶段，每个阶段内部还可能使用 TP。

<a id="expert-parallelism-ep"></a>

### Expert Parallelism（EP，专家并行）

**Expert Parallelism** 专用于 Mixture of Experts（MoE）模型，将不同专家分布到各设备。

**工作原理：**

- 每块 GPU 承载一部分专家
- 路由器网络决定激活哪些专家
- 根据专家选择，将 token 路由到适当 GPU
- 仅激活的专家执行计算

**示例：**

```text
Input Token → Router → [GPU 1: Expert 1, 2]
                    → [GPU 2: Expert 3, 4]
                    → [GPU 3: Expert 5, 6]
                    → [GPU 4: Expert 7, 8] → Output
```

**特征：**

- **粒度**：专家级并行
- **通信**：设备之间动态路由
- **内存**：专家分布存储，路由器复制
- **使用场景**：具有大量专家的 MoE 模型

**优势：**

- 能扩展到数百个专家
- 稀疏激活减少每个 token 的计算
- GPU 之间自然负载均衡
- 对大型专家集合具有内存效率

**挑战：**

- 某些专家使用更频繁时出现负载不均衡
- token 路由的 All-to-all 通信开销
- 故障处理复杂（专家不可用）
- 路由器网络成为瓶颈

**PD 解耦场景：**

在解耦式 MoE 服务中，预填充与解码工作进程可以采用不同的 EP 方式。预填充工作进程可能使用 EP 分布专家，以高效处理提示词；解码工作进程则可以采用针对自回归生成优化的不同专家分布策略。

<a id="sequence-parallelism-sp"></a>

### Sequence Parallelism（SP，序列并行）

**Sequence Parallelism** 将序列维度（输入长度）拆分到多个设备，把张量并行扩展到非张量并行区域。

**工作原理：**

- 沿序列维度在 GPU 间划分输入序列
- 应用于 LayerNorm、Dropout 和其他逐元素操作
- 与张量并行结合提高内存效率
- 减少激活的内存占用

**示例：**

```text
Sequence [Token 1-1024] → [GPU 1: Tokens 1-256]   → Process → Gather
                        → [GPU 2: Tokens 257-512]  → Process →
                        → [GPU 3: Tokens 513-768]  → Process →
                        → [GPU 4: Tokens 769-1024] → Process →
```

**特征：**

- **粒度**：序列长度并行
- **通信**：Scatter/gather 操作
- **内存**：沿序列维度拆分激活
- **使用场景**：长上下文场景（32K+ token）

**优势：**

- 减少长序列的激活内存
- 能处理更长上下文
- 补充张量并行
- 对 LayerNorm 和 Dropout 尤其有效

**挑战：**

- 要求序列长度可被 GPU 数量整除
- Scatter/gather 带来额外通信
- 适用范围有限（并非所有操作都支持 SP）
- 与注意力机制的交互复杂

**PD 解耦场景：**

SP 特别适合处理长上下文窗口的预填充工作进程。处理 32K-token 提示词时，SP 可以将序列分布到多个 GPU，降低每块 GPU 的内存需求。由于序列长度短（一次 1 个 token），解码工作进程较少使用 SP。

<a id="zero-redundancy-parallelism-zp"></a>

### Zero Redundancy Parallelism（ZP，零冗余并行）

**Zero Redundancy Parallelism**（ZeRO）通过在设备之间划分优化器状态、梯度和模型参数，消除数据并行中的内存冗余。

**工作原理：**

- ZeRO Stage 1：仅划分优化器状态
- ZeRO Stage 2：划分优化器状态 + 梯度
- ZeRO Stage 3：划分优化器状态 + 梯度 + 参数
- 计算期间即时聚集所需参数

**示例（ZeRO Stage 3）：**

```text
Model Parameters distributed:
[GPU 1: Params 1-25%] → Broadcast when needed → Compute
[GPU 2: Params 26-50%] → Broadcast when needed → Compute
[GPU 3: Params 51-75%] → Broadcast when needed → Compute
[GPU 4: Params 76-100%] → Broadcast when needed → Compute
```

**特征：**

- **粒度**：在数据并行 rank 之间划分参数
- **通信**：前向/反向传播期间进行 All-gather
- **内存**：随设备数量线性扩展
- **使用场景**：大模型训练（推理中较少见）

**优势：**

- 大幅减少内存（使用 N 块 GPU 时，最多缩减 Nx）
- 能训练原本无法容纳的模型
- 保持数据并行语义
- 兼容其他并行策略

**挑战：**

- 通信开销增加
- 实现更复杂
- All-gather 操作带来额外延迟
- 主要为训练工作负载设计

**PD 解耦场景：**

虽然 ZeRO 主要是一种训练优化，但 ZeRO-Inference 技术可调整用于解耦式服务。例如，在处理大量并发序列的解码工作进程中，ZeRO 风格的参数划分与高效参数聚集结合，可以降低内存占用。

<a id="combining-parallelism-strategies"></a>

### 组合并行策略

实际部署往往组合多种并行策略：

<a id="example-1-large-model-serving"></a>

#### 示例 1：大模型服务

```text
- 8 Data Parallel replicas
  - Each replica uses TP=4 (Tensor Parallel across 4 GPUs)
  - Total: 32 GPUs
  - Configuration: DP=8, TP=4
```

<a id="example-2-moe-model-with-pd-disaggregation"></a>

#### 示例 2：具有 P/D 解耦的 MoE 模型

```text
Prefill Workers:
  - DP=2, TP=2, EP=4
  - 2 replicas, each with 2-way tensor parallel and 4-way expert parallel
  
Decode Workers:
  - DP=4, TP=2, EP=4
  - 4 replicas, different expert distribution strategy
```

<a id="example-3-long-context-serving"></a>

#### 示例 3：长上下文服务

```text
- DP=4, TP=2, SP=2, PP=2
- 4 data parallel replicas
- Each replica: 2-way tensor parallel, 2-way sequence parallel, 2-stage
  pipeline
- Total: 32 GPUs
```

**选择指南：**

- **TP**：模型无法放入单块 GPU 时，配合高速互联使用
- **DP**：用于较小模型的吞吐量扩展
- **PP**：用于极深模型或异构集群
- **EP**：对于具有大量专家的 MoE 模型必不可少
- **SP**：用于长上下文场景（>16K token）
- **ZP**：用于大模型训练或微调

---

<a id="workload-solutions"></a>

## 工作负载方案

本节介绍在 Kubernetes 环境中实现高效 PD 解耦架构的具体工作负载编排方案。

<a id="lws-leaderworkset"></a>

### LWS（LeaderWorkSet）

[`LWS (LeaderWorkSet)`](https://github.com/kubernetes-sigs/lws) 是一个 Kubernetes SIG 项目，提供用于管理具有 leader-follower 关系的 Pod 组的工作负载 API。对于 P/D 解耦，LWS 可以与 StatefulSet 和 Pod 资源配合，编排解耦式推理工作负载。

**面向 P/D 解耦的主要特性：**

- **双 LWS 架构**：使用两个独立 LWS 实例——一个用于预填充工作进程，另一个用于解码工作进程
- **Leader-Follower 协调**：通过 leader 选择实现预填充与解码阶段之间的协调
- **StatefulSet 集成**：与 StatefulSet 协作，满足持久化存储和网络需求
- **Pod 组管理**：将 Pod 组作为整体单元，进行扩缩和生命周期管理

**架构模式：**

```text
Prefill LWS + StatefulSet + Pods  →  KV Cache  →  Decode LWS + StatefulSet + Pods
```

该方法通过 LWS 的 leader-follower 模式保持协调，同时使各阶段能够独立扩缩和管理资源。

<a id="sglang-rbg"></a>

### SGLang RBG

[`SGLang RBG`](https://github.com/sgl-project/rbg) 是一种 Kubernetes API（`RoleBasedGroup`），将多角色 AI 推理工作负载（例如 `processor` / `prefill` / `decode`）作为一个逻辑单元编排。

**主要特性：**

- **基于角色的工作负载模型**：以协调的角色组管理分布式推理服务，而不是孤立的 Deployment/StatefulSet
- **多种部署模式**：支持 `standalonePattern` 和 `leaderWorkerPattern`，适用于单节点和多节点拓扑
- **角色级生命周期控制**：提供发布策略控制（包括 `InPlaceIfPossible` 和分区滚动更新）
- **扩缩适配器集成**：暴露角色级扩缩端点，用于 HPA、KEDA 和 Planner 驱动的自动扩缩
- **协调/Gang 调度**：支持协调策略以及可选的组级 Gang 调度行为

**与 P/D 解耦集成：**

RBG 通过以下能力增强 P/D 解耦：

- `prefill` 和 `decode` 的原生多角色编排
- 角色粒度的独立扩缩控制
- 解耦组件之间协调的发布/更新语义

**近期上游状态（截至 2026-04-15）：**

- **已合并**：
  [sgl-project/rbg#255](https://github.com/sgl-project/rbg/pull/255)（2026-04-03）在 `examples/inference/ecosystem/dynamo/` 下添加了 Dynamo 集成示例：`agg.yaml`、`agg-multi-nodes.yaml`、`pd-disagg.yaml`、`pd-disagg-multi-nodes.yaml`，以及依赖清单（`etcd.yaml`、`nats.yaml`）
- **进行中**：
  [ai-dynamo/dynamo#5457](https://github.com/ai-dynamo/dynamo/pull/5457)（开放中）在 Dynamo 文档中添加专门的 RBG 集成指南

<a id="aibrix-stormservice"></a>

### AIBrix StormService

[`AIBrix StormService`](https://github.com/vllm-project/aibrix/blob/fd8ddd8062602313c5f7b3b7ecbda20e845da647/docs/source/designs/aibrix-stormservice.rst) 是专门用于管理和编排 Prefill/Decode 解耦架构中推理容器生命周期的组件。

**关键能力：**

- **P/D 生命周期管理**：专门编排解耦的预填充和解码容器生命周期
- **多模式支持**：管理多种部署模式，包括：
  - Prefill/Decode 解耦
  - Tensor Parallelism（TP）
  - Pipeline Parallelism（PP）
  - 单 GPU 模型部署
- **容器编排**：对推理容器部署与扩缩提供细粒度控制
- **资源协调**：确保解耦组件之间正确分配和协调资源

**StormService 架构：**

StormService 作为专用控制器：

1. 管理预填充与解码容器的部署
2. 协调解耦组件间的资源分配
3. 处理生命周期事件（扩缩、更新、故障）
4. 优化不同并行模式下的资源利用率

这使企业级 P/D 解耦具备稳健的生命周期管理和多租户支持。

<a id="volcano-kthena"></a>

### Volcano Kthena

[`Volcano Kthena`](https://github.com/volcano-sh/kthena) 是一个 Kubernetes 原生 LLM 推理平台，为在生产环境中部署和管理大语言模型提供全面基础设施。作为 Volcano 生态的一部分，Kthena 为 LLM 推理工作负载带来企业级能力。**最新版本：v1.0.0** 通过协调的角色级自动扩缩、会话感知路由和更安全的滚动更新，增强生产环境中的 P/D 解耦。

**关键能力：**

- **Kubernetes 原生架构**：深度集成 Kubernetes，实现无缝工作负载编排和资源管理
- **生产就绪推理**：大规模部署与管理 LLM 推理的企业级平台
- **Volcano 集成**：利用 Volcano 的高级调度能力实现最优资源分配
- **工作负载编排**：全面管理推理工作负载生命周期，包括扩缩和故障处理

**P/D 解耦特性：**

- **LeaderWorkerSet 支持**：原生集成 LeaderWorkerSet（LWS）API，实现对 leader-worker 拓扑分布式推理工作负载的精细管理，简化 P/D 解耦部署
- **网络拓扑感知调度**：使用 Volcano 的 `subGroupPolicy` 特性，提供细粒度、角色级 Gang 调度和网络拓扑感知。通过将预填充与解码实例共同放置在网络邻近节点（同一交换机/机架）上，尽量降低角色间通信延迟（这对 P/D 分离至关重要）。需要 Volcano v1.14+
- **角色级 Gang 调度**：确保属于特定角色（例如 prefill-0）的所有 Pod 作为原子单元一起调度，避免可能破坏分布式推理工作负载的部分部署
- **ModelServing 修订版本控制**：原生版本控制系统，通过基于分区的更新支持金丝雀部署和回滚
- **路由器可观测性**：全面可观测性框架，具有调试端口（默认 15000）、用于监控延迟/吞吐量的详细指标，以及确保生产可靠性的 E2E 测试套件
- **协调的 P/D 自动扩缩**：`AutoscalingPolicy.spec.disaggregatedTarget` 允许预填充与解码角色基于不同指标扩缩，同时可选的比例约束保持部署平衡
- **Session Boost**：优先处理近期会话的后续请求，提高复用温 KV 缓存的概率

**与 P/D 解耦集成：**

Kthena 通过以下能力为 P/D 解耦提供基础设施支持：

- 解耦架构的原生 Kubernetes 工作负载管理
- 具有拓扑感知能力的预填充与解码组件协调调度
- 跨解耦推理阶段的资源优化
- 集成 Volcano 的批调度和 `subGroupPolicy`，实现高效、拓扑感知的工作负载放置
- 集成 LeaderWorkerSet，管理分布式推理中复杂的 leader-worker 关系

**生产优势：**

在 v1.0.0 中，Kthena 尤其适合构建具有 P/D 解耦需求的生产 LLM 推理平台的组织：

- 网络拓扑感知显著减少预填充与解码实例之间的通信开销
- 角色级 Gang 调度确保分布式工作负载原子部署
- 全面可观测性支持生产监控与调试
- 原生修订版本控制支持安全的金丝雀部署与回滚

v1.0.0 的自动扩缩 API 不向后兼容：`AutoscalingPolicyBinding` 已移除。升级前，现有目标必须迁移到 `AutoscalingPolicy.spec.homogeneousTarget`、`heterogeneousTarget` 或 `disaggregatedTarget`。

<a id="llm-d"></a>

### llm-d

[`llm-d`](https://github.com/llm-d/llm-d) 是可用于生产的 LLM 推理平台，使用双 LeaderWorkSet（LWS）架构实现 Prefill-Decode 解耦。作为 Kubernetes 上 P/D 解耦的参考实现，llm-d 展示了解耦式推理工作负载编排的最佳实践。

**关键架构：**

- **双 LWS 设计**：使用两个独立 LeaderWorkSet 实例：
  - 一个 LWS 用于预填充工作进程
  - 一个 LWS 用于解码工作进程
- **KV 缓存传输**：实现预填充与解码阶段之间的高效 KV 缓存传输
- **LMCache 集成**：支持 LMCache，用于 KV 缓存卸载与管理
- **路由边车**：包含 [`llm-d routing sidecar`](https://github.com/llm-d/llm-d-routing-sidecar)，实现智能请求路由和缓存优化

**P/D 解耦实现：**

llm-d 的双 LWS 架构实现：

- 预填充与解码工作负载独立扩缩
- 为各阶段优化资源分配
- 通过专用预填充工作进程减少 TTFT
- 通过隔离的解码工作进程提高解码吞吐量
- 在解耦组件之间高效管理 KV 缓存

**架构模式：**

```text
Client → Routing Sidecar → Prefill LWS → KV Cache (LMCache) → Decode LWS → Response
```

该架构展示了一种兼顾性能、可扩展性和运维简便性的生产级 P/D 解耦实现。

---

<a id="project-support-status"></a>

## 项目支持状态

<a id="nvidia-dynamo"></a>

### NVIDIA Dynamo

[`Dynamo`](https://github.com/ai-dynamo/dynamo) 是 NVIDIA 的高性能 LLM 推理引擎，提供企业级服务能力，全面支持 Prefill-Decode 解耦。

**P/D 解耦支持：**

- **已支持**：Dynamo 已实现 P/D 解耦，以提高性能与资源效率
- **多节点架构**：在 Kubernetes 部署中，Dynamo 支持基于 leader-worker 的拓扑，社区还添加了用于 Dynamo 运行时编排的 RoleBasedGroup 示例
- **设计文档**：
  [Disaggregation Serving](https://github.com/ai-dynamo/dynamo/blob/main/docs/design_docs/disagg_serving.md)
  \- 分离预填充与解码阶段的详细设计
- **功能比较**：
  [Feature Support Comparison](https://github.com/ai-dynamo/dynamo/blob/6deeecb1d6a9f4eb1770b4272bfa85a4b6226e0a/deploy/helm/README.md#feature-support-comparison)
  \- 展示解耦能力及其他功能

**关键实现：**

- 支持解耦式预填充与解码服务
  [#998](https://github.com/ai-dynamo/dynamo/pull/998)
- 增强的解耦特性
  [#1511](https://github.com/ai-dynamo/dynamo/pull/1511)
- 持续进行的统一工作
  [#1728](https://github.com/ai-dynamo/dynamo/issues/1728)
- RoleBasedGroup 集成指南（开放中）
  [#5457](https://github.com/ai-dynamo/dynamo/pull/5457)
- 配套项目中已合并 RoleBasedGroup Dynamo 示例
  [sgl-project/rbg#255](https://github.com/sgl-project/rbg/pull/255)

**架构：**

Dynamo 的解耦实现支持：

- 预填充与解码工作负载独立扩缩
- 优化 GPU 集群资源利用率
- 在多节点场景中使用 LWS 协调工作负载管理
- 集成 Kubernetes 的企业就绪部署

<a id="vllm-production-stack"></a>

### vLLM production stack

- vLLM 社区正在 [production-stack PR #340](https://github.com/vllm-project/production-stack/pull/340) 中探索更深入的原生集成。

<a id="aibrix"></a>

### AIBrix

- 进行中的 issue：
  [Add Prefill/Decode Disaggregation Support in Inference Gateway](https://github.com/vllm-project/aibrix/issues/1223) 和 [#958](https://github.com/vllm-project/aibrix/issues/958)。

<a id="kserve"></a>

### KServe

[`KServe`](https://github.com/kserve/kserve) 是 CNCF 孵化项目，提供 Kubernetes 原生平台，用于大规模部署和提供机器学习模型服务。KServe 通过其 LLMInferenceService CRD 以及与 llm-d 的集成，支持 LLM 推理和 P/D 解耦。

**当前能力：**

- **LMCache 集成**：基于 LMCache 的 KV 缓存卸载，改善 TTFT 和吞吐量
- **Chunked Prefill**：支持分块预填充，优化内存使用并减少延迟尖峰
- **LLMInferenceService CRD**：用于统一管理 LLM 推理服务的 Custom Resource Definition，原生支持 vLLM 和 LMCache

**结合 llm-d 的 P/D 解耦：**

KServe 通过与 [`llm-d`](https://github.com/llm-d/llm-d) 集成实现生产级 P/D 解耦：

- **双 LWS 架构**：llm-d 基于 KServe 的 InferenceService，为预填充与解码工作进程部署独立 LeaderWorkerSet
- **KV 缓存传输**：LMCache 处理预填充与解码阶段间的高效 KV 缓存移动
- **路由边车**：将请求智能地路由到预填充或解码工作进程，具备缓存感知能力
- **原生 Kubernetes 运维**：利用 KServe 现有能力实现金丝雀部署、缩容至零和流量拆分

完整联合架构讲解请参阅 [Best of Both Worlds: Cloud-Native AI Inference at Scale using KServe and llm-d](https://kserve.github.io/website/blog/cloud-native-ai-inference-kserve-llm-d)。

**架构：**

```text
Client → KServe InferenceService / Gateway
              ↓
    Routing Sidecar (cache-aware)
     ↙                   ↘
Prefill LWS          Decode LWS
(KV build)  →→→→  (KV reuse via LMCache)
```

**统一 LLM 推理服务 API：**

- P/D 解耦的声明式配置
- 自动编排预填充与解码服务
- 内建 KV 缓存管理和传输
- 与 KServe 推理图集成，实现复杂服务模式

<a id="lmcache"></a>

### LMCache

LMCache 是一种 LLM 服务引擎扩展，可减少 TTFT 并提高吞吐量，尤其适合长上下文场景。

- vLLM production stack、llm-d 和 KServe 均支持 LMCache。
- 稳定支持非前缀 KV 缓存。

---

<a id="scaling-pd-workloads"></a>

## P/D 工作负载扩缩

解耦式 Prefill/Decode 工作负载的扩缩面临独特挑战，不同于传统一体式推理部署。本节探讨标准自动扩缩方法的局限，并介绍用于优化 P/D 配置的工具。

<a id="challenges-with-traditional-autoscaling"></a>

### 传统自动扩缩的挑战

传统 Kubernetes 自动扩缩机制，例如 Horizontal Pod Autoscaler（HPA）和 Knative Pod Autoscaler（KPA），应用于 P/D 解耦工作负载时有明显局限：

**主要挑战：**

- **独立的阶段特征**：预填充和解码阶段具有不同的资源利用模式与性能特征。标准自动扩缩器无法根据各阶段特有指标（预填充的 TTFT、解码的 TPOT）独立优化。

- **复杂配置空间**：解耦部署需要决定：
  - 预填充工作进程与解码工作进程的数量
  - 每个阶段的并行策略（张量并行、流水线并行）
  - 各阶段优化的批量大小
  - 各阶段之间的 GPU 分配

- **相互依赖的扩缩**：预填充与解码组件必须协调扩缩，才能保持最优吞吐量与延迟。只扩缩一方而不考虑另一方，可能产生瓶颈或浪费资源。

- **SLA 感知**：传统自动扩缩器不理解 TTFT（Time to First Token，首 token 时间）和 TPOT（Time per Output Token，每输出 token 时间）等 LLM 特定 SLA 目标，而这些目标对解耦式服务的用户体验至关重要。

- **资源异构性**：P/D 工作负载往往受益于异构 GPU 分配（例如解码使用的 GPU 多于预填充），标准自动扩缩器不会对此进行优化。

**HPA/KPA 不足的原因：**

- **响应式而非预测式**：对当前指标作出反应，而非根据工作负载特征主动优化
- **没有配置优化**：扩缩副本数，但不优化底层配置（并行策略、批量大小等）
- **侧重单一指标**：通常根据 CPU/GPU 利用率或请求速率扩缩，忽略 TTFT、TPOT 与吞吐量之间的复杂相互作用

<a id="configuration-optimization-with-aiconfigurator"></a>

### 使用 AIConfigurator 优化配置

NVIDIA 的 [`AIConfigurator`](https://github.com/ai-dynamo/aiconfigurator) 通过离线优化解耦部署配置应对这些挑战。它帮助在部署前确定最优配置，而非依赖响应式自动扩缩。

**AIConfigurator 工作原理：**

AIConfigurator 通过以下方式搜索解耦式服务部署的配置空间：

1. **LLM 推理性能建模**：使用为目标硬件采集的数据，估计不同配置的执行时间
2. **配置空间搜索**：评估数千种组合：
   - 预填充与解码工作进程数量
   - 并行策略（TP、PP、DP）
   - 各阶段批量大小
   - GPU 分配模式
3. **SLA 约束优化**：寻找在满足 TTFT 和 TPOT 目标的同时最大化吞吐量的配置
4. **Pareto 前沿分析**：识别吞吐量、延迟和资源利用率之间的权衡

**主要特性：**

- **xPyD 配置规划**：确定最优副本配置，每个副本由 x 个预填充工作进程和 y 个解码工作进程组成
- **硬件特定优化**：利用采集的性能数据支持多种 GPU 类型（H100、H200、B200 等）
- **量化支持**：按组件评估不同量化策略（FP16、FP8、INT4 等）
- **生成部署文件**：为 Dynamo 部署生成可直接使用的配置文件

**使用示例：**

```bash
# Find optimal configuration for Qwen3-32B on 32 H200 GPUs
# with SLA targets: TTFT ≤ 300ms, TPOT ≤ 10ms
aiconfigurator cli default \
  --model QWEN3_32B \
  --total_gpus 32 \
  --system h200_sxm \
  --isl 4000 \
  --osl 500 \
  --ttft 300 \
  --tpot 10
```

**对 P/D 工作负载的优势：**

- **有依据的扩缩决策**：提供数据驱动的见解，指导如何扩缩预填充与解码组件
- **配置模板**：生成最优起始配置，可作为自动扩缩策略的基线
- **性能预测**：部署前估计吞吐量与延迟，减少试错
- **资源效率**：识别在满足 SLA 目标的同时最大化 GPU 利用率的配置

**与自动扩缩集成：**

虽然 AIConfigurator 是离线工具，其输出仍可以指导自动扩缩策略：

- 使用 AIConfigurator 为不同负载水平建立基线配置
- 配置自动扩缩器，根据工作负载模式在 AIConfigurator 优化的配置之间切换
- 利用 AIConfigurator 的分析，为预填充与解码工作进程设置适当扩缩阈值和副本比例

该方法将 AIConfigurator 的预测式优化与 Kubernetes 自动扩缩的响应能力结合，更有效地管理 P/D 工作负载。

<a id="sla-based-scheduling-in-kubernetes"></a>

### Kubernetes 中基于 SLA 的调度

Kubernetes 正通过 [KEP-5471: Extended Toleration Operators for Threshold-Based Placement](https://github.com/kubernetes/enhancements/pull/5473) 引入原生的基于 SLA 的调度能力。该增强允许 Pod 在 toleration 中使用数值比较表达 SLA 要求，提供 Kubernetes 原生的 SLA 感知调度机制。

**关键能力：**

- **数值比较操作符**：扩展 toleration，支持 `Lt`（小于）和 `Gt`（大于）操作符，以匹配具有数值的节点 taint
- **基于 SLA 阈值的放置**：允许 Pod 指定最低 SLA 要求（例如“仅调度到 SLA > 95% 的节点”）
- **驱逐支持**：结合 `NoExecute` taint effect，在节点 SLA 降至阈值以下时自动驱逐 Pod
- **特性门控**：`TaintTolerationComparisonOperators`（Kubernetes v1.35 中为 alpha）

**与 P/D 工作负载的关系：**

对于解耦式 P/D 部署，基于 SLA 的调度提供细粒度工作负载放置控制：

- **预填充阶段**：可以要求高 SLA 节点，以尽量降低 TTFT，并确保初始 token 生成延迟一致
- **解码阶段**：可能容忍较低 SLA 节点，以优化成本，同时保持可接受的 TPOT
- **异构集群**：允许混合按需（高 SLA）和竞价（低 SLA）节点，根据可靠性要求自动引导工作负载

**P/D 工作负载使用示例：**

```yaml
# High-SLA on-demand node with 95% SLA taint
apiVersion: v1
kind: Node
metadata:
  name: ondemand-gpu-node-1
spec:
  taints:
  - key: node.kubernetes.io/sla
    value: "950"  # 95.0% SLA
    effect: NoExecute
---
# Prefill pod requires SLA > 95% with eviction support
apiVersion: v1
kind: Pod
metadata:
  name: prefill-worker
spec:
  tolerations:
  - key: node.kubernetes.io/sla
    operator: Gt
    value: "950"
    effect: NoExecute
    tolerationSeconds: 30  # Grace period before eviction
  containers:
  - name: prefill
    image: inference-engine:latest
    args: ["--mode=prefill"]
---
# Decode pod tolerates lower SLA for cost savings
apiVersion: v1
kind: Pod
metadata:
  name: decode-worker
spec:
  tolerations:
  - key: node.kubernetes.io/sla
    operator: Gt
    value: "800"  # 80% SLA acceptable
    effect: NoExecute
    tolerationSeconds: 60
  containers:
  - name: decode
    image: inference-engine:latest
    args: ["--mode=decode"]
```

**与 AIConfigurator 集成：**

基于 SLA 的调度通过提供运行时放置控制补充 AIConfigurator：

1. **离线规划**：AIConfigurator 为不同 SLA 层级确定最优 xPyD 配置与资源分配
2. **运行时执行约束**：基于 SLA 的 toleration 确保工作负载放置在满足其可靠性要求的节点上
3. **动态适应**：具有 `NoExecute` effect 的 taint 在节点 SLA 下降时触发自动 Pod 驱逐，实现优雅故障转移
4. **成本优化**：将 AIConfigurator 的吞吐量优化与基于 SLA 的放置结合，平衡性能与基础设施成本

该组合使生产级 P/D 部署在异构 GPU 集群中具备可预测性能、自动故障处理和高效资源利用率。

---

<a id="references"></a>

## 参考资料

- <https://github.com/kubernetes-sigs/lws>
- <https://github.com/llm-d/llm-d>
- <https://github.com/llm-d/llm-d-routing-sidecar>
- <https://github.com/sgl-project/rbg>
- <https://github.com/sgl-project/rbg/pull/255>
- <https://github.com/sgl-project/rbg/tree/main/examples/inference/ecosystem/dynamo>
- <https://github.com/volcano-sh/kthena>
- <https://github.com/ai-dynamo/dynamo>
- <https://github.com/ai-dynamo/dynamo/pull/5457>
- <https://github.com/ai-dynamo/aiconfigurator>
- <https://github.com/kubernetes/enhancements/pull/5473> - KEP-5471：扩展 toleration 操作符以支持基于阈值的放置（基于 SLA 的调度）
- <https://github.com/vllm-project/vllm>
- <https://github.com/vllm-project/production-stack>
- <https://github.com/vllm-project/aibrix>
- <https://github.com/kserve/kserve>
- <https://kserve.github.io/website/blog/cloud-native-ai-inference-kserve-llm-d>
  \- Best of Both Worlds：使用 KServe 和 llm-d 实现大规模云原生 AI 推理
- <https://github.com/LMCache/lmcache>
- DistServe（OSDI'24）：<https://www.usenix.org/system/files/osdi24-zhong-yinmin.pdf>

**部分内容由 ChatGPT 生成，因此使用前请谨慎。这些是个人学习笔记。**

> **译者注（原文快照）：** 本文按所标注 source_commit 的原文翻译；项目支持状态、PR 进度、版本、API、调度能力与性能相关描述均为原文快照，未独立验证，不代表当前状态或实测结果。
