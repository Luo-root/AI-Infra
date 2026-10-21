---
status: Active
maintainer: pacoxu
last_updated: 2026-07-10
tags: kubernetes, nvidia, gpu, dra, device-plugin, gpu-operator
canonical_path: docs/kubernetes/nvidia-gpu-operator.md
source_path: docs/kubernetes/nvidia-gpu-operator.md
source_commit: 3cc83ef18ed502929e55d0e598129c7525e5f993
translation_status: translated
---

# NVIDIA GPU Operator

<a href="https://github.com/NVIDIA/gpu-operator">NVIDIA GPU Operator</a> 通过自动安装 GPU 驱动、容器运行时、设备插件和监控工具，并管理它们的生命周期，简化 Kubernetes 集群中 NVIDIA GPU 资源的部署与管理。

## 概述

GPU Operator 利用 Kubernetes Operator 模式管理运行 GPU 加速工作负载所需的全部 NVIDIA 软件组件。它消除了在每个节点上手动安装和配置 GPU 驱动及 CUDA 库的需要。

关于整卡 GPU、MIG、时间切片、MPS、vGPU、HAMi 和 DRA 之间的平台级选型指南，请参阅 [HAMi / MIG / GPU 共享](./hami-gpu-sharing.md)。

### 主要特性

- 自动安装和升级 GPU 驱动
- 容器运行时配置（nvidia-container-toolkit）
- 部署设备插件以管理 GPU 资源
- GPU 监控与遥测（DCGM Exporter）
- 支持多种 GPU 架构和配置
- 集成 MIG、时间切片、vGPU 和动态资源分配（DRA）

## 核心组件

### 1. Device Plugin（当前默认方案）

<a href="https://github.com/NVIDIA/k8s-device-plugin">**NVIDIA Device Plugin**</a> 通过 Kubernetes 传统设备插件框架实现 GPU 资源管理。

**主要特性：**

- 向 kubelet 公布 GPU 资源
- 通过时间切片支持 GPU 共享
- 支持 MIG（多实例 GPU）
- GPU 资源分配与跟踪

**用法：**

```yaml
resources:
  limits:
    nvidia.com/gpu: 1
```

### 2. DRA Driver for GPUs（未来方向）

<a href="https://github.com/NVIDIA/k8s-dra-driver-gpu">**NVIDIA DRA Driver for GPUs**</a> 使用动态资源分配提供下一代 GPU 资源管理，实现更加灵活且具备拓扑感知能力的调度。

**架构：**

DRA 驱动包含两个 kubelet 插件：

- <a href="https://github.com/NVIDIA/k8s-dra-driver-gpu/tree/main/cmd/gpu-kubelet-plugin">**gpu-kubelet-plugin**</a>：标准 GPU 资源分配插件
- <a href="https://github.com/NVIDIA/k8s-dra-driver-gpu/tree/main/cmd/compute-domain-kubelet-plugin">**compute-domain-kubelet-plugin**</a>：用于计算域管理的高级插件

**高级能力：**

- 通过专用计算域管理支持 GB200
- 拓扑感知 GPU 调度（感知 NVLink、NVSwitch）
- 细粒度资源分配
- 支持复杂的多 GPU 配置

**GB200 支持：**

DRA 驱动通过专用计算域管理，为 NVIDIA GB200 Grace Blackwell Superchip 平台提供增强支持。技术细节请参阅 <a href="https://docs.google.com/presentation/d/1Xupr8IZVAjs5bNFKJnYaK0LE7QWETnJjkz6KOfLu87E/edit?pli=1&slide=id.g373e0ebfa8e_1_233#slide=id.g373e0ebfa8e_1_233">GB200 DRA 架构演示文稿</a>。

**集成路线图：**

DRA 驱动将在未来版本中集成到 GPU Operator，为从设备插件迁移到基于 DRA 的资源管理提供路径。

**另请参阅：** [动态资源分配（DRA）](./dra.md) 全面介绍了 DRA 概念和使用模式；[HAMi / MIG / GPU 共享](./hami-gpu-sharing.md) 则介绍如何结合 GPU Operator 软件栈选择 MIG、时间切片、vGPU 和 HAMi。

### 3. Driver Manager

