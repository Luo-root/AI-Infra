---
status: Active
maintainer: pacoxu
last_updated: 2025-10-30
tags: training, parallelism, distributed-training, pytorch, data-parallel,
  sharded-data-parallel, context-parallel
canonical_path: docs/training/parallelism.md
source_path: docs/training/parallelism.md
source_commit: 3cc83ef18ed502929e55d0e598129c7525e5f993
translation_status: translated
---

<a id="parallelism-strategies-for-distributed-training"></a>
# 分布式训练的并行策略

> 译者注：本文按所标记源提交的快照翻译。版本、性能表述和路线图均保留原文口径，未经独立验证，不代表当前状态或已确认的产品承诺。

<a id="overview"></a>
## 概述

训练大规模 AI 模型需要将计算分布到多个 GPU 和节点上。不同并行策略在内存效率、计算开销和实现复杂度之间有不同的权衡。本指南介绍现代分布式训练中使用的三种基础并行技术。

<a id="key-parallelism-strategies"></a>
## 关键并行策略

<a id="1-data-parallel-dp"></a>
### 1. 数据并行（DP）

**数据并行**是最直接的并行策略：在所有设备上复制模型，每台设备处理训练数据的不同子集。

<a id="how-data-parallel-works"></a>
#### 数据并行的工作方式

- 每块 GPU 维护一份完整的模型副本
- 将训练数据划分为批次，并分发到各块 GPU
- 每块 GPU 独立计算前向传播和反向传播
- 使用 AllReduce 在所有 GPU 间同步（取平均）梯度
- 所有 GPU 以相同方式更新模型参数

<a id="data-parallel-implementation-in-pytorch"></a>
#### PyTorch 中的数据并行实现

```python
import torch
import torch.nn as nn
from torch.nn.parallel import DistributedDataParallel as DDP

# Initialize distributed process group
torch.distributed.init_process_group(backend='nccl')

# Create model and move to GPU
model = MyModel().cuda()

# Wrap with DDP
model = DDP(model, device_ids=[local_rank])

# Training loop - DDP handles gradient synchronization
for data, target in dataloader:
    optimizer.zero_grad()
    output = model(data)
    loss = criterion(output, target)
    loss.backward()  # Gradients are automatically synchronized
    optimizer.step()
```

<a id="data-parallel-characteristics"></a>
#### 数据并行的特征

- **内存：**每块 GPU 存储完整模型 + 优化器状态 + 梯度
- **通信：**通过 all-reduce 操作同步梯度
- **可扩展性：**受限于模型必须能够放入单块 GPU 内存
- **效率：**吞吐量高，通信开销极小

<a id="best-use-cases-for-data-parallel"></a>
#### 数据并行的最适用场景

- 模型能够放入单块 GPU 的内存
- 使用大批次进行高吞吐量训练
- 简单的分布式训练设置

<a id="2-sharded-data-parallel-sdp--fully-sharded-data-parallel-fsdp"></a>
### 2. 分片数据并行（SDP）/ 全分片数据并行（FSDP）

**分片数据并行**（也称**全分片数据并行**或 **FSDP**）通过将模型参数、梯度和优化器状态分片到各块 GPU 上扩展数据并行，大幅降低每块 GPU 的内存占用。

<a id="how-sharded-data-parallel-works"></a>
#### 分片数据并行的工作方式

- 模型参数分片（分区）到所有 GPU 上
- 在前向传播期间：
  - 每块 GPU 通过 all-gather 收集所需参数
  - 计算前向传播
  - 使用完毕后丢弃参数
- 在反向传播期间：
  - 每块 GPU 再次收集参数，用于计算梯度
  - 计算梯度，并在 GPU 之间进行归约
  - 每块 GPU 只保留属于自己的梯度分片
- 优化器状态也进行分片，进一步降低内存占用

<a id="fsdp-implementation-in-pytorch"></a>
#### PyTorch 中的 FSDP 实现

