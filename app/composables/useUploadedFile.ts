import { computed } from 'vue'

type FileMeta = {
  name: string
  size: number
  uploadedAt: string
} | null

type UploadedFileState = {
  fileMeta: FileMeta
  hasFile: boolean
  fileText: string | null
}

const META_KEY = 'uploadedDatasetMeta'
const IDB_DB_NAME = 'furnace-db'
const IDB_STORE = 'files'
const IDB_KEY = 'uploadedFile'

const state = useState<UploadedFileState>('uploaded-file-state', () => ({
  fileMeta: null,
  hasFile: false,
  fileText: null,
}))

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

async function idbPut(key: string, value: unknown) {
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
  return new Promise<unknown>((resolve, reject) => {
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
  const fileMeta = computed(() => state.value.fileMeta)
  const hasFile = computed(() => state.value.hasFile)
  const fileText = computed(() => state.value.fileText)

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
    state.value = {
      ...state.value,
      fileMeta: meta,
      hasFile: true,
      fileText: text,
    }
  }

  async function loadFromStorage() {
    const raw = localStorage.getItem(META_KEY)
    if (!raw) {
      state.value = {
        ...state.value,
        fileMeta: null,
        hasFile: false,
        fileText: null,
      }
      return
    }

    try {
      const parsedMeta = JSON.parse(raw) as FileMeta
      state.value = {
        ...state.value,
        fileMeta: parsedMeta,
        hasFile: true,
      }
    } catch {
      state.value = {
        ...state.value,
        fileMeta: null,
        hasFile: false,
      }
    }

    const persistedText = await idbGet(IDB_KEY)
    state.value = {
      ...state.value,
      fileText: typeof persistedText === 'string' ? persistedText : null,
    }
  }

  async function getFileData() {
    const persistedText = await idbGet(IDB_KEY)
    state.value = {
      ...state.value,
      fileText: typeof persistedText === 'string' ? persistedText : null,
    }

    return typeof persistedText === 'string' ? persistedText : null
  }

  async function clear() {
    await idbDel(IDB_KEY)
    localStorage.removeItem(META_KEY)
    state.value = {
      ...state.value,
      fileMeta: null,
      hasFile: false,
      fileText: null,
    }
  }

  return {
    fileMeta,
    hasFile,
    fileText,
    setFile,
    loadFromStorage,
    getFileData,
    clear,
  }
}
