---
status: Active
maintainer: pacoxu
last_updated: 2025-11-04
tags: observability, monitoring, metrics, gpu, llm, inference
canonical_path: docs/observability/README.md
source_path: docs/observability/README.md
source_commit: 3cc83ef18ed502929e55d0e598129c7525e5f993
translation_status: translated
---

<a id="observability-of-ai-workloads"></a>
# AI 工作负载的可观测性

可观测性对于大规模运行 AI 工作负载至关重要。本指南涵盖 AI 基础设施栈中的监控、指标和可观测性工具：从 GPU 硬件，到推理性能，再到调度器效率。

<a id="overview"></a>
## 概览

AI 工作负载可观测性横跨多个层次：

1. **基础设施层**：GPU 利用率、内存、温度、功耗
2. **推理层**：请求延迟、吞吐量、token 指标
3. **调度器层**：队列深度、调度延迟、资源分配
4. **应用层**：LLM 请求 trace、提示词性能、模型质量

关于智能体到工具到沙箱的 trace 关联、事件字段、查询和仪表盘建议，请参阅[智能体、工具与沙箱可观测性](agent-otel-genai.md)。

<a id="infrastructure-side-observability"></a>
## 基础设施侧可观测性

<a id="gpu-monitoring"></a>
### GPU 监控

跟踪硬件层面的 GPU 健康状态和利用率指标：

**关键指标：**

- **GPU 利用率**：GPU 正在实际执行计算的时间百分比
- **GPU 内存**：每个 GPU 已分配内存与可用内存
- **温度**：运行温度和热降频
- **功耗**：每个 GPU 使用的瓦特数和集群总功耗
- **SM 占用率**：流式多处理器利用率
- **NVLink/PCIe 带宽**：GPU 间以及 CPU-GPU 的通信速度

**工具和项目：**

- <a href="https://github.com/NVIDIA/dcgm-exporter">`NVIDIA DCGM Exporter`</a>：用于 NVIDIA Data Center GPU Manager 指标的 Prometheus exporter。在 Kubernetes 中进行 GPU 监控的行业标准工具。
- <a href="https://github.com/NVIDIA/gpu-operator">`NVIDIA GPU Operator`</a>：自动部署 DCGM 和监控栈的 Kubernetes operator。详情请参阅 [NVIDIA GPU Operator](../kubernetes/nvidia-gpu-operator.md)。
- <a href="https://github.com/kubernetes-sigs/metrics-server">`Metrics Server`</a>：Kubernetes SIG 的资源指标项目（CPU、内存、GPU）。
- <a href="https://github.com/prometheus/prometheus">`Prometheus`</a>：CNCF Graduated 项目。用于指标采集和告警的时序数据库。
- <a href="https://github.com/grafana/grafana">`Grafana`</a>：CNCF Incubating 项目。用于 GPU 和基础设施指标的可视化与仪表盘。

**示例查询：**

```promql
# GPU utilization across cluster
avg(DCGM_FI_DEV_GPU_UTIL) by (gpu, kubernetes_node)

# GPU memory usage percentage
(DCGM_FI_DEV_FB_USED / (DCGM_FI_DEV_FB_USED + DCGM_FI_DEV_FB_FREE)) * 100

# GPUs with high temperature
DCGM_FI_DEV_GPU_TEMP > 80
```

<a id="node-and-cluster-metrics"></a>
### 节点与集群指标

除 GPU 外，还要监控计算、网络和存储资源：

- **CPU/内存**：节点级资源利用率
- **网络**：带宽、丢包、RDMA 指标
- **存储**：模型加载和 checkpoint 时的 I/O 吞吐量、延迟
- **NUMA**：影响 GPU 性能的非统一内存访问模式

<a id="inference-side-observability"></a>
## 推理侧可观测性

<a id="key-inference-metrics"></a>
### 关键推理指标

LLM 推理性能通过多个关键指标进行衡量：

**延迟指标：**

- **TTFT（Time to First Token，首 token 时间）**：从提交请求到生成首个 token 的时间。对交互式应用的用户体验至关重要。目标：实时聊天小于 200ms。
- **TPOT（Time Per Output Token，每个输出 token 时间）**：首个 token 之后生成每个后续 token 的时间。影响流式传输速度。目标：流畅流式传输小于 50ms。
- **ITL（Inter-Token Latency，token 间延迟）**：连续 token 之间时间的变化。较低的 ITL 可提供一致的流式体验。
- **E2E 延迟**：从提交请求到完成的总请求延迟。

**吞吐量指标：**

