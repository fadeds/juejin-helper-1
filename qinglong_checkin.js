/**
 * 掘金助手 - 青龙面板版
 * 功能：模拟访问掘金首页和签到页、SDK埋点上报、每日签到
 *
 * 环境变量:
 *   JJ_COOKIE     掘金Cookie (多用户用换行 \n 分隔)
 *
 * 依赖:
 *   axios
 *
 * 青龙定时建议: 30 6 * * *  (每天北京时间 06:30)
 */

const axios = require("axios");
const crypto = require("crypto");

/* ======================== 工具函数 ======================== */

function wait(ms = 0) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomRangeNumber(start = 500, end = 1000) {
  return (Math.random() * (end - start) + start) >> 0;
}

function generateUUID() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/* ======================== Cookie 处理 ======================== */

class Cookie {
  constructor(cookie = "") {
    this.stack = new Map();
    this.cookie = "";
    if (cookie) this.setCookieValue(cookie);
  }

  setCookieValue(cookie = "") {
    this.stack.clear();
    this.cookie = cookie;
    cookie
      .split("; ")
      .map(s => s.split("="))
      .forEach(([k, v]) => this.stack.set(k, v));
  }

  get(key) {
    return this.stack.get(key);
  }

  entries() {
    return this.stack.entries();
  }

  clear() {
    this.cookie = "";
    this.stack.clear();
  }

  toString() {
    return this.cookie;
  }
}

function parseCookieTokens(cookie) {
  const tokens = { aid: "", uuid: "", user_unique_id: "", web_id: "" };
  const reg = /^__tea_cookie_tokens_(\d+)$/;
  for (const [key, value] of cookie.entries()) {
    if (reg.test(key)) {
      tokens.aid = key.match(reg)[1];
      const json = JSON.parse(decodeURIComponent(decodeURIComponent(value)));
      tokens.uuid = json.user_unique_id;
      tokens.user_unique_id = json.user_unique_id;
      tokens.web_id = json.web_id;
      break;
    }
  }
  return tokens;
}

/* ======================== 掘金 API 客户端 ======================== */

class JuejinHelper {
  constructor() {
    this.cookie = new Cookie();
    this.cookieTokens = null;
    this.user = null;
  }

  async login(cookieStr) {
    this.cookie.setCookieValue(cookieStr);
    this.cookieTokens = parseCookieTokens(this.cookie);
    this.user = await this.request("/user_api/v1/user/get", "GET");
  }

  logout() {
    this.cookie.clear();
    this.user = null;
  }

  getCookie() {
    return this.cookie.toString();
  }

  getCookieTokens() {
    return this.cookieTokens;
  }

  getUser() {
    return this.user;
  }

  async makeToken() {
    const res = await axios.get("https://juejin.cn/get/token", {
      headers: { cookie: this.getCookie(), referer: "https://juejin.cn/" }
    });
    if (res.data.err_no) throw new Error(res.data.err_msg);
    return res.data.data;
  }

  /**
   * 掘金主站 API 请求 (api.juejin.cn)
   */
  async request(path, method = "GET", data = undefined) {
    const tokens = this.cookieTokens;
    const separator = path.indexOf("?") === -1 ? "?" : "&";
    const url = tokens
      ? `https://api.juejin.cn${path}${separator}aid=${tokens.aid}&uuid=${tokens.uuid}`
      : `https://api.juejin.cn${path}`;

    const res = await axios({
      url,
      method,
      data,
      headers: {
        cookie: this.getCookie(),
        referer: "https://juejin.cn/",
        origin: "https://juejin.cn",
        "content-type": "application/json"
      }
    });

    if (res.data.err_no) throw new Error(res.data.err_msg);
    return res.data.data;
  }
}

/* ======================== 任务: 模拟访问 ======================== */

class MockVisitTask {
  taskName = "模拟访问";

  constructor(juejin) {
    this.juejin = juejin;
    this.results = [];
  }

