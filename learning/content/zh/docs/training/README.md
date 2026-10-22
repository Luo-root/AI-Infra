---
status: Active
maintainer: pacoxu
last_updated: 2026-07-11
tags: training, kubernetes, fault-tolerance, distributed-training, jobset, kueue, kuberay
canonical_path: docs/training/README.md
source_path: docs/training/README.md
source_commit: 3cc83ef18ed502929e55d0e598129c7525e5f993
translation_status: translated
---

<a id="training-on-kubernetes"></a>
# 在 Kubernetes 上进行训练

> 译者注：本文按所标记源提交的快照翻译。版本状态、性能相关表述及路线图均保留原文口径，未经独立验证，不代表当前状态或已确认的产品承诺。

<a id="overview"></a>
## 概述

在 Kubernetes 上训练大规模 AI 模型会带来独特挑战，尤其是在容错、诊断以及保持较高有效训练时间比（ETTR）方面。随着训练集群规模扩大，故障的频率和影响显著增加，因此健壮的故障处理机制至关重要。

有关具体主题的更多详情：

- [Transformers：统一 PyTorch 生态中的模型定义](./transformers.md)
- [PyTorch 生态与加速器集成（DeepSpeed、vLLM、NPU/HPU/XPU）](./pytorch-ecosystem.md)
- [大语言模型预训练（MoE、DeepseekV3、Llama4）](./pre-training.md)
- [并行策略（数据并行、分片数据并行、上下文并行）](./parallelism.md)
- [Kubeflow Training Operator 与 Trainer V2](./kubeflow.md)
- [用于 GitOps 工作流的 ArgoCD](./argocd.md)
- [MLOps：机器学习运维生命周期](./mlops.md)
- [AI 训练作业管理：JobSet、Kueue、Ray 与成组调度](../blog/2026-04-13/2026-04-13-ai-training-job-management-jobset-kueue-ray-gang_zh.md)

<a id="key-challenges-at-scale"></a>
### 规模化的主要挑战

资源规模扩大会带来广泛发生的故障，对训练稳定性构成重大挑战：

- **故障类型：**
  - CUDA 错误（GPU 硬件/驱动故障）
  - NaN 值（数值不稳定）
  - 任务挂起（通信超时、死锁）
  - 节点故障（硬件问题）

- **故障特征：**
  - **故障即停止：**传统方法在发生故障时立即停止训练
  - **诊断开销高：**识别根因需要大量时间和专业知识
  - **频率随集群规模增加：**更大的集群会更频繁地发生故障

<a id="key-metrics"></a>
### 关键指标

- **ETTR（有效训练时间比）：**
  有效训练时间与作业总运行时间之比。该指标同时反映故障频率和恢复效率。
  - 公式：`ETTR = Effective Training Time / Total Runtime`
  - ETTR 越高，表示训练效率越好

- **MFU（模型 FLOPs 利用率）：**
  衡量模型相对于理论峰值性能，利用可用计算资源的效率。
  - 同时反映硬件利用率和软件优化情况

<a id="industry-best-practices"></a>
## 行业最佳实践

<a id="bytedance-training-optimization-framework"></a>
### 字节跳动训练优化框架

