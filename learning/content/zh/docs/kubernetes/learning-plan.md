---
status: Active
maintainer: pacoxu
last_updated: 2025-10-29
tags: kubernetes, learning-path, docker, cloud-native
canonical_path: docs/kubernetes/learning-plan.md
source_path: docs/kubernetes/learning-plan.md
source_commit: 3cc83ef18ed502929e55d0e598129c7525e5f993
translation_status: translated
---

# 📘 Kubernetes 学习计划

本文提供一条结构化的 Kubernetes 学习路径。有关 AI 基础设施（AI Infra）的具体主题，请参阅：

- [Pod 启动速度优化](./pod-startup-speed.md)
- [工作负载隔离](./isolation.md)
- [Pod 生命周期](./pod-lifecycle.md)
- [调度优化](./scheduling-optimization.md)
- [动态资源分配（DRA）](./dra.md)

## 🔰 阶段 0——基础：Docker 与容器基础知识

在深入学习 Kubernetes 之前，必须先了解容器的工作原理。

### ✅ 核心主题

- **Docker 基础**
  - 镜像、容器、卷
- **Docker 网络**
  - 桥接（Bridge）、主机网络（Host）、覆盖网络（Overlay）
- **容器镜像仓库**
  - DockerHub、Harbor
- **容器编排（Docker 原生）**
  - `docker-compose`
  - Swarm 与 SwarmKit：集群管理、基于 Raft 的领导者选举

---

## ⚙️ 阶段 1——Kubernetes 0.1 时代：初识 K8s

> **译者注：** 本文标题中的 Kubernetes “0.1／0.2／0.3 时代”是原作者自定义的学习阶段标记，不是 Kubernetes 的真实版本号，也不表示所列组件属于对应版本。

了解 Kubernetes 的早期架构和生态系统。

### ✅ 核心主题

- **基础网络**
  - CNI 插件：Calico、Flannel、Macvlan
  - Ingress、NodePort、外部负载均衡器（例如 F5）
- **存储**
  - 驱动：ScaleIO、Portworx
- **RBAC 与资源管理**
  - 基于角色的访问控制（RBAC）
  - ResourceQuota 与 LimitRange
  - 水平 Pod 自动扩缩容器（HPA）
- **可观测性**
  - Prometheus（监控）
  - EFK 技术栈（Elasticsearch + Fluentd + Kibana）
- **运行时**
  - Containerd

---

## 🚀 阶段 2——Kubernetes 0.2 时代：工具与生态扩展

深入了解提升 Kubernetes 易用性和运维能力的工具与组件。

### ✅ 核心主题

- **CoreDNS**——用于服务发现的 DNS
- **Knative**——Kubernetes 上的无服务器工作负载
- **集群引导工具**
  - `kubeadm`、`kind`
- **高级网络**
  - VLAN 集成
  - Istio 服务网格
  - Keepalived（用于高可用的虚拟 IP）
- **集群工具**
  - Velero（备份／恢复）
  - KubeFed v2（联邦）
  - VPA（垂直 Pod 自动扩缩容器）
  - Thanos（Prometheus 长期存储）

---

## 🌐 阶段 3——Kubernetes 0.3 时代：云原生生态系统

学习如何管理生产级、可扩展的多集群 Kubernetes 环境。由于这里涉及更多生态项目，其中一些项目可能仍处于沙箱阶段。

### ✅ 核心主题

- **集群部署**
  - Kubespray、Kops
- **下一代网络**
  - Cilium（eBPF）
  - Submariner（跨集群）
  - Whereabouts（IP 地址管理，IPAM）
  - MetalLB（裸机负载均衡）
- **现代存储**
  - HwameiStor、本地持久卷
- **镜像管理与联邦**
  - Harbor（容器镜像仓库）
  - Karmada（多集群编排）
- **身份认证与授权**
  - Dex、Pinniped（身份与访问管理）
- **可观测性与服务网格增强**
  - Clusterpedia（集群状态查询）
  - Merbridge（基于 eBPF 的 Istio 加速）
  - OpenTelemetry（追踪、指标、日志）

---

## 🛠 推荐资源

- [Kubernetes 官方文档](https://kubernetes.io/)
- [Awesome Kubernetes GitHub 列表](https://github.com/ramitsurana/awesome-kubernetes)
- 动手实践工具：
  - [Play with Kubernetes](https://labs.play-with-k8s.com/)
  - `kind`、`minikube`、`k3s`

---

学习愉快！🚀

如果你想进一步了解 Kubernetes，请参阅 https://kubernetes.io/ 。这里是我的个人学习笔记。
