---
status: Active
maintainer: pacoxu
last_updated: 2025-10-31
tags: pre-training, moe, distributed-training, pytorch, torchtitan,
  deepseekv3, llama4, amd-mi325
canonical_path: docs/training/pre-training.md
source_path: docs/training/pre-training.md
source_commit: 3cc83ef18ed502929e55d0e598129c7525e5f993
translation_status: translated
---

<a id="pre-training-large-language-models"></a>
# 大语言模型预训练

> 译者注：本文按所标记源提交的快照翻译。模型配置、硬件建议、版本要求、性能数字及路线图均保留原文口径，未经独立验证，不代表当前官方规格、实测结果或已确认的产品承诺。

<a id="overview"></a>
## 概述

大规模预训练大语言模型（LLM）需要复杂的分布式训练技术，混合专家（MoE）架构尤其如此。本指南介绍 MoE 预训练的独特挑战、性能优化策略，以及使用 DeepseekV3-671B、Llama4 等前沿模型进行的扩展实验。

<a id="challenges-of-moe-pre-training"></a>
## MoE 预训练的挑战

与稠密模型相比，混合专家模型的稀疏激活模式和动态路由机制带来了独特挑战。

<a id="1-kernel-efficiency"></a>
### 1. 内核效率

MoE 模型面临显著的内核效率挑战：

- **专家微批次 → 微小 GEMM：**
  - 每个专家处理一小部分 token
  - 导致大量小型 GEMM 操作，而不是大批次计算
  - 计算单元利用不足，导致 GPU 利用率低

- **重排成本：**
  - token 路由需要代价高昂的重排操作
  - 这些受内存带宽限制的操作会增加延迟
  - 难以与计算重叠

- **分组/融合内核：**
  - 可以将多个专家的计算组合在一起
  - 内核融合可降低内存带宽需求
  - 需要专门实现（例如 FP8 分组 GEMM）

- **稀疏内核填充：**
  - 专家间的负载不均衡需要通过填充处理
  - 在填充 token 上浪费计算
  - 需要在效率与负载均衡之间权衡

<a id="2-parallelism"></a>
### 2. 并行性

MoE 架构需要仔细编排多种并行策略：

- **FSDP × PP × EP 的相互作用产生空泡：**
  - 全分片数据并行（FSDP）：对模型参数分片
  - 流水线并行（PP）：将模型层划分到不同设备
  - 专家并行（EP）：将专家分布到不同设备
  - 这些策略的相互作用会产生流水线空泡
  - 空泡会降低 GPU 利用率和吞吐量

- **负载均衡挑战：**
  - token 在专家间分布不均
  - 某些专家可能空闲，而另一些专家过载
  - 动态负载均衡会增加协调开销

<a id="3-communication"></a>
### 3. 通信

在大规模 MoE 训练中，通信模式成为主导因素：

- **大规模运行时，EP rank 之间的 All2all 占主导：**
  - 通过全互连通信，在专家之间路由 token
  - 这是带宽密集型操作，其开销随规模增长
  - 可能成为大规模训练的主要瓶颈

- **通信与计算重叠：**
  - 隐藏通信延迟的机会有限
  - token 路由的依赖关系阻止了完全重叠
  - 需要仔细调度并采用流水线处理

<a id="4-routing--stability"></a>
### 4. 路由与稳定性

路由机制带来训练稳定性挑战：

- **负载不均衡：**
  - 热门专家接收的 token 数量占比过高
  - 利用不足的专家无法有效学习
  - 需要负载均衡损失项和辅助损失

- **token 丢弃：**
  - 容量约束迫使系统丢弃 token
  - 导致信息丢失和训练不稳定
  - 可能导致路由坍塌（所有 token 都流向少数专家）

- **训练动态：**
  - 路由器学习需要仔细调优
  - 需要权衡探索与利用
  - 可能需要课程学习或逐步增加容量

