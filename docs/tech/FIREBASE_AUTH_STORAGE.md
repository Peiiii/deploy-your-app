# Firebase（参考）：Auth + 存储方案

本文件用于“对标学习”：提炼 Firebase 在 **无需自建后端** 场景下的身份与数据能力拆分，供 GemiGo App SDK 设计参考。

---

## 0) API 设计（先看这个：代表性接口）

> 说明：Firebase 按产品拆成多个 SDK 包，这里按 Web/JS 最常见的模块化 SDK 写“核心 API 面”。（移动端也有对应 API，但心智类似。）

### 0.1 Auth（客户端侧）

- 初始化：
  - `initializeApp(firebaseConfig)`
  - `getAuth(app)`
- 登录/注册：
  - `signInWithEmailAndPassword(auth, email, password)`
  - `createUserWithEmailAndPassword(auth, email, password)`
  - `signInWithPopup(auth, provider)`（Google/GitHub 等）
  - `signInAnonymously(auth)`（匿名）
- 会话/身份：
  - `onAuthStateChanged(auth, callback)`
  - `auth.currentUser`
  - `getIdToken(user, forceRefresh?)`
- 登出：
  - `signOut(auth)`

### 0.2 Firestore（结构化数据）

- 初始化：`getFirestore(app)`
- 基础读写：
  - `collection(db, name)` / `doc(db, path...)`
  - `getDoc(docRef)` / `setDoc(docRef, data, { merge? })` / `updateDoc(docRef, data)` / `deleteDoc(docRef)`
  - `addDoc(collectionRef, data)`（自动 id）
- 查询/订阅（核心体验之一）：
  - `query(collectionRef, where(...), orderBy(...), limit(...))`
  - `getDocs(queryRef)`
  - `onSnapshot(docOrQueryRef, callback)`（实时订阅）

### 0.3 Realtime Database（可选：实时树形数据）

- 初始化：`getDatabase(app)`
- 基础：`ref(db, path)` + `set/update/get/onValue`

### 0.4 Cloud Storage（文件）

- 初始化：`getStorage(app)`
- 文件操作：
  - `ref(storage, path)`
  - `uploadBytes(ref, data)` / `uploadBytesResumable(ref, data)`
  - `getDownloadURL(ref)`
  - `deleteObject(ref)`
  - `listAll(ref)`（列举）

### 0.5 Cloud Functions（托管计算）

- 初始化：`getFunctions(app)`
- 调用：
  - `httpsCallable(functions, name)(data)`

## 1) Auth（登录与身份）

### 1.1 核心心智（PM）

- 开发者可以“前端直接登录”，快速获得稳定用户身份与跨端一致体验。
- Auth 与数据产品深度集成：拿到身份后就能直接访问托管数据/函数。

### 1.2 典型机制（架构）

- 客户端登录后得到由平台签发的身份凭证（常见为短期 ID token + 长期 refresh token 的组合）。
- 客户端每次访问数据/函数都带上 token，由服务端（或托管数据层）验证并做访问控制。

### 1.3 关键安全点（我们应学习）

- **服务端强制访问控制**：Security Rules（规则）是 Firebase 允许“前端直连数据”的前提。
- **最小权限 + 可治理**：规则、配额、审计、计费口径非常清晰。

### 1.4 对 GemiGo 的映射（建议）

- 我们已经有：短期 `access_token` + `scopes`（Auth V0）。
- 我建议 V0 的存储采用“默认隔离 + scopes + 配额/审计”先兜住；V1 再引入更细粒度 rules（避免范围爆炸）。

---

## 2) 存储（数据 vs 文件）

### 2.1 数据存储（Firestore / RTDB）

- Firestore/RTDB 提供结构化数据能力，配合 Rules 控制访问。
- 常见开发体验特征：多端同步、离线缓存、监听订阅（实时）。

### 2.2 文件存储（Cloud Storage）

- 文件/图片/大对象与“数据表”分开管理，权限也能通过规则体系/签名 URL 控制。

### 2.3 对 GemiGo 的映射（建议）

- V0：不复刻 Firestore 查询/订阅，先做 `gemigo.cloud.kv`（跨设备数据真相源）+ `etag/ifMatch`（避免多端覆盖）。
- V1：引入 `gemigo.cloud.blob`（大对象），并把 usage/配额/审计作为第一优先级能力。
