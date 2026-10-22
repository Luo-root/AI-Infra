---
status: Active
maintainer: pacoxu
last_updated: 2025-10-29
tags: training, kubeflow, pytorch, tensorflow, ml-operators
canonical_path: docs/training/kubeflow.md
source_path: docs/training/kubeflow.md
source_commit: 3cc83ef18ed502929e55d0e598129c7525e5f993
translation_status: translated
---

<a id="kubeflow-for-ai-training-management"></a>

# 使用 Kubeflow 管理 AI 训练

<a id="overview"></a>

## 概述

<a href="https://github.com/kubeflow/kubeflow">`Kubeflow`</a> 是一个 CNCF 孵化项目，为 Kubernetes 提供全面的机器学习平台。它简化了 Kubernetes 上 ML 工作流的部署和管理，让数据科学家和 ML 工程师能够更轻松地大规模构建、训练和部署模型。

<a id="kubeflow-ecosystem"></a>

## Kubeflow 生态系统

Kubeflow 生态系统由多个关键组件构成，旨在覆盖完整的 ML 生命周期：

<a id="core-components"></a>

### 核心组件

- <a href="https://github.com/kubeflow/kubeflow">`Kubeflow`</a>：编排 ML 生命周期的核心平台（CNCF 孵化项目）
- <a href="https://github.com/kubeflow/pipelines">`Kubeflow Pipelines`</a>：ML 工作流编排和实验
- <a href="https://github.com/kubeflow/katib">`Katib`</a>：超参数调优和神经架构搜索（AutoML）
- <a href="https://github.com/kubeflow/notebooks">`Kubeflow Notebooks`</a>：交互式开发环境（Jupyter notebooks）
- <a href="https://github.com/kserve/kserve">`KServe`</a>：模型服务平台（前身为 KFServing，CNCF 孵化项目）
- <a href="https://github.com/kubeflow/metadata">`Kubeflow Metadata`</a>：ML 元数据和制品跟踪
- <a href="https://github.com/kubeflow/mpi-operator">`MPI Operator`</a>：MPI 风格的分布式训练支持
- <a href="https://github.com/kubeflow/training-operator">`Training Operator`</a>：面向多种框架的统一训练 Operator

<a id="integration-components"></a>

### 集成组件

- <a href="https://argoproj.github.io/">`Argo Workflows`</a>：工作流引擎（Kubeflow Pipelines 的替代方案）
- <a href="https://min.io/">`MinIO`</a>：用于制品和模型的对象存储
- <a href="https://github.com/istio/istio">`Istio`</a>：用于网络和安全的服务网格
- <a href="https://knative.dev/">`Knative`</a>：无服务器工作负载支持
- <a href="https://www.kubeflow.org/docs/components/central-dash/">`Central Dashboard`</a>：Kubeflow 组件的统一 Web UI
- <a href="https://github.com/dexidp/dex">`Dex`</a>：用于身份认证的身份服务
- <a href="https://cert-manager.io/">`cert-manager`</a>：TLS 证书管理

<a id="kubeflow-training-operator"></a>

## Kubeflow Training Operator

<a href="https://github.com/kubeflow/training-operator">`Training Operator`</a>（前身为 TF Operator、PyTorch Operator 等）为多种 ML 框架的分布式训练提供 Kubernetes 原生支持。

<a id="supported-frameworks"></a>

### 支持的框架

- **PyTorch**（`PyTorchJob`）：分布式 PyTorch 训练，原生支持 DDP、FSDP 和弹性训练
- **TensorFlow**（`TFJob`）：分布式 TensorFlow 训练，支持参数服务器和 all-reduce 策略
- **XGBoost**（`XGBoostJob`）：用于梯度提升的分布式 XGBoost 训练
- **MPI**（`MPIJob`）：基于 MPI 的分布式训练（Horovod、DeepSpeed）
- **PaddlePaddle**（`PaddleJob`）：分布式 PaddlePaddle 训练
- **JAX**（`JAXJob`）：对 JAX 分布式训练的实验性支持

<a id="key-features"></a>

### 主要特性

- **Gang 调度**：全有或全无的调度方式确保所有副本一同启动
- **容错**：自动重启策略和弹性训练支持
- **资源管理**：GPU 和分布式存储集成
- **多租户**：命名空间隔离和资源配额
- **可观测性**：与 Prometheus 和 Kubernetes 指标集成

<a id="kubeflow-trainer-v2"></a>

## Kubeflow Trainer V2

<a href="https://www.kubeflow.org/docs/components/training/trainer-v2/">`Kubeflow Trainer V2`</a> 是下一代训练接口，通过 Python 优先的 API 简化 Kubernetes 上的分布式训练。

<a id="key-features-of-trainer-v2"></a>