<a id="moe-pre-training-accelerations"></a>
## MoE 预训练加速

<a id="torchtitan-on-amd-mi325"></a>
### AMD MI325 上的 TorchTitan

Meta 的 TorchTitan 框架为大规模模型提供优化的预训练基础设施，并针对 AMD MI325 GPU 提供特定加速。

<a id="amd-gpu-architecture-advantages"></a>
#### AMD GPU 架构优势

AMD MI325 GPU 为 MoE 预训练提供独特优势：

- **高内存带宽：**
  - 对受通信限制的 MoE 工作负载至关重要
  - 高效处理全互连操作

- **矩阵核心优化：**
  - 针对 FP8 和 BF16 优化的 GEMM 内核
  - 支持分组 GEMM 操作

- **大容量片上内存：**
  - 降低全局内存访问延迟
  - 更好地处理小型专家批次

<a id="parallel-strategy-design"></a>
#### 并行策略设计

有效的 MoE 预训练需要仔细设计并行策略：

- **专家并行（EP）度：**
  - 将专家分布到多块 GPU
  - 降低每块 GPU 的内存占用，并支持更大的模型
  - 需要通过全互连通信路由 token

- **数据并行（DP）维度：**
  - 在 DP 组间复制专家
  - 无需全互连开销即可提高吞吐量
  - 需要权衡内存与通信

- **流水线并行（PP）阶段：**
  - 对超大模型按层划分
  - 需要仔细减少空泡
  - 交错调度可提高效率

<a id="primus-turbo-optimizations"></a>
#### Primus-Turbo 优化

Primus-turbo 为 AMD GPU 提供一套内核级优化：

- **FP8 分组 GEMM：**
  - 将多个专家 GEMM 批量放入单个内核
  - 减少内核启动开销
  - 提高小批次下的 GPU 利用率

- **FP8 GEMM 内核：**
  - 使用 FP8 运算进行低精度训练
  - 在保持精度的同时提高吞吐量
  - 降低内存带宽需求

- **Aiter ASM FAv3（Flash Attention v3）：**
  - 为 AMD GPU 手工调优的汇编级 Flash Attention v3 实现
  - 降低注意力计算的内存占用
  - 加快长序列训练中的注意力计算
  - “Aiter”指汇编代码中针对 AMD 优化的迭代器模式

- **DeepEP（深度专家并行）：**
  - 采用分层路由的高级专家并行
  - 降低全互连通信开销
  - 改善专家组之间的负载均衡

<a id="deepseekv3-and-llama4-pre-training"></a>
## DeepseekV3 与 Llama4 预训练

<a id="deepseekv3-671b-scaling"></a>
### DeepseekV3-671B 扩展

DeepseekV3-671B 是最大的开放 MoE 模型之一，需要复杂的扩展策略。

<a id="model-architecture"></a>
#### 模型架构

- **总计 671B 个参数：**
  - 稠密层：由所有 token 共享
  - MoE 层：通过专家路由实现稀疏激活
  - 典型配置：每个 token 激活 8 个专家

- **多头潜在注意力：**
  - 用于长上下文的高效注意力机制
  - 相比标准注意力，内存占用更低

- **无辅助损失的负载均衡：**
  - 一种不使用辅助损失的新型负载均衡（传统 MoE 使用辅助损失来鼓励均衡使用专家，但这可能损害模型质量）
  - 改善训练稳定性和收敛性
  - 无需调节辅助损失权重的超参数

<a id="cluster-setup-for-deepseekv3"></a>
#### DeepseekV3 的集群配置

DeepseekV3-671B 训练的推荐集群配置：

- **硬件要求：**
  - 1024+ 块 AMD MI325 GPU（128+ 个节点 × 8 块 GPU）
  - 高带宽互连（RoCE v2 或 InfiniBand）
  - 用于检查点的分布式存储（10+ TB）