<a href="https://github.com/NVIDIA/k8s-driver-manager">**Driver Manager**</a> 自动完成 Kubernetes 节点上的 NVIDIA GPU 驱动安装与生命周期管理。

**特性：**

- 自动检测和安装驱动版本
- 节点专属驱动配置
- 驱动升级协调
- 支持不同节点使用多个驱动版本

### 4. DCGM Exporter

<a href="https://github.com/NVIDIA/dcgm-exporter">**DCGM Exporter**</a> 将 NVIDIA Data Center GPU Manager（DCGM）的指标暴露给 Prometheus，从而提供 GPU 遥测与监控。

**提供的指标：**

- GPU 利用率和温度
- 显存使用情况和错误
- 功耗
- PCIe 吞吐量
- 时钟频率
- ECC 错误与健康状态

## 附加组件

GPU Operator 还管理多个用于特定场景的组件：

### 运行时与发现

- **NVIDIA GPU Feature Discovery**：自动发现节点的 GPU 能力并添加标签
- **GPU Driver**：NVIDIA 数据中心 GPU 驱动
- **Container Toolkit**：用于容器运行时集成的 nvidia-container-toolkit

### 高级特性

- **MIG Manager**：多实例 GPU 配置与管理
- **Validator**：部署后验证 GPU 软件栈
- **DCGM**：用于健康监控的 NVIDIA Data Center GPU Manager
- **KubeVirt GPU Device Plugin**：为虚拟化工作负载提供 GPU 支持
- **vGPU Manager**：面向虚拟化平台的虚拟 GPU 管理

### 专用配置

- **GDS Driver**：用于 GPU 与存储之间直接传输的 GPUDirect Storage 驱动
- **Confidential Computing Manager**：为 GPU 工作负载提供 TEE（可信执行环境）支持
- **Kata Manager**：为 Kata Containers 运行时提供 GPU 支持
- **GDRCopy Driver**：为高速网络传输提供 GPUDirect RDMA 支持

## 部署

### 前提条件

- Kubernetes 集群（v1.24+）
- 配备 NVIDIA GPU 的 GPU 节点
- Node Feature Discovery（NFD）Operator（推荐）

### 安装

通过 Helm 安装：

```bash
# Add NVIDIA Helm repository
helm repo add nvidia https://helm.ngc.nvidia.com/nvidia
helm repo update

# Install GPU Operator
helm install gpu-operator nvidia/gpu-operator \
  --namespace gpu-operator \
  --create-namespace
```

### 验证

```bash
# Check GPU Operator pods
kubectl get pods -n gpu-operator

# Verify GPU resources
kubectl get nodes -o=custom-columns=NAME:.metadata.name,GPUs:.status.capacity."nvidia\.com/gpu"

# Test GPU workload
kubectl run gpu-test --image=nvidia/cuda:12.0.0-base-ubuntu20.04 \
  --limits=nvidia.com/gpu=1 -- nvidia-smi
```

## 配置

### Device Plugin 配置

配置 GPU 共享与资源策略：

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: device-plugin-config
  namespace: gpu-operator
data:
  config.yaml: |
    version: v1
    sharing:
      timeSlicing:
        replicas: 4
    mig:
      strategy: mixed
```

### DCGM Exporter 配置

自定义指标采集：

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: dcgm-exporter-config
  namespace: gpu-operator
data:
  metrics.csv: |
    # GPU utilization
    DCGM_FI_DEV_GPU_UTIL, gauge, GPU utilization
    # Memory usage
    DCGM_FI_DEV_FB_USED, gauge, GPU memory used
    DCGM_FI_DEV_FB_FREE, gauge, GPU memory free
```

## 最佳实践

### 生产部署

- 使用 Node Feature Discovery（NFD）自动给节点添加标签
- 为 GPU 命名空间配置资源配额和限制
- 启用 DCGM 指标采集以进行监控
- 为 GPU 错误和温度事件设置告警
- 谨慎使用 GPU 时间切片（会影响性能）

### 升级策略

- 在预发布环境中测试 GPU Operator 升级
- 升级前检查驱动兼容性矩阵
- 在驱动升级期间规划节点维护窗口
- 在升级期间和升级之后监控工作负载

### 故障排查

常见问题与解决方法：

