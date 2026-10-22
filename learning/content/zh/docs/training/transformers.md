---
status: Active
maintainer: pacoxu
last_updated: 2025-10-31
tags: transformers, huggingface, pytorch, model-definitions, standardization
canonical_path: docs/training/transformers.md
source_path: docs/training/transformers.md
source_commit: 3cc83ef18ed502929e55d0e598129c7525e5f993
translation_status: translated
---

<a id="transformers-standardizing-model-definitions-across-the-pytorch-ecosystem"></a>

# Transformers：在整个 PyTorch 生态系统中标准化模型定义

<a id="overview"></a>

## 概述

Hugging Face 的 <a href="https://github.com/huggingface/transformers">`Transformers`</a> 是整个 PyTorch 生态系统中模型定义的事实标准。Transformers 在 GitHub 上有超过 400,000+ 个依赖项目，处于模型发布周期的中心，为训练框架、推理引擎、预训练工具和本地部署方案提供它们所依赖的标准化接口。

Transformers 目前与绝大多数模型提供方合作，是 AI 基础设施领域一致模型定义的基础。

<a id="transformers-in-the-ecosystem"></a>

## 生态系统中的 Transformers

<a id="central-hub-architecture"></a>

### 中心枢纽架构

Transformers 作为中央标准化层，连接多类工具：

```text
┌─────────────────────────────────────────────────────────────────┐
│                     Fine-tuning Frameworks                       │
│  Unsloth, TRL, Axolotl, PyTorch Lightning, LLaMA-Factory,       │
│                         MaxText                                  │
└────────────────────────────────┬────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────┐
│                                                                  │
│                         transformers                             │
│            (Standardized Model Definitions)                      │
│                                                                  │
└────────────┬────────────────────┬──────────────────┬────────────┘
             │                    │                  │
┌────────────▼──────────┐ ┌──────▼─────────┐ ┌─────▼────────────┐
│  Pre-training Tools   │ │ Inference       │ │ Local Deployment │
│  • torchtitan         │ │ Engines         │ │ • LLaMA.cpp      │
│  • NVIDIA NEMO        │ │ • vLLM          │ │ • MLX            │
│  • Nanotron           │ │ • SGLang        │ │ • candle         │
│                       │ │ • TensorRT      │ │                  │
└───────────────────────┘ └─────────────────┘ └──────────────────┘
```

<a id="fine-tuning-frameworks"></a>

### 微调框架

Transformers 为主要微调工具提供基础：

- <a href="https://github.com/unslothai/unsloth">`Unsloth`</a>：具有内存优化的超高速微调
- <a href="https://github.com/huggingface/trl">`TRL`</a>（Transformer Reinforcement Learning，Transformer 强化学习）：RLHF 和偏好学习
- <a href="https://github.com/axolotl-ai-cloud/axolotl">`Axolotl`</a>：简化微调流程的工具包
- <a href="https://github.com/Lightning-AI/pytorch-lightning">`PyTorch Lightning`</a>：高层训练框架
- <a href="https://github.com/hiyouga/LLaMA-Factory">`LLaMA-Factory`</a>：高效 LLM 微调
- <a href="https://github.com/google/maxtext">`MaxText`</a>：Google 的高性能 LLM 训练

<a id="inference-engines"></a>

### 推理引擎

主要推理引擎依赖 Transformers 的模型定义：

- <a href="https://github.com/vllm-project/vllm">`vLLM`</a>：使用 PagedAttention 的快速 LLM 推理
- <a href="https://github.com/sgl-project/sglang">`SGLang`</a>：面向 LLM 的结构化生成语言
- <a href="https://github.com/NVIDIA/TensorRT-LLM">`TensorRT-LLM`</a>：NVIDIA 优化的推理引擎
- <a href="https://github.com/huggingface/text-generation-inference">`TGI`</a>（Text Generation Inference，文本生成推理）：Hugging Face 的生产推理解决方案

<a id="pre-training-tools"></a>

### 预训练工具

预训练框架建立在 Transformers 标准之上：

