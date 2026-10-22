---
status: Active
maintainer: pacoxu
last_updated: 2025-10-30
tags: pytorch, deepspeed, vllm, accelerator, training, inference
canonical_path: docs/training/pytorch-ecosystem.md
source_path: docs/training/pytorch-ecosystem.md
source_commit: 3cc83ef18ed502929e55d0e598129c7525e5f993
translation_status: translated
---

<a id="pytorch-ecosystem-and-accelerator-integration"></a>
# PyTorch 生态与加速器集成

> 译者注：本文按所标记源提交的快照翻译。支持状态、版本、性能与案例数字及路线图均保留原文口径，未经独立验证，不代表当前状态或已确认的产品承诺。

<a id="overview"></a>
## 概述

PyTorch 生态已经发展到能够支持传统 CUDA GPU 之外的各种硬件加速器，使 AI 工作负载能够在 NPU（神经网络处理单元）、HPU（Habana 处理单元）和 XPU（Intel 的 AI 加速器）等专用硬件上运行。本文介绍 PyTorch 生态库的原生支持，以及它们与各种加速器后端的集成。

<a id="native-support-for-pytorch-ecosystem-libraries"></a>
## PyTorch 生态库的原生支持

<a id="architecture-overview"></a>
### 架构概览

PyTorch 生态为硬件加速提供分层抽象，使 DeepSpeed、vLLM 等框架能够利用不同后端：

```text
┌──────────────────────────────────────────────────────────┐
│                    Application Layer                      │
│              (Model, DeepSpeed API, etc.)                 │
└──────────────────────────────────────────────────────────┘
                            │
┌──────────────────────────────────────────────────────────┐
│                    PyTorch Layer                          │
│              (PyTorch ops, autograd, etc.)                │
└──────────────────────────────────────────────────────────┘
                            │
┌──────────────────────────────────────────────────────────┐
│              Accelerator Library Layer                    │
│         (CUDA, CANN, HPU libs, XPU libs, etc.)            │
└──────────────────────────────────────────────────────────┘
                            │
┌──────────────────────────────────────────────────────────┐
│                   Hardware Layer                          │
│              (GPU, NPU, HPU, XPU, etc.)                   │
└──────────────────────────────────────────────────────────┘
```

<a id="deepspeed-accelerator-integration"></a>
### DeepSpeed 加速器集成