  async run() {
    console.log("--------模拟访问---------");
    const pages = [
      { path: "/", name: "掘金首页" },
      { path: "/user/center/signin", name: "掘金每日签到" }
    ];

    for (const page of pages) {
      try {
        await this.visitPage(page.path);
        this.results.push({ name: page.name, success: true });
        console.log(`${page.name}：页面访问成功`);
      } catch (e) {
        this.results.push({ name: page.name, success: false, error: e.message });
        console.log(`${page.name}：页面访问失败`);
      }
      await wait(randomRangeNumber(2000, 5000));
    }
    console.log("-------------------------");
  }

  async visitPage(path) {
    const url = `https://juejin.cn${path}`;
    await axios.get(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        Cookie: this.juejin.getCookie(),
        DNT: "1",
        Host: "juejin.cn",
        Pragma: "no-cache",
        Priority: "u=0, i",
        Referer: path === "/" ? "https://juejin.cn/" : "https://juejin.cn/",
        "Sec-Ch-Ua": '"Microsoft Edge";v="149", "Chromium";v="149", "Not)A;Brand";v="24"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": path === "/" ? "none" : "same-origin",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0"
      },
      timeout: 30000,
      decompress: true
    });
  }

  toString() {
    return this.results.map(r => `${r.name}: ${r.success ? "成功" : "失败"}`).join("\n");
  }
}

/* ======================== 任务: SDK 埋点 ======================== */

class SdkTask {
  taskName = "埋点";

  constructor(juejin) {
    this.juejin = juejin;
    this.sdkType = "npm";
    this.sdkLib = "js";
    this.sdkVersion = "4.2.9";
    this.calledSdkSetting = false;
    this.calledTrackGrowthEvent = false;
    this.calledTrackOnloadEvent = false;
  }

  async run() {
    try {
      await this.slardarSDKSetting();
      this.calledSdkSetting = true;
    } catch {
      this.calledSdkSetting = false;
    }

    try {
      const result = await this.mockTrackGrowthEvent();
      if (result && result.e === 0) {
        this.calledTrackGrowthEvent = true;
      } else {
        throw result;
      }
    } catch {
      this.calledTrackGrowthEvent = false;
    }

    try {
      const result = await this.mockTrackOnloadEvent();
      if (result && result.e === 0) {
        this.calledTrackOnloadEvent = true;
      } else {
        throw result;
      }
    } catch {
      this.calledTrackOnloadEvent = false;
    }
  }

  async slardarSDKSetting() {
    const res = await axios.get("https://i.snssdk.com/slardar/sdk_setting", {
      params: { bid: "juejin_web" },
      headers: {
        accept: "*/*",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
        "content-type": "application/json",
        origin: "https://juejin.cn",
        priority: "u=1, i",
        referer: "https://juejin.cn/",
        "sec-ch-ua": '"Microsoft Edge";v="149", "Chromium";v="149", "Not)A;Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "cross-site",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0",
        cookie: `MONITOR_WEB_ID=${this.juejin.cookie.get("MONITOR_WEB_ID")}`
      }
    });
    const data = res.data;
    if ("e" in data) return data;
    if (data.errno !== 200) throw new Error(data.message);
    return data.data;
  }

  async list(events = []) {
    const cookieTokens = this.juejin.getCookieTokens();
    const userInfo = this.juejin.getUser();
    const userIsLogin = !!userInfo;

    const payload = [
      {
        events,
        header: {
          app_id: Number(cookieTokens?.aid),
          browser: "Edge",
          browser_version: "149.0.0.0",
          custom: JSON.stringify(
            userIsLogin
              ? {
                  student_verify_status: userInfo.student_status ? "student" : "not_student",
                  user_level: userInfo.level
                }
              : {}
          ),
          device_model: "Windows NT 10.0",
          os_name: "windows",
          os_version: "10",
          resolution: "1920x1080",
          screen_width: 1920,
          screen_height: 1080,
          width: 1920,
          height: 1080,
          language: "zh-CN",
          platform: "Web",
          referrer: "",
          referrer_host: "",
          sdk_lib: this.sdkLib,
          sdk_version: this.sdkVersion,
          timezone: 8,
          tz_offset: -28800,
          utm_campaign: "ad",
          utm_medium: "user_center"
        },
        local_time: (Date.now() / 1000) >> 0,
        user: {
          user_id: userInfo?.user_id || "",
          user_is_login: userIsLogin,
          user_unique_id: cookieTokens?.user_unique_id || "",
          web_id: cookieTokens?.web_id || ""
        }
      }
    ];

    const res = await axios.post("https://mcs.snssdk.com/list", payload, {
      headers: {
        accept: "*/*",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
        "content-type": "application/json",
        origin: "https://juejin.cn",
        priority: "u=1, i",
        referer: "https://juejin.cn/",
        "sec-ch-ua": '"Microsoft Edge";v="149", "Chromium";v="149", "Not)A;Brand";v="24"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "cross-site",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0",
        host: "mcs.snssdk.com"
      }
    });
    return res.data;
  }

