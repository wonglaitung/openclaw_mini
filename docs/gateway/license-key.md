# License Key 系统

## 概述

License Key 系统用于防止离线部署的 OpenClaw 客户端被滥用。系统采用 **公钥签名验证** 方式，确保客户端无法伪造 License。

## 安全架构

### 公钥签名验证流程

```
管理员端（离线、安全环境）:
┌─────────────────────────────────────────┐
│  1. 生成密钥对（一次性）                  │
│     private.key (私钥) - 安全保管         │
│     public.key (公钥) - 分发给客户端      │
│                                         │
│  2. 创建 License                         │
│     payload = {username, expiresAt}     │
│     signature = RSA.sign(private.key, payload) │
│     license.key = {payload, signature}  │
└─────────────────────────────────────────┘

客户端:
┌─────────────────────────────────────────┐
│  configs/                               │
│  ├── public.key (公钥)                   │
│  └── license.key (签名后的 License)      │
│                                         │
│  验证流程:                               │
│  1. 读取 license.key                    │
│  2. 用 public.key 验证签名               │
│  3. 检查用户名、过期时间                  │
└─────────────────────────────────────────┘
```

### 为什么安全？

1. **客户端无法伪造 License**：没有私钥无法生成有效签名
2. **公钥可以公开**：客户端持有公钥只能验证，不能签名
3. **适合离线环境**：无需在线服务器验证

## 文件位置

| 角色   | 文件                  | 说明                              |
| ------ | --------------------- | --------------------------------- |
| 管理员 | `admin/private.key`   | RSA 私钥（2048 位），离线安全保管 |
| 管理员 | `admin/public.key`    | RSA 公钥，分发给客户端            |
| 客户端 | `configs/public.key`  | 公钥（用于验证签名）              |
| 客户端 | `configs/license.key` | 签名后的 License                  |

## License 内容

License 包含以下信息：

| 字段        | 说明                 |
| ----------- | -------------------- |
| `version`   | 版本号（当前为 1）   |
| `username`  | 绑定的用户名         |
| `issuedAt`  | 签发时间（ISO 8601） |
| `expiresAt` | 过期时间（ISO 8601） |

## 有效期限制

- **最长有效期**：180 天（半年）
- **宽限期**：过期后 24 小时内仍可运行（仅警告）
- **续期提醒**：过期前 72 小时开始提醒

## 使用方式

### 1. 生成密钥对（管理员）

在安全的管理员环境下执行：

```bash
node scripts/license-generator.mjs generate-keys \
  --private-output admin/private.key \
  --public-output configs/public.key
```

输出：

```
Key pair generated:
  Private key: admin/private.key (KEEP SECURE!)
  Public key: configs/public.key (distribute to clients)
```

**重要**：私钥必须安全保管，不能泄露到客户端！

### 2. 创建 License（管理员）

```bash
node scripts/license-generator.mjs create \
  --username "zhangsan" \
  --valid-days 30 \
  --private-key admin/private.key \
  --output configs/license.key
```

输出：

```
License created: configs/license.key
  Username: zhangsan
  Valid for: 30 days
  Expires: 2026-06-21T00:00:00.000Z
```

### 3. 验证 License（客户端）

```bash
node scripts/license-generator.mjs verify \
  --license configs/license.key \
  --public-key configs/public.key
```

输出：

```
License Details:
  Algorithm: rsa-sha256
  Username: zhangsan
  Issued: 2026-05-22T00:00:00.000Z
  Expires: 2026-06-21T00:00:00.000Z
  Signature: Valid
  Status: Valid
```

### 4. 分发到客户端

将以下文件复制到客户端的 `configs/` 目录：

- `configs/public.key`
- `configs/license.key`

## Gateway 配置

在 `configs/offline-bank.json` 中添加：

```json
{
  "gateway": {
    "license": {
      "enabled": true,
      "gracePeriodHours": 24,
      "renewalWarningHours": 72
    }
  }
}
```

| 配置项                | 说明                 | 默认值  |
| --------------------- | -------------------- | ------- |
| `enabled`             | 启用 License 验证    | `false` |
| `gracePeriodHours`    | 宽限期（小时）       | `24`    |
| `renewalWarningHours` | 续期提醒阈值（小时） | `72`    |

## Gateway 启动验证

Gateway 启动时会自动验证 License：

### 验证成功

```
[gateway] License valid for user: zhangsan (expires: 2026-06-21T00:00:00.000Z)
[gateway] listening on ws://127.0.0.1:18789
```

### 用户名不匹配

```
[gateway] License validation failed: Username mismatch: expected zhangsan, got other-user
Gateway failed to start: Gateway cannot start: Username mismatch
```

### License 过期（宽限期内）

```
[gateway] License expired. Grace period ends in 18 hours. Please renew your license.
[gateway] listening on ws://127.0.0.1:18789 (running in grace period)
```

### License 过期（超过宽限期）

```
[gateway] License validation failed: License expired at 2026-05-20T00:00:00.000Z and grace period (24h) exceeded
Gateway failed to start: Gateway cannot start: License expired
```

## 跨平台用户名获取

系统自动获取当前用户名进行验证：

| 平台    | 用户名来源                                               |
| ------- | -------------------------------------------------------- |
| Windows | `USERNAME` 环境变量 或 `os.userInfo().username`          |
| Linux   | `USER` 或 `LOGNAME` 环境变量 或 `os.userInfo().username` |
| macOS   | `USER` 或 `LOGNAME` 环境变量 或 `os.userInfo().username` |

## 续期流程

1. License 过期前 72 小时，Gateway 启动时会显示续期提醒
2. 管理员使用私钥重新生成 License
3. 将新的 `license.key` 分发给客户端
4. 客户端重启 Gateway 即可

## 常见问题

### Q: License 签名验证失败

**原因**：License 文件可能被篡改，或公钥与私钥不匹配

**解决**：

1. 确认 `public.key` 是与生成 License 时使用的私钥匹配
2. 重新生成 License

### Q: 用户名不匹配

**原因**：License 绑定的用户名与当前系统用户名不同

**解决**：

1. 检查当前用户名：`node scripts/license-generator.mjs verify --license configs/license.key --public-key configs/public.key`
2. 为正确的用户名重新生成 License

### Q: License 过期

**原因**：License 已超过有效期

**解决**：

1. 如果在宽限期内（24 小时），Gateway 会警告但继续运行
2. 联系管理员续期

### Q: 找不到 License 文件

**原因**：`configs/license.key` 或 `configs/public.key` 不存在

**解决**：

1. 确认文件存在
2. 从管理员处获取这两个文件

## 技术细节

### 签名算法

- **算法**：RSA-SHA256
- **密钥长度**：2048 位
- **签名格式**：Base64 编码

### License 文件格式

```json
{
  "algorithm": "rsa-sha256",
  "payload": {
    "version": 1,
    "username": "zhangsan",
    "issuedAt": "2026-05-22T00:00:00.000Z",
    "expiresAt": "2026-06-21T00:00:00.000Z"
  },
  "signature": "Base64编码的签名..."
}
```

### 公钥文件格式

PEM 格式的 RSA 公钥：

```
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END PUBLIC KEY-----
```
