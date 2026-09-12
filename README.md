# TradeLens · 贸差眼

把中国货源价、目标国售价、国际运费、海关关税与 VAT、平台佣金、广告与退货摊进同一张利润表。

> 市面上的工具是割裂的：海外选品工具不知道中国采购成本，中国采购平台不知道海外终端动销，
> 关税/运费工具是孤立的单点查询。TradeLens 把这三段接成一条链。

## 快速开始

```bash
npm install
npm run dev          # http://localhost:3000
```

**不需要数据库也能跑。** 未配置 `DATABASE_URL` 时应用以内存演示模式启动：
参考数据（市场 / 商品 / 税则 / 运价 / 平台费率）来自种子常量，自选与测算记录存在进程内存中，重启清空。
页脚会显示演示模式提示，不会让人误以为数据已落库。

### 启用持久化

```bash
docker compose up -d db
cp .env.example .env          # 填入 docker-compose 里的连接串
npm run db:push               # 建表
npm run dev                   # 首次启动自动灌种子
```

`GET /api/health` 会回报当前用的是哪套存储：

```json
{ "ok": true, "store": "postgres", "durable": true }
```

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 开发服务器 |
| `npm run build` | 生产构建（不需要数据库） |
| `npm test` | 精算引擎单元测试 |
| `npm run verify` | typecheck + lint + test |
| `npm run db:push` | 按 schema 建表（需 `DATABASE_URL`） |

## 架构

```
src/
  app/              Next.js App Router：页面 + API 路由
  components/       UI 组件
  lib/
    profit.ts       全成本精算引擎（纯函数，无 IO，被单测覆盖）
    catalog.ts      目录查询与机会构建
    assistant.ts    Hermes 助手的意图识别与检索
    seed-data.ts    参考数据常量（税则 / 运价 / 商品 / 平台费率）
  server/
    http.ts         API 边界：Zod 入参校验 + 错误归一化
    store/          数据访问层
      types.ts        TradeStore 接口
      postgres.ts     Postgres 实现（含幂等灌种子）
      memory.ts       内存实现（演示模式）
      seed-catalog.ts 种子数据 → 行数据的唯一转换入口
  db/               Drizzle schema 与惰性连接
```

**分层原则**：业务代码只依赖 `TradeStore` 接口，不直接 import drizzle。
两套实现产生的主键完全一致（在 `seed-catalog.ts` 里确定性分配），
所以 `/products/42` 在演示模式和持久化模式下指向同一个商品。

## 计算口径

精算引擎刻意对齐真实报关口径，这几处是 Excel 手算最常出错的地方：

- **关税以 CIF 为基数**（货值 + 运费 + 保费），不是货值。
- **VAT 计税基 = CIF + 关税**，是复利叠加，不是只对 CIF 征。
- **计费重取实重与体积重的较大者**（1 CBM = 167kg）；海运则按 CBM 计费，不折体积重。
- **最低收费按订单件数摊薄**后再与按重量计算的运费取大。
- VAT 可抵扣时不计入到岸成本，但仍会报出税额。

以上口径均有单元测试锁定，见 `src/lib/profit.test.ts`。

## 对外接口

`GET /api/assistant/tools` 返回工具描述，供 Hermes 等个人助手接入。
核心接口：`/api/opportunities`、`/api/calculator`、`/api/customs`、`/api/shipping`、`/api/markets`、`/api/products`。

## 数据免责

当前参考数据（税率、运价、平台费率、终端售价）为**可校准的模型基准值，不是实时行情**。
关税与 de minimis 政策变动频繁，实操前请复核报关行与承运商报价。
接入实时数据源属于 M2 阶段工作。
