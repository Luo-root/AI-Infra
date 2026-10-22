---
status: Active
maintainer: pacoxu
last_updated: 2026-01-13
tags: mlops, machine-learning, model-lifecycle, kubernetes
canonical_path: docs/training/mlops.md
source_path: docs/training/mlops.md
source_commit: 3cc83ef18ed502929e55d0e598129c7525e5f993
translation_status: translated
---

<a id="mlops-machine-learning-operations"></a>

# MLOps：机器学习运维

<a id="overview"></a>

## 概述

MLOps（Machine Learning Operations，机器学习运维）将模型生命周期转变为可重复、可审计且支持回滚的工程闭环。它将机器学习开发实践与 DevOps 原则结合起来，简化从数据准备到生产部署和监控的端到端 ML 工作流。

**核心目标：**

- **可重复性**：一致且可复现的 ML 工作流
- **可审计性**：模型血缘关系的完整可见性和跟踪
- **回滚**：安全部署，并能够恢复到先前版本
- **自动化**：减少人工干预和人为错误
- **协作**：让数据科学家与工程师能够无缝协作

<a id="mlops-architecture"></a>

## MLOps 架构

MLOps 生态系统可划分为七个关键功能领域：

<a id="1-端到端平台-end-to-end-k8s-ai-platform"></a>

### 1) 端到端平台（端到端 K8s AI 平台）

为整个 ML 生命周期提供集成工具链的完整平台，旨在成为具有强大 Kubernetes 原生集成能力的“参考平台”。

**主要平台：**

- <a href="https://github.com/kubeflow/kubeflow">`Kubeflow`</a>：面向 Kubernetes 的 AI 平台工具包，涵盖组合、模块化和可移植性，贯穿从实验到生产的多个阶段。CNCF 项目。

**使用场景：**

- 希望以 Kubernetes 原生工作流实现标准化的组织
- 需要端到端可见性和组件互操作性的团队

<a id="2-流水线与编排-pipelines--orchestration"></a>

### 2) 流水线与编排（流水线 / 编排）

用于构建、管理和调度复杂 ML 流水线的工作流编排系统，支持依赖关系和并行执行。

**主要项目：**

- <a href="https://github.com/kubeflow/pipelines">`Kubeflow Pipelines (KFP)`</a>：容器原生工作流编排，用于在 Kubernetes 上构建和部署可移植、可扩展的 ML 工作流。Kubeflow 的一部分 +1
- <a href="https://github.com/argoproj/argo-workflows">`Argo Workflows`</a>：Kubernetes 原生工作流引擎，使用基于 CRD 的 DAG 或步骤格式定义工作流。CNCF 毕业项目 +1
- <a href="https://github.com/flyteorg/flyte">`Flyte`</a>：可扩展的数据/ML/分析工作流编排平台，具有强类型安全性和可复现性。CNCF 孵化项目 +1

**使用场景：**

- Kubernetes 原生环境：Argo / KFP
- 对类型和可复现性要求严格的复杂工作流：Flyte

<a id="3-实验跟踪与模型注册-experiment-tracking--model-registry"></a>

### 3) 实验跟踪与模型注册（实验跟踪 / 模型注册表）

集中跟踪实验、超参数、指标和模型制品，提供版本控制和血缘跟踪。

**主要项目：**

- <a href="https://github.com/mlflow/mlflow">`MLflow`</a>：覆盖实验跟踪和模型生命周期管理的开源平台，其 Model Registry 提供集中式版本控制和元数据管理。GitHub +1

**使用场景：**

- 需要跟踪实验并向工程团队发布模型，同时提供标准化注册表/血缘视图的团队。

<a id="4-数据与模型版本管理-datamodel-versioning"></a>

### 4) 数据与模型版本管理（数据/模型版本管理）

类似 Git 的版本控制系统，用于管理数据和模型制品，确保可复现性并支持回滚。

**主要项目：**

- <a href="https://github.com/iterative/dvc">`DVC`</a>：数据版本管理和 ML 实验工具，为数据和模型提供类似 Git 的版本控制，使“代码版本”与“数据/模型版本”能够同步跟踪。DVC +1

**使用场景：**

- 大型数据集的训练数据版本管理
- 多次迭代中的模型制品版本管理
- 要求严格可复现性和回滚能力的团队

<a id="5-数据质量与契约-data-quality--validation"></a>

### 5) 数据质量与契约（数据质量 / 验证）

用于验证数据模式、质量指标和预期条件的框架，以防止数据漂移并确保模型可靠性。

**主要项目：**

- <a href="https://github.com/great-expectations/great_expectations">`Great Expectations`</a>：数据验证和文档框架，用于数据质量单元测试（以“expectations”作为数据质量断言）。greatexpectations.io +1