### Trainer V2 的主要特性

根据 <a href="https://mp.weixin.qq.com/s/-PFG2ZHVKZ75vrUrwBZ4PQ">Kubeflow Trainer V2 介绍</a>（中文资源）和 <a href="https://www.kubeflow.org/docs/components/training/trainer-v2/">Trainer V2 官方文档</a>，主要改进包括：

1. **简化大规模 AI/ML 任务管理**
   - 抽象隐藏 Kubernetes 的复杂性
   - 专注于 ML 工程，而不是基础设施

2. **Python 原生接口**
   - 使用符合 Python 风格的 API 定义训练作业
   - 无需手动编写 YAML 清单
   - 与 PyTorch 和 TensorFlow 代码库无缝集成

3. **最简单且最具可扩展性的 PyTorch 分布式训练**
   - 内置对 PyTorch DDP、FSDP 和 Torchrun 的支持
   - 自动配置分布式环境变量
   - 支持多节点 GPU 训练

4. **内置 LLM 微调支持**
   - 为流行 LLM 预先配置模板
   - 与 HuggingFace Transformers 集成
   - 支持 PEFT（LoRA、QLoRA）和全量微调

5. **Kubernetes 抽象**
   - 向 ML 从业者隐藏基础设施的复杂性
   - 专注于模型训练，而不是集群管理
   - 自动分配和调度资源

6. **社区集成**
   - 汇聚 Kubernetes Batch Working Group 的工作成果
   - 与 Kubeflow 社区生态系统集成
   - 兼容现有 Kubeflow 组件

<a id="trainer-v2-capabilities"></a>

### Trainer V2 的能力

下图展示了 Kubeflow Trainer V2 的主要能力：