- **并行配置：**
  - 专家并行：16-32（分布专家）
  - 数据并行：32-64（提高吞吐量）
  - 流水线并行：4-8（提高内存效率）
  - GPU 总数：EP × DP × PP

- **训练超参数：**
  - 全局批次大小：4M-8M 个 token
  - 序列长度：4K-8K 个 token
  - 学习率：1e-4 到 3e-4，使用余弦衰减
  - 预热步数：2000-4000

<a id="performance-metrics"></a>
#### 性能指标

预期性能特征：

- **训练吞吐量：**
  - 目标：每块 GPU 50-100 TFLOPs
  - MFU（模型 FLOPs 利用率）：40-55%
  - 每秒 token 数：整个集群为 1M-2M

- **通信开销：**
  - 全互连：总时间的 10-20%
  - 梯度同步：5-10%
  - 总通信：15-30%

<a id="llama4-scout-scaling"></a>
### Llama4-Scout 扩展

Llama4-scout 作为较小的测试模型，用于在完整 Llama4 预训练之前验证扩展规律和训练基础设施。

<a id="model-configuration"></a>
#### 模型配置

- **Scout 模型规模：**
  - 小型：7B-13B 个参数（验证）
  - 中型：34B-70B 个参数（扩展测试）
  - 完整规模：405B+ 个参数（生产）

- **架构特征：**
  - 分组查询注意力（GQA）
  - 使用 RMSNorm 进行层归一化
  - SwiGLU 激活函数
  - 旋转位置嵌入（RoPE）

<a id="experimental-setup"></a>
#### 实验设置

推荐实验流程：

1. **小规模验证（7B-13B）：**
   - 使用 8-64 块 GPU 快速迭代
   - 验证数据流水线和训练稳定性
   - 测试检查点保存/恢复机制
   - 对单块 GPU 的吞吐量进行基准测试

2. **中等规模测试（34B-70B）：**
   - 使用 128-512 块 GPU 验证扩展性
   - 测量通信开销
   - 验证 FSDP/DP/PP 策略
   - 测试容错与恢复

3. **全规模预训练（405B+）：**
   - 使用 1024+ 块 GPU 进行生产训练
   - 持续监控 ETTR（有效训练时间比）和 MFU
   - 实施全部容错机制
   - 定期验证检查点

<a id="performance-optimization"></a>
#### 性能优化

Llama4 预训练的关键优化策略：

- **梯度检查点：**
  - 在反向传播期间重新计算激活
  - 以计算换取内存
  - 对大模型至关重要

- **Flash Attention：**
  - 内存高效的注意力实现
  - 支持更长序列训练
  - 将激活内存降低 5-10×

- **混合精度训练：**
  - 激活和权重使用 BF16
  - 优化器状态使用 FP32
  - 特定操作使用 FP8（AMD MI325）

- **序列打包：**
  - 将多个序列打包到单个批次
  - 最大程度提高 GPU 利用率
  - 减少填充开销

<a id="best-practices-for-pre-training"></a>
## 预训练最佳实践

<a id="infrastructure-setup"></a>
### 基础设施设置

1. **网络拓扑：**
   - 使用高带宽互连（每块 GPU 200+ Gbps）
   - 使用支持 RDMA 的网卡实现低延迟通信
   - 使用叶脊或胖树拓扑实现可扩展性

2. **存储架构：**
   - 数据集使用分布式文件系统（Lustre、CephFS、JuiceFS）
   - 检查点使用基于 NVMe 的本地存储
   - 分层存储：热（NVMe）→ 温（SSD）→ 冷（HDD）

3. **监控与可观测性：**
   - GPU 指标（利用率、温度、内存）
   - 网络指标（带宽、丢包）
   - 训练指标（损失、吞吐量、MFU）
   - 实时仪表板与告警

<a id="training-configuration"></a>
### 训练配置