  async mockTrackGrowthEvent() {
    const sessionid = generateUUID();
    const localtime = Date.now();
    const eventindex = localtime + randomRangeNumber(4000, 10000);

    return this.list([
      {
        ab_sdk_version: "90000611,90001195",
        event: "task_center_sign_in_visit",
        is_bav: 0,
        local_time_ms: localtime + 1,
        params: JSON.stringify({ event_index: eventindex + 1, _staging_flag: 0 }),
        session_id: sessionid
      },
      {
        ab_sdk_version: "90000611,90001195",
        event: "predefine_pageview",
        is_bav: 0,
        local_time_ms: localtime,
        params: JSON.stringify({
          $is_first_time: "false",
          event_index: eventindex,
          referrer: "",
          time: localtime,
          title: "每日签到 - 掘金",
          url: "https://juejin.cn/user/center/signin",
          url_path: "/user/center/signin",
          _staging_flag: 0
        }),
        session_id: sessionid
      }
    ]);
  }

  async mockTrackOnloadEvent() {
    const cookieTokens = this.juejin.getCookieTokens();
    const localtime = Date.now();

    return this.list([
      {
        event: "onload",
        local_time_ms: localtime,
        params: JSON.stringify({
          app_id: Number(cookieTokens?.aid),
          app_name: "",
          sdk_version: this.sdkVersion,
          sdk_type: this.sdkType,
          sdk_config: {
            app_id: Number(cookieTokens?.aid),
            channel: "cn",
            log: false,
            enable_ab_test: true,
            ab_channel_domain: "https://abtestvm.bytedance.com",
            cross_subdomain: true,
            cookie_expire: 94608000000,
            cookie_domain: "juejin.cn",
            enable_stay_duration: true,
            maxDuration: 1200000
          }
        })
      }
    ]);
  }

  toString() {
    return [
      `SDK状态: ${this.calledSdkSetting ? "成功" : "失败"}`,
      `成长API事件埋点: ${this.calledTrackGrowthEvent ? "成功" : "失败"}`,
      `OnLoad事件埋点: ${this.calledTrackOnloadEvent ? "成功" : "失败"}`
    ].join("\n");
  }
}

/* ======================== 任务: 每日签到 ======================== */

class GrowthTask {
  taskName = "签到";

  constructor(juejin) {
    this.juejin = juejin;
    this.todayStatus = 0; // 0=未签到 1=本次签到 2=已签到
    this.incrPoint = 0;
    this.sumPoint = 0;
    this.contCount = 0;
    this.sumCount = 0;
  }

  async run() {
    const todayStatus = await this.juejin.request("/growth_api/v1/get_today_status", "GET");

    if (!todayStatus) {
      const checkInResult = await this.juejin.request("/growth_api/v1/check_in", "POST");
      this.incrPoint = checkInResult.incr_point;
      this.sumPoint = checkInResult.sum_point;
      this.todayStatus = 1;
    } else {
      this.todayStatus = 2;
    }

    const counts = await this.juejin.request("/growth_api/v1/get_counts", "GET");
    this.contCount = counts.cont_count;
    this.sumCount = counts.sum_count;

    // 如果签到时未获取到 sumPoint，单独查询
    if (!this.sumPoint) {
      this.sumPoint = await this.juejin.request("/growth_api/v1/get_cur_point", "GET");
    }
  }

  toString() {
    const statusText = {
      0: "签到失败",
      1: `签到成功 +${this.incrPoint} 矿石`,
      2: "今日已完成签到"
    }[this.todayStatus];

    return [
      statusText,
      `连续签到天数 ${this.contCount}`,
      `累计签到天数 ${this.sumCount}`,
      `当前矿石数 ${this.sumPoint}`
    ].join("\n");
  }
}