字节跳动形成了一套面向大规模训练稳定性的综合方法，详见其技术文章：[字节跳动训练优化](https://mp.weixin.qq.com/s/-KDhk_R4nj3C-uPG11VoYQ)。

该框架的关键组成部分：

<a id="1-lightweight-real-time-monitoring"></a>
#### 1. 轻量级实时监控

- 持续对 GPU、网络和训练指标进行健康检查
- 在异常引发故障之前尽早检测
- 采用低开销监控，尽量减小对训练性能的影响

<a id="2-stop-diagnose-pattern"></a>
#### 2. 停止后诊断模式

- 将故障检测与诊断分离
- 保留系统状态，以便进行事后分析
- 使用自动化诊断工具识别根因

<a id="3-replay-capability"></a>
#### 3. 重放能力

- 记录训练状态和配置
- 支持复现故障以进行调试
- 支持回滚到稳定检查点

<a id="4-in-place-hot-updates"></a>
#### 4. 原地热更新

- 不销毁运行环境即可更新训练代码
- 保留 GPU 内存和已加载的数据
- 尽量缩短软件修复的恢复时间

<a id="5-fast-recovery-with-warm-standby"></a>
#### 5. 通过温备快速恢复

- 保留备用资源，以便快速故障转移
- 预热环境，减少冷启动开销
- 通过有策略的资源分配平衡成本与可用性

<a id="6-reduced-remote-filesystem-dependencies"></a>
#### 6. 减少对远程文件系统的依赖

- 在本地缓存检查点和数据
- 尽量减少恢复期间的网络 I/O
- 无需等待远程数据加载即可快速重启

<a id="7-mfu-optimization"></a>
#### 7. MFU 优化

- 持续进行性能剖析与优化
- 内核融合与内存优化
- 流水线并行调优

<a id="projects-and-tools"></a>
## 项目与工具

<a id="training-operators"></a>
### 训练 Operator

- [`Training Operator`](https://github.com/kubeflow/training-operator)：用于分布式训练（PyTorch、TensorFlow、XGBoost 等）的 Kubernetes 原生 Operator。属于 Kubeflow 项目。有关 Kubeflow Training Operator 和 Trainer V2 的详细指南，请参阅 [Kubeflow 文档](./kubeflow.md)。
- [`Volcano`](https://github.com/volcano-sh/volcano)：CNCF 孵化项目，为批处理工作负载提供成组调度和队列管理。
- [`Kueue`](https://github.com/kubernetes-sigs/kueue)：用于作业排队和资源配额的 Kubernetes SIG 项目。
- [`KubeRay`](https://github.com/ray-project/kuberay)：用于 Ray 集群的 Kubernetes Operator；支持在 Kubernetes 上进行基于 Ray 的分布式训练和服务（Ray Train、Ray Tune）。

<a id="core-training-frameworks"></a>
### 核心训练框架

- [`PyTorch`](https://github.com/pytorch/pytorch)：分布式训练的主要框架，也是 AI/ML 生态的中心。
- [`JAX`](https://github.com/google/jax)：Google 的高性能数值计算库；常用于 TPU 场景和研究。

<a id="distributed-training-libraries"></a>
### 分布式训练库

- [`Megatron-LM`](https://github.com/NVIDIA/Megatron-LM)：NVIDIA 用于训练大语言模型的框架（TP/PP 并行）。
- [`DeepSpeed`](https://github.com/microsoft/DeepSpeed)：微软的深度学习优化库（ZeRO、卸载、检查点）。
- [`PyTorch FSDP`](https://pytorch.org/docs/stable/fsdp.html)：全分片数据并行，PyTorch 原生的参数分片式分布式训练。

<a id="finetuning-微调"></a>
### 微调

- [`Transformers`](https://github.com/huggingface/transformers)：Hugging Face 库；微调生态的核心。
- [`Accelerate`](https://github.com/huggingface/accelerate)：轻量级 Hugging Face 库，只需极少代码修改即可进行分布式/混合精度训练。
- [`PEFT`](https://github.com/huggingface/peft)：参数高效微调——LoRA、Adapter 及相关技术。
- [`Axolotl`](https://github.com/axolotl-ai-cloud/axolotl)：为 SFT/LoRA 微调工作流提供具有明确设计取向的工程流水线。
- [`LLaMA-Factory`](https://github.com/hiyouga/LLaMA-Factory)：工具箱，支持 LLaMA 及其他模型的 SFT、LoRA、DPO 和其他微调方案。

<a id="post-training--rlhf-强化学习对齐"></a>
### 后训练 / RLHF（强化学习对齐）

- [`verl`](https://github.com/volcengine/verl)：面向 LLM 设计的强化学习训练系统框架（字节跳动/火山引擎）。
- [`SLIME`](https://github.com/TIGER-AI-Lab/SLIME)：用于 LLM 后训练的强化学习扩展框架。
- [`OpenRLHF`](https://github.com/OpenRLHF/OpenRLHF)：面向大语言模型的开源 RLHF 训练框架。
- [`TRL`](https://github.com/huggingface/trl)：Hugging Face 库，用于 PPO、DPO 及其他基于强化学习的训练方案。

<a id="fault-tolerance-and-checkpointing"></a>
### 容错与检查点

- [`PyTorch Distributed Checkpoint`](https://github.com/pytorch/pytorch/tree/main/torch/distributed/checkpoint)：PyTorch 中用于容错的原生检查点功能。
- [`Megatron-LM`](https://github.com/NVIDIA/Megatron-LM)：NVIDIA 用于训练大语言模型的框架，具有内置容错能力。
- [`DeepSpeed`](https://github.com/microsoft/DeepSpeed)：微软的深度学习优化库，提供检查点和容错功能。

<a id="monitoring-and-observability"></a>
### 监控与可观测性

- [`DCGM Exporter`](https://github.com/NVIDIA/dcgm-exporter)：面向 Prometheus 的 NVIDIA Data Center GPU Manager 指标导出器。
- [`Kineto`](https://github.com/pytorch/kineto)：用于 GPU 利用率分析的 PyTorch 性能剖析库。
- [`Metrics Server`](https://github.com/kubernetes-sigs/metrics-server)：用于资源指标的 Kubernetes SIG 项目。

<a id="storage-and-caching"></a>
### 存储与缓存

- [`3FS`](https://github.com/deepseek-ai/3FS)：DeepSeek 的高性能分布式文件系统，针对 AI 训练（检查点 IO 和小文件/元数据密集型工作负载）进行了优化。
- [`safetensors`](https://github.com/huggingface/safetensors)：Hugging Face 用于模型权重的安全、快速张量序列化格式。
- [`TensorStore`](https://github.com/google/tensorstore)：Google 的库，用于高效读写大型分片数组和检查点。
- [`Fluid`](https://github.com/fluid-cloudnative/fluid)：CNCF 项目，用于 Kubernetes 中的数据集编排和缓存。
- [`Ceph CSI`](https://github.com/ceph/ceph-csi)：Ceph 的容器存储接口驱动。
- [`JuiceFS CSI`](https://github.com/juicedata/juicefs-csi-driver)：用于检查点存储的高性能分布式文件系统。

<a id="gitops-and-continuous-deployment"></a>
### GitOps 与持续部署

- [`ArgoCD`](https://github.com/argoproj/argo-cd)：CNCF 毕业项目，用于声明式 GitOps 持续交付。有关通过 GitOps 工作流管理训练作业的详细指南，请参阅 [ArgoCD 文档](./argocd.md)。
- [`Argo Workflows`](https://github.com/argoproj/argo-workflows)：用于 ML 流水线的 Kubernetes 原生工作流引擎（CNCF 毕业项目）。
- [`Flux CD`](https://github.com/fluxcd/flux2)：用于 Kubernetes 部署的 GitOps 工具包（CNCF 毕业项目）。

<a id="learning-topics"></a>
## 学习主题

<a id="foundation"></a>
### 基础

- **分布式训练基础：**
  - 数据并行与模型并行
  - 流水线并行与张量并行
  - 梯度同步策略（AllReduce、Ring-AllReduce）
  - 通信库：NCCL、Gloo、MPI
  - **参阅[并行策略指南](./parallelism.md)，全面了解数据并行（DP）、分片数据并行（FSDP）和上下文并行（CP）策略**

- **PyTorch 分布式：**
  - [DistributedDataParallel（DDP）](https://pytorch.org/tutorials/beginner/dist_overview.html)
  - [全分片数据并行（FSDP）](https://pytorch.org/docs/stable/fsdp.html)
  - [RPC 框架](https://pytorch.org/docs/stable/rpc.html)

<a id="kubernetes-integration"></a>
### Kubernetes 集成

- **成组调度：**
  - 分布式作业的全有或全无调度
  - PodGroup 与调度插件
  - 与训练 Operator 集成

- **资源管理：**
  - GPU 共享与时间切片
  - RDMA 网络配置
  - 动态资源分配（DRA）

- **存储：**
  - 用于检查点的持久卷
  - CSI 驱动与卷快照
  - 数据局部性优化

<a id="fault-tolerance"></a>
### 容错

- **检查点策略：**
  - 完整检查点与增量检查点
  - 检查点频率优化
  - 分布式检查点存储

- **故障检测：**
  - 健康检查与存活探针
  - 死锁检测
  - GPU 错误监控

- **恢复机制：**
  - 自动重启策略
  - 基于检查点的恢复
  - 弹性训练（动态扩缩容）

<a id="performance-optimization"></a>
### 性能优化

- **性能剖析：**
  - PyTorch Profiler
  - NVIDIA Nsight Systems
  - 通信瓶颈分析

- **内存优化：**
  - 梯度检查点
  - 混合精度训练（FP16、BF16）
  - 激活重计算

- **通信优化：**
  - 梯度压缩
  - 计算与通信重叠
  - 网络拓扑感知

<a id="case-studies-and-research"></a>
## 案例研究与调研

<a id="academic-papers"></a>
### 学术论文

- **容错：**
  - [《通过容错训练大规模 AI 模型》](https://arxiv.org/abs/2509.16293)（arXiv:2509.16293v4）

- **分布式训练：**
  - [《PyTorch Distributed：加速数据并行训练的经验》](https://arxiv.org/abs/1910.02054)

<a id="industry-blog-posts"></a>
### 行业博客文章

- **字节跳动：**
  - [大规模训练优化实践](https://mp.weixin.qq.com/s/-KDhk_R4nj3C-uPG11VoYQ)（中文）

- **Meta：**
  - [大规模训练大语言模型](https://engineering.fb.com/2021/09/13/ml-applications/llama/)

- **微软：**
  - [DeepSpeed：面向所有人的超大规模模型训练](https://www.microsoft.com/en-us/research/blog/deepspeed-extreme-scale-model-training-for-everyone/)

<a id="roadmap-ongoing-proposals"></a>
## 路线图（正在推进的提案）

<a id="kubernetes-enhancements"></a>
### Kubernetes 增强

- **弹性训练 KEP：**
  根据资源可用性动态扩缩训练作业
- **检查点优化：**
  Kubernetes 原生支持分布式检查点
- **GPU 健康监控：**
  内置 GPU 错误检测与节点隔离

<a id="training-operator-enhancements"></a>
### Training Operator 增强

- [Training Operator 问题列表](https://github.com/kubeflow/training-operator/issues)：功能请求与增强
- **自动故障恢复：**
  具有智能重试逻辑的自愈训练作业
- **跨集群训练：**
  跨多个 Kubernetes 集群的联合训练

<a id="getting-started"></a>
## 入门

<a id="prerequisites"></a>
### 前置条件

- 具有 GPU 节点的 Kubernetes 集群
- 已安装训练 Operator
- 已配置持久存储（用于检查点）
- 监控栈（Prometheus + Grafana）

<a id="quick-start-example"></a>
### 快速开始示例

```yaml
# PyTorch distributed training job
apiVersion: kubeflow.org/v1
kind: PyTorchJob
metadata:
  name: pytorch-distributed-training
spec:
  pytorchReplicaSpecs:
    Master:
      replicas: 1
      restartPolicy: OnFailure
      template:
        spec:
          containers:
          - name: pytorch
            image: pytorch/pytorch:latest
            resources:
              limits:
                nvidia.com/gpu: 1
    Worker:
      replicas: 3
      restartPolicy: OnFailure
      template:
        spec:
          containers:
          - name: pytorch
            image: pytorch/pytorch:latest
            resources:
              limits:
                nvidia.com/gpu: 1
```

<a id="best-practices"></a>
## 最佳实践

<a id="checkpoint-management"></a>
### 检查点管理

- 频繁保存检查点（例如每 N 步或每 M 分钟）
- 将检查点存储在可靠的持久存储上
- 使用异步检查点，尽量减少对训练的中断
- 实施检查点版本管理和清理策略

<a id="monitoring-and-alerting"></a>
### 监控与告警

- 监控 GPU 利用率、温度和错误
- 跟踪训练指标（损失、吞吐量、MFU）
- 为异常和故障设置告警
- 保留训练日志，以便进行事后分析

<a id="resource-planning"></a>
### 资源规划

- 额外预留 10-20% 的容量用于容错
- 在具备适当检查点机制的前提下，考虑使用竞价/可抢占实例
- 为写入检查点期间的资源使用峰值做好规划
- 使用资源配额防止资源耗尽

<a id="testing"></a>
### 测试

- 在预生产环境中测试故障场景
- 定期验证检查点保存/恢复流程
- 对恢复时间目标（RTO）进行基准测试
- 验证恢复后训练的正确性

<a id="contributing"></a>
## 贡献

欢迎为训练相关文档和最佳实践做出贡献！请通过提交 issue 或 pull request，分享你的经验、工具和优化技术。

---

**注意：**部分内容可能根据引用来源生成或总结。用于生产环境之前，请通过官方文档核实技术细节。
