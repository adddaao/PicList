# EasyImages 无数据库图床 API 文档

> 基础信息
- 基础地址示例：`https://your-domain.example.com`
- 返回类型：`application/json; charset=utf-8`
- CORS：允许 `PUT, POST, GET, OPTIONS, DELETE`
- 统一字段：`code`（数字状态码）、`msg/message`（文本说明）、`result`（success/failed）

## 鉴权
- 上传接口使用表单字段 `token` 校验（配置在 `config/api_key.php`，验证逻辑在 `app/function.php:1322-1356`）
- 删除接口使用上传后返回的加密删除链接，不需要额外 Token

## 接口列表
### 1) 上传图片
- 方法：`POST /api/index.php`
- 说明：支持普通上传与分片上传；成功返回删除链接 `del`
- 表单（两种模式之一）：
  - 普通上传
    - `token`：字符串，必填
    - `image`：文件，必填
  - 分片上传
    - `token`：字符串，必填
    - `name`：字符串，最终文件名，必填
    - `chunk`：整数，当前分片顺序（从0开始），必填
    - `chunks`：整数，总分片数，必填
    - `file`：文件，当前分片数据，必填
- 成功返回示例（`api/index.php:165-177`）：
```json
{
  "result": "success",
  "code": 200,
  "url": "https://img.example.com/i/2025/11/25/a1b2c3.jpg",
  "srcName": "source.jpg",
  "thumb": "https://domain/app/thumb.php?img=/i/2025/11/25/a1b2c3.jpg",
  "del": "https://domain/app/del.php?hash=ABCD...",
  "id": 2,
  "message": "success"
}
```
- 常见失败：
  - 204 未选择文件（`api/index.php:18-28`）
  - 201 API关闭、202 Token错误、203 Token过期（`app/function.php:1329-1355`）
  - 205 黑/白名单或 MD5 黑名单命中（`api/index.php:30-40,116-130`）
  - 400 处理失败或客户端文件问题（`api/index.php:180-191`）
- 行为参考：
  - 返回缩略图链接或生成器（`api/index.php:151-163`）
  - 删除链接 `del`（可能关闭展示，`api/index.php:146-151`）
  - 上传后异步处理：日志、鉴黄、水印、压缩、外部同步（`api/index.php:194-209`）

### 2) 删除图片（加密链接）
- 方法：`GET /app/del.php?hash=<密文>`
- 说明：使用上传返回的 `del` 链接；如果开启回收站，则会原子移动到 `recycle/`
- 请求参数：
  - `hash`：加密的相对路径密文（加密/解密在 `app/function.php:560-574`）
- 成功返回示例（`app/del.php:34-41,57-64`）：
```json
{
  "code": 200,
  "msg": "删除成功",
  "type": "success",
  "icon": "ok-sign",
  "mode": "delete",
  "url": "/i/2025/11/25/a1b2c3.jpg"
}
```
- 失败返回示例（`app/del.php:43-51,66-73`）：
```json
{
  "code": 404,
  "msg": "文件不存在",
  "type": "danger",
  "icon": "exclamation-sign",
  "mode": "delete",
  "url": "/i/2025/11/25/a1b2c3.jpg"
}
```
- 删除逻辑：
  - 回收站开启：调用 `checkImg(relPath, 3, 'recycle/')` 原子 `rename`（`app/function.php:913-943`）
  - 直接删除：`easyimage_delete(url, 'url')`（目录限制+存在性校验，`app/function.php:612-638`）
  - FTP 同步删除：`any_upload(..., 'delete')`（`app/del.php:55-56`）

### 3) 缩略图生成/访问
- 访问生成：`GET /app/thumb.php?img=<相对路径>`（按配置生成或返回）
- 列表/访问缩略图：由 `thumbnail` 配置决定（参考 `app/function.php:971-1107`）

