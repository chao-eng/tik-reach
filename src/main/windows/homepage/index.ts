import path from "path";
import WindowBase from "../window-base";
import configManager from "./config-manager";
import puppeteer from 'puppeteer-core';
import { app, WebContents, dialog } from 'electron';
import appState from "../../app-state";
import * as XLSX from 'xlsx'; // 引入 xlsx
import fs from "fs";

class homepageWindow extends WindowBase {
  // 1. 新增一个控制停止的标志位
  private isTaskRunning: boolean = false;

  constructor() {

    super({
      width: 1000,
      height: 600,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
      },
    });

    this.openRouter("/homepage");
  }

  protected registerIpcMainHandler(): void {
    this.registerIpcHandleHandler('getConfig', (event, key) => configManager.get(key));

    this.registerIpcHandleHandler('setConfig', async (event, key, value) => {
      await configManager.set(key, value);
    });

    // 开始采集任务
    this.registerIpcHandleHandler('startFetchTask', async (event, { chromePath, users }) => {
      if (!chromePath || !users || users.length === 0) {
        return { status: false, msg: '参数不完整' };
      }

      // 2. 启动时，将标志位设为 true
      this.isTaskRunning = true;

      this.runScraper(event.sender, chromePath, users);
      return { status: true, msg: '后台任务已启动' };
    });

    // 3. 新增：停止任务的接口
    this.registerIpcHandleHandler('stopFetchTask', async () => {
      console.log("收到停止指令...");
      this.isTaskRunning = false; // 修改标志位
      return { status: true, msg: '正在停止...' };
    });

    // --- 导出 Excel ---
    this.registerIpcHandleHandler('exportToExcel', async (event, successData: any[]) => {
      if (!successData || successData.length === 0) {
        return { status: false, msg: '没有可导出的数据' };
      }

      try {
        // 1. 读取邮件模板配置
        const templateConfig = await configManager.get('email_template') || {};
        const subject = templateConfig.subject || "";

        // --- 修改点：优先读取 htmlContent，如果没有则降级使用 content ---
        const rawBody = templateConfig.htmlContent || templateConfig.content || "";

        // 2. 处理数据：替换变量
        const exportRows = successData.map(item => {
          // 替换 {{username}} 为实际用户名
          // 正则替换在 HTML 字符串中同样有效
          const processedBody = rawBody.replace(/{{username}}/g, item.username);

          return {
            "用户邮箱": item.email,
            "邮件主题": subject,
            "邮件正文(HTML)": processedBody // 列名可以改一下提示这是 HTML
          };
        });

        // 3. 生成 Excel 工作簿
        const worksheet = XLSX.utils.json_to_sheet(exportRows);

        // 设置列宽
        const wscols = [
          { wch: 25 }, // 邮箱
          { wch: 30 }, // 主题
          { wch: 80 }  // 正文 (HTML通常比较长，列宽设大一点)
        ];
        worksheet['!cols'] = wscols;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Emails");

        // 4. 弹出保存对话框
        const { filePath } = await dialog.showSaveDialog({
          title: '导出采集结果',
          defaultPath: `TikReach_Export_${Date.now()}.xlsx`,
          filters: [
            { name: 'Excel Files', extensions: ['xlsx'] }
          ]
        });

        if (filePath) {
          const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
          fs.writeFileSync(filePath, buffer);
          return { status: true, msg: `导出成功: ${filePath}` };
        } else {
          return { status: false, msg: '取消导出' };
        }

      } catch (error: any) {
        console.error("导出失败:", error);
        return { status: false, msg: `导出出错: ${error.message}` };
      }
    });


  }

  async runScraper(sender: WebContents, executablePath: string, users: string[]) {
    let browser;
    try {
      browser = await puppeteer.launch({
        executablePath: executablePath,
        headless: true, // 保持无头模式
        defaultViewport: null,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    } catch (error: any) {
      console.error("启动浏览器失败:", error);
      this.sendUpdateToFrontend(sender, { username: 'SYSTEM', status: 'failed', email: error.message });
      return;
    }

    try {
      const page = await browser.newPage();
      const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;

      for (const username of users) {
        // 4. 关键：在循环开始处检查标志位
        // 如果用户点了停止，或者窗口关闭了，就跳出循环
        if (!this.isTaskRunning || sender.isDestroyed()) {
          console.log("检测到停止信号或窗口销毁，终止循环");
          break;
        }

        this.sendUpdateToFrontend(sender, { username, status: 'processing' });

        try {
          const targetUrl = `https://www.tiktok.com/@${username}`;
          await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

          // (这里省略中间的爬虫逻辑，保持不变...)
          try { await page.waitForSelector('[data-e2e="user-bio"]', { timeout: 5000 }); } catch (e) { }
          const pageText = await page.evaluate(() => document.body.innerText);

          const match = pageText.match(emailRegex);

          if (match && match.length > 0) {
            this.sendUpdateToFrontend(sender, { username, status: 'success', email: match[0] });
          } else {
            this.sendUpdateToFrontend(sender, { username, status: 'failed', email: '未公开邮箱' });
          }

        } catch (error: any) {
          this.sendUpdateToFrontend(sender, { username, status: 'failed', email: '访问异常' });
        }

        const delay = Math.floor(Math.random() * 3000) + 2000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }

    } catch (err) {
      console.error("Browser operation error:", err);
    } finally {
      if (browser) await browser.close();
      this.isTaskRunning = false; // 重置状态
      console.log("浏览器已关闭，任务结束");
    }
  }

  private sendUpdateToFrontend(sender: WebContents, data: any) {
    if (sender && !sender.isDestroyed()) {
      sender.send('onFetchUpdate', data);
    }
  }
}

export default homepageWindow;