import { contextBridge, ipcRenderer } from "electron";

/*
暴露homepageWindow窗口主进程的方法到homepageWindow窗口的渲染进程
*/
contextBridge.exposeInMainWorld("homepageWindowAPI", {
  setConfig: (key, value) => ipcRenderer.invoke("setConfig", key, value),
  getConfig: (key) => ipcRenderer.invoke("getConfig", key),
  // 2. 启动采集任务
  startFetchTask: (payload: any) => ipcRenderer.invoke('startFetchTask', payload),

  // 3. 监听流式进度更新 (on / off)
  onFetchUpdate: (callback: (event: any, data: any) => void) => {
    ipcRenderer.on('onFetchUpdate', callback);
  },
  removeFetchUpdateListener: () => {
    ipcRenderer.removeAllListeners('onFetchUpdate');
  },
  stopFetchTask: () => ipcRenderer.invoke('stopFetchTask'),
  // 新增导出接口
  exportToExcel: (data: any[]) => ipcRenderer.invoke('exportToExcel', data),
});
