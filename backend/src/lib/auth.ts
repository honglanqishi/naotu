import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '../db/client.js';

// 根据环境选择对应的 schema 和 provider
const isProduction = process.env.NODE_ENV === 'production';

const schema = isProduction
    ? await import('../db/schema.js')
    : await import('../db/schema.sqlite.js');

// 去尾斜杠：防止 better-auth origin 字符串匹配失败
const strip = (s: string) => s.replace(/\/+$/, '');
const frontendUrl = strip(process.env.FRONTEND_URL || 'http://localhost:3000');
const backendPort = process.env.BACKEND_PORT || '3001';
const frontendPort = process.env.FRONTEND_PORT || '3000';
const backendUrl = strip(process.env.BACKEND_URL || `http://localhost:${backendPort}`);
const configuredBetterAuthUrl = process.env.BETTER_AUTH_URL;

const resolvedBetterAuthUrl = strip((() => {
    if (isProduction) {
        return configuredBetterAuthUrl || backendUrl;
    }

    // 开发环境：优先使用显式 BETTER_AUTH_URL；
    // 未配置时默认走前端 origin（与 Google redirect_uri 常见配置一致）。
    return configuredBetterAuthUrl || frontendUrl;
})());

const trustedOrigins = Array.from(new Set([
    frontendUrl,
    resolvedBetterAuthUrl,
    backendUrl,
    `http://127.0.0.1:${frontendPort}`,
    `http://127.0.0.1:${backendPort}`,
]));

console.log('[auth] config:', { frontendUrl, backendUrl, resolvedBetterAuthUrl, trustedOrigins });

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: isProduction ? 'pg' : 'sqlite',
        schema: {
            user: schema.users,
            session: schema.sessions,
            account: schema.accounts,
            verification: schema.verifications,
        },
    }),

    // 邮箱 + 密码认证
    emailAndPassword: {
        enabled: true,
        autoSignIn: true,           // 注册后自动登录
        minPasswordLength: 6,
    },

    // Google OAuth 提供者
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
    },

    // 基础 URL
    baseURL: resolvedBetterAuthUrl,
    basePath: '/auth',

    // Session 配置
    session: {
        expiresIn: 60 * 60 * 24 * 30, // 30 天
        updateAge: 60 * 60 * 24,       // 每天更新
        cookieCache: {
            enabled: true,
            maxAge: 5 * 60,
        },
    },

    // 安全配置
    secret: process.env.BETTER_AUTH_SECRET!,

    // 信任的域名（允许这些来源的请求携带 session cookie）
    trustedOrigins,
});

export type Auth = typeof auth;


class MyPromise {

    state: 'pending' | 'fulfilled' | 'rejected'
    value: any
    reason: any
    onFulfilledCallbacks: Function[]
    onRejectedCallbacks: Function[]
  constructor(executor: (resolve: (value: any) => void, reject: (reason: any) => void) => void) {
    this.state = 'pending'
    this.value = undefined
    this.reason = undefined
    this.onFulfilledCallbacks = []   // 存 .then 的成功回调
    this.onRejectedCallbacks  = []   // 存 .then 的失败回调

    const resolve = (value: any) => {
      if (this.state !== 'pending') return
      this.state = 'fulfilled'
      this.value = value
      // 依次执行所有成功回调
      this.onFulfilledCallbacks.forEach(fn => fn(value))
    }

    const reject = (reason: any) => {
      if (this.state !== 'pending') return
      this.state = 'rejected'
      this.reason = reason
      this.onRejectedCallbacks.forEach(fn => fn(reason))
    }

    // 立即执行 executor，并传入我们自己定义的 resolve/reject
    try {
      executor(resolve, reject)
    } catch (err) {
      reject(err)
    }
  }

  then(onFulfilled: (value: any) => any, onRejected?: (reason: any) => any): MyPromise {
    // 返回一个新的 Promise（链式调用核心）
    return new MyPromise((resolve, reject) => {
      // 处理 fulfilled 情况
      if (this.state === 'fulfilled') {
        setTimeout(() => {  // 模拟微任务（then 回调是微任务）
          try {
            const x = onFulfilled(this.value)
            resolve(x)           // 关键：把上一个 then 的返回值传下去
          } catch (e) {
            reject(e)
          }
        }, 0)
      }
      // 处理 rejected 情况（类似上面）
      else if (this.state === 'rejected') {
        setTimeout(() => {
          try {
            const x = onRejected ? onRejected(this.reason) : this.reason
            resolve(x)   // 注意：rejected 也可以被 then 的第二个参数处理后变成 resolve
          } catch (e) {
            reject(e)
          }
        }, 0)
      }
      // pending 状态：先收集回调，等状态改变后再执行
      else {
        this.onFulfilledCallbacks.push((value: any) => {
          setTimeout(() => {
            try {
              const x = onFulfilled(value)
              resolve(x)
            } catch (e) { reject(e) }
          }, 0)
        })
        this.onRejectedCallbacks.push((reason: any) => {
          setTimeout(() => {
            try {
              const x = onRejected ? onRejected(reason) : reason
              resolve(x)
            } catch (e) { reject(e) }
          }, 0)
        })
      }
    })
  }
}