![Kubeflow Trainer V2 的能力](https://github.com/user-attachments/assets/1ccba329-86e3-421b-8c18-62d0d10cff21)

支持的训练模式：

- 多节点训练
- Gang 调度
- 弹性训练
- LLM 蓝图
- LLM 微调
- MPI 风格训练

支持的框架和平台：

- PyTorch、JAX、TensorFlow、MLX
- HuggingFace、DeepSpeed、XGBoost
- 多种硬件加速器（NVIDIA、Intel、AMD）
- 云平台（AWS、Azure、Google Cloud、Red Hat OpenShift）
- 本地和自托管部署

<a id="example-pytorch-distributed-training-with-trainer-v2"></a>

### 示例：使用 Trainer V2 进行 PyTorch 分布式训练

```python
from kubeflow.training import TrainingClient
from kubeflow.training import constants

# Initialize the training client
client = TrainingClient()

# Define the training job
client.create_job(
    name="pytorch-distributed-training",
    namespace="kubeflow",
    base_image="pytorch/pytorch:2.0.0-cuda11.7-cudnn8-runtime",
    num_workers=4,
    num_gpus_per_worker=1,
    command=[
        "python",
        "train.py",
        "--epochs", "100",
        "--batch-size", "32"
    ]
)

# Monitor the training job
client.wait_for_job_completion("pytorch-distributed-training")

# Get training logs
logs = client.get_job_logs("pytorch-distributed-training")
print(logs)
```

<a id="example-llm-fine-tuning-with-trainer-v2"></a>

### 示例：使用 Trainer V2 进行 LLM 微调

```python
from kubeflow.training import TrainingClient

client = TrainingClient()

# Fine-tune LLaMA-2 with LoRA
client.create_job(
    name="llama2-lora-finetuning",
    namespace="kubeflow",
    base_image="huggingface/transformers:latest",
    num_workers=2,
    num_gpus_per_worker=4,
    command=[
        "python",
        "finetune_llama.py",
        "--model_name", "meta-llama/Llama-2-7b-hf",
        "--dataset", "alpaca",
        "--lora_r", "8",
        "--lora_alpha", "16",
        "--epochs", "3"
    ]
)
```

<a id="architecture-and-workflow"></a>

## 架构与工作流

<a id="training-job-lifecycle"></a>

### 训练作业生命周期

1. **创建作业**：用户通过 Python API 或 YAML 提交训练作业
2. **调度**：Training Operator 通过 Gang 调度创建 Pod
3. **初始化**：Pod 初始化分布式训练环境
4. **训练**：在所有 Worker 上执行分布式训练
5. **检查点保存**：定期将检查点保存到持久化存储
6. **完成**：作业完成并清理资源
7. **监控**：收集指标和日志以提供可观测性

<a id="integration-with-kubernetes-resources"></a>

### 与 Kubernetes 资源集成

- **Pods**：每个训练副本在独立的 Pod 中运行
- **Services**：主节点 Pod 与 Worker Pod 之间的通信
- **ConfigMaps**：训练配置和超参数
- **PersistentVolumeClaims**：检查点和数据集存储
- **Secrets**：API 密钥和凭据

<a id="integration-with-argocd"></a>

## 与 ArgoCD 集成

可以使用 ArgoCD 部署和管理 Kubeflow 训练作业，以实现 GitOps 工作流。更多详情请参阅[面向 AI 工作负载的 ArgoCD](./argocd.md)。

<a id="best-practices"></a>

## 最佳实践

<a id="job-configuration"></a>

### 作业配置

- 使用资源请求和限制，确保正确调度
- 为分布式作业配置 Gang 调度
- 设置适当的重启策略（OnFailure、Never）
- 使用 init 容器进行数据准备

<a id="storage-management"></a>

### 存储管理

- 使用 PersistentVolumes 存储检查点和数据集
- 考虑使用 CSI 驱动实现高性能存储（Fluid、JuiceFS）
- 实施检查点清理策略
- 尽可能在本地缓存数据集

<a id="monitoring-and-debugging"></a>

### 监控与调试

- 启用 Prometheus 指标以监控作业
- 使用 Kubeflow UI 查看作业状态和日志
- 为作业失败配置告警
- 保留审计日志以满足合规要求

<a id="security"></a>

### 安全

- 使用 RBAC 进行访问控制
- 在 Kubernetes Secrets 中存储敏感数据
- 启用网络策略以隔离 Pod
- 使用最小权限的服务账户

<a id="learning-resources"></a>

## 学习资源

<a id="official-documentation"></a>

### 官方文档

- <a href="https://www.kubeflow.org/docs/">Kubeflow 文档</a>
- <a href="https://www.kubeflow.org/docs/components/training/">Training Operator 文档</a>
- <a href="https://www.kubeflow.org/docs/components/training/trainer-v2/">Trainer V2 文档</a>
- <a href="https://github.com/kubeflow/training-operator/tree/master/examples">Training Operator 示例</a>

<a id="community-resources"></a>

### 社区资源

- <a href="https://mp.weixin.qq.com/s/-PFG2ZHVKZ75vrUrwBZ4PQ">Kubeflow Trainer V2 介绍</a>（中文）
- <a href="https://github.com/kubeflow/community">Kubeflow 社区</a>
- <a href="https://www.kubeflow.org/docs/about/community/">社区会议和 Slack</a>

<a id="tutorials-and-guides"></a>

### 教程与指南

- <a href="https://www.kubeflow.org/docs/started/getting-started/">Kubeflow 入门</a>
- <a href="https://www.kubeflow.org/docs/components/training/pytorch/">PyTorch 训练教程</a>
- <a href="https://www.kubeflow.org/docs/components/training/tensorflow/">TensorFlow 训练教程</a>

<a id="roadmap-and-future-development"></a>

## 路线图与未来发展

<a id="upcoming-features"></a>

### 即将推出的特性

- 增强弹性训练能力
- 改进与 Ray 的集成以支持分布式计算
- 高级容错机制
- 原生支持更多 ML 框架
- 更好地集成云原生存储解决方案

<a id="community-initiatives"></a>

### 社区举措

- 与 Kubernetes Batch Working Group 协作
- 与 CNCF 项目（Kueue、Volcano）集成
- 训练作业 API 标准化
- 大规模训练的性能优化

<a id="comparison-with-alternatives"></a>

## 与替代方案的比较

<a id="vs-native-kubernetes"></a>

### 与原生 Kubernetes 对比

- **Kubeflow**：更高层次的抽象、Python API、内置最佳实践
- **原生 K8s**：更灵活，需要更多 YAML 和手动配置

<a id="vs-volcano"></a>

### 与 Volcano 对比

- **Kubeflow Training Operator**：针对特定框架的 Operator，与 Kubeflow 生态系统集成
- **Volcano**：通用批处理调度器，适用于任何工作负载

<a id="vs-ray"></a>

### 与 Ray 对比

- **Kubeflow**：Kubernetes 原生，专注于训练工作流
- **Ray**：分布式计算框架，覆盖范围更广（训练、服务、调优）

<a id="contributing"></a>

## 参与贡献

欢迎为 Kubeflow 和 Training Operator 做出贡献！更多信息请参阅<a href="https://github.com/kubeflow/training-operator/blob/master/CONTRIBUTING.md">贡献指南</a>。

---

**注意：** 部分内容可能由所引用的来源生成或概括而来。用于生产环境前，请通过官方文档核实技术细节。

> **译者注（未核实范围）：** 本文按指定源版本翻译，未独立核实 CNCF 项目阶段、各框架及调度/弹性训练支持、Trainer V2 功能与 Python API、存储集成或路线图的当前状态。示例中的版本、参数和代码均保留原文，未执行或验证；翻译不构成功能或版本事实更新。
