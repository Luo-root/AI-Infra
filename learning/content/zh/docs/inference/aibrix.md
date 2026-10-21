---
status: Active
maintainer: pacoxu
last_updated: 2026-07-24
tags: inference, aibrix, vllm, llm-serving, lora
canonical_path: docs/inference/aibrix.md
source_path: docs/inference/aibrix.md
source_commit: 3cc83ef18ed502929e55d0e598129c7525e5f993
translation_status: translated
---

# AIBrix：云原生 LLM 推理基础设施

[`AIBrix`](https://github.com/vllm-project/aibrix) 是一个开源项目，旨在提供构建可扩展生成式 AI（GenAI）推理基础设施所需的基础组件。AIBrix 提供一种云原生解决方案，专门针对企业需求进行设计，并针对大语言模型（LLM）推理的部署、管理和扩缩容进行了优化。

## 概述

AIBrix 是 vLLM 项目生态的一部分，专注于为大规模 LLM 推理提供企业级基础设施。它通过高级路由、自动扩缩容和分布式推理等能力，应对在生产环境中部署和管理 LLM 工作负载的挑战。

## 核心功能

- **高密度 LoRA 管理**：简化对轻量级模型低秩适配的支持
- **LLM 网关与路由**：高效管理流量，并将其分配到多个模型和副本
- **面向 LLM 应用定制的自动扩缩容器**：根据实时需求动态调整推理资源规模
- **统一 AI 运行时**：通过多功能边车（sidecar）提供指标标准化、模型下载和管理能力
- **分布式推理**：利用可扩展架构，跨多个节点处理大规模工作负载
- **分布式 KV 缓存**：支持大容量、跨引擎的 KV 复用
- **高性价比异构模型服务**（实验性）：在保证服务等级目标（SLO）的前提下，使用混合 GPU 进行推理以降低成本
- **GPU 硬件故障检测**：主动检测 GPU 硬件问题

## 架构

AIBrix 采用面向 Kubernetes 环境设计的云原生架构。系统由多个协同工作的组件构成，共同提供完整的 LLM 推理平台：

- **控制平面**：管理推理工作负载的生命周期
- **网关**：处理请求路由和负载均衡
- **运行时**：管理模型服务和资源分配
- **自动扩缩容器**：根据 LLM 专用指标进行智能扩缩容

## 学习主题

- 感知 LLM 特性的负载均衡与路由
- 动态 LoRA 切换与管理
- 分布式推理架构
- GPU 资源优化与故障检测
- 高性价比异构模型服务策略
- 企业级 LLM 部署模式

## 项目状态

> **译者注：** 本文的版本及项目状态信息是原文于 **2026-07-24** 更新时的快照，并非对阅读时最新状态的核实；下文的“当前版本”和安装命令也沿用该快照。

- **当前版本**：v0.7.0（截至 2026 年 6 月）
- **许可证**：Apache 2.0
- **成熟度**：积极开发中，定期发布版本
- **社区**：属于 vLLM 项目，设有专用 Slack 频道

## Prefill/Decode 分离支持

AIBrix v0.4.0 引入了完整的 Prefill/Decode（P/D，预填充／解码）分离支持，借助 StormService 和 RoleSet CRD 对 P/D 角色进行细粒度编排，并结合路由能力实现大规模分离式推理。这些能力现已纳入当前的 v0.7.0 发布系列。

核心功能包括：

- StormService 和 RoleSet 自定义资源定义（CRD）
- 对 Prefill 和 Decode 角色进行细粒度编排  
- 面向分离式推理的高级路由能力
- 面向大规模部署的可扩展架构

该功能通过 v0.4.0 版本中的多个 PR 交付，包括对控制平面、网关路由和分布式推理能力的增强。

更多详情请参阅 [PD 分离](./pd-disaggregation.md)。

## 入门

### 快速安装

```bash
# Install component dependencies
AIBRIX_VERSION="v0.7.0"
GITHUB_BASE="https://github.com/vllm-project/aibrix/releases/download"
kubectl apply -f \
  "${GITHUB_BASE}/${AIBRIX_VERSION}/aibrix-dependency-${AIBRIX_VERSION}.yaml" \
  --server-side

# Install AIBrix components  
kubectl apply -f \
  "${GITHUB_BASE}/${AIBRIX_VERSION}/aibrix-core-${AIBRIX_VERSION}.yaml"
```

### 开发环境搭建

```bash
# Clone the repository
git clone https://github.com/vllm-project/aibrix.git
cd aibrix

# Install nightly dependencies
kubectl apply -k config/dependency --server-side

# Install nightly components
kubectl apply -k config/default
```

## 资源

- **文档**：[aibrix.readthedocs.io](https://aibrix.readthedocs.io/latest/)
- **博客**：[aibrix.github.io](https://aibrix.github.io/)
- **白皮书**：[arxiv.org/abs/2504.03648](https://arxiv.org/abs/2504.03648)
- **Slack**：[#aibrix](https://vllm-dev.slack.com/archives/C08EQ883CSV)
- **GitHub**：[vllm-project/aibrix](https://github.com/vllm-project/aibrix)

## 重要演讲

- **KubeCon China 2025**：[AIBrix：面向 vLLM、兼顾成本效益与可扩展性的 Kubernetes 控制平面](https://kccncchn2025.sched.com/event/1x5im/)
- **KubeCon EU 2025**：[Kubernetes 中感知 LLM 特性的负载均衡：效率新纪元](https://kccnceu2025.sched.com/event/1txC7/)（与 Google 联合进行的主题演讲）
- **ASPLOS'25 研讨会**：[AIBrix：面向系统研究的开源大规模 LLM 推理基础设施](https://docs.google.com/presentation/d/1YDVsPFTIgGXnROGaJ1VKuDDAB4T5fzpE/edit)
- **FORCE 大会**：[AIBrix 基于vLLM的高性价比LLM推理加速方案—FORCE大会直播回放](https://www.bilibili.com/video/BV1q6MezaEtP/)（中文）

---

**注意**：部分内容可能由 AI 工具生成。在生产环境中使用前，请核实相关信息。