```python
import functools
import torch
from torch.distributed.fsdp import FullyShardedDataParallel as FSDP
from torch.distributed.fsdp import ShardingStrategy
from torch.distributed.fsdp.wrap import size_based_auto_wrap_policy

# Initialize distributed process group
torch.distributed.init_process_group(backend='nccl')

# Wrap policy for automatic layer-wise sharding
auto_wrap_policy = functools.partial(
    size_based_auto_wrap_policy,
    min_num_params=1e8  # Wrap layers with >100M parameters
)

# Create model with FSDP
model = FSDP(
    MyModel(),
    sharding_strategy=ShardingStrategy.FULL_SHARD,
    auto_wrap_policy=auto_wrap_policy,
    device_id=torch.cuda.current_device(),
)

# Training loop - FSDP handles all-gather and reduce-scatter
for data, target in dataloader:
    optimizer.zero_grad()
    output = model(data)
    loss = criterion(output, target)
    loss.backward()
    optimizer.step()
```

<a id="sharding-strategies"></a>
#### 分片策略

- **FULL_SHARD：**对参数、梯度和优化器状态进行分片（最大程度节省内存）
- **SHARD_GRAD_OP：**仅对梯度和优化器状态进行分片
- **NO_SHARD：**等同于标准 DDP（不分片）
- **HYBRID_SHARD：**节点内分片，节点间复制

<a id="sharded-data-parallel-characteristics"></a>
#### 分片数据并行的特征

- **内存：**显著降低——每块 GPU 存储 1/N 的参数（N = GPU 数量）
- **通信：**更频繁地执行 all-gather 和 reduce-scatter 操作
- **可扩展性：**可以训练远大于单块 GPU 内存容量的模型
- **效率：**通信开销略高于 DDP

<a id="best-use-cases-for-sharded-data-parallel"></a>
#### 分片数据并行的最适用场景

- 无法放入单块 GPU 内存的超大模型
- 每台设备的 GPU 内存有限时进行训练
- 多节点训练场景

<a id="3-context-parallel-cp"></a>
### 3. 上下文并行（CP）

**上下文并行**是一种专门为长序列 Transformer 模型设计的并行策略。它将序列维度划分到各块 GPU 上，从而支持训练上下文长度超出单块 GPU 内存容量的模型。

<a id="how-context-parallel-works"></a>
#### 上下文并行的工作方式

- 沿序列维度将输入序列划分到各块 GPU 上
- 修改注意力机制，以处理跨 GPU 通信
- 对于自注意力，每块 GPU：
  - 为自己的序列分区计算注意力
  - 与其他 GPU 通信，交换键/值，以完成完整的注意力计算
- 根据下一层的需求，收集各层输出或使其保持分片状态

<a id="key-concepts"></a>
#### 关键概念

**Transformer 的序列并行：**

```text
Sequence length: 32K tokens
4 GPUs with Context Parallel

GPU 0: Tokens [0:8K]
GPU 1: Tokens [8K:16K]
GPU 2: Tokens [16K:24K]
GPU 3: Tokens [24K:32K]

Each GPU computes attention over its partition while exchanging
key-value information with other GPUs for complete attention scores.
```

<a id="context-parallel-implementation-in-pytorch-simplified"></a>
#### PyTorch 中的上下文并行实现（简化版）

```python
import torch
import torch.distributed as dist

def context_parallel_attention(
    query, key, value, cp_group, cp_rank, cp_world_size
):
    """
    Context parallel self-attention.
    
    Args:
        query, key, value: [batch, seq_len_local, hidden_dim]
        cp_group: Context parallel process group
        cp_rank: Rank within context parallel group
        cp_world_size: Size of context parallel group
    """
    batch_size, seq_len_local, hidden_dim = query.shape
    
    # All-gather keys and values from all GPUs
    key_all = [torch.empty_like(key) for _ in range(cp_world_size)]
    value_all = [torch.empty_like(value) for _ in range(cp_world_size)]
    
    dist.all_gather(key_all, key, group=cp_group)
    dist.all_gather(value_all, value, group=cp_group)
    
    # Concatenate to get full sequence
    key_full = torch.cat(key_all, dim=1)  # [batch, seq_len, hidden_dim]
    value_full = torch.cat(value_all, dim=1)
    
    # Compute attention over full sequence for local queries
    # Note: compute_attention is a placeholder for your attention implementation
    # (e.g., scaled dot-product attention or flash attention)
    attention_output = compute_attention(query, key_full, value_full)
    
    return attention_output
```

