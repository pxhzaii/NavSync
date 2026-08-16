<script setup lang="ts">
const webdavStore = useWebDavStore()
</script>

<template>
  <div class="webdav-sync">
    <div mb-10 flex items-center gap-x-8>
      <span i-carbon:data-backup text-16 />
      <span text-14 font-bold>WebDAV 备份</span>
    </div>
    <div mb-10 text-12 opacity-60>
      通过 WebDAV 服务备份当前配置。可经自建代理中转（避免 CF 520），也可直连。
      服务器地址建议填写 <code>https://dav.jianguoyun.com/dav</code>（带或不带末尾斜杠均可）；
      备份路径需含子目录（如 <code>/navsync/backup.json</code>），不可直接放在根目录下。
    </div>

    <n-form label-placement="left" label-width="90">
      <n-form-item label="服务器地址">
        <n-input
          v-model:value="webdavStore.serverUrl"
          placeholder="https://dav.jianguoyun.com/dav"
        />
      </n-form-item>
      <n-form-item label="代理地址">
        <n-input
          v-model:value="webdavStore.proxy"
          placeholder="https://webdav.5as.cn/api/webdav（留空则直连）"
        />
      </n-form-item>
      <n-form-item label="用户名">
        <n-input
          v-model:value="webdavStore.username"
          placeholder="坚果云账号邮箱"
        />
      </n-form-item>
      <n-form-item label="密码">
        <n-input
          v-model:value="webdavStore.password"
          type="password"
          show-password-on="click"
          placeholder="应用密码（非登录密码）"
        />
      </n-form-item>
      <n-form-item label="备份路径">
        <n-input
          v-model:value="webdavStore.filePath"
          placeholder="/navsync/backup.json"
        />
      </n-form-item>
    </n-form>

    <div v-if="webdavStore.lastBackup" mb-10 text-12 opacity-60>
      上次备份: {{ webdavStore.lastBackup }}
    </div>

    <div flex flex-wrap gap-x-12 gap-y-8>
      <n-button
        :loading="webdavStore.isTesting"
        :disabled="webdavStore.isBackingUp || webdavStore.isRestoring"
        @click="webdavStore.handleTest"
      >
        测试连接
      </n-button>
      <n-button
        type="primary"
        text-color="#ffffff"
        :loading="webdavStore.isBackingUp"
        :disabled="webdavStore.isTesting || webdavStore.isRestoring"
        @click="webdavStore.handleBackup"
      >
        备份到 WebDAV
      </n-button>
      <n-button
        :loading="webdavStore.isRestoring"
        :disabled="webdavStore.isTesting || webdavStore.isBackingUp"
        @click="webdavStore.handleRestore"
      >
        从 WebDAV 恢复
      </n-button>
      <n-button
        quaternary
        type="error"
        :disabled="webdavStore.isTesting || webdavStore.isBackingUp || webdavStore.isRestoring"
        @click="webdavStore.handleClear"
      >
        清除配置
      </n-button>
    </div>

    <div mt-12 text-12 opacity-50>
      代理地址留空时直连 WebDAV 服务器（需服务器支持 CORS）；账号密码仅保存在浏览器本地，不会上传到服务器。
    </div>
  </div>
</template>

<style lang="scss" scoped>
.webdav-sync {
  padding: 12px 16px;
  border: 1px solid rgba(128, 128, 128, 0.25);
  border-radius: 8px;
}
</style>
