---
status: Active
maintainer: pacoxu
last_updated: 2025-10-29
tags: inference, ome, kubernetes-operator, llm-management
canonical_path: docs/inference/ome.md
source_path: docs/inference/ome.md
source_commit: 3cc83ef18ed502929e55d0e598129c7525e5f993
translation_status: translated
---

<a id="ome-kubernetes-operator-for-llm-management"></a>
# OME：用于 LLM 管理的 Kubernetes Operator

OME 是一个功能全面的 Kubernetes operator，旨在为大语言模型（LLM）提供企业级管理和服务。OME 由 SGL 项目团队开发，通过自动化模型管理、智能运行时选择和复杂部署模式，优化 LLM 的部署与运行。

<a id="overview"></a>
## 概述

[`OME`](https://github.com/sgl-project/ome) 将模型视为一等 Kubernetes 自定义资源，支持复杂的模型解析、自动运行时选择，以及包括 prefill-decode 解耦在内的高级部署模式，因此在 LLM 推理领域独具特色。

**注意**：[贡献者页面](https://github.com/sgl-project/ome/graphs/contributors)显示，截至目前，这是一个单人项目（104/168 次提交）。

<a id="key-features"></a>
## 核心功能

<a id="model-management"></a>
### 模型管理

- **一等自定义资源**：将模型作为原生 Kubernetes 资源管理，并全面提取元数据
- **架构检测**：自动解析模型文件，提取架构、参数量和能力
- **多格式支持**：支持 SafeTensors、PyTorch、TensorRT 和 ONNX 模型格式
- **分布式存储**：通过自动修复、双重加密和命名空间作用域，保障模型存储安全

<a id="intelligent-runtime-selection"></a>
### 智能运行时选择

- **自动匹配**：通过加权评分系统，将模型匹配到最优运行时配置
- **多因素分析**：考虑架构、格式、量化、参数规模和框架兼容性
- **性能优化**：确保每个模型运行在最合适的推理引擎上

<a id="advanced-deployment-patterns"></a>
### 高级部署模式

- **Prefill-Decode 解耦**：支持复杂的 PD 解耦，以提高资源利用率
- **多节点推理**：将大模型分布到多个节点
- **传统部署**：具备高级扩缩容控制的标准 Kubernetes 部署

<a id="resource-optimization"></a>
### 资源优化

- **GPU 装箱**：通过专用调度算法，实现最优 GPU 利用率
- **动态再优化**：在保持高可用性的同时，持续优化集群效率
- **智能资源分配**：最大化异构环境中的硬件利用率

<a id="runtime-integrations"></a>
## 运行时集成

<a id="sglang-first-class-support"></a>
### SGLang（一等支持）

OME 与 [`SGLang`](https://github.com/sgl-project/sglang) 深度集成，提供：

- 缓存感知负载均衡
- 多节点部署能力
- Prefill-decode 解耦式服务
- 多 LoRA 适配器服务
- 高级推理优化

<a id="vllm-support"></a>
### vLLM 支持

OME 支持将 [`vLLM`](https://github.com/vllm-project/vllm) 作为高性能运行时选项，并提供用于优化 LLM 服务的[预置配置](https://github.com/sgl-project/ome/tree/main/config/runtimes/vllm)。

<a id="kubernetes-ecosystem-integration"></a>
## Kubernetes 生态集成

OME 与现代 Kubernetes 组件深度集成：

- **[Kueue](https://kueue.sigs.k8s.io/)**：用于多 Pod 工作负载的成组调度
- **[LeaderWorkerSet](https://github.com/kubernetes-sigs/lws)**：具有韧性的多节点部署
- **[KEDA](https://keda.sh/)**：基于自定义指标的高级自动扩缩容
- **[K8s Gateway API](https://gateway-api.sigs.k8s.io/)**：复杂流量路由
- **[Gateway API Inference Extension](https://gateway-api-inference-extension.sigs.k8s.io/)**：标准化推理端点

<a id="core-architecture"></a>
## 核心架构

OME 采用基于 Kubernetes 自定义资源的组件化架构：

<a id="custom-resources"></a>
### 自定义资源

- **BaseModel/ClusterBaseModel**：定义模型来源和元数据
- **ServingRuntime/ClusterServingRuntime**：定义模型如何提供服务
- **InferenceService**：将模型连接到运行时以进行部署
- **BenchmarkJob**：衡量模型在不同工作负载下的性能

<a id="automated-workflow"></a>
### 自动化工作流

1. **模型发现**：下载并解析模型，以了解其特征
2. **运行时选择**：为每个模型选择最优运行时配置
3. **资源生成**：生成 Kubernetes 资源以实现高效部署
4. **持续优化**：优化整个集群的资源利用率

<a id="production-readiness"></a>
## 生产就绪性

OME 已具备生产就绪能力，包括：

- ✅ API 版本：v1beta1
- ✅ 完整文档
- ✅ 单元测试和集成测试覆盖
- ✅ 大规模生产部署
- ✅ 标准 Kubernetes 监控与事件
- ✅ 基于 RBAC 的安全机制和模型加密
- ✅ 通过冗余存储实现高可用性

<a id="installation"></a>
## 安装

<a id="requirements"></a>
### 要求

需要 Kubernetes 1.28 或更新版本

<a id="quick-start-oci-registry"></a>
### 快速开始（OCI 注册表）

```bash
# Install OME CRDs
helm upgrade --install ome-crd oci://ghcr.io/moirai-internal/charts/ome-crd \
  --namespace ome --create-namespace

# Install OME resources
helm upgrade --install ome oci://ghcr.io/moirai-internal/charts/ome-resources \
  --namespace ome
```

<a id="helm-repository"></a>
### Helm 仓库

```bash
# Add repository
helm repo add ome https://sgl-project.github.io/ome
helm repo update

# Install components
helm upgrade --install ome-crd ome/ome-crd \
  --namespace ome --create-namespace
helm upgrade --install ome ome/ome-resources --namespace ome
```

<a id="learning-topics"></a>
## 学习主题

- Kubernetes 自定义资源开发与模式
- LLM 推理优化策略
- 多节点分布式服务架构
- 资源调度与装箱算法
- 模型管理与元数据提取
- Kubernetes 中的生产 MLOps 模式

<a id="comparison-with-other-platforms"></a>
## 与其他平台的比较

OME 的差异化体现在：

- **原生 Kubernetes 集成**：基于 CRD 的深度架构，而非外部编排
- **智能运行时选择**：自动匹配，而非手动配置
- **高级部署模式**：内建 PD 解耦与多节点支持
- **模型优先设计**：将模型视为一等资源，而非以部署为中心的方法

<a id="roadmap"></a>
## 路线图

- 增强模型解析，以支持更多模型家族和架构
- 支持模型量化与优化工作流
- 跨多个 Kubernetes 集群的联邦
- 扩展运行时生态集成

<a id="references"></a>
## 参考资料

- [OME GitHub 仓库](https://github.com/sgl-project/ome)
- [OME 文档](https://sgl-project.github.io/ome/docs/)
- [SGLang 项目](https://github.com/sgl-project/sglang)
- [安装指南](https://sgl-project.github.io/ome/docs/installation/)
- [API 参考](https://sgl-project.github.io/ome/docs/reference/ome.v1beta1/)

---

**注意**：本文档概述了 OME 的能力。详细实施指导和高级配置请参阅 OME 官方文档。
