import { ref } from 'vue'

type FileMeta = {
  name: string
  size: number
  uploadedAt: string
} | null

const META_KEY = 'uploadedDatasetMeta'
const IDB_DB_NAME = 'furnace-db'
const IDB_STORE = 'files'
const IDB_KEY = 'uploadedFile'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbPut(key: string, value: any) {
  const db = await openDb()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    const store = tx.objectStore(IDB_STORE)
    const req = store.put(value, key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

async function idbGet(key: string) {
  const db = await openDb()
  return new Promise<any>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly')
    const store = tx.objectStore(IDB_STORE)
    const req = store.get(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbDel(key: string) {
  const db = await openDb()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    const store = tx.objectStore(IDB_STORE)
    const req = store.delete(key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export default function useUploadedFile() {
  const fileMeta = ref<FileMeta>(null)
  const hasFile = ref(false)

  async function setFile(file: File) {
    if (!file) return
    const text = await file.text()
    await idbPut(IDB_KEY, text)

    const meta = {
      name: file.name,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    }
    localStorage.setItem(META_KEY, JSON.stringify(meta))
    fileMeta.value = meta
    hasFile.value = true
  }

  async function loadFromStorage() {
    const raw = localStorage.getItem(META_KEY)
    if (!raw) {
      fileMeta.value = null
      hasFile.value = false
      return
    }
    try {
      fileMeta.value = JSON.parse(raw)
      hasFile.value = true
    } catch (err) {
      fileMeta.value = null
      hasFile.value = false
    }
  }

  async function getFileData() {
    return idbGet(IDB_KEY)
  }

  async function clear() {
    await idbDel(IDB_KEY)
    localStorage.removeItem(META_KEY)
    fileMeta.value = null
    hasFile.value = false
  }

  return {
    fileMeta,
    hasFile,
    setFile,
    loadFromStorage,
    getFileData,
    clear,
  }
}
