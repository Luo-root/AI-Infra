---
status: Active
maintainer: pacoxu
last_updated: 2026-03-24
tags: kubernetes, pod, lifecycle, scheduling, restart-policy, KEP-5307, KEP-5532
canonical_path: docs/kubernetes/pod-lifecycle.md
source_path: docs/kubernetes/pod-lifecycle.md
source_commit: 3cc83ef18ed502929e55d0e598129c7525e5f993
translation_status: translated
---

<a id="pod-lifecycle-in-kubernetes-recent-changes-and-enhancements"></a>

# Kubernetes 中的 Pod 生命周期：近期变化与增强

<a id="why-understanding-pod-lifecycle-matters"></a>

## 为什么要了解 Pod 生命周期

深入理解 Pod 生命周期对于 Kubernetes 用户和运维人员至关重要，主要有以下几个好处：

1. **处理 Pod 常见崩溃或故障**：深入了解 Pod 生命周期有助于诊断和解决常见问题，如容器崩溃、健康检查失败和 Pod 卡住等。理解容器何时以及为何重启，能够实现更好的故障排查和更快的恢复。

2. **优化 Pod 启动性能**：通过理解从调度到就绪的 Pod 初始化序列，您可以识别镜像拉取、init 容器执行和应用启动中的瓶颈，从而加快部署时间。

3. **实现高级模式**：现代应用通常需要复杂的生命周期管理，如优雅关闭、协调的 sidecar 启动或选择性容器重启。理解生命周期可以实现这些模式。

4. **资源效率**：适当的生命周期管理有助于优化资源利用率，防止资源泄漏，并确保 Pod 的干净终止。

<a id="pod-lifecycle-overview"></a>

## Pod 生命周期简介

![Pod 生命周期](../../diagrams/pod-lifecycle.png)

在 Kubernetes 中，Pod 经历几个标准生命周期**阶段**。这些阶段描述的是 Pod 的整体状态，而不是单个容器的状态。

想要详细了解 Pod 生命周期，可以先参考：