- **每秒 token 数（TPS）**：所有请求每秒生成的 token 总数。
- **每秒请求数（RPS）**：每秒完成的推理请求数。
- **批大小**：一起处理的请求数（越高通常意味着更好的 GPU 利用率）。

**资源指标：**

- **KV Cache 利用率**：Transformer 模型中用于键值缓存的内存。
- **Decode 效率**：计算时间与 token 生成时间的比率。
- **GPU 计算利用率**：GPU 正在实际执行推理的百分比。

**质量指标：**

- **Token 准确率**：用于推测解码和 draft 模型。
- **缓存命中率**：用于前缀缓存和提示词缓存策略。

<a id="inference-observability-tools"></a>
### 推理可观测性工具

**OpenTelemetry 原生方案：**

- <a href="https://github.com/openlit/openlit">`OpenLit`</a>：面向 AI Engineering 的开源平台，提供基于 OpenTelemetry 的原生 LLM 可观测性。为 GenAI 应用提供指标、trace 和日志。
- <a href="https://github.com/traceloop/openllmetry">`OpenLLMetry`</a>：基于 OpenTelemetry 的 GenAI 和 LLM 应用开源可观测性方案。可与流行的 LLM 框架进行单行集成。

**LLM 专用平台：**

- <a href="https://github.com/langfuse/langfuse">`Langfuse`</a>：开源 LLM 工程平台，提供可观测性、指标、评估和提示词管理。支持跟踪复杂的 LLM 链和智能体工作流。
- <a href="https://github.com/truera/trulens">`TruLens`</a>：用于 LLM 实验和 AI 智能体的评估与跟踪。提供用于质量评估的反馈函数。

**模型验证与测试：**

- <a href="https://github.com/deepchecks/deepchecks">`Deepchecks`</a>：用于持续验证 ML 模型和数据的测试工具。包括漂移检测和模型性能监控。

**网络与分布式 trace：**

- <a href="https://github.com/deepflowio/deepflow">`DeepFlow`</a>：具有深度网络可视性的可观测性平台。支持跨分布式 AI 工作负载和微服务的 trace。
- <a href="https://github.com/okahu">`Okahu`</a>：专注于 AI 基础设施可观测性和优化的组织。

<a id="inference-platform-integration"></a>
### 推理平台集成

大多数 LLM 推理平台都提供内置可观测性：

**vLLM 指标：**

```python
# vLLM exposes Prometheus metrics at /metrics endpoint
- vllm:prompt_tokens_total
- vllm:generation_tokens_total
- vllm:time_to_first_token_seconds
- vllm:time_per_output_token_seconds
- vllm:num_requests_running
- vllm:gpu_cache_usage_perc
```

**Ray Serve（用于分布式推理）：**

```python
# Ray dashboard provides detailed metrics
- ray_serve_replica_processing_latency_ms
- ray_serve_num_router_requests
- ray_serve_deployment_queued_queries
```

**Triton Inference Server：**

```bash
# Triton metrics endpoint
curl http://localhost:8002/metrics

# Key metrics
nv_inference_request_success
nv_inference_request_duration_us
nv_inference_queue_duration_us
nv_gpu_utilization
```

<a id="scheduler-side-observability"></a>
## 调度器侧可观测性

<a id="kubernetes-scheduler-metrics"></a>
### Kubernetes 调度器指标

监控调度效率和资源分配：

**关键指标：**

- **调度延迟**：从 Pod 创建到作出调度决策的时间
- **调度尝试次数**：成功调度前的尝试次数
- **Pending Pod**：按原因统计等待调度的 Pod
- **抢占事件**：为更高优先级 Pod 而驱逐低优先级 Pod
- **队列深度**：批处理调度队列中等待的作业

**Kubernetes 原生指标：**

```promql
# Scheduling latency by operation
histogram_quantile(0.99,
  sum(rate(scheduler_scheduling_duration_seconds_bucket[5m]))
  by (le, operation))

# Pending pods by reason
sum(kube_pod_status_phase{phase="Pending"}) by (reason)

# Failed scheduling attempts
rate(scheduler_schedule_attempts_total{result="error"}[5m])
```

**批调度器可观测性：**

- <a href="https://github.com/kubernetes-sigs/kueue">`Kueue`</a>：Kubernetes 作业排队，提供队列深度指标、准入延迟和资源配额利用率。
- <a href="https://github.com/volcano-sh/volcano">`Volcano`</a>：批调度器，提供 gang scheduling 指标、作业生命周期跟踪和队列管理。
- <a href="https://github.com/koordinator-sh/koordinator">`Koordinator`</a>：基于 QoS 的调度，提供细粒度资源指标和协同部署效率。