- <a href="https://github.com/pytorch/torchtitan">`torchtitan`</a>：PyTorch 原生大规模预训练
- <a href="https://github.com/NVIDIA/NeMo">`NVIDIA NEMO`</a>：用于构建和定制 AI 模型的端到端平台
- <a href="https://github.com/huggingface/nanotron">`Nanotron`</a>：用于预训练 Transformer 的 3D 并行

<a id="local-deployment"></a>

### 本地部署

本地部署工具利用 Transformers 模型格式：

- <a href="https://github.com/ggerganov/llama.cpp">`LLaMA.cpp`</a>：使用纯 C/C++ 进行推理，支持量化
- <a href="https://github.com/ml-explore/mlx">`MLX`</a>：针对 Apple 芯片优化的 ML 框架
- <a href="https://github.com/huggingface/candle">`candle`</a>：使用 Rust 编写的极简 ML 框架

<a id="transformers-version-5-focus-areas"></a>

## Transformers 第 5 版：重点领域

Transformers v5 代表了一次重大演进，在多个维度进行了有针对性的改进：

<a id="1-performance-enabler-coherent-definitions-for-targeted-accelerations"></a>

### 1. 性能赋能：以一致定义实现针对性加速

**目标：** 提供一致的模型定义，使整个生态系统能够进行针对特定硬件的优化。

- **标准化接口：** 为模型组件（注意力、嵌入、MLP 层）提供通用 API
- **优化钩子：** 提供定义清晰的扩展点，供硬件厂商注入优化内核
- **加速器支持：** 与 CUDA、ROCm、XPU、NPU 及其他加速器无缝集成
- **性能原语：** 提供高效实现，作为进一步优化的基线

**影响：**

- 推理引擎可以优化特定操作，同时保持模型兼容性
- 硬件厂商可以针对单一标准开展优化
- 性能改进自动惠及所有下游框架

<a id="2-modeling-toolkit-fast-model-integration-with-common-api"></a>

### 2. 建模工具包：通过通用 API 快速集成模型

**目标：** 以最少的代码重复，快速集成新模型架构。

- **模块化架构：** 为常见模式提供可复用组件（注意力机制、归一化层、激活函数）
- **配置系统：** 用于模型定制的灵活配置类
- **AutoModel 类：** 根据配置自动识别和加载模型
- **向后兼容：** 为模型更新提供平滑迁移路径
- **测试框架：** 用于模型验证的全面测试套件

**影响：**

- 添加新模型可从数周缩短到数天
- 减少相似架构之间的代码重复
- 更容易维护模型家族并修复缺陷
- 降低社区贡献门槛

<a id="3-code-as-product-readability-clean-understandable-code"></a>

### 3. 代码即产品：可读、整洁、易理解的代码

**目标：** 保持高标准的代码质量，使 Transformers 成为可靠的参考实现。

**原则：**

- **简单胜过巧妙：** 优先采用清晰、直接的实现
- **标准化：** 一致的命名约定、代码结构和文档模式
- **文档：** 全面的文档字符串、教程和示例
- **类型注解：** 完整的类型提示，以改善 IDE 支持和错误检测
- **代码评审：** 对所有贡献开展严格评审
- **测试：** 通过广泛的测试覆盖确保可靠性

**影响：**

- 工程师可以快速理解和调试模型实现
- 更容易发现并修复整个生态系统中的缺陷
- 作为学习模型架构的教育资源
- 建立对生产部署的信任

<a id="4-training-primitives-trainer-api-and-accelerate"></a>

### 4. 训练原语：Trainer API 和 Accelerate

**目标：** 提供高层 API，在保持灵活性的同时简化分布式训练。

<a id="trainer-api"></a>

#### Trainer API

Trainer API 抽象了常见的训练模式：

```python
from transformers import Trainer, TrainingArguments

training_args = TrainingArguments(
    output_dir="./results",
    num_train_epochs=3,
    per_device_train_batch_size=8,
    gradient_accumulation_steps=4,
    learning_rate=5e-5,
    warmup_steps=500,
    logging_steps=100,
    save_steps=1000,
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    eval_dataset=eval_dataset,
)

trainer.train()
```

**特性：**

- 自动混合精度训练
- 梯度累积和梯度检查点
- 分布式训练支持（DDP、FSDP）
- 与日志工具（TensorBoard、Weights & Biases）集成
- 评估和指标计算
- 提前停止和学习率调度

