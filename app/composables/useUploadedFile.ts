import { computed } from 'vue'

type FileMeta = {
  name: string
  size: number
  uploadedAt: string
} | null

type UploadedFileState = {
  fileMeta: FileMeta
  hasFile: boolean
}

const IDB_DB_NAME = 'furnace-db'
const IDB_STORE = 'files'

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
    tx.objectStore(IDB_STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function idbGet(key: string) {
  const db = await openDb()
  return new Promise<unknown>((resolve, reject) => {
    const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbDel(key: string) {
  const db = await openDb()
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/**
 * Verwaltet die eine hochgeladene CSV. Der Dateiinhalt liegt als `Blob` in
 * IndexedDB (auch sehr große Dateien, kein Riesen-String), die Metadaten in
 * localStorage — ein Reload verliert die Datei nicht.
 */
export default function useUploadedFile(slot: string = 'dataset') {
  const META_KEY = slot === 'dataset' ? 'uploadedDatasetMeta' : `uploadedDatasetMeta:${slot}`
  const IDB_KEY = slot === 'dataset' ? 'uploadedFile' : `uploadedFile:${slot}`

  const state = useState<UploadedFileState>(`uploaded-file-state-${slot}`, () => ({
    fileMeta: null,
    hasFile: false
  }))

  const fileMeta = computed(() => state.value.fileMeta)
  const hasFile = computed(() => state.value.hasFile)

  async function setFile(file: File) {
    if (!file) return
    await idbPut(IDB_KEY, file)
    const meta = { name: file.name, size: file.size, uploadedAt: new Date().toISOString() }
    localStorage.setItem(META_KEY, JSON.stringify(meta))
    state.value = { fileMeta: meta, hasFile: true }
  }

  async function loadFromStorage() {
    const raw = localStorage.getItem(META_KEY)
    if (!raw) {
      state.value = { fileMeta: null, hasFile: false }
      return
    }
    try {
      state.value = { fileMeta: JSON.parse(raw) as FileMeta, hasFile: true }
    } catch {
      state.value = { fileMeta: null, hasFile: false }
    }
  }

  /** Den gespeicherten Blob holen (zum Parsen). */
  async function getBlob(): Promise<Blob | null> {
    const value = await idbGet(IDB_KEY)
    return value instanceof Blob ? value : null
  }

  async function clear() {
    await idbDel(IDB_KEY)
    localStorage.removeItem(META_KEY)
    state.value = { fileMeta: null, hasFile: false }
  }

  return {
    fileMeta,
    hasFile,
    setFile,
    loadFromStorage,
    getBlob,
    clear
  }
}
