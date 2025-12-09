<template>
  <a-layout style="min-height: 100vh">
    <a-layout-sider v-model:collapsed="collapsed" collapsible theme="light" class="custom-sider">
      <div class="logo">
        <span v-if="!collapsed" class="logo-text">TikReach</span>
        <span v-else class="logo-text">TR</span>
      </div>
      
      <a-menu v-model:selectedKeys="selectedKeys" theme="light" mode="inline">
        <a-menu-item key="config">
          <template #icon><EditOutlined /></template>
          <span>模板配置</span>
        </a-menu-item>
        
        <a-menu-item key="fetch">
          <template #icon><CloudDownloadOutlined /></template>
          <span>获取邮箱</span>
        </a-menu-item>
      </a-menu>
    </a-layout-sider>

    <a-layout>
      <a-layout-header style="background: #fff; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 1px 4px rgba(0,21,41,0.08); z-index: 1;">
        <h2 style="margin: 0; font-size: 18px; font-weight: 600;">{{ pageTitle }}</h2>
      </a-layout-header>

      <a-layout-content style="margin: 24px 16px">
        <div style="padding: 24px; background: #fff; min-height: 360px; border-radius: 8px; height: 100%; display: flex; flex-direction: column;">
          
          <div v-if="selectedKeys[0] === 'config'" style="height: 100%; display: flex; flex-direction: column;">
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
               <a-typography-title :level="4" style="margin: 0;">编辑邮件模板</a-typography-title>
               <a-space>
                 <a-button @click="loadTemplateConfig" :loading="loadingData">重置/刷新</a-button>
                 <a-button type="primary" @click="saveTemplateConfig" :loading="saving">
                    <template #icon><SaveOutlined /></template> 保存模板
                 </a-button>
               </a-space>
            </div>

            <div style="margin-bottom: 16px;">
              <a-input 
                v-model:value="emailSubject" 
                placeholder="请输入邮件主题 (Subject)" 
                size="large"
                addon-before="邮件主题"
              />
            </div>
            
            <a-alert 
              message="正文变量说明" 
              description="您可以使用 Markdown 语法编写邮件正文。支持变量：{{username}} 代表客户名。" 
              type="info" 
              show-icon 
              style="margin-bottom: 16px" 
            />

            <div id="vditor" style="flex: 1; min-height: 500px;"></div>
          </div>

          <div v-else-if="selectedKeys[0] === 'fetch'">
             
             <a-card size="small" title="环境配置" style="margin-bottom: 24px; border-color: #e8e8e8;">
               <div style="display: flex; gap: 10px; width: 100%;">
                 <div style="flex: 1;">
                    <a-input 
                      v-model:value="chromePath" 
                      placeholder="请输入 Chrome 浏览器可执行文件路径 (例如: C:\Program Files\Google\Chrome\Application\chrome.exe)"
                      size="large"
                    >
                      <template #prefix><ChromeOutlined style="color: rgba(0,0,0,.25)" /></template>
                    </a-input>
                 </div>
                 <a-button type="primary" size="large" ghost @click="saveChromeConfig" :loading="savingChrome">
                   保存配置
                 </a-button>
               </div>
             </a-card>

             <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
               <a-typography-title :level="5" style="margin: 0;">任务列表</a-typography-title>
               
               <a-space>
                  <a-button type="primary" :loading="isFetching" @click="openFetchModal">
                    <template #icon><CloudDownloadOutlined /></template>
                    {{ isFetching ? '采集进行中...' : '新建采集任务' }}
                  </a-button>
                  <a-button @click="exportEmails" :disabled="fetchedData.length === 0">导出数据</a-button>
                  <a-button v-if="isFetching" danger @click="stopFetching">停止任务</a-button>
               </a-space>
             </div>

             <a-table 
               :columns="fetchColumns" 
               :data-source="fetchedData" 
               row-key="username"
               :pagination="{ pageSize: 10, showSizeChanger: true }"
               bordered
               size="middle"
             >
                <template #bodyCell="{ column, record }">
                   <template v-if="column.key === 'status'">
                      <a-tag v-if="record.status === 'success'" color="success">
                         <template #icon><CheckCircleOutlined /></template> 采集成功
                      </a-tag>
                      <a-tag v-else-if="record.status === 'processing'" color="processing">
                         <template #icon><SyncOutlined spin /></template> 正在采集
                      </a-tag>
                      <a-tag v-else-if="record.status === 'pending'" color="default">
                         <template #icon><ClockCircleOutlined /></template> 待采集
                      </a-tag>
                      <a-tag v-else-if="record.status === 'failed'" color="error">
                         <template #icon><CloseCircleOutlined /></template> 采集失败
                      </a-tag>
                   </template>
                   
                   <template v-if="column.key === 'email'">
                      <span v-if="record.email" style="font-weight: 500; color: #1890ff;">{{ record.email }}</span>
                      <span v-else style="color: #ccc;">-</span>
                   </template>
                </template>
             </a-table>
          </div>

        </div>
      </a-layout-content>
      
      <a-layout-footer style="text-align: center">
        TikReach Project ©2025 Created by bujic
        <a-divider type="vertical" />
        <GithubOutlined style="cursor: pointer; font-size: 16px" @click="openGithub" />
      </a-layout-footer>
    </a-layout>

    <a-modal
      v-model:open="isModalVisible"
      title="输入目标 TikTok 用户名"
      ok-text="开始采集"
      cancel-text="取消"
      @ok="handleStartFetch"
      :confirmLoading="isFetching"
      width="600px"
    >
      <a-alert
        message="操作提示"
        description="系统将调用本地 Chrome 浏览器，依次访问 https://www.tiktok.com/@用户名 抓取公开邮箱。"
        type="info"
        show-icon
        style="margin-bottom: 16px;"
      />
      <a-form layout="vertical">
        <a-form-item label="用户名列表 (每行一个)">
            <a-textarea
                v-model:value="targetUsernames"
                placeholder="例如：&#10;tiktok_official&#10;charlidamelio&#10;khaby.lame"
                :auto-size="{ minRows: 8, maxRows: 15 }"
                style="font-family: monospace;"
            />
        </a-form-item>
      </a-form>
      <div style="text-align: right; color: #999; font-size: 12px;">
         当前已输入 {{ usernameCount }} 个用户
      </div>
    </a-modal>
  </a-layout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick, onUnmounted } from 'vue';