<a id="accelerate"></a>

#### Accelerate

<a href="https://github.com/huggingface/accelerate">`Accelerate`</a> 为分布式训练提供轻量级封装：

```python
from accelerate import Accelerator

accelerator = Accelerator()
model, optimizer, dataloader = accelerator.prepare(
    model, optimizer, dataloader
)

for batch in dataloader:
    optimizer.zero_grad()
    outputs = model(**batch)
    loss = outputs.loss
    accelerator.backward(loss)
    optimizer.step()
```

**优势：**

- 一次编写，随处运行（CPU、GPU、TPU、多节点）
- 只需少量代码改动即可进行分布式训练
- 自动设备放置和梯度同步
- 与 DeepSpeed、FSDP 及其他后端集成
- 开箱即用的混合精度支持

**影响：**

- 降低分布式训练的入门门槛
- 在不同硬件配置上保持一致行为
- 简化调试和开发工作流
- 以最少的样板代码实现可用于生产的训练循环

<a id="5-model-agnostic-utilities"></a>

### 5. 与模型无关的实用工具

**目标：** 提供适用于所有模型架构的工具，无需针对特定模型进行定制。

**主要工具：**

- **Tokenizers：** 跨模型快速、一致的分词
- **AutoClasses：** 自动识别模型/分词器/配置
- **Pipeline API：** 面向常见任务的高层接口
- **Model Hub 集成：** 从 Hugging Face Hub 无缝加载
- **量化工具：** 模型压缩实用工具
- **ONNX 导出：** 跨框架互操作
- **剪枝与蒸馏：** 模型压缩技术

**影响：**

- 简化从业者的工作流
- 在不同模型间提供一致体验
- 更容易进行模型比较和基准测试
- 降低新模型的集成开销

<a id="transformer-architecture-training-and-inference"></a>

## Transformer 架构：训练与推理

<a id="training-process"></a>

### 训练过程

Transformer 架构在训练期间以并行、教师强制方式运行：

```text
Training: Time Step = 1 (All happens in one time step)

Input: "<SOS> I love you very much <EOS>" → Ti amo molto <EOS>
                                              (target/label)

┌─────────────────────────────────────────────────────────────┐
│                        Encoder Stack                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Encoder Input → Positional Encoding                 │   │
│  │  ↓                                                    │   │
│  │  Multi-Head Attention (Self-Attention)               │   │
│  │  ↓                                                    │   │
│  │  Add & Norm → Feed Forward → Add & Norm              │   │
│  │  ↓                                                    │   │
│  │  [Repeated Nx times]                                 │   │
│  │  ↓                                                    │   │
│  │  Encoder Output: (seq, d_model)                      │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────────────┬─────────────────────────────┘
                                │ Cross-Attention Connection
┌───────────────────────────────▼─────────────────────────────┐
│                        Decoder Stack                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Decoder Input: "<SOS> Ti amo molto"                │   │
│  │  ↓                                                    │   │
│  │  Output Embedding → Positional Encoding              │   │
│  │  ↓                                                    │   │
│  │  Masked Multi-Head Self-Attention                    │   │
│  │  ↓                                                    │   │
│  │  Add & Norm                                          │   │
│  │  ↓                                                    │   │
│  │  Multi-Head Cross-Attention (attends to encoder)     │   │
│  │  ↓                                                    │   │
│  │  Add & Norm → Feed Forward → Add & Norm              │   │
│  │  ↓                                                    │   │
│  │  [Repeated Nx times]                                 │   │
│  │  ↓                                                    │   │
│  │  Decoder Output: (seq, d_model)                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                            ↓                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Linear: (seq, d_model) → (seq, vocab_size)         │   │
│  └──────────────────────────────────────────────────────┘   │
│                            ↓                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Softmax: (seq, vocab_size)                          │   │
│  └──────────────────────────────────────────────────────┘   │
│                            ↓                                  │
│                  Cross Entropy Loss                          │
│          (Compare with target: "Ti amo molto <EOS>")        │
└─────────────────────────────────────────────────────────────┘
```

**主要训练特征：**

