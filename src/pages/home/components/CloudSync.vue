<script setup lang="ts">
const cloudStore = useCloudStore()
</script>

<template>
  <div class="cloud-sync-section">
    <!-- 未连接：点击连接按钮 -->
    <div v-if="!cloudStore.isConnected" mb-16>
      <n-button
        type="primary"
        text-color="#ffffff"
        :loading="cloudStore.isConnecting"
        @click="cloudStore.connectToCloud"
      >
        连接云端同步
      </n-button>
      <div v-if="cloudStore.connectError" mt-8 text-12 style="color: #d03050;">
        {{ cloudStore.connectError }}
      </div>
      <div mt-8 text-12 opacity-60>
        点击连接后自动检测同步服务状态。
      </div>
    </div>

    <!-- 已连接：口令模式 -->
    <template v-if="cloudStore.isConnected && cloudStore.passwordMode">
      <div mb-16>
        <div text-14 mb-10>访问口令</div>
        <div v-if="!cloudStore.passwordAuthed" flex gap-x-8>
          <n-input
            v-model:value="cloudStore.passwordInput"
            type="password"
            show-password-on="click"
            placeholder="输入访问口令"
            flex-1
          />
          <n-button
            type="primary"
            text-color="#ffffff"
            :disabled="!cloudStore.passwordInput.trim() || cloudStore.isLocked"
            @click="cloudStore.verifyPassword"
          >
            验证
          </n-button>
        </div>
        <div v-if="!cloudStore.passwordAuthed && cloudStore.passwordHint" mt-8 text-12 style="color: #d03050;">
          {{ cloudStore.passwordHint }}
        </div>
        <div v-if="cloudStore.isLocked" mt-8 text-12 style="color: #d03050;" flex items-center gap-x-4>
          <span i-carbon:warning-alt />
          <span>已锁定，{{ cloudStore.formatLockTime(cloudStore.lockRemainingSec) }} 后自动解锁</span>
        </div>
        <div v-if="cloudStore.passwordAuthed" text-12 opacity-70 flex items-center gap-x-8>
          <span i-carbon:checkmark-filled style="color: #18a058;" />
          <span>口令已验证</span>
        </div>
      </div>
    </template>

    <!-- 已连接：非口令模式 -->
    <template v-if="cloudStore.isConnected && !cloudStore.passwordMode">
      <div v-if="cloudStore.username" mb-16 text-12 opacity-70 flex items-center gap-x-8>
        <span i-carbon:checkmark-filled style="color: #18a058;" />
        <span>已连接，用户: {{ cloudStore.username }}</span>
      </div>
    </template>

    <!-- 口令验证通过 或 非口令模式：显示同步按钮 -->
    <div v-if="cloudStore.isConnected && (cloudStore.passwordAuthed || !cloudStore.passwordMode)" mb-16>
      <div v-if="cloudStore.lastSyncTime" text-12 mb-8 opacity-60>
        上次同步: {{ cloudStore.lastSyncTime }}
      </div>
      <div flex gap-x-12>
        <n-button
          :loading="cloudStore.isUploading"
          :disabled="cloudStore.isDownloading"
          @click="cloudStore.handleUpload"
        >
          上传到云端
        </n-button>
        <n-button
          :loading="cloudStore.isDownloading"
          :disabled="cloudStore.isUploading"
          @click="cloudStore.handleDownload"
        >
          从云端拉取
        </n-button>
        <n-button
          type="error"
          ghost
          @click="cloudStore.handleDisconnect"
        >
          断开
        </n-button>
      </div>
    </div>

    <!-- 使用说明 -->
    <div text-12 opacity-50 mt-12>
      <template v-if="cloudStore.passwordMode">
        <div>同步原理：输入口令后，配置数据通过服务端代理存储在 GitHub Gist 中。</div>
        <div>换设备时只需重新连接并输入同一口令即可恢复配置。</div>
      </template>
      <template v-else>
        <div>同步原理：配置数据通过服务端代理存储在 GitHub Gist 中。</div>
        <div>换设备时只需重新连接即可恢复配置。</div>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.cloud-sync-section {
  padding: 16px 0;
}
</style>
