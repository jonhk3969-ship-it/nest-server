# 📈 Scaling Plan - Upgrade Guide

## Tổng Quan

Khi user tăng, anh cần upgrade 3 components:
1. **EC2** (NestJS Server) - CPU/RAM
2. **Redis Cloud** - Memory/Ops
3. **MongoDB Atlas** - Storage/IOPS

---

## 🎯 Scaling Thresholds

| Users | EC2 | Redis | MongoDB | Chi phí ước tính |
|-------|-----|-------|---------|------------------|
| **0-500** | t3.small | 250MB | M10 | ~$70/month |
| **500-1000** | t3.medium | 1GB | M10 | ~$100/month |
| **1000-3000** | t3.large | 2.5GB | M20 | ~$180/month |
| **3000-5000** | t3.xlarge | 5GB | M30 | ~$350/month |
| **5000-10000** | c5.2xlarge | 12GB | M40 | ~$700/month |
| **10000+** | Cluster (K8s) | Redis Cluster | M50+ Sharded | $1500+/month |

---

## 📊 Chi Tiết Từng Mức

### Level 1: 0-500 Users (Hiện tại)

```
EC2: t3.small (2 vCPU, 2GB RAM) - $15/month
Redis: 250MB - $7/month
MongoDB: M10 (2GB RAM, 10GB Storage) - $57/month
────────────────────────────────────
Total: ~$79/month
```

**Dấu hiệu cần upgrade:**
- CPU usage > 70% liên tục
- Response time > 100ms
- Redis memory > 200MB

---

### Level 2: 500-1000 Users ⭐ Recommended Start

```
EC2: t3.medium (2 vCPU, 4GB RAM) - $30/month
Redis: 1GB ($22/month) ← Anh đang dùng
MongoDB: M10 (2GB RAM) - $57/month
────────────────────────────────────
Total: ~$109/month
```

**Upgrade steps:**
1. EC2: Change instance type trong AWS Console
2. Redis: Đã có 1GB rồi ✅
3. MongoDB: Giữ nguyên M10

---

### Level 3: 1000-3000 Users

```
EC2: t3.large (2 vCPU, 8GB RAM) - $60/month
Redis: 2.5GB - $44/month
MongoDB: M20 (4GB RAM, 20GB Storage) - $140/month
────────────────────────────────────
Total: ~$244/month
```

**Upgrade steps:**
1. **EC2**: AWS Console → Instance → Stop → Change type → t3.large → Start
2. **Redis**: Redis Cloud → Database → Configuration → Increase to 2.5GB
3. **MongoDB**: Atlas → Cluster → Modify → Select M20

**Dấu hiệu cần upgrade tiếp:**
- Redis ops/sec > 2000 liên tục
- MongoDB connections > 400
- DB query time > 50ms

---

### Level 4: 3000-5000 Users

```
EC2: t3.xlarge (4 vCPU, 16GB RAM) - $120/month
Redis: 5GB - $85/month
MongoDB: M30 (8GB RAM, 40GB Storage) - $280/month
────────────────────────────────────
Total: ~$485/month
```

**Thêm optimizations:**
- Enable **Redis High Availability** (Single Zone)
- Enable **MongoDB Replica Set** (đã có sẵn trong Atlas)
- Consider running **2 NestJS instances** behind Load Balancer

---

### Level 5: 5000-10000 Users

```
EC2: c5.2xlarge (8 vCPU, 16GB RAM) - $250/month
     + Load Balancer - $20/month
     + 2 instances = $500/month total
Redis: 12GB + High Availability - $200/month
MongoDB: M40 (16GB RAM) - $560/month
────────────────────────────────────
Total: ~$1,280/month
```

**Architecture changes:**
```
                    ┌─────────────┐
                    │   AWS ALB   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────┴─────┐┌─────┴─────┐┌─────┴─────┐
        │ NestJS 1  ││ NestJS 2  ││ NestJS 3  │
        └─────┬─────┘└─────┬─────┘└─────┬─────┘
              │            │            │
              └────────────┼────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
        ┌─────┴─────┐             ┌─────┴─────┐
        │   Redis   │             │  MongoDB  │
        │  Cluster  │             │  Replica  │
        └───────────┘             └───────────┘
```

---

### Level 6: 10000+ Users (Enterprise)

```
Kubernetes Cluster:
  - 5-10 NestJS pods (auto-scaling)
  - Ingress Controller
  
Redis: Redis Enterprise Cloud - $500+/month
MongoDB: M50+ Sharded Cluster - $1000+/month
────────────────────────────────────
Total: $2,500-5,000+/month
```

---

## 🔧 Upgrade Commands Cheat Sheet

### EC2 Instance Type Change
```bash
# 1. Stop instance (AWS Console hoặc CLI)
aws ec2 stop-instances --instance-ids i-xxxxx

# 2. Change type
aws ec2 modify-instance-attribute --instance-id i-xxxxx --instance-type t3.large

# 3. Start
aws ec2 start-instances --instance-ids i-xxxxx
```

### Redis Cloud Upgrade
1. Dashboard → Databases → Select database
2. Configuration → Scale
3. Select new size → Confirm
4. **Zero downtime** - tự động migrate

### MongoDB Atlas Upgrade
1. Atlas Dashboard → Clusters → Select cluster
2. "..." menu → Modify → Select new tier
3. Click "Apply Changes"
4. **Zero downtime** - rolling upgrade

---

## 📊 Monitoring Metrics

### Khi nào cần upgrade?

| Component | Metric | Threshold | Action |
|-----------|--------|-----------|--------|
| EC2 | CPU | > 70% sustained | Upgrade instance |
| EC2 | Memory | > 80% | Upgrade instance |
| Redis | Memory | > 80% capacity | Upgrade plan |
| Redis | Ops/sec | > 80% limit | Upgrade plan |
| MongoDB | Connections | > 80% limit | Upgrade tier |
| MongoDB | Disk I/O | High alert | Upgrade tier |

### Monitoring Tools
- **EC2**: AWS CloudWatch
- **Redis**: Redis Cloud Dashboard → Metrics
- **MongoDB**: Atlas → Metrics tab

---

## 💡 Pro Tips

### 1. Scale Gradually
Đừng nhảy từ M10 lên M40. Scale từ từ để tiết kiệm chi phí.

### 2. Set Alerts
```
Redis Cloud: Set alert khi memory > 70%
MongoDB Atlas: Set alert khi connections > 300
AWS: Set CloudWatch alarm khi CPU > 60%
```

### 3. Horizontal vs Vertical
- **< 5000 users**: Vertical scaling (upgrade instance size)
- **> 5000 users**: Horizontal scaling (add more instances)

### 4. Cost Optimization
- Dùng **Reserved Instances** cho EC2 (tiết kiệm 30-50%)
- MongoDB Atlas **prepaid** discount
- Redis Cloud **annual plan** discount

---

## 📅 Scaling Timeline Example

| Month | Users | Action | Cost |
|-------|-------|--------|------|
| 1 | 100 | Start với setup hiện tại | $80 |
| 3 | 500 | Monitor, no change | $80 |
| 6 | 1500 | Upgrade MongoDB M20, Redis 2.5GB | $180 |
| 9 | 3000 | Upgrade EC2 t3.xlarge, MongoDB M30 | $350 |
| 12 | 5000 | Add Load Balancer + 2nd instance | $700 |