**使用场景：**

- 经历过“数据漂移/垃圾数据”问题，希望将数据验证集成到 ML 流水线中的团队。

<a id="6-特征平台-feature-store"></a>

### 6) 特征平台（特征存储）

开源特征工程平台，用于在训练和在线推理之间一致地定义、管理、发现和提供特征，确保训练与服务的一致性。

**主要项目：**

- <a href="https://github.com/feast-dev/feast">`Feast`</a>：用于管理、发现和提供 ML 特征的特征存储，支持训练与服务一致性。Feast +1

**使用场景：**

- 传统 ML（推荐系统、广告、风险建模）
- 需要大规模结构化特征在线服务的 RAG/LLM 场景

<a id="7-部署与推理服务-serving--inference"></a>

### 7) 部署与推理服务（服务 / 推理）

模型部署和服务平台，提供具有自动扩缩容、监控、金丝雀部署及健康检查能力的推理服务。

**主要项目：**

- <a href="https://github.com/kserve/kserve">`KServe`</a>：Kubernetes 原生模型推理平台（CRD），为预训练模型服务提供打包、自动扩缩容、网络、健康检查和配置管理。KServe 文档 +1
- <a href="https://github.com/SeldonIO/seldon-core">`Seldon Core`</a>：基于 Kubernetes 的 MLOps/LLMOps 框架，用于打包、部署、监控和管理数千个生产 ML 模型。GitHub +1
- <a href="https://github.com/bentoml/BentoML">`BentoML`</a>：基于 Python 的模型/AI 应用服务框架，具有快速模型打包、容器化及边缘服务能力。GitHub +1
- <a href="https://github.com/ray-project/ray/tree/master/python/ray/serve">`Ray Serve`</a>：可扩展、可编程的服务框架（与框架无关），支持动态批处理、多模型/多 GPU 服务等。docs.ray.io

**推理引擎集成：**

关于 LLM 推理服务，请参阅[推理指南](../inference/README.md)，其中深入介绍：

- <a href="https://github.com/nvidia/TensorRT-LLM">`NVIDIA Triton Inference Server`</a>：经过 GPU 优化的多框架服务，支持多种后端（TensorRT、ONNX、PyTorch）。GitHub +1

**使用场景：**

- KServe：通过基于 CRD 的管理提供 Kubernetes 原生模型服务
- Seldon Core：用于大规模生产模型部署的 MLOps 框架
- BentoML：快速原型开发和边缘部署
- Ray Serve：灵活、可编程且具有高级批处理能力的服务
- Triton：经过 GPU 优化的多框架服务

<a id="comprehensive-mlops-workflow-projects"></a>

## 综合性 MLOps 工作流项目

跨越多个 MLOps 类别的端到端平台：

- <a href="https://github.com/kubeflow/kubeflow">`Kubeflow`</a>：面向 Kubernetes 的机器学习工具包，涵盖流水线、训练、服务等。参阅 [Kubeflow 训练指南](./kubeflow.md)。
- <a href="https://github.com/flyteorg/flyte">`Flyte`</a>：可扩展且灵活的工作流编排平台，无缝统一数据、ML 和分析技术栈。CNCF 孵化项目。
- <a href="https://github.com/Netflix/metaflow">`Metaflow`</a>：构建、部署和管理 AI/ML 系统。最初由 Netflix 开发。
- <a href="https://github.com/mlflow/mlflow">`MLflow`</a>：面向机器学习生命周期的开源平台，涵盖跟踪、项目、模型和模型注册表。
- <a href="https://github.com/polyaxon/polyaxon">`Polyaxon`</a>：用于管理和编排机器学习生命周期的 MLOps 工具。
- <a href="https://github.com/ray-project/ray">`Ray`</a>：Ray 是一个 AI 计算引擎，由核心分布式运行时和一组用于加速 ML 工作负载的 AI 库组成。
- <a href="https://github.com/zenml-io/zenml">`ZenML`</a>：ZenML：连接 ML 与 Ops 的桥梁。专注于可复现性的可扩展 MLOps 框架。

<a id="learning-topics"></a>

## 学习主题

<a id="foundation"></a>

### 基础

- **ML 生命周期基础：**
  - 模型开发和实验
  - 模型训练和超参数调优
  - 模型评估和验证
  - 模型部署和服务
  - 模型监控和重新训练

- **版本控制：**
  - 代码版本管理（Git）
  - 数据版本管理（DVC、Git LFS）
  - 模型版本管理（MLflow、DVC）
  - 实验跟踪和可复现性

<a id="kubernetes-integration"></a>