<a id="context-parallel-characteristics"></a>
#### 上下文并行的特征

- **内存：**按序列分区比例减少激活内存
- **通信：**在注意力层中对键/值执行 all-gather
- **可扩展性：**支持使用极长上下文进行训练
- **效率：**通信开销随序列长度增长

<a id="best-use-cases-for-context-parallel"></a>
#### 上下文并行的最适用场景

- 训练上下文极长的 Transformer（>8K 个 token）
- 序列长度是内存瓶颈的模型
- 长上下文 LLM（32K、64K、128K+ 个 token）

<a id="combining-multiple-parallelism-strategies"></a>
## 组合多种并行策略

现代大规模训练通常组合多种并行策略，以最大程度提升效率和规模。常见组合包括：

<a id="3d-parallelism-dp--tp--pp"></a>
### 3D 并行（DP + TP + PP）

```text
Data Parallel (DP): Replicate across data
Tensor Parallel (TP): Shard model layers
Pipeline Parallel (PP): Split model across pipeline stages
```

<a id="4d-parallelism-dp--tp--pp--cp"></a>
### 4D 并行（DP + TP + PP + CP）

```text
Add Context Parallel to 3D parallelism for long-context models:
- DP: 4-way (4 data replicas)
- TP: 8-way (model sharded across 8 GPUs)
- PP: 4-way (model split into 4 pipeline stages)
- CP: 2-way (sequence split across 2 GPUs)
Total: 256 GPUs (4 × 8 × 4 × 2)
```

<a id="example-pytorch-torchtitan-configuration"></a>
### 示例：PyTorch TorchTitan 配置

```python
# Example configuration from torchtitan for LLaMA 3 training
parallelism_config = {
    "data_parallel": 4,           # 4-way data parallelism
    "tensor_parallel": 8,          # 8-way tensor parallelism
    "pipeline_parallel": 4,        # 4-way pipeline parallelism
    "context_parallel": 2,         # 2-way context parallelism
    "enable_fsdp": True,           # Use FSDP for data parallel
    "fsdp_sharding_strategy": "FULL_SHARD",
}
```

<a id="performance-considerations"></a>
## 性能考量

<a id="memory-efficiency-comparison"></a>
### 内存效率比较

对于在 N 块 GPU 上训练、包含 M 个参数的模型：

| 策略 | 每块 GPU 的内存 | 通信量 |
|----------|----------------|---------------------|
| DP | M + 优化器 + 梯度 | 仅梯度 |
| FSDP | M/N + 优化器/N + 梯度/N | 参数 + 梯度 |
| CP | 通过序列分片减少 | 注意力中的 K-V |

<a id="communication-patterns"></a>
### 通信模式

- **DP：**反向传播期间执行 all-reduce（环形或树形拓扑）
- **FSDP：**all-gather（前向）+ reduce-scatter（反向）
- **CP：**在注意力层执行 all-gather，在输出处执行 reduce-scatter

<a id="when-to-use-each-strategy"></a>
### 各策略的适用时机

| 使用场景 | 推荐策略 |
|----------|---------------------|
| 模型能够放入单块 GPU | DP（DDP） |
| 模型过大，无法放入单块 GPU | FSDP 或模型并行 |
| 长上下文（>8K） | CP + FSDP |
| 数十亿参数模型 | FSDP + TP + PP |
| 最大吞吐量 | 使用大批次的 DP |

<a id="tools-and-frameworks"></a>
## 工具与框架

<a id="pytorch-native"></a>
### PyTorch 原生功能