<a id="gpu-scheduling-metrics"></a>
### GPU 调度指标

GPU 工作负载调度的专用指标：

- **GPU 分配时间**：查找并分配 GPU 资源所需的时间
- **GPU 碎片化**：由分配模式导致的 GPU 容量浪费
- **多 GPU 作业调度**：需要多个 GPU 的作业的延迟
- **调度后的 GPU 利用率**：实际 GPU 使用量与请求 GPU 使用量的对比

**工具：**

- <a href="https://github.com/Project-HAMi/HAMi">`HAMi`</a>：异构 AI 计算虚拟化中间件，提供 GPU 共享指标
- <a href="https://github.com/NVIDIA/k8s-device-plugin">`NVIDIA Device Plugin`</a>：Kubernetes 中的 GPU 分配跟踪

<a id="best-practices"></a>
## 最佳实践

<a id="1-instrumentation-strategy"></a>
### 1. 埋点策略

- **从基础设施指标开始**：GPU、CPU、内存、网络
- **增加推理指标**：应用层的 TTFT、TPOT、吞吐量
- **实施分布式 trace**：跟踪跨服务的请求
- **启用调试日志**：可配置的详细程度，用于故障排查

<a id="2-alerting-and-slos"></a>
### 2. 告警与 SLO

为关键指标定义服务级别目标：

```yaml
# Example SLO for inference latency
- alert: HighTTFT
  expr: histogram_quantile(0.95, ttft_seconds) > 0.5
  annotations:
    summary: "95th percentile TTFT exceeds 500ms"

- alert: LowGPUUtilization
  expr: avg(DCGM_FI_DEV_GPU_UTIL) < 30
  annotations:
    summary: "GPU utilization below 30% - possible inefficiency"
```

<a id="3-performance-optimization-workflow"></a>
### 3. 性能优化工作流

1. **建立基线**：测量当前性能（TTFT、TPOT、GPU 利用率）
2. **识别瓶颈**：使用指标找出约束（GPU、内存、网络）
3. **优化**：应用技术（批处理、缓存、量化）
4. **验证**：测量改进情况并确保没有回归
5. **监控**：持续跟踪以检测性能下降

<a id="4-cost-optimization"></a>
### 4. 成本优化

使用可观测性数据降低基础设施成本：

- **合理选择 GPU 实例规格**：让工作负载匹配 GPU 容量
- **识别空闲资源**：缩减利用率不足的 GPU
- **优化批大小**：最大化每个 GPU 的吞吐量
- **缓存常用提示词**：减少重复计算

<a id="5-multi-tenant-monitoring"></a>
### 5. 多租户监控

对于共享 AI 基础设施：

- **按租户统计指标**：资源使用量、请求量、延迟
- **公平共享执行**：监控配额违规并告警
- **检测 noisy neighbor**：识别影响其他租户的工作负载
- **成本分摊/成本展示**：为成本分配准确归因使用量

<a id="integration-with-cloud-native-ecosystem"></a>
## 与云原生生态集成

<a id="observability-stack"></a>
### 可观测性栈

**推荐架构：**