### Kubernetes 集成

- **Kubernetes 上的模型服务：**
  - 使用 KServe 提供标准化模型服务
  - 根据推理负载自动扩缩容
  - 金丝雀部署和 A/B 测试
  - GPU/CPU 工作负载的资源管理

- **训练编排：**
  - Kubernetes 上的分布式训练
  - 多节点作业的 Gang 调度
  - 与训练 Operator（Kubeflow、Volcano）集成
  - 完整介绍请参阅[训练指南](./README.md)。

- **存储与制品管理：**
  - 用于模型存储的持久卷
  - 对象存储集成（S3、GCS、Azure Blob）
  - 数据集缓存策略
  - 关于数据编排，请参阅 [Fluid](https://github.com/fluid-cloudnative/fluid)。

<a id="automation-and-cicd"></a>

### 自动化与 CI/CD

- **面向 ML 的 GitOps：**
  - 使用 ArgoCD 进行声明式部署
  - 自动化重新训练流水线
  - 模型版本管理和回滚策略
  - 参阅 [ArgoCD 指南](./argocd.md)。

- **流水线编排：**
  - 基于 DAG 的工作流（Argo Workflows、KFP）
  - 依赖管理和调度
  - 并行执行和资源优化
  - 错误处理和重试逻辑

<a id="monitoring-and-observability"></a>

### 监控与可观测性

- **模型监控：**
  - 预测准确率和漂移检测
  - 特征分布监控
  - 模型性能指标（延迟、吞吐量）
  - 参阅[可观测性指南](../observability/README.md)。

- **数据质量：**
  - 模式验证和约束
  - 数据质量测试（Great Expectations）
  - 数据漂移检测
  - 输入特征的异常检测

<a id="best-practices"></a>

## 最佳实践

<a id="model-lifecycle-management"></a>

### 模型生命周期管理

- **对一切进行版本控制：**
  - 一同跟踪代码、数据和模型制品
  - 对模型使用语义化版本
  - 记录模型血缘关系和依赖
  - 维护可复现的实验记录

- **自动化测试：**
  - 数据预处理的单元测试
  - 模型流水线的集成测试
  - 模型性能基准测试
  - 生产部署前的影子测试

<a id="deployment-strategies"></a>

### 部署策略

- **渐进式发布：**
  - 金丝雀部署（1% → 10% → 50% → 100%）
  - 用于模型比较的 A/B 测试
  - 用于零停机更新的蓝绿部署
  - 使用功能开关控制发布

- **回滚能力：**
  - 保留先前的模型版本
  - 快速回滚流程
  - 性能下降时自动回滚
  - 记录回滚条件和流程

<a id="monitoring-and-alerting"></a>

### 监控与告警

- **需要监控的关键指标：**
  - 模型推理延迟（p50、p95、p99）
  - 预测准确率和错误率
  - 资源利用率（CPU、GPU、内存）
  - 数据漂移和特征分布

- **告警策略：**
  - 为模型性能下降设置告警
  - 监控数据质量问题
  - 跟踪资源耗尽情况
  - 为生产模型配置值班轮换

<a id="collaboration-and-documentation"></a>

### 协作与文档

- **团队协作：**
  - 共享实验跟踪（MLflow）
  - 对模型变更进行代码评审
  - 记录模型决策
  - 知识共享和事后复盘

- **模型文档：**
  - 描述用途和局限的模型卡
  - 训练数据的特征和偏差
  - 性能指标和基准测试
  - 部署要求和依赖

<a id="case-studies-and-references"></a>

## 案例研究与参考资料

<a id="industry-implementations"></a>

### 行业实现

- **Netflix：**
  - [Metaflow：生产 ML 基础设施](https://netflixtechblog.com/open-sourcing-metaflow-a-human-centric-framework-for-data-science-fa72e04a5d9)
  - 专注于数据科学家的生产力和可复现性

- **Uber：**
  - [Michelangelo：Uber 的 ML 平台](https://www.uber.com/blog/michelangelo-machine-learning-platform/)
  - 面向训练、服务和监控的端到端 ML 平台

- **Airbnb：**
  - [Bighead：Airbnb 的 ML 平台](https://databricks.com/session/bighead-airbnbs-end-to-end-machine-learning-platform)
  - 大规模特征工程和模型管理

<a id="research-papers"></a>

### 研究论文

- **MLOps 原则：**
  - [《机器学习系统中隐藏的技术债务》](https://papers.nips.cc/paper/2015/hash/86df7dcfd896fcaf2674f757a2463eba-Abstract.html)
    （NIPS 2015）
  - [《机器学习：技术债务的高息信用卡》](https://research.google/pubs/pub43146/)
    （Google Research）

- **模型服务：**
  - [《Clipper：低延迟在线预测服务系统》](https://arxiv.org/abs/1612.03079)
  - [《TensorFlow Serving：灵活、高性能的 ML 服务》](https://arxiv.org/abs/1712.06139)

<a id="roadmap-ongoing-initiatives"></a>

## 路线图（正在推进的举措）

<a id="kubernetes-enhancements"></a>

### Kubernetes 增强

- **模型作为一等公民：**
  - 模型的原生 Kubernetes 资源
  - 内置模型版本管理和血缘关系
  - 集成模型生命周期管理

- **ModelMesh 集成：**
  - 多模型服务优化
  - 跨模型资源池化
  - 动态加载和卸载模型

<a id="mlops-standardization"></a>

### MLOps 标准化

- **CNCF MLOps 项目：**
  - [Model Spec](https://github.com/modelpack/model-spec)：标准化模型打包（CNCF 沙箱项目）
  - [KServe 演进](https://github.com/kserve/kserve/issues)：持续发展推理标准

- **行业标准：**
  - 使用 ONNX 进行模型交换
  - 使用 OpenTelemetry 实现 ML 可观测性
  - 使用 OpenMetrics 提供 ML 指标

<a id="emerging-trends"></a>

### 新兴趋势

- **LLMOps：**
  - 面向大语言模型的专门 MLOps 实践
  - 提示词工程和版本管理
  - LLM 专用监控和评估
  - 关于 LLM 服务，请参阅[推理指南](../inference/README.md)。

- **联邦式 MLOps：**
  - 跨集群模型训练
  - 保护隐私的 ML 工作流
  - 边缘部署和联邦学习

<a id="getting-started"></a>

## 入门

<a id="prerequisites"></a>

### 前置条件

- Kubernetes 集群（用于部署）
- Python 环境（3.8+）
- 容器镜像仓库访问权限
- 对象存储（S3、GCS 或 Azure Blob）

<a id="quick-start-mlflow-tracking-example"></a>

### 快速入门：MLflow 跟踪示例

```python
import mlflow

# Start MLflow tracking
mlflow.set_tracking_uri("http://mlflow-server:5000")
mlflow.set_experiment("my-experiment")

# Log parameters and metrics
with mlflow.start_run():
    mlflow.log_param("learning_rate", 0.01)
    mlflow.log_param("batch_size", 32)
    
    # Train model
    model = train_model()
    
    # Log metrics
    mlflow.log_metric("accuracy", 0.95)
    mlflow.log_metric("loss", 0.05)
    
    # Log model
    mlflow.sklearn.log_model(model, "model")
```

<a id="quick-start-kubeflow-pipeline-example"></a>

### 快速入门：Kubeflow 流水线示例

```python
from kfp import dsl
from kfp import compiler

@dsl.component
def preprocess_data(input_path: str, output_path: str):
    # Data preprocessing logic
    pass

@dsl.component
def train_model(data_path: str, model_path: str):
    # Model training logic
    pass

@dsl.pipeline(name='ml-pipeline')
def ml_pipeline(input_data: str):
    preprocess_task = preprocess_data(
        input_path=input_data,
        output_path='/data/preprocessed'
    )
    
    train_task = train_model(
        data_path=preprocess_task.outputs['output_path'],
        model_path='/models/trained'
    )

# Compile and submit pipeline
compiler.Compiler().compile(ml_pipeline, 'pipeline.yaml')
```

<a id="contributing"></a>

## 参与贡献

欢迎为 MLOps 文档和最佳实践做出贡献！请通过提交 Issue 或拉取请求分享经验、工具和优化技巧。

<a id="related-documentation"></a>

## 相关文档

- [Kubernetes 上的训练](./README.md)：分布式训练和容错
- [Kubeflow 训练](./kubeflow.md)：Kubeflow Training Operator 和 Trainer V2
- [用于 GitOps 的 ArgoCD](./argocd.md)：面向 ML 部署的 GitOps 工作流
- [推理指南](../inference/README.md)：LLM 推理和服务
- [可观测性](../observability/README.md)：ML 工作负载的监控和指标

---

**注意：** 部分内容基于社区资源生成和整理。用于生产环境前，请通过官方文档核实技术细节。

> **译者注（未核实范围）：** 本文忠实保留指定源版本的项目分类、CNCF 阶段、功能及性能描述、路线图、引用链接和“+1”标记，未独立核实其当前状态。源文中 NVIDIA Triton Inference Server 的链接仍按原文指向 TensorRT-LLM，未作事实修正。Python 版本要求、MLflow/KFP API 和示例代码未执行或验证；译文不代表事实更新。