import { message } from 'ant-design-vue';
import Vditor from 'vditor';
import 'vditor/dist/index.css';

import { 
  EditOutlined, 
  SaveOutlined,
  GithubOutlined,
  CloudDownloadOutlined,
  ChromeOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons-vue';

// --- Electron API 封装 ---
const getElectronApi = () => {
  const api = (window as any).homepageWindowAPI;
  if (!api) {
    console.warn("Electron API not found. Running in Mock Mode.");
    return {
      setConfig: async (key: string, val: any) => { 
        localStorage.setItem(key, JSON.stringify(val));
        return { status: true }; 
      },
      getConfig: async (key: string) => { 
        const val = localStorage.getItem(key);
        return val ? JSON.parse(val) : null; 
      },
      startFetchTask: async (payload: any) => {
        console.log("Mock startFetchTask:", payload);
        return { status: true, msg: '任务已下发' };
      },
      onFetchUpdate: (cb: any) => { console.log("Listener registered"); },
      removeFetchUpdateListener: () => { console.log("Listener removed"); },
      stopFetchTask: async () => ({ status: true }), // Mock
      exportToExcel: async (data: any[]) => ({ status: true, msg: 'Mock导出成功' }),
    };
  }
  return api;
}

// --- 全局 UI 状态 ---
const collapsed = ref<boolean>(false);
const selectedKeys = ref<string[]>(['config']);
const pageTitle = computed(() => {
  if (selectedKeys.value[0] === 'config') return '模板设置';
  if (selectedKeys.value[0] === 'fetch') return '邮箱采集';
  return 'TikReach';
});
import utils from "@utils/renderer";
const openGithub = () => {
  utils.openExternalLink("https://github.com/chao-eng/tik-reach");
};

// --- 1. 模板配置逻辑 (Subject + Vditor) ---
const vditorInstance = ref<Vditor | null>(null);
const emailSubject = ref(''); // 新增：绑定主题输入框
const saving = ref(false);
const loadingData = ref(false);

const initVditor = () => {
  const vditorElement = document.getElementById('vditor');
  if (!vditorElement) return;
  vditorInstance.value = new Vditor('vditor', {
    height: '100%',
    mode: 'wysiwyg',
    placeholder: '在此输入邮件正文内容...',
    toolbar: [ 'emoji', 'headings', 'bold', 'italic', 'strike', 'link', '|', 'list', 'ordered-list', 'check', 'outdent', 'indent', '|', 'quote', 'line', 'code', 'inline-code', '|', 'undo', 'redo', '|', 'preview' ],
    cache: { enable: false },
    after: () => { loadTemplateConfig(); },
  });
};

// 加载配置：同时读取 subject 和 content
const loadTemplateConfig = async () => {
  loadingData.value = true;
  try {
    const config = await getElectronApi().getConfig('email_template');
    if (config) {
      // 恢复正文
      if (config.content && vditorInstance.value) {
        vditorInstance.value.setValue(config.content);
      }
      // 恢复主题
      if (config.subject) {
        emailSubject.value = config.subject;
      } else {
        emailSubject.value = '';
      }
    }
  } catch (error) {
    message.error('加载模板失败');
  } finally {
    loadingData.value = false;
  }
};

// 保存配置：同时保存 subject 和 content
const saveTemplateConfig = async () => {
  if (!vditorInstance.value) return;
  
  if (!emailSubject.value.trim()) {
    message.warning('请填写邮件主题');
    return;
  }

  saving.value = true;
  try {
    const content = vditorInstance.value.getValue();
    const subject = emailSubject.value; // 获取主题
    const htmlContent = vditorInstance.value.getHTML();
    await getElectronApi().setConfig('email_template', {
      subject: subject,  // 保存主题
      content: content,  // 保存正文
      htmlContent: htmlContent, // 存 HTML
      updatedAt: new Date().toISOString()
    });
    message.success('模板（主题+正文）已保存');
  } catch (error) {
    message.error('保存失败');
  } finally {
    saving.value = false;
  }
};

// --- 2. 邮箱采集逻辑 (保持不变) ---
const chromePath = ref('');
const savingChrome = ref(false);

const loadChromeConfig = async () => {
  try {
    const config = await getElectronApi().getConfig('chrome_path');
    if (config && config.path) {
      chromePath.value = config.path;
    }
  } catch (e) { console.error(e); }
};

const saveChromeConfig = async () => {
  if (!chromePath.value) return message.warning('请输入 Chrome 路径');
  savingChrome.value = true;
  try {
    await getElectronApi().setConfig('chrome_path', { path: chromePath.value });
    message.success('配置已保存');
  } catch (e) {
    message.error('保存失败');
  } finally {
    savingChrome.value = false;
  }
};

interface FetchTask {
  username: string;
  email: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  errorMsg?: string;
}

const isModalVisible = ref(false);
const targetUsernames = ref('');
const isFetching = ref(false);
const fetchedData = ref<FetchTask[]>([]);

const usernameCount = computed(() => {
    if(!targetUsernames.value) return 0;
    return targetUsernames.value.split('\n').filter(u => u.trim()).length;
});

const fetchColumns = [
    { title: 'TikTok 用户名', dataIndex: 'username', key: 'username', width: 250 },
    { title: '抓取结果 (Email)', dataIndex: 'email', key: 'email' },
    { title: '当前状态', dataIndex: 'status', key: 'status', width: 150, align: 'center' },
];

const openFetchModal = () => {
  if (!chromePath.value) {
    message.error('请先配置 Chrome 路径');
    return;
  }
  targetUsernames.value = '';
  isModalVisible.value = true;
};

const handleStartFetch = async () => {
  const lines = targetUsernames.value.split('\n')
    .map(u => u.trim())
    .filter(u => u.length > 0);
  
  const uniqueUsers = [...new Set(lines)];

  if (uniqueUsers.length === 0) {
      message.warning("请输入有效的用户名");
      return;
  }

  fetchedData.value = uniqueUsers.map(u => ({
    username: u,
    email: '',
    status: 'pending'
  }));

  isModalVisible.value = false;
  isFetching.value = true;
  message.loading({ content: '正在启动 Puppeteer 浏览器...', key: 'starting' });

  try {
    const api = getElectronApi();
    const res = await api.startFetchTask({
        chromePath: chromePath.value,
        users: uniqueUsers
    });
    
    if(res.status) {
        message.success({ content: '浏览器已启动，开始执行队列', key: 'starting' });
    } else {
        message.error({ content: `启动失败: ${res.msg}`, key: 'starting' });
        isFetching.value = false;
    }
  } catch (e) {
    message.error({ content: '调用后台接口异常', key: 'starting' });
    isFetching.value = false;
  }
};

const stopFetching = async() => {
    isFetching.value = false;
   try {
        // 调用后台接口停止
        await getElectronApi().stopFetchTask();
        
        // 更新前端状态
        isFetching.value = false;
        
        // 可选：将所有还在 pending 状态的任务标记为 "已取消" 或保持 pending
        fetchedData.value.forEach(task => {
            if (task.status === 'processing') {
                task.status = 'failed'; // 或者增加一个 'cancelled' 状态
                task.errorMsg = '用户手动停止';
            }
        });
        
        message.warn("已发送停止指令，当前正在运行的任务完成后将终止。");
    } catch (e) {
        console.error(e);
        message.error("停止指令发送失败");
    }
};

const exportEmails = async () => {
    // 筛选出采集成功的数据
    const successList = fetchedData.value.filter(item => item.status === 'success' && item.email);

    if(successList.length === 0) {
        return message.warning("暂无【采集成功】的数据可导出");
    }

    // 可以在这里加一个 loading 状态
    const hide = message.loading('正在生成 Excel...', 0);

    try {
        const res = await getElectronApi().exportToExcel(JSON.parse(JSON.stringify(successList)));
        hide(); // 关闭 loading
        
        if (res.status) {
            message.success(res.msg);
        } else {
            if (res.msg !== '取消导出') {
                message.error(res.msg);
            }
        }
    } catch (e) {
        hide();
        console.error(e);
        message.error("导出过程发生异常");
    }
};

// --- 监听器 ---
const registerListeners = () => {
    const api = getElectronApi();
    if(api.onFetchUpdate) {
        api.onFetchUpdate((_event: any, data: any) => {
            if (data.username === 'SYSTEM') {
                message.error({ 
                    content: `采集无法启动: ${data.email}`, 
                    duration: 5 
                });
                isFetching.value = false;
                fetchedData.value.forEach(task => {
                    if (task.status === 'pending') task.status = 'failed';
                });
                return; 
            }
            const targetTask = fetchedData.value.find(t => t.username === data.username);
            if (targetTask) {
                targetTask.status = data.status;
                if (data.email) targetTask.email = data.email;
            }
            const hasPending = fetchedData.value.some(t => t.status === 'pending' || t.status === 'processing');
            if (!hasPending) {
                isFetching.value = false;
                message.success("采集队列全部执行完毕");
            }
        });
    }
};

const removeListeners = () => {
    const api = getElectronApi();
    if(api.removeFetchUpdateListener) {
        api.removeFetchUpdateListener();
    }
};

// --- 生命周期 ---
watch(
  () => selectedKeys.value[0],
  async (newKey) => {
    if (newKey === 'config') {
      await nextTick();
      initVditor();
    } else {
      if (vditorInstance.value) {
        vditorInstance.value.destroy();
        vditorInstance.value = null;
      }
    }
    if (newKey === 'fetch') loadChromeConfig();
  }
);

onMounted(async () => {
  registerListeners();
  if (selectedKeys.value[0] === 'config') {
    await nextTick();
    initVditor();
  }
  if (selectedKeys.value[0] === 'fetch') loadChromeConfig();
});

onUnmounted(() => {
  removeListeners();
  if (vditorInstance.value) {
    vditorInstance.value.destroy();
    vditorInstance.value = null;
  }
});
</script>

<style scoped>
.logo {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.02);
  margin-bottom: 16px;
  overflow: hidden;
  transition: all 0.2s;
}

.logo-text {
  font-size: 18px;
  font-weight: bold;
  color: #1890ff;
  white-space: nowrap;
}

.custom-sider {
  box-shadow: 2px 0 8px 0 rgba(29, 35, 41, 0.05);
  z-index: 2;
}

.ant-layout-content {
  transition: all 0.2s;
}

#vditor {
  border: 1px solid #d9d9d9;
  border-radius: 4px;
}
</style>