[`DeepSpeed`](https://github.com/microsoft/DeepSpeed) 提供灵活的加速器抽象层，支持跨多种硬件后端进行训练优化。

<a id="core-components"></a>
#### 核心组件

- **DeepSpeed 运行时**：管理分布式训练、内存优化和流水线并行
- **DeepSpeed API**：用于训练配置的高级接口
- **PyTorch 集成**：与 PyTorch 模型和优化器无缝集成
- **加速器库**：针对特定硬件的优化（CUDA、CANN 等）

<a id="supported-accelerator-backends"></a>
#### 支持的加速器后端

1. **CUDA（NVIDIA GPU）**
   - PyTorch 原生支持
   - 针对 Transformer 模型优化的内核
   - ZeRO 内存优化阶段（1、2、3）
   - 使用 CUDA Graphs 减少内核启动开销

2. **CANN（华为昇腾 NPU）**
   - 通过 PyTorch 昇腾适配器支持 NPU
   - 面向 NPU 的自定义算子实现
   - 针对 NPU 架构的内存优化
   - 通过 HCCL（华为集合通信库）进行分布式训练

3. **HPU（Habana Gaudi）**
   - Habana 的 SynapseAI 软件栈
   - 优化的集合通信
   - 支持混合精度训练
   - 与 Habana 性能剖析工具集成

4. **XPU（Intel GPU）**
   - Intel Extension for PyTorch（IPEX）
   - OneAPI 编程模型
   - 针对 Intel 架构优化的内核
   - 支持 Intel Data Center GPU Max 系列

<a id="deepspeed-configuration-example"></a>
#### DeepSpeed 配置示例

```python
import deepspeed

# Initialize DeepSpeed with accelerator-agnostic configuration
model_engine, optimizer, _, _ = deepspeed.initialize(
    model=model,
    model_parameters=model.parameters(),
    config={
        "train_batch_size": 32,
        "gradient_accumulation_steps": 1,
        "fp16": {
            "enabled": True
        },
        "zero_optimization": {
            "stage": 2
        }
    }
)

# Training loop works across all accelerators
for batch in dataloader:
    loss = model_engine(batch)
    model_engine.backward(loss)
    model_engine.step()
```

<a id="vllm-accelerator-integration"></a>
### vLLM 加速器集成

[`vLLM`](https://github.com/vllm-project/vllm) 是高性能 LLM 推理引擎，通过插件架构支持多种加速器后端。

<a id="core-architecture"></a>
#### 核心架构

```text
┌──────────────────────────────────────────────────────────┐
│                      LLM Layer                            │
│         (chat, generate, encode, score APIs)              │
└──────────────────────────────────────────────────────────┘
                            │
┌──────────────────────────────────────────────────────────┐
│                   LLM Engine Layer                        │
│       (Scheduler, Cache Engine, Executor)                 │
└──────────────────────────────────────────────────────────┘
                            │
┌──────────────────────────────────────────────────────────┐
│                  Worker Layer                             │
│         (Model Runner, Attention, Communication)          │
└──────────────────────────────────────────────────────────┘
                            │
┌──────────────────────────────────────────────────────────┐
│               Accelerator Backend Layer                   │
│          (GPU/CPU/XPU/NPU via Plugin Interface)           │
└──────────────────────────────────────────────────────────┘
```

<a id="plugin-architecture"></a>
#### 插件架构

vLLM 使用 Python 入口点实现特定加速器的实现：

- **Worker**：设备专用的工作进程实现
- **Model Runner**：针对加速器优化的模型执行
- **注意力后端**：针对硬件的自定义注意力内核
- **自定义算子**：特定硬件的操作
- **通信**：后端专用的集合操作

<a id="accelerator-plugins"></a>
#### 加速器插件

1. **vLLM 核心（CUDA/ROCm）**
   - 原生支持 NVIDIA 和 AMD GPU
   - FlashAttention 和 PagedAttention 优化
   - 使用连续批处理实现高吞吐量
   - 支持量化（AWQ、GPTQ、SqueezeLLM）

2. **vLLM-Ascend**
   - [`vllm-ascend`](https://github.com/vllm-project/vllm-ascend)：用于华为昇腾 NPU 的插件
   - 与 CANN（异构计算架构）集成
   - 针对 NPU 架构优化的自定义注意力内核
   - 基于 HCCL 的分布式推理
   - 支持昇腾 910B 及未来代际产品

3. **vLLM-Spyre**（实验性）
   - 面向其他加速器的插件架构
   - 模块化执行器与工作进程实现
   - 可灵活集成自定义硬件后端

<a id="vllm-plugin-integration-example"></a>
#### vLLM 插件集成示例

```python
# vLLM automatically detects and loads the appropriate plugin
from vllm import LLM, SamplingParams

# Works with CUDA, Ascend NPU, or other supported backends
llm = LLM(model="meta-llama/Llama-2-7b-chat-hf")

prompts = ["Tell me about AI infrastructure"]
sampling_params = SamplingParams(temperature=0.8, top_p=0.95)

# Inference runs on detected accelerator
outputs = llm.generate(prompts, sampling_params)
```

<a id="platform-specific-worker-implementation"></a>
#### 平台专用工作进程实现

```python
# Example: Custom platform worker in vLLM plugin
class CustomPlatformWorker:
    def __init__(self):
        self.device = self._init_device()
        self.model_runner = self._init_model_runner()

    def execute_model(self, seq_group_metadata_list):
        # Execute model on custom accelerator
        return self.model_runner.execute_model(seq_group_metadata_list)

    def _init_device(self):
        # Initialize platform-specific device
        pass

    def _init_model_runner(self):
        # Initialize platform-specific model runner
        pass
```

<a id="accelerator-integration-patterns"></a>
## 加速器集成模式

<a id="core-repository-integration"></a>
### 核心仓库集成

PyTorch 和 vLLM 核心仓库为新后端提供扩展点：

<a id="pytorch-core-repo"></a>
#### PyTorch 核心仓库

- **流管理**：设备专用的流处理
- **Cuda/ROCm/XPU 支持**：面向主要供应商的内置后端
- **事件处理**：同步原语
- **Guard/分配器**：内存管理抽象

<a id="vllm-core-repo"></a>
#### vLLM 核心仓库

- **后端插件接口**：新后端的标准化接口
- **Executor API**：抽象执行接口
- **Worker API**：设备专用工作进程实现
- **Model Runner API**：针对加速器优化的模型执行

<a id="accelerator-backend-development"></a>
### 加速器后端开发

向 PyTorch 生态添加新的加速器后端：

1. **实现 PyTorch 设备扩展**
   - 向 PyTorch 注册新设备类型
   - 为设备实现张量操作
   - 提供内存分配器
   - 实现集合通信原语

2. **开发加速器专用内核**
   - 注意力内核（FlashAttention 变体）
   - 矩阵乘法优化
   - 激活函数
   - 量化操作

3. **创建 vLLM 插件**（用于推理工作负载）
   - 实现工作进程类
   - 实现模型运行器
   - 通过 Python 入口点注册
   - 提供安装包

4. **与 DeepSpeed 集成**（用于训练工作负载）
   - 实现加速器抽象
   - 提供集合通信后端
   - 优化内存管理
   - 添加配置模板

<a id="projects-and-tools"></a>
## 项目与工具

<a id="training-frameworks"></a>
### 训练框架

- <a href="https://github.com/microsoft/DeepSpeed">`DeepSpeed`</a>：微软的深度学习优化库，支持多种加速器。
- <a href="https://github.com/pytorch/pytorch">`PyTorch`</a>：核心深度学习框架，具有可扩展的设备支持。
- <a href="https://github.com/NVIDIA/Megatron-LM">`Megatron-LM`</a>：NVIDIA 用于训练大语言模型的框架。

<a id="inference-engines"></a>
### 推理引擎

- <a href="https://github.com/vllm-project/vllm">`vLLM`</a>：通过 PagedAttention 和多加速器支持实现快速 LLM 推理。
- <a href="https://github.com/vllm-project/vllm-ascend">`vLLM-Ascend`</a>：用于华为昇腾 NPU 的 vLLM 插件。
- <a href="https://github.com/triton-inference-server/server">`Triton`</a>：NVIDIA 的推理服务平台。

<a id="accelerator-software-stacks"></a>
### 加速器软件栈

- <a href="https://github.com/pytorch/pytorch">`PyTorch CUDA`</a>：PyTorch 原生的 NVIDIA GPU 支持。
- **CANN（异构计算架构）**：华为面向昇腾 NPU 的软件栈。
- <a href="https://github.com/intel/intel-extension-for-pytorch">`Intel Extension for PyTorch`</a>：针对 Intel CPU 和 XPU 的优化。
- **Habana SynapseAI**：用于 Habana Gaudi 处理器的软件栈。

<a id="communication-libraries"></a>
### 通信库

- <a href="https://github.com/NVIDIA/nccl">`NCCL`</a>：NVIDIA 集合通信库，用于多 GPU 训练。
- **HCCL**：用于昇腾 NPU 的华为集合通信库。
- <a href="https://github.com/intel/oneCCL">`oneCCL`</a>：Intel 的集合通信库。

<a id="learning-topics"></a>
## 学习主题

<a id="hardware-acceleration-fundamentals"></a>
### 硬件加速基础

- **PyTorch 中的设备抽象：**
  - 张量设备管理（`tensor.to(device)`）
  - 自定义设备注册
  - 流与事件处理
  - 内存管理

- **加速器架构：**
  - GPU、NPU 与 TPU 的设计差异
  - 内存层次结构和带宽考量
  - 专用计算单元（Tensor Core、矩阵单元）
  - 互连技术（NVLink、RoCE、CXL）

<a id="deepspeed-for-multi-accelerator-training"></a>
### 用于多加速器训练的 DeepSpeed

- **ZeRO 优化：**
  - 阶段 1：优化器状态分区
  - 阶段 2：梯度分区
  - 阶段 3：参数分区
  - 使用 ZeRO-Offload 利用 CPU 内存

- **流水线并行：**
  - 跨设备划分模型
  - 梯度累积策略
  - 空泡减少技术

- **加速器专用优化：**
  - 自定义算子实现
  - 内存布局优化
  - 集合通信调优

<a id="vllm-plugin-development"></a>
### vLLM 插件开发

- **插件架构：**
  - 入口点注册
  - 工作进程类实现
  - 模型运行器定制
  - 自定义操作集成

- **注意力优化：**
  - PagedAttention 算法
  - FlashAttention 适配
  - KV 缓存管理
  - 内存高效的注意力变体

- **推理优化：**
  - 连续批处理
  - 量化技术（INT8、INT4）
  - 推测解码
  - 前缀缓存

<a id="best-practices"></a>
## 最佳实践

<a id="choosing-the-right-accelerator"></a>
### 选择合适的加速器

- **CUDA GPU（NVIDIA）：**
  - 最佳生态支持与工具
  - 最广泛的框架兼容性
  - 成熟的优化技术
  - 适用于：通用 AI 工作负载、生产部署

- **昇腾 NPU（华为）：**
  - 大规模部署成本效益高
  - Transformer 模型性能强劲
  - 生态支持不断增长
  - 适用于：成本敏感环境中的大型集群

- **Habana Gaudi（Intel）：**
  - 针对训练工作负载优化
  - 良好的性价比
  - 强大的软件支持
  - 适用于：以训练为重点的集群、MLPerf 基准测试

- **Intel XPU：**
  - 训练与推理的统一架构
  - OneAPI 软件生态
  - CPU-GPU 一致性功能
  - 适用于：以 Intel 为核心的数据中心、混合工作负载

<a id="performance-optimization"></a>
### 性能优化

- **内存管理：**
  - 大模型使用梯度检查点
  - 逐步启用 ZeRO 优化阶段
  - 监控内存使用峰值并优化批次大小
  - 按需采用卸载策略

- **通信优化：**
  - 使用硬件原生集合通信库（NCCL、HCCL）
  - 在带宽受限场景启用梯度压缩
  - 让通信与计算重叠
  - 调整梯度同步的桶大小

- **内核优化：**
  - 利用平台专用的优化算子
  - 启用 CUDA Graphs 或同等功能以降低开销
  - 使用混合精度训练（FP16、BF16）
  - 对热点操作进行性能剖析与优化

<a id="portability-considerations"></a>
### 可移植性考量

- **框架选择：**
  - 使用 PyTorch 获得最大可移植性
  - 利用与加速器无关的 API
  - 避免在模型代码中使用平台专用操作
  - 开发期间在多个后端上测试

- **配置管理：**
  - 将硬件专用配置与模型代码分离
  - 使用环境变量或配置文件选择设备
  - 对不支持的操作实现优雅回退
  - 清楚记录硬件要求

<a id="case-studies"></a>
## 案例研究

<a id="metas-llama-training-on-multi-accelerator-infrastructure"></a>
### Meta 在多加速器基础设施上的 LLaMA 训练

Meta 的 LLaMA 模型使用 FSDP（PyTorch 的全分片数据并行）在大型 GPU 集群上进行训练，展示了多加速器训练的最佳实践：

- **训练栈：**
  - 使用 PyTorch 和 FSDP 进行分布式训练
  - 混合精度训练（BF16）
  - 使用激活检查点提高内存效率
  - 自定义数据加载优化

- **关键成果：**
  - 在 2048 块 A100 GPU 上训练 65B 参数模型
  - 较高的模型 FLOPs 利用率（MFU > 50%）
  - 高效扩展到数千块 GPU

<a id="bytedances-inference-optimization-with-vllm"></a>
### 字节跳动使用 vLLM 进行推理优化

字节跳动使用 vLLM 实现大规模推理服务：

- **部署栈：**
  - 使用 vLLM 作为推理引擎
  - 使用 Kubernetes 进行编排
  - 自定义负载均衡与路由
  - 通过连续批处理优化吞吐量

- **优化：**
  - 使用 PagedAttention 提高内存效率
  - 对重复提示词使用前缀缓存
  - 通过量化（INT8）降低成本
  - 使用 LoRA 适配器提供多租户服务

<a id="huaweis-ascend-npu-ecosystem"></a>
### 华为昇腾 NPU 生态

华为围绕昇腾 NPU 构建了全面的生态系统：

- **软件栈：**
  - 使用 CANN 进行底层操作
  - 支持 MindSpore 和 PyTorch
  - 使用 vLLM-Ascend 进行推理
  - 自定义训练框架

- **部署规模：**
  - 大规模训练集群（数千个 NPU）
  - 生产推理服务
  - 包含预训练模型的模型库
  - 开发者工具和性能剖析

<a id="roadmap-ongoing-development"></a>
## 路线图（持续开发中）

<a id="pytorch-ecosystem"></a>
### PyTorch 生态

- **增强的设备插件系统：**
  简化注册新设备类型的 API
- **统一通信后端：**
  跨所有后端的抽象集合通信接口
- **改进内存管理：**
  更好的内存池和分配策略
- **性能剖析：**
  面向所有加速器的标准化性能剖析工具

<a id="vllm-plugin-ecosystem"></a>
### vLLM 插件生态

- **标准化插件 API：**
  插件开发的正式规范
- **测试框架：**
  用于插件验证的全面测试套件
- **文档：**
  插件开发指南与教程
- **性能基准：**
  跨平台性能比较工具

<a id="accelerator-support"></a>
### 加速器支持

- **新兴硬件：**
  - AMD Instinct MI300 系列集成
  - Intel Gaudi 3 支持
  - 自定义 ASIC 集成模式
- **优化技术：**
  - 稀疏感知内核
  - 高级量化方法
  - 动态批处理改进

<a id="contributing"></a>
## 贡献

欢迎为 PyTorch 生态加速器集成做出贡献！关注领域包括：

- 新加速器后端实现
- 性能优化案例研究
- 插件开发教程
- 基准测试与比较研究

<a id="references"></a>
## 参考资料

<a id="official-documentation"></a>
### 官方文档

- [PyTorch 设备管理](https://pytorch.org/docs/stable/notes/cuda.html)
- [DeepSpeed 配置](https://www.deepspeed.ai/docs/config-json/)
- [vLLM 文档](https://docs.vllm.ai/)

<a id="academic-papers"></a>
### 学术论文

- [《PyTorch Distributed：加速数据并行训练的经验》](https://arxiv.org/abs/2006.15704)
- [《ZeRO：面向万亿参数模型训练的内存优化》](https://arxiv.org/abs/1910.02054)
- [《使用 PagedAttention 高效管理大语言模型服务的内存》](https://arxiv.org/abs/2309.06180)

<a id="industry-resources"></a>
### 行业资源

- [DeepSpeed 教程](https://www.deepspeed.ai/tutorials/)
- [vLLM 博客](https://blog.vllm.ai/)
- [华为昇腾文档](https://www.hiascend.com/)
- [Intel AI 文档](https://www.intel.com/content/www/us/en/developer/tools/oneapi/ai-analytics-toolkit.html)

---

**注意：**本文档涵盖快速演进中的技术。在生产环境部署之前，请通过官方文档核实具体功能和能力。