- **教师强制：** 解码器接收正确的前序 token 作为输入，而不是接收自身的预测
- **并行处理：** 训练期间同时处理所有位置
- **掩码注意力：** 对解码器自注意力施加掩码，防止关注未来位置
- **单个时间步：** 整个序列在一次前向传播中处理
- **交叉熵损失：** 同时计算所有位置的损失

<a id="inference-process"></a>

### 推理过程

推理期间，Transformer 以自回归方式生成 token：

```text
Inference: Time Step = 1

Input: "<SOS> I love you very much <EOS>"
Output: Ti (first token)

┌─────────────────────────────────────────────────────────────┐
│                     Encoder (unchanged)                      │
│  Processes input once and caches encoder output              │
└───────────────────────────────┬─────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────┐
│                          Decoder                             │
│  Input: "<SOS>"                                              │
│  ↓                                                           │
│  Decoder Output → Linear → Softmax                           │
│  ↓                                                           │
│  Select token with max probability: "Ti"                     │
└─────────────────────────────────────────────────────────────┘

Inference: Time Step = 2

┌─────────────────────────────────────────────────────────────┐
│                Encoder Output (reused from cache)            │
└───────────────────────────────┬─────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────┐
│                          Decoder                             │
│  Input: "<SOS> Ti" (append previous output)                 │
│  ↓                                                           │
│  Decoder Output → Linear → Softmax                           │
│  ↓                                                           │
│  Select second token: "amo"                                  │
└─────────────────────────────────────────────────────────────┘

Inference: Time Step = N (continues until <EOS>)
```

**主要推理特征：**

- **自回归生成：** 每次生成一个输出 token
- **顺序处理：** 每个 token 依赖所有先前 token
- **KV Cache：** 缓存编码器输出和先前的解码器状态，以避免重复计算
- **贪心/采样：** 通过 argmax（贪心）或从分布中采样来选择 token
- **可变长度：** 持续生成，直到遇到序列结束 token 或达到最大长度

<a id="training-vs-inference-differences"></a>

### 训练与推理的差异

| 方面 | 训练 | 推理 |
|--------|----------|-----------|
| **时间步** | 单次前向传播 | 多个顺序步骤 |
| **输入** | 完整目标序列 | 先前生成的 token |
| **解码器输入** | 真实标签（教师） | 模型预测 |
| **并行化** | 完全并行 | 顺序生成 |
| **速度** | 快（并行） | 较慢（顺序） |
| **内存** | 较高（存储所有梯度） | 较低（仅前向传播） |
| **输出** | 所有位置的损失 | 每步一个 token |
| **目的** | 学习模型参数 | 生成新序列 |

<a id="common-optimizations"></a>

### 常见优化

**训练优化：**

- **混合精度：** 使用 FP16/BF16 加快计算
- **梯度累积：** 实现更大的有效批大小
- **梯度检查点：** 以计算换内存
- **数据并行：** 将批次分布到多个 GPU
- **模型并行：** 将模型层拆分到多个 GPU

**推理优化：**

- **KV Cache：** 避免重复计算注意力键/值
- **连续批处理：** 对请求进行动态批处理
- **量化：** 使用 INT8/INT4 减少内存占用并加快计算
- **Flash Attention：** 优化注意力计算
- **推测解码：** 并行生成 token 并进行验证

<a id="learning-topics"></a>

## 学习主题

<a id="model-architecture-fundamentals"></a>

### 模型架构基础

- **注意力机制：**
  - 自注意力和交叉注意力
  - 多头注意力
  - 缩放点积注意力
  - 逐位置前馈网络

- **Transformer 变体：**
  - 仅编码器模型（BERT、RoBERTa）
  - 仅解码器模型（GPT、Llama、Mistral）
  - 编码器-解码器模型（T5、BART）
  - 现代架构（Llama 3/4、Qwen、Mixtral、DeepSeek）

- **位置编码：**
  - 正弦位置嵌入
  - 可学习位置嵌入
  - 旋转位置嵌入（RoPE）
  - ALiBi（带线性偏置的注意力）

<a id="training-techniques"></a>

### 训练技术

- **微调策略：**
  - 全量微调
  - 参数高效微调（PEFT）
  - LoRA（低秩适配）
  - QLoRA（量化 LoRA）
  - 适配器层