## 请求示例
- 上传（普通）
```bash
curl -X POST https://your-domain.example.com/api/index.php \
  -F "token=833c5611862efcaa9955205ee96125e9" \
  -F "image=@/path/to/picture.jpg"
```
- 上传（分片）
```bash
curl -X POST https://your-domain.example.com/api/index.php \
  -F "token=833c5611862efcaa9955205ee96125e9" \
  -F "name=bigfile.bin" \
  -F "chunk=0" \
  -F "chunks=10" \
  -F "file=@chunk_0"
```
- 删除（加密链接）
```bash
curl "https://your-domain.example.com/app/del.php?hash=ABCD..."
```

## 错误码说明
- 200 成功（上传/删除）
- 201 API 关闭（上传）
- 202 Token 错误（上传）
- 203 Token 过期（上传）
- 204 没有选择上传文件（上传）
- 205 黑/白名单或 MD5 黑名单命中（上传）
- 400 客户端文件问题或处理失败（上传）
- 404 文件不存在/删除失败（删除）

## 安全与防护
- Token 校验：`check_api($token)`（`app/function.php:1322-1356`）
- 路径遍历防护：删除前统一本地化与目录限制（`app/function.php:616-628`）
- 源图保护与隐藏路径：按配置返回受保护链接（`api/index.php:138-145`）
- CORS 与统一 JSON 头：`api/index.php:10-16`

## 文件映射与命名
- 存储根：`config['path']`（示例 `/i/`）
- 子目录：`config['storage_path']`（默认 `Y/m/d/`）
- 文件命名：`imgName()` 多种策略（`app/function.php:264-331`）
- 删除标识：`urlHash()` 对相对路径加密/解密（`app/function.php:560-574`）

## OpenAPI 3.0 片段
```yaml
openapi: 3.0.3
info:
  title: EasyImages 无数据库图床 API
  version: 1.0.0
servers:
  - url: https://your-domain.example.com
paths:
  /api/index.php:
    post:
      summary: 上传图片（支持分片）
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              oneOf:
                - type: object
                  properties:
                    token: { type: string }
                    image: { type: string, format: binary }
                  required: [token, image]
                - type: object
                  properties:
                    token: { type: string }
                    name: { type: string }
                    chunk: { type: integer }
                    chunks: { type: integer }
                    file: { type: string, format: binary }
                  required: [token, name, chunk, chunks, file]
      responses:
        '200':
          description: 上传成功
        '201':
          description: API 关闭
        '202':
          description: Token 错误
        '203':
          description: Token 过期
        '204':
          description: 未选择文件
        '205':
          description: 黑名单或 MD5 黑名单命中
        '400':
          description: 处理失败
  /app/del.php:
    get:
      summary: 删除图片（加密hash）
      parameters:
        - in: query
          name: hash
          schema: { type: string }
          required: true
      responses:
        '200':
          description: 删除成功或移入回收站
        '404':
          description: 文件不存在或删除失败
```

## 与兰空图床（Lsky Pro）对齐说明
- 兰空图床提供 RESTful `DELETE /api/v1/images/{key}` 并使用 `Authorization: Bearer <token>`，返回标准 JSON（参考社区讨论与示例脚本）。
- 当前实现为“加密链接删除 `GET /app/del.php?hash=...`”，非 RESTful DELETE，返回 JSON 字段包含 `code/msg/type/url`。
- 若需完全对齐兰空风格：
  - 可新增 `DELETE /api/images/{image_id}` 端点，使用 Bearer Token 与标准状态码；`image_id` 可为 `urlHash(path)` 的密文，服务端解密定位文件。
  - 返回 JSON 可映射为 `{code, message, data:{path}}` 或 `{status, message}`。

## 溯源文件与行号
- CORS/返回头与上传主逻辑：`api/index.php:10-16,57-177,194-209`
- 删除接口与返回结构：`app/del.php:23-74,79-133`
- 删除工具函数：`app/function.php:612-638`
- 回收站原子移动：`app/function.php:913-943`
- 加密/解密：`app/function.php:560-574`
- Token 校验：`app/function.php:1322-1356`
- 缩略图生成：`app/function.php:971-1107`