/* ======================== 通知 (青龙) ======================== */

async function sendNotify(title, content) {
  // 优先使用青龙自带通知模块
  try {
    const { sendNotify: qlNotify } = require("./sendNotify");
    if (typeof qlNotify === "function") {
      await qlNotify(title, content);
      console.log("[通知]: 青龙通知发送完成");
      return;
    }
  } catch {
    // sendNotify 不存在，走内置通知
  }

  // 内置通知: 支持通过环境变量配置 webhook 推送
  const webhookUrl = process.env.JJ_NOTIFY_WEBHOOK;
  if (webhookUrl) {
    try {
      await axios.post(webhookUrl, {
        msgtype: "text",
        text: { content: `${title}\n${content}` }
      });
      console.log("[通知]: Webhook 通知发送完成");
      return;
    } catch (e) {
      console.log(`[通知]: Webhook 通知发送失败: ${e.message}`);
    }
  }

  // 兜底: 仅控制台输出
  console.log(`\n========== ${title} ==========\n${content}\n`);
}

/* ======================== 主函数 ======================== */

class CheckIn {
  constructor(cookie) {
    this.cookie = cookie;
    this.username = "";
  }

  async run() {
    const juejin = new JuejinHelper();
    try {
      await juejin.login(this.cookie);
    } catch (e) {
      console.error(e.message);
      throw new Error("登录失败, 请尝试更新Cookies!");
    }

    this.username = juejin.getUser().user_name;

    this.mockVisitTask = new MockVisitTask(juejin);
    this.sdkTask = new SdkTask(juejin);
    this.growthTask = new GrowthTask(juejin);

    console.log(`\n========== 掘友: ${this.username} ==========`);
    console.log(`运行 ${this.mockVisitTask.taskName}`);
    await this.mockVisitTask.run();

    await this.sdkTask.run();

    console.log(`运行 ${this.growthTask.taskName}`);
    await this.growthTask.run();

    juejin.logout();
    console.log("-------------------------");

    return this.growthTask.todayStatus;
  }

  toString() {
    return [
      `掘友: ${this.username}`,
      `--- 模拟访问 ---`,
      this.mockVisitTask.toString(),
      `--- 签到 ---`,
      this.growthTask.toString()
    ].join("\n");
  }
}

/**
 * 从环境变量获取用户 Cookie 列表
 * 支持: JJ_COOKIE 变量中用换行分隔多用户
 */
function getUsersCookie() {
  const env = process.env;
  const cookies = [];

  // 主 JJ_COOKIE 变量 (支持换行分隔多用户)
  if (env.JJ_COOKIE) {
    env.JJ_COOKIE.split("\n")
      .map(c => c.trim())
      .filter(Boolean)
      .forEach(c => cookies.push(c));
  }

  // // 兼容 JJ_COOKIE_1 ~ JJ_COOKIE_5 格式
  // for (let i = 1; i <= 5; i++) {
  //   const c = env[`JJ_COOKIE_${i}`];
  //   if (c) cookies.push(c.trim());
  // }

  return cookies;
}

async function main() {
  const cookies = getUsersCookie();

  if (cookies.length === 0) {
    console.log("未配置 JJ_COOKIE 环境变量，请先在青龙面板添加掘金Cookie。");
    return;
  }

  console.log(`共 ${cookies.length} 个用户待执行\n`);

  const messageList = [];

  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i];
    const checkin = new CheckIn(cookie);

    try {
      await wait(randomRangeNumber(1000, 5000));
      await checkin.run();

      const content = checkin.toString();
      console.log(content);
      messageList.push(content);
    } catch (error) {
      const errorMsg = `掘友 #${i + 1} 执行失败: ${error.message}`;
      console.error(errorMsg);
      messageList.push(errorMsg);
    }
  }

  const message = messageList.join(`\n${"-".repeat(15)}\n`);

  await sendNotify("掘金每日签到", message);
}

main().catch(error => {
  console.error("执行异常:", error);
  sendNotify("掘金每日签到", `<strong>Error</strong>\n${error.message}`).finally(() => {
    process.exit(1);
  });
});
