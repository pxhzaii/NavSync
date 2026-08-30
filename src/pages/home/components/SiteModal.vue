<script setup lang="ts">
const modalStore = useModalStore()
const errorInput = ref(false)

function handleAllCommit(_e: Event) {
  if (modalStore.inputValues.name.length <= 0
      || (modalStore.target === 'site' && modalStore.inputValues.url.length <= 0)) {
    errorInput.value = true
    setTimeout(() => errorInput.value = false, 500)
    return
  }
  modalStore.handleCommit()
  setTimeout(() => errorInput.value = false, 500)
}
</script>

<template>
  <n-modal
    v-model:show="modalStore.modalVisible"
    preset="dialog"
    title="Dialog"
    :show-icon="false"
    :closable="false"
    :auto-focus="true"
    :on-after-leave="modalStore.clearInput"
  >
    <template #header>
      <div>{{ modalStore.title }}</div>
    </template>
    <div>
      <n-input
        v-model:value="modalStore.inputValues.name"
        :status="errorInput && modalStore.inputValues.name.length <= 0 ? 'error' : 'success'"
        placeholder="名称"
        my-8
        @keydown.enter="handleAllCommit"
      />
      <n-input
        v-if="modalStore.target === 'site'"
        v-model:value="modalStore.inputValues.url"
        placeholder="链接"
        my-8
        :status="errorInput && modalStore.inputValues.url.length <= 0 ? 'error' : 'success'"
        @keydown.enter="handleAllCommit"
      />
      <n-input
        v-if="modalStore.target === 'site'"
        v-model:value="modalStore.inputValues.favicon"
        placeholder="图标链接（选填）"
        my-8
        @keydown.enter="handleAllCommit"
      />
    </div>
    <template #action>
      <div flex gap-x-12>
        <n-button @click="modalStore.handleCancel">
          取消
        </n-button>
        <n-button v-if="modalStore.action === 'update'" type="error" @click="modalStore.handleDelete">
          删除
        </n-button>
        <n-button type="primary" text-color="#ffffff" @click="handleAllCommit">
          确认
        </n-button>
      </div>
    </template>
  </n-modal>
</template>