- [Kubernetes 官方文档：Pod 生命周期](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/)
- [中文博客：理解 Pod 生命周期（上）](https://mp.weixin.qq.com/s/3rViD6CLJ8wVadh_MPqovw)
- [中文博客：理解 Pod 生命周期（下）](https://mp.weixin.qq.com/s/MG5V8Pqa-Ua_Je9OXxdt1A)

<a id="pod-phases"></a>

### Pod 阶段

- **Pending（待定）**：Pod 已被接受，但容器尚未运行
- **Running（运行中）**：Pod 已绑定到节点，所有容器都已创建
- **Succeeded（成功）**：Pod 中的所有容器都已成功终止
- **Failed（失败）**：所有容器都已终止，至少有一个失败
- **Unknown（未知）**：无法确定 Pod 状态

<a id="pod-milestones-from-creation-to-readiness"></a>

### Pod 从创建到就绪的里程碑

<img src="https://github.com/user-attachments/assets/4c3eafd2-73fa-446a-90df-bb4dee2540b9" alt="Pod 从创建到就绪的里程碑">

*来源：《我的 Job 显示“Running”，但什么也没在运行：Kubernetes 状态核查》——[KubeCon NA 2025](https://sched.co/28D8Z)*

---

<a id="recent-enhancements-to-pod-lifecycle-kubernetes-135"></a>

## Pod 生命周期的近期增强（Kubernetes 1.35+）

Kubernetes 社区持续增强 Pod 生命周期管理。两个重要的增强特性正在针对 Kubernetes 1.35 版本开发：

<img src="https://github.com/user-attachments/assets/1cc61c54-6cde-4bda-ab88-6c6568aa51b0" alt="restartPolicy 可能就足够了">

*来源：KubeCon NA 2025 SIG-Node 维护者分会*

<a id="1-schedulinggates"></a>

### 1. SchedulingGates（调度门控）

SchedulingGates 允许您控制何时应调度 Pod。通过添加调度门控，您可以将 Pod 保持在“Pending”阶段，直到满足某些条件，防止过早调度。

**使用场景**：

- 等待外部资源被配置
- 协调批处理作业调度
- 实现自定义准入策略

<a id="2-container-restart-rules-kep-5307"></a>

### 2. 容器重启规则（KEP-5307）

**状态**：目标是在 Kubernetes 1.35 中达到 Beta 阶段

[KEP-5307](https://github.com/kubernetes/enhancements/blob/master/keps/sig-node/5307-container-restart-policy/README.md) 引入了细粒度的容器级重启策略规则，比传统的 Pod 级 `restartPolicy` 更加灵活。

<img src="https://github.com/user-attachments/assets/d2842c7e-3344-4323-8a43-c9e5a88d628f" alt="容器重启策略">

*来源：KubeCon NA 2025 SIG-Node 维护者分会*

<a id="key-features"></a>

#### 主要特性

- **覆盖 Pod 级重启策略**：提供每个容器的灵活性，而不是单一的 Pod 范围策略
- **条件的细粒度控制**：基于退出码的规则取代了通用的 Never/OnFailure/Always 策略
- **区分故障类型**：能够对硬件错误与可重试错误进行不同处理
- **动作的细粒度控制**：
  - **Restart（重启）**：传统的容器级重启，不终止 Pod
  - **RestartAllContainers（重启所有容器）**：重启 Pod 中的所有容器，包括 init 容器（参见 KEP-5532）
  - **TerminatePod（待定）**：终止整个 Pod
  - **Complete（待定）**：将容器视为已完成

<a id="benefits"></a>

#### 优势

这一增强对于[这篇关于容器退出策略的中文博客文章](https://mp.weixin.qq.com/s/X_yhEtvkYh2RSp1F0p1UZA)中描述的场景特别有用，包括：

- **任务完成处理**：基于主容器退出码将任务标记为完成，同时 sidecar 继续运行
- **选择性重启逻辑**：仅在特定退出码时重启特定容器
- **高级故障处理**：基于退出码范围采取不同动作

<a id="3-restartallcontainers-action-kep-5532"></a>

### 3. RestartAllContainers 动作（KEP-5532）

**状态**：目标是在 Kubernetes 1.35 中达到 Alpha 阶段

[KEP-5532](https://github.com/kubernetes/enhancements/blob/master/keps/sig-node/5532-restart-all-containers-on-container-exits/README.md) 引入了一个可以由容器退出触发的新动作：重启 Pod 中的所有容器。

<a id="key-features-1"></a>

#### 主要特性

- **更干净的重启**：重启 Pod 的所有容器，包括 init 容器，提供一个干净的起点
- **容器控制 Pod 生命周期**：允许容器对整个 Pod 生命周期拥有一定控制权
- **适用于所有容器类型**：可应用于常规容器、init 容器和 sidecar 容器

<a id="use-cases"></a>

#### 使用场景

1. **配置重新加载**：当配置容器退出时，触发完整的 Pod 重启以使所有容器重新加载新配置
2. **依赖管理**：当关键 sidecar 失败时，重启所有容器以确保一致状态
3. **协调更新**：使容器能够在满足某些条件时协调重启

<a id="restart-decision-runbook-kubernetes-135"></a>

## 重启判定操作手册（Kubernetes 1.35+）

在生产故障里，“Pod 重启了”常常混淆了多种事件。建议先用下表判定，再决定处理动作：

| 场景 | Pod UID | Pod IP | `restartCount` | 实际发生的情况 |
| --- | --- | --- | --- | --- |
| 容器崩溃/进程重启 | 不变 | 不变 | 增长 | 同一个 Pod 对象内原地重启容器 |
| 滚动更新/Pod 重建 | 改变 | 通常改变 | 重置为 `0` | 创建了新的 Pod 对象 |
| 原地调整大小（`cpu`、`NotRequired`） | 不变 | 不变 | 不变 | 仅更新 cgroup，不重启容器 |
| 原地调整大小（`memory`、`RestartContainer`） | 不变 | 不变 | 增长 | 策略触发同一个 Pod 内的容器重启 |

<a id="practical-rules"></a>

### 运维规则

- **kubelet 响应 PodSpec 变化**：直接改 ConfigMap/Secret 对象本身，不会自动触发重启。
- **通过环境变量使用的 ConfigMap/Secret 配置会被冻结**：进程环境在 `execve()` 时固定；要么执行滚动重启，要么使用应用级重新加载策略。
- **通过卷挂载使用的 ConfigMap/Secret 依靠符号链接切换**：应监听目录创建/重命名事件，而不是监听已打开文件描述符上的文件 `IN_MODIFY`。
- **显式设置内存调整策略**：默认内存调整行为可能不重启容器；若进程需要重新初始化内存相关设置，应设置 `RestartContainer`。
- **服务网格路由更新通常不重启**：Istio 的 xDS 路由更新不需要重建 Pod。

<a id="minimal-commands-for-on-call"></a>

### 值班最小命令集

```bash
# 1) Distinguish container restart vs pod recreation
kubectl get pod <pod> -o custom-columns=\
"NAME:.metadata.name,UID:.metadata.uid,IP:.status.podIP,RESTARTS:.status.containerStatuses[0].restartCount"

# 2) Check events
kubectl describe pod <pod> | grep -A 20 "Events:"

# 3) Check in-place resize status
kubectl get pod <pod> -o jsonpath='{.status.resize}'
```

**参考资料：**

- [Kubernetes 何时会重启你的 Pod，何时不会](https://www.cncf.io/blog/2026/03/17/when-kubernetes-restarts-your-pod-and-when-it-doesnt/)
- [配套实验仓库：opscart/k8s-pod-restart-mechanics](https://github.com/opscart/k8s-pod-restart-mechanics)

---

<a id="detailed-pod-lifecycle-diagrams"></a>

## 详细的 Pod 生命周期图表

<a id="comprehensive-pod-lifecycle-chinese"></a>

### 全面的 Pod 生命周期图（中文）

<img src="https://github.com/user-attachments/assets/1510eca1-f272-4e34-89e4-bf4d7e7dd3d0" alt="Pod 生命周期详细图（中文）">

*详细的 Pod 生命周期图，显示了用户、控制器、调度器、kubelet 和容器运行时之间的交互*

<a id="pod-lifecycle-state-transitions"></a>

### Pod 生命周期状态转换

<img src="https://github.com/user-attachments/assets/fd8346f2-78b9-4c43-81e5-5a3333c78f9c" alt="来自 WG Node Lifecycle 的 Pod 生命周期">

*来源：《Pod 生命周期》——WG Node Lifecycle，[KubeCon NA 2025](https://sched.co/28aCd)*

---

<a id="related-concepts"></a>

## 相关概念

- 容器状态
- Init 容器
- Sidecar 容器
- 存活探针
- 就绪探针
- 启动探针
- 重启策略
- 生命周期钩子：`preStop`、`postStart`
- 调度门控（SchedulingGates）

更多信息请参见 [Issue #1](https://github.com/pacoxu/AI-Infra/issues/1) 或 [Kubernetes 官方文档](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/)。

---

<a id="学习读代码前的理解--pre-learning-understanding"></a>

## 学习（读代码）前的理解

<a id="11-pod-生命周期--pod-lifecycle-overview"></a>

### 1.1. Pod 生命周期

1. 调用 APIServer 创建 Pod
2. Scheduler 监控到 Pod 没有 NodeName，进行节点分配
3. Kubelet 根据节点分配情况，通过 CRI 创建 Pod 的容器实例
4. 调用 APIServer 删除 Pod
5. 先标记 Pod Delete TimeStamp
6. Kubelet 获取到之后开始删除容器实例
7. 删除成功后，上报 Pod 删除成功

<a id="12-推测猜想--speculation-and-assumptions"></a>

### 1.2. 推测、猜想

1. 猜测 `--force --grace-period` 的时候可能表现不一样
2. 猜测有特殊的 finalizer 可能有不同表现
3. 节点驱逐发生的情况，Pod 删除请求可能是 kubelet 发出的
4. 一般场景，rs 发起创建和删除 Pod 的请求
5. StaticPod 可能有所不同，应该是 kubelet 发起的 Pod Create，并且 NodeName 是默认有的，不会触发调度
6. Kubelet webhook 跟 Pod 的逻辑关系

<a id="13-创建过程再细化一些根据经验-detailed-creation-process"></a>

### 1.3. 创建过程再细化一些（根据经验）

根据之前的排错经验：

<a id="pod-创建失败的情况--pod-creation-failure-scenarios"></a>

#### Pod 创建失败的情况

- 权限不足
- QoS 限制：不允许创建 best effort Pod 或者 limit range 不符合要求

<a id="pod-在-apiserver-创建好--pod-successfully-created-in-apiserver"></a>

#### Pod 在 ApiServer 创建好

- Static Pod 自带 Node Name 会跳过下面一步
- 早期版本指定 NodeName 的情况也会跳过下一步

<a id="调度器标记-pod-可以调度的节点--scheduler-marks-available-nodes"></a>

#### 调度器标记 Pod 可以调度的节点

- 无法调度，等待 1s、2s、4s 直到 5 分钟检查
- max pod 达到上限之后，是调度失败，还是调度后无法启动？

<a id="对应节点上的-kubelet-获取到这个信息使用-cri-去创建容器"></a>

#### 对应节点上的 Kubelet 获取到这个信息，使用 CRI 去创建容器

**Pause 容器：**

- 资源限制太小导致 Pause 容器无法启动
- 网络：首先创建 Pause 容器，并且做网络相关的初始化，使用的是本地 CNI
  - 如果 CNI 为 SDN 或者公有云，放行规则如何发送？

**存储：**

- 挂载和绑定存储使用 CSI（没有挂载会跳过）

**拉取镜像：**

- 拉取镜像超时、失败、无权限、已存在镜像等情况

<a id="init-容器--init-containers"></a>

#### Init 容器

**创建和运行应用容器：**

- 执行 PostStart

<a id="sidecaristioknative等-sidecar-istio-knative-etc"></a>

#### SideCar（Istio、Knative 等）

**传统 Sidecar：**

- 通过注入器（如 Istio）在 Pod 中添加辅助容器
- 与主容器并行运行，提供网络代理、监控等功能

**原生 Sidecar 容器（Kubernetes 1.29+）：**

- 使用 Init 容器配置 `restartPolicy: Always`
- 在主容器启动前启动，但持续运行整个 Pod 生命周期
- 提供原生的 Sidecar 支持，无需外部注入

```yaml
apiVersion: v1
kind: Pod
spec:
  initContainers:
  - name: sidecar-container
    image: busybox
    restartPolicy: Always  # 使其成为 sidecar
  containers:
  - name: main-container
    image: app
```

<a id="启动后--after-startup"></a>

#### 启动后

- 存活检查，可能会被终止
- OOM Kill
- Evicted

<a id="14-删除过程--deletion-process"></a>

### 1.4. 删除过程

Terminating → Terminated → 清理掉

---

<a id="学习过程--learning-process"></a>

## 学习过程

<a id="21-deployment-创建-pod-过程--deployment-pod-creation-process"></a>

### 2.1. Deployment 创建 Pod 过程

参考资料：

- [PDF.us 文章](https://pdf.us/2019/05/16/3407.html)
- [知乎文章](https://zhuanlan.zhihu.com/p/111241212)

<a id="事件示例--event-examples"></a>

#### 事件示例

```text
调度     Normal   Scheduled  <unknown>           default-scheduler
         Successfully assigned default/spring-46phs-deployment-5dd8d6646-98hdh
         to dce-10-7-177-10

镜像Pull Normal   Pulled     2m49s               kubelet, dce-10-7-177-10
         Container image "10.7.177.84/daocloud/spring-boot-sample@sha256:..."
         already present on machine

创建容器 Normal   Created    2m48s               kubelet, dce-10-7-177-10
         Created container user-container

启动容器 Normal   Started    2m46s               kubelet, dce-10-7-177-10
         Started container user-container

SideCar镜像Pull Normal   Pulled     2m46s               kubelet, dce-10-7-177-10
         Container image "10.7.177.84/kube-system/knative-serving-queue:v0.17.3"
         already present on machine

创建Sidecar容器 Normal   Created    2m46s               kubelet, dce-10-7-177-10
         Created container queue-proxy

启动Sidecar容器 Normal   Started    2m44s               kubelet, dce-10-7-177-10
         Started container queue-proxy

Readiness检查 Warning  Unhealthy  2m (x2 over 2m20s)  kubelet, dce-10-7-177-10
         Readiness probe failed: probe returned not ready

         Warning  Unhealthy  39s (x4 over 100s)  kubelet, dce-10-7-177-10
         Readiness probe failed: failed to probe: Get "http://127.0.0.1:8012/":
         context deadline exceeded (Client.Timeout exceeded while awaiting headers)
```

---

<a id="cni-网络分配详情--cni-network-allocation-details"></a>

## CNI 网络分配详情

参考资料：<https://www.qikqiak.com/post/pod-init-container/>

测试网络 CNI 了解到：

1. Pod 创建后申请网络，会请求 CNI 分配 IP
2. 容器进程全部崩溃（Pause 容器也退出的情况），重新启动过程，会重新申请 IP

   - 重启场景
   - 关闭过程：Pod IP 会被清理掉，回收 CNI 可以收到 del IP 请求
   - 启动过程：重新申请，网络组件需要保证同一个 Pod UUID 下次分配的 IP 跟之前保持一致。（这里不是看 Pod name，而是要看 UUID）

---

<a id="kubelet-逻辑-race-困境--kubelet-logic-race-conditions"></a>

## Kubelet 逻辑竞态困境

参考资料：

- [Kubernetes PR #102344](https://github.com/kubernetes/kubernetes/pull/102344)
- [设计文档](https://docs.google.com/document/d/1DvAmqp9CV8i4_zYvNdDWZW-V0FMk1NbZ8BAOvLRD3Ds/edit#)

<a id="kubelet-需要处理什么-what-does-kubelet-need-to-handle"></a>

### kubelet 需要处理什么？

1. 将 Pod 状态同步到 apiserver
2. 杀 Pod 需要 kubelet 去处理，默认有个优雅终止的协议；强制终止比较特别；静态 Pod 也需要特殊处理
3. kubelet 不是直接操作 Pod，而是通过容器运行时管理，因此使用 CRI 封装

<a id="问题在哪哪里容易-race-where-are-race-conditions"></a>

### 问题在哪？哪里容易出现竞态？

1. 如何区分 a) Pod 没有正在运行的容器；b) Pod 不能再启动容器了？Status Manager 的数据是否是最新的？
2. 随着临时容器和 sidecar 容器的增加，以及 init container，有些地方的逻辑忽略了对这些容器的处理

<a id="造成什么结果--what-are-the-consequences"></a>

### 造成什么结果

通常也不会造成太严重的问题，一般是 Pod 清理得很慢，或者完全卡住了：

1. 部分情况下，重启 kubelet 可以清理掉
2. 清理慢如果涉及到一些资源回收，就会导致应用更新非常缓慢，进而导致更多问题

<a id="解决方案--solutions"></a>
<a id="解决方案-solutions"></a>

### 解决方案

1. StatusManager 增强
2. 逻辑分离：
   - syncPod
   - syncTerminatingPod
   - syncTerminatedPod
3. 同步循环可以中止

基本从以上几点解决问题，缩短关闭时间。

---

<a id="pleg-pod-lifecycle-event-generator-详情"></a>

## PLEG（Pod 生命周期事件生成器）详情

<a id="generic--evented-pleg-详细流程--generic--evented-pleg-detailed-flow"></a>

### Generic + Evented PLEG 详细流程

参考资料：

- [SIG-Node 幻灯片](https://docs.google.com/presentation/d/1e-qJWe6He2qjt0PFiZtocqP8VbkrwKAI9B4X72L0bGk/edit?resourcekey=0-N77W7Q5UHuN5dFtekjmAIA#slide=id.g1b9bef2a0a0_3_248)
- [KubeCon 会议专场](https://sched.co/1PTJk)
- [Evented PLEG 讨论](https://docs.google.com/document/d/1GfWDoKAYiaXApxayXmPl9bcK5ewyiimFDJ966r28TUE/edit?tab=t.0)
- [Generic PLEG 设计](https://github.com/kubernetes/design-proposals-archive/blob/main/node/pod-lifecycle-event-generator.md?plain=1)
- [Evented PLEG KEP](https://github.com/kubernetes/enhancements/tree/master/keps/sig-node/3386-kubelet-evented-pleg)

<a id="pleg-工作原理--pleg-working-principles"></a>

### PLEG 工作原理

PLEG 负责监控 Pod 生命周期事件，并将状态变化通知 kubelet。它有两种类型：

- **Generic PLEG**：定期轮询容器运行时
- **Evented PLEG**：接收来自容器运行时的事件（效率更高）

---

<a id="附加资源--additional-resources"></a>

## 附加资源

<a id="生命周期图表--lifecycle-diagrams"></a>

### 生命周期图表

以下图表展示了 issue 评论中引用的详细 Pod 生命周期流程：

- [Pod 生命周期图 1](https://github.com/pacoxu/AI-Infra/assets/2010320/ca74609f-0c40-46a1-b3e1-016d627b0122)
- [Pod 生命周期图 2](https://github.com/pacoxu/AI-Infra/assets/2010320/819be861-1a45-47b4-a31e-f22d46b181ae)
- [PreStop 钩子流程](https://github.com/user-attachments/assets/79c6278c-4976-49c8-8348-c6636297e7e0)
- [Evented PLEG 流程](https://github.com/user-attachments/assets/87682f04-18ff-4366-8698-2bfa1765f1ec)

<a id="注意事项--notes"></a>

### 注意事项

基于 kubernetes 1.27-；在 v1.28 之后，init container 可以通过新的重启策略 always 成为 sidecar container。

---

> **译者注（原文版本状态，未独立核实）：** 原文末尾重复的中文介绍已与前文合并，全文仅保留一套内容。Kubernetes 1.35 的特性目标阶段、SchedulingGates 的版本归类、Sidecar 的 1.28/1.29 版本表述，以及 CNI 重启后 IP 保持不变等说法均按原文保留，未独立核实；“推测、猜想”与早期经验记录仍应按其原有性质阅读。API 字段、枚举、动作及函数名称保留原标识，不将说明文字视为新增 API。