```text
┌─────────────────────────────────────────────────────────────┐
│                     Grafana (Dashboards)                     │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │
┌─────────────────────────────────────────────────────────────┐
│              Prometheus (Metrics Storage)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ DCGM Exporter│  │ vLLM Metrics │  │ K8s Metrics  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │
┌─────────────────────────────────────────────────────────────┐
│              OpenTelemetry Collector                         │
│  (Traces, Metrics, Logs from LLM Applications)              │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │
┌─────────────────────────────────────────────────────────────┐
│          AI Workloads (Inference, Training)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   vLLM       │  │   SGLang     │  │  Training    │      │
│  │   Pods       │  │   Pods       │  │  Jobs        │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

<a id="cncf-projects-for-observability"></a>
### 用于可观测性的 CNCF 项目

- <a href="https://github.com/prometheus/prometheus">`Prometheus`</a>：CNCF Graduated。指标采集和告警
- <a href="https://github.com/open-telemetry/opentelemetry-collector">`OpenTelemetry`</a>：CNCF Incubating。统一的可观测性框架
- <a href="https://github.com/grafana/grafana">`Grafana`</a>：CNCF Incubating。可视化与仪表盘
- <a href="https://github.com/grafana/loki">`Loki`</a>：CNCF Incubating。日志聚合
- <a href="https://github.com/jaegertracing/jaeger">`Jaeger`</a>：CNCF Graduated。分布式 trace

<a id="learning-path"></a>
## 学习路径

<a id="phase-1-foundation-week-1-2"></a>
### 阶段 1：基础（第 1-2 周）

- 理解 Prometheus 指标和 PromQL 基础
- 部署 DCGM Exporter 并创建 GPU 监控仪表盘
- 学习 OpenTelemetry 概念（trace、指标、span）

<a id="phase-2-inference-observability-week-3-4"></a>
### 阶段 2：推理可观测性（第 3-4 周）

- 使用 OpenLLMetry 或 OpenLit 为 LLM 推理埋点
- 跟踪 TTFT、TPOT 和吞吐量指标
- 创建推理性能仪表盘
- 为延迟 SLO 设置告警

<a id="phase-3-advanced-topics-week-5-6"></a>
### 阶段 3：高级主题（第 5-6 周）

- 跨 LLM 服务实施分布式 trace
- 监控批调度器（Kueue、Volcano）
- 构建成本归因和成本分摊仪表盘
- 基于可观测性数据优化工作负载

<a id="llm-capability-evaluation-llm-能力评测"></a>
## LLM 能力评测

作为运行时可观测性的补充，模型评测从知识、推理、代码生成、指令遵循、事实性、安全性和多语言能力等维度衡量 LLM 输出的质量。

<a id="open-source-evaluation-frameworks"></a>
### 开源评测框架

| 工具 | 描述 |
| --- | --- |
| [lm-eval-harness](https://github.com/EleutherAI/lm-evaluation-harness) | 通用评测框架，带有数百个任务适配器 |
| [OpenCompass](https://github.com/open-compass/opencompass) | 一体化评测系统，任务集丰富，适合内部平台 |
| [HELM](https://github.com/stanford-crfm/helm) | Stanford 的系统化评测框架，具有全面的维度设计 |
| [AlpacaEval](https://github.com/tatsu-lab/alpaca_eval) | 用于指令遵循和对话质量的自动化成对评测 |
| [lighteval](https://github.com/huggingface/lighteval) | Hugging Face 的轻量级评测框架，易于集成到 CI 中 |
| [EvalPlus](https://github.com/evalplus/evalplus) | 增强版 HumanEval 代码评测，使用更严格的测试用例 |
| [SWE-bench](https://github.com/princeton-nlp/SWE-bench) | 用于评估代码智能体的真实软件工程任务基准 |
| [FastChat / MT-Bench](https://github.com/lm-sys/FastChat) | 多轮对话评测脚本和基准 |
| [Ragas](https://github.com/explodinggradients/ragas) / [DeepEval](https://github.com/confident-ai/deepeval) | RAG 流水线和应用链质量评测 |

<a id="key-benchmark-datasets"></a>
### 关键基准数据集

- **知识与语言**：MMLU / MMLU-Pro、ARC、HellaSwag、TruthfulQA
- **推理与数学**：GSM8K、MATH、BBH (Big-Bench Hard)、AIME
- **代码**：HumanEval / MBPP、EvalPlus、SWE-bench、LiveCodeBench
- **指令遵循**：MT-Bench、AlpacaEval、IFEval
- **安全**：AdvBench、HarmBench、RealToxicityPrompts
- **多语言**：XNLI、XQuAD / TyDiQA、MIRACL

<a id="references-and-further-reading"></a>
## 参考资料与延伸阅读

- [CNCF Observability Landscape](https://landscape.cncf.io/?group=observability-and-analysis)
- [Prometheus Best Practices](https://prometheus.io/docs/practices/)
- [OpenTelemetry for LLMs](https://opentelemetry.io/docs/languages/)
- [NVIDIA DCGM Documentation](https://docs.nvidia.com/datacenter/dcgm/)
- [Kubernetes Monitoring Architecture](https://kubernetes.io/docs/tasks/debug/debug-cluster/resource-metrics-pipeline/)
- 另请参阅：[Kubernetes Guide](../kubernetes/README.md)，了解调度器指标
- 另请参阅：[Inference Guide](../inference/README.md)，了解推理平台指标

<a id="roadmap"></a>
## RoadMap

正在进行的提案和讨论：

- 通过 DRA（Dynamic Resource Allocation）增强 GPU 指标
- 在推理引擎之间标准化 LLM 指标格式
- 与 Kubernetes WG AI Gateway 集成，以实现统一的可观测性
- 基于可观测性数据提供成本优化建议

---

_本指南汇总了 AI 基础设施的可观测性最佳实践。有关具体实现细节，请参阅各层的链接文档。_

> 译者注：本文忠实保留源文对项目 CNCF 阶段、工具能力、指标定义和性能目标的陈述；这些事实未在本次翻译中独立核实，不代表对其当前准确性或适用性的确认。
