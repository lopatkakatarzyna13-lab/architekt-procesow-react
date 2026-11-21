const databaseName = 'architekt-procesow:workshop-recordings'

function openDatabase() {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(databaseName, 1)
    open.onupgradeneeded = () => {
      open.result.createObjectStore('recordings', { keyPath: 'processId' })
      open.result.createObjectStore('chunks', { keyPath: ['processId', 'index'] })
    }
    open.onsuccess = () => resolve(open.result)
    open.onerror = () => reject(open.error)
  })
}

function chunkRange(processId) {
  return IDBKeyRange.bound([processId, 0], [processId, Infinity])
}

async function transaction(mode, work) {
  const database = await openDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const tx = database.transaction(['recordings', 'chunks'], mode, { durability: 'strict' })
      tx.oncomplete = () => {
        try { resolve(result()) } catch (error) { reject(error) }
      }
      tx.onabort = () => reject(tx.error || new Error('Nagranie zmieniło się w innej karcie.'))
      const result = work(tx.objectStore('recordings'), tx.objectStore('chunks'), tx)
    })
  } finally {
    database.close()
  }
}

export function readWorkshopRecording(processId) {
  return transaction('readonly', (recordings, chunks) => {
    const info = recordings.get(processId)
    const parts = chunks.getAll(chunkRange(processId))
    return () => info.result && {
      ...info.result,
      blob: new Blob(parts.result.map(({ data }) => data), { type: info.result.mimeType }),
    }
  })
}

export function saveWorkshopRecordingChunk(info, previousId, index, data) {
  return transaction('readwrite', (recordings, chunks, tx) => {
    const current = recordings.get(info.processId)
    current.onsuccess = () => {
      const expectedId = index === 0 ? previousId : info.id
      if ((current.result?.id ?? null) !== expectedId) { tx.abort(); return }
      if (index === 0) chunks.delete(chunkRange(info.processId))
      recordings.put(info)
      chunks.add({ processId: info.processId, index, data })
    }
    return () => undefined
  })
}

export function finishWorkshopRecording(processId, id) {
  return transaction('readwrite', (recordings, chunks, tx) => {
    const current = recordings.get(processId)
    current.onsuccess = () => {
      if (current.result?.id !== id) { tx.abort(); return }
      recordings.put({ ...current.result, finished: true })
    }
    return () => undefined
  })
}

export function deleteWorkshopRecording(processId, expectedId) {
  return transaction('readwrite', (recordings, chunks, tx) => {
    const current = recordings.get(processId)
    current.onsuccess = () => {
      if (expectedId && current.result?.id !== expectedId) { tx.abort(); return }
      recordings.delete(processId)
      chunks.delete(chunkRange(processId))
    }
    return () => undefined
  })
}