- [`torch.nn.parallel.DistributedDataParallel`](https://pytorch.org/docs/stable/generated/torch.nn.parallel.DistributedDataParallel.html)：标准 DDP 实现
- [`torch.distributed.fsdp`](https://pytorch.org/docs/stable/fsdp.html)：全分片数据并行（FSDP）
- [`torch.distributed.tensor.parallel`](https://pytorch.org/docs/stable/distributed.tensor.parallel.html)：张量并行 API

<a id="reference-implementations"></a>
### 参考实现

- [`PyTorch TorchTitan`](https://github.com/pytorch/torchtitan)：PyTorch 用于训练大模型的参考实现，涵盖所有并行策略。提供可用于生产的 DP、FSDP、TP、PP 和 CP 示例。
- [`Megatron-LM`](https://github.com/NVIDIA/Megatron-LM)：采用先进并行技术的 NVIDIA 框架
- [`DeepSpeed`](https://github.com/microsoft/DeepSpeed)：微软的优化库，提供 ZeRO（类似于 FSDP）

<a id="training-operators"></a>
### 训练 Operator

- [`Kubeflow Training Operator`](https://github.com/kubeflow/training-operator)：支持分布式 PyTorch 训练的 Kubernetes 原生 Operator
- [`Volcano`](https://github.com/volcano-sh/volcano)：用于多 GPU 作业、支持成组调度的批处理调度

<a id="learning-resources"></a>
## 学习资源

<a id="official-documentation"></a>
### 官方文档

- [PyTorch 分布式概览](https://pytorch.org/tutorials/beginner/dist_overview.html)
- [FSDP 教程](https://pytorch.org/tutorials/intermediate/FSDP_tutorial.html)
- [使用 PyTorch 进行分布式训练](https://pytorch.org/tutorials/beginner/ddp_series_intro.html)

<a id="research-papers"></a>
### 研究论文

- **FSDP/ZeRO：**
  [《ZeRO：面向万亿参数模型训练的内存优化》](https://arxiv.org/abs/1910.02054)（arXiv:1910.02054）
- **Megatron-LM：**
  [《Megatron-LM：使用模型并行训练数十亿参数语言模型》](https://arxiv.org/abs/1909.08053)（arXiv:1909.08053）
- **序列并行：**
  [《减少大型 Transformer 模型中的激活重计算》](https://arxiv.org/abs/2205.05198)（arXiv:2205.05198）

<a id="example-projects"></a>
### 示例项目

- [PyTorch TorchTitan 示例](https://github.com/pytorch/torchtitan/tree/main/docs)：包含所有并行策略的生产可用示例
- [PyTorch FSDP 示例](https://github.com/pytorch/examples/tree/main/distributed/FSDP)：简单的 FSDP 使用示例
- [Megatron-LM 训练脚本](https://github.com/NVIDIA/Megatron-LM/tree/main/examples)：高级并行配置

<a id="best-practices"></a>
## 最佳实践

<a id="choosing-parallelism-configuration"></a>
### 选择并行配置

1. **从数据并行（DDP）开始：**模型能够放入 GPU 内存时
2. **添加 FSDP：**模型内存需求超出单块 GPU 容量时
3. **考虑上下文并行：**序列长度 >8K 个 token 时
4. **使用张量/流水线并行：**针对超大模型（>100B 个参数）

<a id="optimization-tips"></a>
### 优化提示

- **梯度累积：**不增加内存即可增大有效批次大小
- **混合精度（FP16/BF16）：**减少内存占用并提升吞吐量
- **激活检查点：**以额外计算换取内存节省
- **通信重叠：**尽可能让通信与计算重叠

<a id="debugging-distributed-training"></a>
### 调试分布式训练

- 先用单块 GPU 测试，然后扩展到多 GPU
- 使用更小的模型变体加快迭代
- 监控 GPU 内存使用量和通信时间
- 验证梯度同步的正确性
- 使用 NCCL_DEBUG=INFO 检查挂起的进程

<a id="roadmap"></a>
## 路线图

<a id="upcoming-features"></a>
### 即将推出的功能

- **自动选择并行策略：**在框架层面优化并行策略的选择
- **异构训练：**混合使用不同 GPU 类型和内存配置
- **动态并行：**根据工作负载特征自适应调整并行策略

<a id="community-contributions"></a>
### 社区贡献

欢迎为并行策略文档和示例做出贡献！请通过提交 issue 或 pull request，分享你的经验、基准测试和最佳实践。

---

**注意：**本文档基于 PyTorch 2.x，并参考了 [PyTorch TorchTitan](https://github.com/pytorch/torchtitan) 项目。部分内容描述了需要仔细调优才能用于生产的高级技术。请始终使用你的具体工作负载和硬件验证配置。
