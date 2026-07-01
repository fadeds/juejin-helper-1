import notification from "./utils/notification-kit";
const JuejinHelper = require("juejin-helper");
const utils = require("./utils/utils");
const env = require("./utils/env");

class Task {
  constructor(juejin) {
    this.juejin = juejin;
  }

  taskName = "";

  async run() {}

  toString() {
    return `[${this.taskName}]`;
  }
}

class GrowthTask extends Task {
  taskName = "成长任务";

  todayStatus = 0; // 未签到
  incrPoint = 0;
  sumPoint = 0; // 当前矿石数
  contCount = 0; // 连续签到天数
  sumCount = 0; // 累计签到天数

  async run() {
    const growth = this.juejin.growth();

    const todayStatus = await growth.getTodayStatus();
    if (!todayStatus) {
      const checkInResult = await growth.checkIn();

      this.incrPoint = checkInResult.incr_point;
      this.sumPoint = checkInResult.sum_point;
      this.todayStatus = 1; // 本次签到
    } else {
      this.todayStatus = 2; // 已签到
    }

    const counts = await growth.getCounts();
    this.contCount = counts.cont_count;
    this.sumCount = counts.sum_count;
  }
}

class MockVisitTask extends Task {
  taskName = "模拟访问";

  async run() {
    console.log("--------模拟访问---------");
    try {
      const browser = this.juejin.browser();
      await browser.open();
      try {
        await browser.visitPage("/");
        console.log("掘金首页：页面访问成功");
      } catch (e) {
        console.log("掘金首页：页面访问失败");
      }
      await utils.wait(utils.randomRangeNumber(2000, 5000));
      try {
        await browser.visitPage("/user/center/signin");
        console.log("掘金每日签到：页面访问成功");
      } catch (e) {
        console.log("掘金每日签到：页面访问失败");
      }
      await utils.wait(utils.randomRangeNumber(2000, 5000));
      await browser.close();
    } catch {
      console.log("浏览器API异常");
    }
    console.log("-------------------------");
  }
}

class CheckIn {
  cookie = "";
  username = "";

  constructor(cookie) {
    this.cookie = cookie;
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
    this.growthTask = new GrowthTask(juejin);

    await this.mockVisitTask.run();
    await this.growthTask.run();
    await juejin.logout();
    console.log("-------------------------");

    return this.growthTask.todayStatus;
  }

  toString() {
    return `
掘友: ${this.username}
${
  {
    0: "签到失败",
    1: `签到成功 +${this.growthTask.incrPoint} 矿石`,
    2: "今日已完成签到"
  }[this.growthTask.todayStatus]
}
连续签到天数 ${this.growthTask.contCount}
累计签到天数 ${this.growthTask.sumCount}
当前矿石数 ${this.growthTask.sumPoint}
`.trim();
  }
}

async function run(args) {
  const cookies = utils.getUsersCookie(env);
  let messageList = [];
  for (let cookie of cookies) {
    const checkin = new CheckIn(cookie);

    await utils.wait(utils.randomRangeNumber(1000, 5000)); // 初始等待1-5s
    await checkin.run(); // 执行

    const content = checkin.toString();
    console.log(content); // 打印结果

    messageList.push(content);
  }

  const message = messageList.join(`\n${"-".repeat(15)}\n`);
  notification.pushMessage({
    title: "掘金每日签到",
    content: message,
    msgtype: "text"
  });
}

run(process.argv.splice(2)).catch(error => {
  notification.pushMessage({
    title: "掘金每日签到",
    content: `<strong>Error</strong><pre>${error.message}</pre>`,
    msgtype: "html"
  });

  throw error;
});