- **训练稳定性：**
  - 层归一化
  - 学习率调度
  - 梯度裁剪
  - 权重衰减
  - 混合精度训练

- **数据处理：**
  - 分词策略
  - 词表构建
  - 数据增强
  - 课程学习

<a id="inference-optimization"></a>

### 推理优化

- **生成策略：**
  - 贪心解码
  - 束搜索
  - Top-k 采样
  - Top-p（核）采样
  - 温度缩放

- **性能优化：**
  - 模型量化（GPTQ、AWQ、GGUF）
  - KV 缓存管理
  - Flash Attention 和其他注意力优化
  - 连续批处理
  - 推测解码

- **部署：**
  - 模型服务框架（vLLM、TGI、TensorRT-LLM）
  - 硬件考量（GPU、CPU、边缘设备）
  - 延迟与吞吐量之间的权衡

<a id="ecosystem-integration"></a>

### 生态系统集成

- **Model Hub：**
  - 发布和共享模型
  - 模型版本控制
  - 模型卡和文档
  - 许可证合规

- **工具集成：**
  - 将 Transformers 与 PyTorch 配合使用
  - 与训练框架集成
  - 连接推理引擎
  - 评估和基准测试

<a id="projects-and-resources"></a>

## 项目与资源

<a id="core-libraries"></a>

### 核心库

- <a href="https://github.com/huggingface/transformers">`Transformers`</a>：面向 PyTorch、TensorFlow 和 JAX 的前沿机器学习
- <a href="https://github.com/huggingface/accelerate">`Accelerate`</a>：通过多 GPU、TPU、混合精度训练和使用 PyTorch 模型
- <a href="https://github.com/huggingface/tokenizers">`Tokenizers`</a>：快速、可定制的文本分词库
- <a href="https://github.com/huggingface/peft">`PEFT`</a>：前沿的参数高效微调方法
- <a href="https://github.com/huggingface/optimum">`Optimum`</a>：Transformer 的硬件加速和优化

<a id="training-frameworks"></a>

### 训练框架

- <a href="https://github.com/huggingface/trl">`TRL`</a>：Transformer 强化学习
- <a href="https://github.com/unslothai/unsloth">`Unsloth`</a>：快 2-5x 的 LLM 微调
- <a href="https://github.com/axolotl-ai-cloud/axolotl">`Axolotl`</a>：LLM 微调的首选解决方案
- <a href="https://github.com/hiyouga/LLaMA-Factory">`LLaMA-Factory`</a>：易用的 LLM 微调框架

<a id="inference-tools"></a>

### 推理工具

- <a href="https://github.com/vllm-project/vllm">`vLLM`</a>：高吞吐量、内存高效的推理引擎
- <a href="https://github.com/huggingface/text-generation-inference">`TGI`</a>：可用于生产的推理容器
- <a href="https://github.com/sgl-project/sglang">`SGLang`</a>：通过前端与运行时协同设计实现结构化生成
- <a href="https://github.com/NVIDIA/TensorRT-LLM">`TensorRT-LLM`</a>：NVIDIA 优化的推理库

<a id="documentation-and-learning"></a>

### 文档与学习

