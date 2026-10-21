---
status: Active
maintainer: pacoxu
last_updated: 2026-10-15
tags: serverless, inference, knative, sagemaker, ai-platforms
canonical_path: docs/inference/serverless.md
source_path: docs/inference/serverless.md
source_commit: 3cc83ef18ed502929e55d0e598129c7525e5f993
translation_status: translated
---

<a id="ai-inference-serverless-support"></a>

# AI 推理的 Serverless 支持

本文概述 Serverless AI 推理平台，重点介绍 Kubernetes 原生方案和云厂商产品，用于以自动伸缩、按使用量计费和极低运维开销部署 LLM 与 ML 模型。

> **译者注：** 本文忠实翻译所标注提交的原文快照；平台存续状态、规格、价格、GPU 支持、成熟度声明、配置 API 和性能数据未独立验证。所有数字、版本及技术声明均按原文保留，不代表对当前能力或成本的确认。

<a id="table-of-contents"></a>

## 目录

- [概述](#overview)
- [Serverless 平台比较](#serverless-platform-comparison)
- [Kubernetes 原生方案](#kubernetes-native-solutions)
  - [KNative AI](#knative-ai)
- [云厂商方案](#cloud-provider-solutions)
  - [AWS SageMaker Serverless Inference](#aws-sagemaker-serverless-inference)
- [平台比较矩阵](#platform-comparison-matrix)
- [关键考虑因素](#key-considerations)
- [参考资料](#references)

<a id="overview"></a>

## 概述

Serverless AI 推理平台让组织无需管理底层基础设施即可部署机器学习模型。这些平台根据流量自动伸缩，仅对实际使用量收费，并高效处理冷启动。主要优势包括：

- **自动伸缩**：根据需求自动缩容到零并扩容
- **成本优化**：按请求或计算量计费
- **减少运维**：无需管理基础设施
- **快速部署**：快速部署和更新模型
- **多模型支持**：在共享基础设施上托管多个模型

<a id="serverless-platform-comparison"></a>

## Serverless 平台比较

根据行业分析和平台能力，下面全面比较主要的 Serverless AI 推理平台：

| 平台 | 冷启动 | 最长执行时间 | 计费模式 | 最佳用例 |
|----------|-----------|---------------|---------------|---------------|
| Cyfuture AI | 3-7s | 不受限 | 企业按小时 | 企业部署 |
| AWS SageMaker | 1-10s | 15 min | 按请求 | 企业 AWS 集成 |
| Google Vertex AI | 2-8s | 60 min | 按小时计算 | AutoML 工作流 |
| Azure ML | 2-8s | 60 min | 按消耗量 | Microsoft 生态 |
| Hugging Face | 30-120s | 不受限 | GPU 按小时 | NLP 应用 |
| Replicate | 10-30s | 不受限 | 按秒 | 开源模型 |
| Modal | <5s | 不受限 | GPU 按小时 | 高性能 ML |
| Potassium | <1s | 不受限 | 按实例 | 生产推理 |
| RunPod | 15-45s | 不受限 | GPU 按秒 | 成本优化 |
| OctoAI | 5-15s | 不受限 | 按性能 | 模型优化 |

**关键指标：**

- **冷启动**：初始化并服务第一个请求的时间
- **最长执行时间**：每个请求的最大推理时间
- **计费模式**：平台如何按使用量收费
- **最佳用例**：平台最擅长的主要场景

<a id="kubernetes-native-solutions"></a>

## Kubernetes 原生方案

<a id="knative-ai"></a>

### KNative AI

<a href="https://github.com/knative/serving">`Knative Serving`</a> 提供可用于 AI 推理工作负载的 Kubernetes 原生 Serverless 平台。结合 AI 专用扩展和模型服务框架，Knative 能够实现：

**主要特性：**

- **缩容到零**：空闲时自动缩容到零副本
- **自动伸缩**：基于请求和并发数自动伸缩
- **修订管理**：流量拆分与金丝雀部署
- **请求缓冲**：冷启动期间对请求排队
- **集成**：适配 KServe、Seldon Core 和自定义服务运行时

**架构：**

Knative AI 实现通常结合：

1. **Knative Serving**：Serverless 运行时与自动伸缩
2. **模型服务器**：vLLM、TGI、Triton 或自定义推理引擎
3. **KServe/自定义 CRD**：模型生命周期与版本管理
4. **自动伸缩器**：KPA（Knative Pod Autoscaler），用于智能伸缩

**用例示例：**

```yaml
# Example Knative Service for LLM inference
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: llama-inference
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/target: "10"
        autoscaling.knative.dev/metric: "concurrency"
    spec:
      containers:
      - image: vllm/vllm-openai:latest
        env:
        - name: MODEL_NAME
          value: "meta-llama/Llama-3.1-8B"
        resources:
          limits:
            nvidia.com/gpu: "1"
```

**集成示例：**

- <a href="https://github.com/knative/docs/blob/main/docs/blog/articles/ai_functions_llama_stack.md">`Llama Stack 与 Knative`</a>：Llama 模型的 Serverless 部署
- <a href="https://github.com/kserve/kserve">`KServe`</a>：集成 Knative 的 Kubernetes 原生模型服务
- <a href="https://github.com/SeldonIO/seldon-core">`Seldon Core`</a>：使用 Knative 自动伸缩的 ML 部署

**冷启动优化：**

- 通过最小副本数设置预热副本
- 模型缓存与镜像优化
- GPU Pod 启动优化（参阅 [GPU Pod 冷启动](../kubernetes/gpu-pod-cold-start.md)）
- 快速模型加载策略

**学习资源：**

- <a href="https://knative.dev/docs/">`Knative 文档`</a>
- <a href="https://kserve.github.io/website/">`KServe 文档`</a>
- <a href="https://github.com/knative/community/blob/main/working-groups/WORKING-GROUPS.md">`Knative 工作组`</a>

<a id="keda--event-driven-autoscaling-for-llm-inference"></a>

### KEDA——面向 LLM 推理的事件驱动自动伸缩

<a href="https://keda.sh">`KEDA (Kubernetes Event-Driven Autoscaling)`</a> 是 CNCF 毕业项目，扩展 Kubernetes HPA，使其能够根据外部事件源和自定义指标伸缩——这对 LLM 推理至关重要，因为 CPU/内存指标并不是良好的伸缩信号。

**为什么 LLM 推理需要 KEDA：**

标准 HPA 根据 CPU 或内存伸缩，但推理工作负载受到以下因素限制：

- GPU 饱和度与请求队列深度
- 负载下 TTFT（首 token 时间）的恶化
- vLLM `num_requests_waiting` 指标超过阈值

**推理的主要伸缩器：**

| 伸缩器 | 用例 |
| --- | --- |
| Prometheus | 根据 vLLM/SGLang 队列深度或 TTFT 指标伸缩 |
| Kafka / RabbitMQ | 根据批量推理队列深度伸缩 |
| Redis | 根据 Redis stream 中积压的请求伸缩 |
| AWS SQS / GCP PubSub | 云原生的基于队列的伸缩 |

**示例：根据 vLLM 请求队列深度伸缩**

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: vllm-scaledobject
spec:
  scaleTargetRef:
    name: vllm-deployment
  minReplicaCount: 1
  maxReplicaCount: 8
  cooldownPeriod: 120
  triggers:
  - type: prometheus
    metadata:
      serverAddress: http://prometheus:9090
      metricName: vllm_requests_waiting
      query: sum(vllm:num_requests_waiting{namespace="default"})
      threshold: "5"
```

**缩容到零的考虑因素：**

LLM 推理冷启动（模型加载）可能需要 30–300 秒。缓解策略：

- 对延迟敏感的路径设置 `minReplicaCount: 1`，避免完全缩容到零
- 对延迟关键路由使用**温池模式**（预初始化 Pod）
- 在节点本地存储（NVMe）缓存模型权重以加速冷启动
- 对于模型切换 / 共享 GPU 池：[llm-d 快速模型启用](./model-lifecycle.md#llm-d-fast-model-actuation)（睡眠/唤醒 + 双 Pod + 启动器）
- 对于 Dynamo 副本横向扩容：[Dynamo Snapshot](./model-lifecycle.md#dynamo-snapshot-checkpoint--restore)（CRIU/`cuda-checkpoint` 温恢复，约 10 s，而冷启动约 1 min）
- 详细策略参阅 [GPU Pod 冷启动](../kubernetes/gpu-pod-cold-start.md)

**与 Gateway API Inference Extension 集成：**

<a href="https://github.com/kubernetes-sigs/gateway-api-inference-extension">`Gateway API Inference Extension`</a> 暴露每个模型的队列深度和 TTFT 指标，KEDA 可以直接使用，从而实现推理感知的自动伸缩：

```yaml
# Scale on per-model TTFT degradation
triggers:
- type: prometheus
  metadata:
    query: |
      histogram_quantile(0.95,
        rate(inference_model_request_duration_seconds_bucket[2m]))
    threshold: "0.5"  # Scale out when P95 TTFT > 500ms
```

**参考资料：**

- <a href="https://keda.sh/docs/">`KEDA 文档`</a>
- <a href="https://github.com/kedacore/keda">`KEDA GitHub`</a>（CNCF 毕业项目）
- <a href="https://github.com/kubernetes-sigs/gateway-api-inference-extension">`Gateway API Inference Extension`</a>

<a id="cloud-provider-solutions"></a>

## 云厂商方案

<a id="aws-sagemaker-serverless-inference"></a>

### AWS SageMaker Serverless Inference

<a href="https://docs.aws.amazon.com/sagemaker/latest/dg/serverless-endpoints.html">`AWS SageMaker Serverless Inference`</a> 是专为部署和伸缩 ML 模型设计的 Serverless 选项，无需管理基础设施。

**主要特性：**

- **自动伸缩**：从零扩展到数千个请求
- **按使用量付费**：仅对计算时间和处理的数据收费
- **内存配置**：可选择 1GB 到 6GB 内存
- **并发调用**：处理最多 200 个并发请求
- **托管基础设施**：无需配置或管理服务器
- **集成**：原生 AWS 生态集成（Lambda、S3、IAM）

**规格：**

- **冷启动**：1-10 秒，取决于模型大小和内存
- **最长调用时间**：每个请求 15 分钟
- **最大载荷**：请求/响应 6MB
- **内存选项**：1GB、2GB、3GB、4GB、5GB、6GB
- **并发数**：每个端点最多 200 个并发调用

**计费模式：**

- **计算**：按推理时长付费（每毫秒）
- **内存**：按分配内存付费（每 GB-秒）
- **数据**：同一区域内的数据传输不收费
- **无最低要求**：无最低费用或预付承诺

**配置示例：**

```python
# Create serverless endpoint configuration
serverless_config = {
    'MemorySizeInMB': 4096,  # 4GB memory
    'MaxConcurrency': 50,     # Max concurrent invocations
}

# Create endpoint with serverless config
response = sagemaker_client.create_endpoint(
    EndpointName='llama-serverless',
    EndpointConfigName='llama-config',
    ServerlessEndpointConfig=serverless_config
)
```

**最佳实践：**

1. **模型优化**：
   - 使用模型压缩与量化
   - 优化容器大小和依赖
   - 启用模型制品缓存

2. **减少冷启动**：
   - 尽可能将模型保持在 1GB 以下
   - 使用更小的内存配置
   - 考虑通过定时调用保持温热

3. **并发规划**：
   - 根据预期流量设置 MaxConcurrency
   - 监控冷启动频率
   - 对可预测的工作负载使用预置并发

4. **成本优化**：
   - 合理调整内存分配
   - 大任务使用批量推理
   - 监控空闲时间并调整超时设置

**用例：**

- **间歇流量**：使用情况不可预测或零星出现的应用
- **开发/测试**：具备成本效益的模型测试与验证
- **低延迟要求**：较小模型的亚秒级推理
- **多模型托管**：部署多个模型而无需过量配置资源

**限制：**

- 最长调用时间 15 分钟（不适合长时间运行的推理）
- 6MB 载荷限制（不适合超大输入/输出）
- 冷启动可能影响延迟敏感型应用
- GPU 支持有限（主要是基于 CPU 的推理）

**迁移路径：**

对于超出 Serverless 限制的工作负载：

- <a href="https://docs.aws.amazon.com/sagemaker/latest/dg/realtime-endpoints.html">`SageMaker 实时端点`</a>：适合稳定流量模式
- <a href="https://docs.aws.amazon.com/sagemaker/latest/dg/async-inference.html">`SageMaker 异步推理`</a>：适合长时间运行或大载荷推理
- <a href="https://docs.aws.amazon.com/sagemaker/latest/dg/batch-transform.html">`SageMaker 批量转换`</a>：适合离线批处理

**学习资源：**

- <a href="https://aws.amazon.com/sagemaker/serverless-inference/">`AWS SageMaker Serverless 概述`</a>
- <a href="https://docs.aws.amazon.com/sagemaker/latest/dg/serverless-endpoints-how-it-works.html">`工作原理文档`</a>
- <a href="https://github.com/aws/amazon-sagemaker-examples/tree/main/serverless-inference">`Notebook 示例`</a>

<a id="platform-comparison-matrix"></a>

## 平台比较矩阵

<a id="selection-criteria"></a>

### 选择标准

选择 Serverless AI 推理平台时，应考虑：

1. **冷启动要求**：
   - 亚秒级：Potassium、Modal
   - 1-10 秒：AWS SageMaker、Knative、Google Vertex AI、Azure ML
   - 10+ 秒：Hugging Face、Replicate、RunPod、OctoAI

2. **执行时间限制**：
   - 不受限：Knative、Hugging Face、Replicate、Modal、Potassium、RunPod、OctoAI
   - 15 分钟：AWS SageMaker
   - 60 分钟：Google Vertex AI、Azure ML

3. **计费模式偏好**：
   - 按请求：AWS SageMaker
   - 按秒：Replicate、RunPod
   - GPU 按小时：Hugging Face、Modal
   - 企业：Cyfuture AI
   - 按消耗量：Azure ML、Google Vertex AI

4. **生态集成**：
   - AWS 生态：SageMaker
   - Kubernetes 原生：Knative、KServe
   - Microsoft 生态：Azure ML
   - Google Cloud：Vertex AI
   - 开源模型：Hugging Face、Replicate

5. **GPU 支持**：
   - 强 GPU 支持：Hugging Face、Replicate、Modal、RunPod、OctoAI
   - 有限 GPU 支持：AWS SageMaker Serverless（主要是 CPU）
   - 灵活：Knative（取决于集群配置）

<a id="decision-matrix"></a>

### 决策矩阵

| 需求 | 推荐平台 |
|-------------|---------------------|
| 企业 AWS 工作负载 | AWS SageMaker Serverless |
| Kubernetes 原生部署 | Knative + KServe |
| 最低冷启动（<1s） | Potassium、Modal |
| 成本优化 | RunPod、Replicate |
| NLP/Transformer 模型 | Hugging Face |
| 生产推理 | Potassium、Cyfuture AI |
| AutoML 工作流 | Google Vertex AI |
| Microsoft 生态 | Azure ML |
| 高性能 ML | Modal、OctoAI |
| 开源灵活性 | Knative、Replicate |

<a id="key-considerations"></a>

## 关键考虑因素

<a id="performance-optimization"></a>

### 性能优化

1. **模型大小**：更小的模型冷启动更快
2. **容器优化**：尽量缩小镜像和依赖
3. **预热策略**：实现保活或定时探测
4. **缓存**：使用模型制品缓存，以及 LLM 的 KV 缓存
5. **批处理**：尽可能将请求分组以分摊启动成本

<a id="cost-management"></a>

### 成本管理

1. **合理配置资源**：使内存/计算与实际模型需求匹配
2. **使用模式**：Serverless 最适合多变/不可预测的流量
3. **监控**：跟踪冷启动频率与空闲时间
4. **混合方案**：将 Serverless 与承载基线负载的专用实例结合

<a id="operational-excellence"></a>

### 卓越运维

1. **监控**：跟踪延迟、冷启动、错误和成本
2. **日志**：实现全面的请求/响应日志
3. **版本管理**：使用修订管理实现安全发布
4. **测试**：通过负载测试了解伸缩行为
5. **SLA**：设置适当的超时和并发限制

<a id="security"></a>

### 安全

1. **访问控制**：实现适当的身份认证与授权
2. **网络隔离**：在可用时使用 VPC 和私有端点
3. **数据保护**：加密传输中和静态数据
4. **合规**：确保平台符合监管要求
5. **密钥管理**：使用平台原生密钥存储

<a id="references"></a>

## 参考资料

<a id="platforms"></a>

### 平台

- <a href="https://knative.dev/">`Knative`</a>：基于 Kubernetes 的 Serverless 平台
- <a href="https://aws.amazon.com/sagemaker/serverless-inference/">`AWS SageMaker Serverless`</a>：AWS 托管 Serverless 推理
- <a href="https://cloud.google.com/vertex-ai">`Google Vertex AI`</a>：Google Cloud AI 平台
- <a href="https://azure.microsoft.com/en-us/products/machine-learning">`Azure ML`</a>：Microsoft Azure ML 平台
- <a href="https://huggingface.co/inference-endpoints">`Hugging Face Inference Endpoints`</a>：托管 Transformer 模型服务
- <a href="https://replicate.com/">`Replicate`</a>：在云端运行开源模型
- <a href="https://modal.com/">`Modal`</a>：用于数据与 ML 的 Serverless 云
- <a href="https://www.banana.dev/">`Potassium (Banana)`</a>：生产 ML 推理
- <a href="https://www.runpod.io/">`RunPod`</a>：GPU 云计算
- <a href="https://octo.ai/">`OctoAI`</a>：优化的模型服务

<a id="related-documentation"></a>

### 相关文档

- [模型生命周期管理](./model-lifecycle.md)：冷启动优化策略
- [GPU Pod 冷启动](../kubernetes/gpu-pod-cold-start.md)：GPU 初始化优化
- [缓存策略](./caching.md)：KV 缓存与模型缓存技术
- [性能测试](./performance-testing.md)：Serverless 平台基准测试

<a id="community-resources"></a>

### 社区资源

- <a href="https://github.com/kubernetes/community/blob/master/wg-serving/README.md">`Kubernetes WG Serving`</a>
- <a href="https://kserve.github.io/website/">`KServe 社区`</a>
- <a href="https://github.com/knative/community">`Knative 社区`</a>

---

**说明**：平台规格和价格可能变化。做出部署决策前，务必通过官方平台文档核实当前能力与成本。冷启动时间和性能指标可能随模型大小、配置和流量模式而变化。