1. **批次大小选择：**
   - 从内存所能容纳的最大批次开始
   - 使用梯度累积增大有效批次
   - 监控梯度噪声尺度，以确定最佳批次大小

2. **学习率调度：**
   - 预热：在总步数的 1-2% 内线性增加
   - 衰减：通过余弦或线性方式降至峰值学习率的 10%
   - 峰值学习率：按 sqrt(batch_size) 缩放，或进行网格搜索

3. **检查点策略：**
   - 早期频繁保存检查点（每 100-500 步）
   - 后期降低频率（每 1000-5000 步）
   - 保留最近 N 个检查点，以及周期性的里程碑检查点
   - 定期验证检查点（加载并核验）

<a id="debugging-and-troubleshooting"></a>
### 调试与故障排查

1. **损失发散：**
   - 降低学习率
   - 提高梯度裁剪阈值
   - 检查数据质量问题
   - 检查数值稳定性（FP16 溢出）

2. **训练缓慢：**
   - 剖析 GPU 利用率并识别瓶颈
   - 检查通信开销（理想情况下 <30%）
   - 确认数据加载没有造成阻塞
   - 检查并行策略（可能需要重新平衡）

3. **OOM（内存不足）：**
   - 启用梯度检查点
   - 减小微批次大小
   - 提高模型并行度
   - 使用优化器状态卸载

4. **通信瓶颈：**
   - 提高 EP 度，减少全互连规模
   - 让通信与计算重叠
   - 大规模场景使用分层全互连
   - 检查网络配置和带宽

<a id="projects-and-frameworks"></a>
## 项目与框架

<a id="pre-training-frameworks"></a>
### 预训练框架

- <a href="https://github.com/pytorch/torchtitan">`TorchTitan`</a>：Meta 用于 Llama 模型的预训练框架。采用原生 PyTorch，并针对大规模分布式训练优化。

- <a href="https://github.com/NVIDIA/Megatron-LM">`Megatron-LM`</a>：NVIDIA 用于训练大型 Transformer 模型的框架。支持多种并行策略和优化。

- <a href="https://github.com/microsoft/DeepSpeed">`DeepSpeed`</a>：微软的深度学习优化库。包括提高内存效率的 ZeRO 优化器。

- <a href="https://github.com/allenai/OLMo">`OLMo`</a>：Allen AI 的开放语言模型训练框架。注重可复现性和透明度。

<a id="moe-implementations"></a>
### MoE 实现

- <a href="https://github.com/huggingface/transformers">`Hugging Face Transformers`</a>：包含多种模型（Mixtral、Switch Transformer）的 MoE 实现。

- <a href="https://github.com/google-research/t5x">`T5X`</a>：Google 用于训练 T5 和 Switch Transformer 模型的框架。

- <a href="https://github.com/microsoft/tutel">`Tutel`</a>：微软优化的 MoE 库，提供高效专家并行。

<a id="amd-specific-tools"></a>
### AMD 专用工具

- <a href="https://github.com/ROCm/rocm">`ROCm`</a>：AMD 用于 GPU 计算的开放软件平台。MI325 训练所必需。

- <a href="https://github.com/ROCm/RCCL">`RCCL`</a>：ROCm 集合通信库。AMD 对应 NCCL 的多 GPU 通信方案。

- <a href="https://github.com/ROCm/hipify">`Hipify`</a>：将 CUDA 代码转换为用于 AMD GPU 的 HIP 代码的工具。可用于移植基于 CUDA 的训练代码。

<a id="research-and-resources"></a>
## 研究与资源

<a id="academic-papers"></a>
### 学术论文