```bash
# Check GPU Operator logs
kubectl logs -n gpu-operator -l app=nvidia-device-plugin-daemonset

# Verify driver installation
kubectl exec -n gpu-operator <driver-pod> -- nvidia-smi

# Check device plugin registration
kubectl get nodes -o json | jq '.items[].status.allocatable'

# Validate DCGM metrics
kubectl port-forward -n gpu-operator <dcgm-pod> 9400:9400
curl http://localhost:9400/metrics
```

## 迁移路径：从 Device Plugin 到 DRA

NVIDIA 正在积极开发 DRA 驱动，将其作为下一代 GPU 资源管理方案。迁移路径包括：

### 当前状态（Device Plugin）

- 稳定且可用于生产
- 简单的资源模型（`nvidia.com/gpu`）
- 拓扑感知能力有限
- 适用于基本的 GPU 分配

### 未来状态（DRA 驱动）

- 增强的拓扑感知能力
- 细粒度资源分配
- 支持复杂的多设备工作负载
- 更好地集成高级 GPU 特性（GB200、NVLink）

### 过渡策略

1. **评估阶段**：在开发集群中测试 DRA 驱动
2. **共存阶段**：同时运行设备插件与 DRA 驱动
3. **迁移阶段**：逐步将工作负载迁移到 DRA
4. **完成阶段**：弃用设备插件

GPU Operator 将在过渡期内支持两种方式，让运维人员可以按需求选择。

## 学习资源

### 官方文档

- <a href="https://docs.nvidia.com/datacenter/cloud-native/gpu-operator/latest/index.html">NVIDIA GPU Operator 文档</a>
- <a href="https://github.com/NVIDIA/gpu-operator">GPU Operator GitHub 仓库</a>
- <a href="https://github.com/NVIDIA/k8s-device-plugin">NVIDIA Device Plugin 文档</a>
- <a href="https://github.com/NVIDIA/k8s-dra-driver-gpu">NVIDIA DRA Driver 文档</a>

### 会议演讲

- **KubeCon NA 2024**：<a href="https://www.youtube.com/watch?v=Z_15EyXOnhU">Kubernetes WG Device Management——借助 DRA 管理 GPU、TPU、NIC 等设备</a> - Kevin Klues 和 Patrick Ohly
- **NVIDIA GTC 会议专场**：搜索“GPU Operator”和“Kubernetes”主题

### 社区资源

- <a href="https://github.com/kubernetes/community/blob/master/wg-device-management/README.md">Kubernetes WG Device Management</a>
- <a href="https://github.com/NVIDIA/gpu-operator/issues">GPU Operator 问题跟踪</a>
- NVIDIA 开发者论坛：云原生板块

## 相关主题

- **[动态资源分配（DRA）](./dra.md)**：理解 DRA 概念与架构
- **[HAMi / MIG / GPU 共享](./hami-gpu-sharing.md)**：在 GPU 分区、时间共享、虚拟 GPU、软件配额和 DRA 之间选型
- **[调度优化](./scheduling-optimization.md)**：GPU 调度策略与最佳实践
- **[节点资源接口（NRI）](./nri.md)**：细粒度容器资源管理
- **[工作负载隔离](./isolation.md)**：通过 GPU 检查点/恢复实现容错

## 路线图

正在开展的开发和提案：

- 将 DRA 驱动集成到 GPU Operator（进行中）
- 通过计算域管理增强 GB200 支持
- 多 GPU 拓扑优化
- 改进 GPU 健康监控与诊断
- 跨节点 GPU 互联网络管理（NVLink、NVSwitch）
- 用于 GPU 机密计算的 TEE（可信执行环境）

了解最新进展，请关注：

- <a href="https://github.com/NVIDIA/gpu-operator/issues">GPU Operator 问题列表</a>
- <a href="https://github.com/NVIDIA/k8s-dra-driver-gpu/issues">DRA Driver 问题列表</a>
- <a href="https://github.com/kubernetes/enhancements/issues/?q=is%3Aissue%20DRA%20in%3Atitle">Kubernetes DRA KEP</a>

---

**注意：** 部分即将推出的特性信息（尤其是 DRA 集成）反映的是规划中的功能。请查阅官方文档确认当前实现状态。

> **译者注（原文版本状态，未独立核实）：** DRA 集成路线图、组件能力、Kubernetes 最低版本及示例命令均按原文保留，未独立验证其当前可用性或兼容性。