- [Hugging Face 课程](https://huggingface.co/learn/nlp-course/chapter1/1)：使用 Transformers 的全面 NLP 课程
- [Transformers 文档](https://huggingface.co/docs/transformers/)：包含教程和 API 参考的官方文档
- [《Attention is All You Need》（博客）](https://huggingface.co/blog/Esmail-AGumaan/attention-is-all-you-need)：详细讲解 Transformer 架构
- [PyTorch 大会：Transformers 标准化演讲](https://sched.co/27QDi)：Hugging Face 的 Lysandre Debut 与 Arthur Zucker——《Transformers：在整个 PyTorch 生态系统中标准化模型定义》

<a id="best-practices"></a>

## 最佳实践

<a id="model-development"></a>

### 模型开发

- **从现有模型开始：** 利用预训练模型，并针对任务进行微调
- **使用 AutoClasses：** 启用模型自动识别和配置
- **类型注解：** 保留类型提示，以改善 IDE 支持
- **文档：** 编写全面的文档字符串和示例
- **测试：** 为自定义组件添加单元测试

<a id="training"></a>

### 训练

- **梯度累积：** 在有限硬件上实现更大的有效批大小
- **混合精度：** 启用 FP16/BF16 以加快训练
- **检查点：** 定期保存模型并实现可恢复训练
- **监控：** 使用 TensorBoard 或 Weights & Biases 跟踪指标
- **验证：** 定期在留出数据上评估

<a id="deployment"></a>

### 部署

- **量化：** 在适当情况下使用量化模型进行推理
- **批处理：** 利用批量推理提高吞吐量
- **硬件选择：** 根据延迟/吞吐量要求选择合适硬件
- **监控：** 跟踪推理延迟、吞吐量和资源使用情况
- **版本控制：** 维护模型版本并跟踪配置

<a id="roadmap-ongoing-development"></a>

## 路线图（持续开发中）

<a id="transformers-core"></a>

### Transformers 核心

- **第 5 版增强：**
  - 改进模块化和代码组织
  - 增强性能原语
  - 更好的文档和示例
  - 扩大模型覆盖范围

- **社区发展：**
  - 加强与模型提供方的合作
  - 更广泛的生态系统集成
  - 更多社区贡献的模型
  - 增强工具及实用程序

<a id="future-ecosystem-integration"></a>

### 未来的生态系统集成

- **训练框架：**
  - 与分布式训练工具更深入地集成
  - 改进 PEFT 方法
  - 更好的多模态支持

- **推理引擎：**
  - 与 vLLM、TGI 及其他引擎更紧密地集成
  - 标准化优化接口
  - 改进跨框架兼容性

- **硬件支持：**
  - 扩大加速器支持范围
  - 针对特定硬件的优化
  - 更好的性能分析和调试工具

<a id="contributing"></a>

## 参与贡献

Transformers 项目欢迎社区贡献：

- **模型集成：** 添加新模型架构
- **优化：** 改进现有模型的性能
- **文档：** 增强指南和示例
- **缺陷修复：** 报告和修复问题
- **社区支持：** 在讨论区和论坛帮助他人

详细说明请参阅 [Transformers 贡献指南](https://github.com/huggingface/transformers/blob/main/CONTRIBUTING.md)。

<a id="references"></a>

## 参考资料

<a id="official-resources"></a>

### 官方资源

- [Transformers GitHub](https://github.com/huggingface/transformers)
- [Hugging Face 文档](https://huggingface.co/docs)
- [Hugging Face Hub](https://huggingface.co/models)
- [Hugging Face 博客](https://huggingface.co/blog)

<a id="academic-papers"></a>

### 学术论文

- [《Attention is All You Need》](https://arxiv.org/abs/1706.03762)：最初的 Transformer 论文
- [《BERT：深度双向 Transformer 的预训练》](https://arxiv.org/abs/1810.04805)
- [《语言模型是少样本学习者》](https://arxiv.org/abs/2005.14165)：GPT-3 论文
- [《LLaMA：开放且高效的基础语言模型》](https://arxiv.org/abs/2302.13971)

<a id="conference-talks"></a>

### 大会演讲

- [PyTorch 大会 2024：Transformers 标准化](https://sched.co/27QDi)：Hugging Face 的 Lysandre Debut 与 Arthur Zucker 的演讲——《Transformers：在整个 PyTorch 生态系统中标准化模型定义》

<a id="blog-posts"></a>

### 博客文章

- [《Attention is All You Need》详解](https://huggingface.co/blog/Esmail-AGumaan/attention-is-all-you-need)：全面解释 Transformer 架构，包括训练和推理细节

---

**注意：** 本文档反映 Transformers 库及生态系统的当前状态。由于该领域发展迅速，请参阅官方文档获取最新信息。

> **译者注（未核实范围）：** 本文中的“目前”“当前”和路线图均指指定英文源版本的表述，未独立核实 400,000+ 依赖项目数、Transformers v5 的版本状态与特性、各工具的集成关系、2-5x 性能描述或训练/推理比较的适用条件。API、参数、代码及文本图均原样保留，未执行或验证；译文不构成当前事实或性能承诺的更新。
