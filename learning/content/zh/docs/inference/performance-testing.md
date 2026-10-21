---
status: Active
maintainer: pacoxu
last_updated: 2025-11-04
tags: performance, testing, benchmark, inference, llm
canonical_path: docs/inference/performance-testing.md
source_path: docs/inference/performance-testing.md
source_commit: 3cc83ef18ed502929e55d0e598129c7525e5f993
translation_status: translated
---

# AI/LLM 推理的性能测试与基准测试工具

性能测试和基准测试对于验证和优化大规模 AI/LLM 推理系统至关重要。本指南介绍在 Kubernetes 和云原生环境中测试推理性能、测量吞吐量、延迟和资源利用率的主要工具与框架。

## 概述

AI 推理性能测试涉及以下指标的测量：

- **吞吐量**：每秒请求数（RPS）或每秒 token 数（TPS）
- **延迟**：首 token 时间（TTFT）、每个输出 token 的耗时（TPOT）、token 间延迟（ITL）
- **资源利用率**：GPU/CPU 使用率、内存消耗、网络带宽
- **可扩展性**：不同负载和集群规模下的性能
- **成本效率**：单位费用所获得的性能、资源优化

## Kubernetes 原生性能测试工具

### kubernetes-sigs/inference-perf

[`inference-perf`](https://github.com/kubernetes-sigs/inference-perf) 是 Kubernetes SIG Serving 开发的 Kubernetes 原生性能测试框架。它提供了一套标准化方法，用于对 Kubernetes 环境中的推理工作负载进行基准测试。

**主要特性：**

- Kubernetes 原生设计，使用 CRD 配置测试
- 支持多种推理框架（vLLM、TensorRT-LLM、TGI 等）
- 标准化的指标采集与报告
- 与 Kubernetes 调度和资源管理集成
- 面向云原生推理平台设计

**使用场景：**

- 对 Kubernetes 上的 LLM 服务平台进行基准测试
- 在生产部署前验证推理性能
- 比较不同推理引擎和配置
- 测试负载下的自动扩缩容行为

**相关资源：**

- [WG Serving 提案 013](https://github.com/kubernetes-sigs/wg-serving/tree/main/proposals/013-inference-perf)：inference-perf 的设计文档

### Azure/kperf

[`kperf`](https://github.com/Azure/kperf) 是 Microsoft Azure 开发的 Kubernetes 性能基准测试工具。虽然它并非专为 AI 工作负载设计，但提供了全面的集群性能测试能力。

**主要特性：**

- 集群级性能测试
- Pod 调度和启动延迟测量
- 资源争用测试
- 网络和存储性能基准测试
- 支持大规模集群测试

**使用场景：**

- 验证 Kubernetes 集群运行 AI 工作负载时的性能
- 测试推理服务的 Pod 调度延迟
- 测量集群资源限制与可扩展性
- 对节点供给与自动扩缩容进行基准测试

### NVIDIA/knavigator

[`knavigator`](https://github.com/NVIDIA/knavigator) 是 NVIDIA 的 Kubernetes 集群性能测试工具，旨在验证 GPU 工作负载性能和集群行为。

**主要特性：**

- GPU 专项性能测试
- 集群混沌测试与压力测试
- 作业调度性能验证
- GPU 资源分配测试
- 大规模集群模拟

**使用场景：**

- 测试 GPU 集群运行 AI 工作负载时的性能
- 验证 GPU 调度器行为
- 对 AI 训练和推理集群进行压力测试
- 测量 GPU 资源分配延迟

## 推理引擎专用基准测试工具

### Triton Inference Server 性能工具

NVIDIA Triton Inference Server 提供了全面的性能测试工具：

#### triton-inference-server/perf_analyzer

[`perf_analyzer`](https://github.com/triton-inference-server/perf_analyzer) 是 Triton Inference Server 的标准性能测试工具。

**主要特性：**

- 全面的推理性能指标
- 支持多种模型格式（TensorRT、ONNX、PyTorch 等）
- 并发请求测试
- 延迟与吞吐量分析
- 自定义请求载荷生成

**使用场景：**

- 对 Triton 推理性能进行基准测试
- 优化模型服务配置
- 比较不同模型格式
- 对推理端点进行负载测试

#### genai-perf

[`genai-perf`](https://github.com/triton-inference-server/perf_analyzer/blob/main/genai-perf/README.md) 是专门用于大语言模型（LLM）和生成式 AI 推理基准测试的工具。

**主要特性：**

- LLM 专用指标（TTFT、TPOT、ITL）
- 支持流式推理和批量推理
- token 级性能分析
- 支持多种 LLM 框架（vLLM、TGI、TensorRT-LLM）
- 生成贴近实际的工作负载

**使用场景：**

- 对 LLM 服务性能进行基准测试
- 测量 token 生成延迟
- 测试流式推理端点
- 比较 LLM 推理引擎

### vLLM 基准测试工具

#### vllm-project/vllm benchmark_serving.py

[`benchmark_serving.py`](https://github.com/vllm-project/vllm/blob/main/benchmarks/benchmark_serving.py) 是 vLLM 自带的基准测试脚本，用于测试服务性能。

**主要特性：**

- 与 vLLM 原生集成
- 支持兼容 OpenAI 的 API 测试
- 可配置的请求模式与负载曲线
- token 生成指标
- 吞吐量与延迟分析

**使用场景：**

- 对 vLLM 服务部署进行基准测试
- 测试不同的 vLLM 配置
- 测量不同负载模式下的性能
- 比较 vLLM 与其他推理引擎

### fmperf-project/fmperf

[`fmperf`](https://github.com/fmperf-project/fmperf) 是面向基础模型（FM）和大语言模型的综合基准测试框架。

**主要特性：**

- 支持多种框架（vLLM、TGI、TensorRT-LLM 等）
- 标准化基准测试套件
- 贴近实际的工作负载模式
- 全面的指标采集
- 性能对比报告

**使用场景：**

- 比较不同的 LLM 推理引擎
- 对基础模型进行标准化基准测试
- 模拟生产工作负载
- 性能回归测试

## 云平台专用工具

### GCP latency-profile-generator

[`latency-profile-generator`](https://github.com/GoogleCloudPlatform/ai-on-gke/tree/main/benchmarks/benchmark/tools/profile-generator) 是 Google Cloud 的工具，用于为 AI 推理工作负载生成贴近实际的延迟分布特征。

**主要特性：**

- 生成贴近实际的请求模式
- GCP 专项优化
- 与 GKE 和 Vertex AI 集成
- 为自动扩缩容分析工作负载特征
- 自定义延迟分布建模

**使用场景：**

- 为 GCP AI 服务生成测试工作负载
- 分析生产流量模式
- 测试自动扩缩容配置
- 为 GKE AI 工作负载进行容量规划

## 负载测试与压力测试工具

### openshift-psap/llm-load-test

[`llm-load-test`](https://github.com/openshift-psap/llm-load-test) 是 Red Hat 的 OpenShift PSAP 团队开发的负载测试框架，专为 LLM 推理服务设计。

**主要特性：**

- Kubernetes 原生负载测试
- LLM 专用工作负载模式
- 支持 OpenShift 和 Kubernetes
- 指标采集与可视化
- 与 AI 推理平台集成

**使用场景：**

- 对 OpenShift/Kubernetes 上的 LLM 服务进行负载测试
- 验证是否具备生产就绪条件
- 对推理端点进行压力测试
- 容量规划与资源规格估算

## 行业标准与基准测试

### MLCommons Inference

[`MLCommons Inference`](https://docs.mlcommons.org/inference/) 提供跨不同硬件和软件平台的标准化 AI 推理基准测试。

**主要特性：**

- 行业标准基准测试套件
- 多种模型类别（计算机视觉、自然语言处理、推荐系统）
- 不依赖特定硬件或软件
- 通过严格规范保证结果可复现
- 官方性能排行榜

**使用场景：**

- 比较用于 AI 推理的硬件平台
- 依据行业标准验证推理性能
- 支持硬件采购决策
- 性能宣传与验证

### sgl-project/genai-bench

[`genai-bench`](https://github.com/sgl-project/genai-bench) 是 SGLang 项目开发的综合基准测试套件，面向生成式 AI 工作负载。

**主要特性：**

- 聚焦生成式 AI 工作负载
- 多种模型类型（LLM、视觉、多模态）
- 贴近实际的任务评估
- 与主流推理框架集成
- 性能与质量指标

**使用场景：**

- 对生成式 AI 应用进行基准测试
- 比较多模态模型的推理引擎
- 评估端到端应用性能
- 分析质量与性能之间的权衡

## 性能测试最佳实践

### 测试环境设置

- **一致的硬件**：使用专用 GPU 节点或一致的实例类型
- **网络隔离**：尽量减少测试期间的网络干扰
- **预热期**：在采集指标前让模型充分预热
- **多次运行**：执行多轮测试，以获得统计显著性

### 指标采集

- **延迟分位数**：跟踪 P50、P90、P95、P99 延迟
- **负载下的吞吐量**：测量不同负载水平下的 RPS/TPS
- **资源利用率**：监控 GPU、CPU、内存和网络使用情况
- **错误率**：跟踪请求失败率与超时率

### 工作负载设计

- **真实模式**：使用接近生产环境的请求模式
- **可变输入长度**：使用不同的输入 token 长度进行测试
- **批量与流式**：同时测试批量推理和流式推理模式
- **并发请求**：测量并发负载下的性能

### 比较与验证

- **基线指标**：建立用于比较的性能基线
- **配置测试**：测试不同模型配置（批量大小、精度等）
- **框架比较**：使用相同模型比较不同推理引擎
- **成本分析**：计算单位费用所获得的性能指标

## 学习主题

- 理解推理性能指标（TTFT、TPOT、ITL）
- Kubernetes 原生性能测试策略
- GPU 性能剖析与优化
- 基于推理指标的自动扩缩容
- 比较推理引擎与部署策略
- 生产负载测试与容量规划

## KubeCon 参考资料

- [KubeCon EU 2025：AI/ML 工作负载的性能测试](https://kccnceu2025.sched.com/event/1tx7Q)

## 补充资源

- [关于 LLM 性能测试的中文文章](https://mp.weixin.qq.com/s/6vfE_VGF66vDmh2R4RTC1g)
- Kubernetes SIG Serving 关于推理性能的文档
- NVIDIA 推理工作负载优化指南
- 云服务商的 AI 推理最佳实践

## 相关文档

- [推理指南](./README.md)：推理引擎与平台概述
- [模型生命周期](./model-lifecycle.md)：冷启动优化与模型管理
- [缓存](./caching.md)：用于提升性能的 KV 缓存优化
- [AIBrix](./aibrix.md)：具有内建性能优化能力的云原生 LLM 推理

---

**注意：** 本指南部分内容在 AI 辅助下生成。在生产环境使用之前，请核实工具版本、特性和链接。

> **译者注（原文版本状态，未独立核实）：** 本文保留原文对各工具归属、功能和脚本路径的描述；这些信息不代表已经核实的当前项目状态。