- **MoE 架构：**
  - [《混合专家：综述》](https://arxiv.org/abs/2407.06204)（arXiv:2407.06204）
  - [《Switch Transformers：通过简单高效的稀疏性扩展到万亿参数模型》](https://arxiv.org/abs/2101.03961)（arXiv:2101.03961）

- **预训练优化：**
  - [《使用 Megatron-LM 在 GPU 集群上高效训练大规模语言模型》](https://arxiv.org/abs/2104.04473)（arXiv:2104.04473）
  - [《ZeRO：面向万亿参数模型训练的内存优化》](https://arxiv.org/abs/1910.02054)（arXiv:1910.02054）

<a id="technical-blogs"></a>
### 技术博客

- **DeepSeek：**
  - [DeepSeek-V3 仓库](https://github.com/deepseek-ai/DeepSeek-V3)（包含技术报告和实现）

- **Meta：**
  - [大规模训练 Llama 3](https://ai.meta.com/blog/meta-llama-3/)

- **AMD：**
  - [MI300 系列](https://www.amd.com/en/products/accelerators/instinct/mi300.html)

<a id="roadmap-ongoing-research"></a>
## 路线图（正在开展的研究）

<a id="emerging-techniques"></a>
### 新兴技术

- **稀疏升级：**
  将稠密预训练模型转换为 MoE 模型

- **Soft MoE：**
  用专家的加权组合代替硬路由

- **专家专门化：**
  鼓励专家进行多样化学习的技术

<a id="infrastructure-improvements"></a>
### 基础设施改进

- **自适应路由：**
  根据训练动态和负载进行动态路由

- **分层专家：**
  通过多级专家层次结构改善扩展性

- **通信优化：**
  用于降低延迟的新型全互连算法

<a id="getting-started"></a>
## 入门

<a id="prerequisites"></a>
### 前置条件

- 配备 AMD MI300/MI325 或 NVIDIA H100/H200 GPU 的 Kubernetes 集群
- 已安装 ROCm 6.0+ 或 CUDA 12.0+
- 支持分布式训练的 PyTorch 2.4+
- 高带宽网络（200+ Gbps InfiniBand 或 RoCE v2）

<a id="quick-start-torchtitan"></a>
### 快速开始：TorchTitan

```bash
# Clone TorchTitan repository
git clone https://github.com/pytorch/torchtitan.git
cd torchtitan

# Install dependencies
pip install -r requirements.txt

# Configure training (edit toml file)
vim train_configs/llama3_8b.toml

# Launch distributed training
torchrun --nproc_per_node=8 train.py \
  --config train_configs/llama3_8b.toml
```

<a id="example-moe-pre-training-configuration"></a>
### 示例：MoE 预训练配置

```toml
# TorchTitan configuration for MoE model
[model]
model_type = "moe"
num_layers = 32
hidden_size = 4096
num_attention_heads = 32
num_experts = 8
experts_per_token = 2

[parallelism]
expert_parallel = 4
data_parallel = 8
pipeline_parallel = 2

[training]
global_batch_size = 4_000_000
sequence_length = 4096
learning_rate = 3e-4
warmup_steps = 2000

[checkpointing]
checkpoint_interval = 1000
checkpoint_dir = "/mnt/checkpoints"
```

<a id="performance-benchmarks"></a>
## 性能基准

<a id="deepseekv3-671b-performance"></a>
### DeepseekV3-671B 性能

配置：1024 块 AMD MI325 GPU，EP=16，DP=64，PP=1

- **吞吐量：**1.8M token/秒
- **MFU：**48%
- **通信开销：**22%
- **ETTR：**94%

<a id="llama4-405b-performance"></a>
### Llama4-405B 性能

配置：2048 块 NVIDIA H100 GPU，DP=64，PP=8，FSDP

- **吞吐量：**3.2M token/秒
- **MFU：**52%
- **通信开销：**18%
- **ETTR：**96%

---

**注意：**本文涵盖大规模模型的高级预训练技术。内容基于近期研究论文、技术报告和行业最佳实践。实现细节请参阅框架官方文档。

> 译者注：原文中的硬件配置、性能数字和模型规格未独立核验；上述实验流程与 GPU 规模保留原文的建议口径，并非必需条件。
