import { describe, expect, it, vi } from 'vitest'
import {
  CURRENT_PROCESS_ID_KEY,
  activateProcessId,
  createProcessId,
  isValidProcessId,
  loadCurrentProcessId,
  removeCurrentProcessId,
  saveCurrentProcessId,
} from './processIdentity'

const validProcessId = '123e4567-e89b-42d3-a456-426614174000'
const otherValidProcessId = '7d444840-9dc0-4f5c-b245-5b7b4de43f01'
const uppercaseProcessId = validProcessId.toUpperCase()

describe('processIdentity', () => {
  describe('isValidProcessId', () => {
    it('akceptuje poprawny UUID zapisany jako string', () => {
      expect(isValidProcessId(validProcessId)).toBe(true)
    })

    it('odrzuca pusty string', () => {
      expect(isValidProcessId('')).toBe(false)
    })

    it('odrzuca nieprawidłowy identyfikator', () => {
      expect(isValidProcessId('process-123')).toBe(false)
    })

    it.each([
      ['null', null],
      ['undefined', undefined],
      ['liczbę', 123],
      ['obiekt', { id: validProcessId }],
      ['UUID o nieprawidłowej długości', '123e4567-e89b-42d3-a456-42661417400'],
      ['UUID bez łączników', '123e4567e89b42d3a456426614174000'],
      ['UUID z nieprawidłową wersją', '123e4567-e89b-02d3-a456-426614174000'],
      ['UUID z nieprawidłowym wariantem', '123e4567-e89b-42d3-7456-426614174000'],
      ['UUID otoczony spacjami', ` ${validProcessId} `],
    ])('odrzuca %s', (_description, value) => {
      expect(isValidProcessId(value)).toBe(false)
    })

    it('akceptuje poprawny UUID zapisany wielkimi literami', () => {
      expect(isValidProcessId(uppercaseProcessId)).toBe(true)
    })
  })

  describe('loadCurrentProcessId', () => {
    it('zwraca null, gdy klucza nie ma', () => {
      const storage = { getItem: vi.fn(() => null) }

      expect(loadCurrentProcessId(storage)).toBeNull()
      expect(storage.getItem).toHaveBeenCalledOnce()
      expect(storage.getItem).toHaveBeenCalledWith(CURRENT_PROCESS_ID_KEY)
    })

    it('odczytuje poprawny UUID', () => {
      const storage = {
        getItem: vi.fn(() => validProcessId),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      }

      expect(loadCurrentProcessId(storage)).toBe(validProcessId)
      expect(storage.setItem).not.toHaveBeenCalled()
      expect(storage.removeItem).not.toHaveBeenCalled()
    })

    it('zwraca null dla nieprawidłowego identyfikatora', () => {
      const storage = { getItem: vi.fn(() => 'invalid') }

      expect(loadCurrentProcessId(storage)).toBeNull()
    })

    it('przekazuje błąd storage.getItem()', () => {
      const storageError = new Error('getItem failed')
      const storage = {
        getItem: vi.fn(() => {
          throw storageError
        }),
      }

      expect(() => loadCurrentProcessId(storage)).toThrow(storageError)
    })
  })

  describe('createProcessId', () => {
    it('tworzy identyfikator za pomocą randomUUID()', () => {
      const cryptoApi = { randomUUID: vi.fn(() => validProcessId) }

      expect(createProcessId(cryptoApi)).toBe(validProcessId)
      expect(cryptoApi.randomUUID).toHaveBeenCalledOnce()
    })

    it('zgłasza błąd dla niepoprawnego wyniku randomUUID()', () => {
      const cryptoApi = { randomUUID: vi.fn(() => 'invalid') }

      expect(() => createProcessId(cryptoApi)).toThrow(
        'Wygenerowany identyfikator procesu nie jest poprawnym UUID-em.',
      )
    })

    it('przekazuje błąd cryptoApi.randomUUID()', () => {
      const cryptoError = new Error('randomUUID failed')
      const cryptoApi = {
        randomUUID: vi.fn(() => {
          throw cryptoError
        }),
      }

      expect(() => createProcessId(cryptoApi)).toThrow(cryptoError)
    })
  })

  describe('saveCurrentProcessId', () => {
    it('zapisuje UUID pod wskazanym kluczem, gdy klucza nie ma', () => {
      const storage = {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
      }

      saveCurrentProcessId(storage, validProcessId)

      expect(storage.getItem).toHaveBeenCalledOnce()
      expect(storage.getItem).toHaveBeenCalledWith(CURRENT_PROCESS_ID_KEY)
      expect(storage.setItem).toHaveBeenCalledOnce()
      expect(storage.setItem).toHaveBeenCalledWith(
        CURRENT_PROCESS_ID_KEY,
        validProcessId,
      )
    })

    it('blokuje zapis niepoprawnego identyfikatora', () => {
      const storage = {
        getItem: vi.fn(),
        setItem: vi.fn(),
      }

      expect(() => saveCurrentProcessId(storage, 'invalid')).toThrow(TypeError)
      expect(storage.getItem).not.toHaveBeenCalled()
      expect(storage.setItem).not.toHaveBeenCalled()
    })

    it('wykonuje no-op przy ponownym zapisie tego samego UUID', () => {
      const storage = {
        getItem: vi.fn(() => validProcessId),
        setItem: vi.fn(),
      }

      saveCurrentProcessId(storage, validProcessId)

      expect(storage.setItem).not.toHaveBeenCalled()
    })

    it('traktuje różnicę wielkości liter jako ten sam identyfikator', () => {
      const storage = {
        getItem: vi.fn(() => uppercaseProcessId),
        setItem: vi.fn(),
      }

      saveCurrentProcessId(storage, validProcessId)

      expect(storage.setItem).not.toHaveBeenCalled()
    })

    it('zgłasza konflikt przy próbie zastąpienia UUID innym poprawnym UUID', () => {
      const storage = {
        getItem: vi.fn(() => validProcessId),
        setItem: vi.fn(),
      }

      expect(() =>
        saveCurrentProcessId(storage, otherValidProcessId),
      ).toThrow('Konflikt identyfikatora procesu')
      expect(storage.setItem).not.toHaveBeenCalled()
    })

    it('nie nadpisuje automatycznie nieprawidłowej istniejącej wartości', () => {
      const storage = {
        getItem: vi.fn(() => 'invalid'),
        setItem: vi.fn(),
      }

      expect(() => saveCurrentProcessId(storage, validProcessId)).toThrow(
        'Zapisany identyfikator procesu jest nieprawidłowy',
      )
      expect(storage.setItem).not.toHaveBeenCalled()
    })

    it('przekazuje błąd storage.getItem() podczas zapisu', () => {
      const storageError = new Error('getItem failed')
      const storage = {
        getItem: vi.fn(() => {
          throw storageError
        }),
        setItem: vi.fn(),
      }

      expect(() => saveCurrentProcessId(storage, validProcessId)).toThrow(
        storageError,
      )
      expect(storage.setItem).not.toHaveBeenCalled()
    })

    it('przekazuje błąd storage.setItem()', () => {
      const storageError = new Error('setItem failed')
      const storage = {
        getItem: vi.fn(() => null),
        setItem: vi.fn(() => {
          throw storageError
        }),
      }

      expect(() => saveCurrentProcessId(storage, validProcessId)).toThrow(
        storageError,
      )
    })
  })

  describe('activateProcessId', () => {
    it('zapisuje UUID pod wskazanym kluczem, gdy aktualnego ID nie ma', () => {
      const storage = {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
      }

      activateProcessId(storage, validProcessId)

      expect(storage.getItem).toHaveBeenCalledOnce()
      expect(storage.getItem).toHaveBeenCalledWith(CURRENT_PROCESS_ID_KEY)
      expect(storage.setItem).toHaveBeenCalledOnce()
      expect(storage.setItem).toHaveBeenCalledWith(
        CURRENT_PROCESS_ID_KEY,
        validProcessId,
      )
    })

    it('wykonuje no-op dla tego samego UUID', () => {
      const storage = {
        getItem: vi.fn(() => validProcessId),
        setItem: vi.fn(),
      }

      activateProcessId(storage, validProcessId)

      expect(storage.setItem).not.toHaveBeenCalled()
    })

    it('wykonuje no-op, gdy UUID różni się tylko wielkością liter', () => {
      const storage = {
        getItem: vi.fn(() => uppercaseProcessId),
        setItem: vi.fn(),
      }

      activateProcessId(storage, validProcessId)

      expect(storage.setItem).not.toHaveBeenCalled()
    })

    it('jawnie zastępuje inny poprawny UUID dokładnie jednym zapisem', () => {
      const storage = {
        getItem: vi.fn(() => validProcessId),
        setItem: vi.fn(),
      }

      activateProcessId(storage, otherValidProcessId)

      expect(storage.setItem).toHaveBeenCalledOnce()
      expect(storage.setItem).toHaveBeenCalledWith(
        CURRENT_PROCESS_ID_KEY,
        otherValidProcessId,
      )
    })

    it('blokuje nieprawidłowy nowy processId przed odczytem storage', () => {
      const storage = {
        getItem: vi.fn(),
        setItem: vi.fn(),
      }

      expect(() => activateProcessId(storage, 'invalid')).toThrow(TypeError)
      expect(storage.getItem).not.toHaveBeenCalled()
      expect(storage.setItem).not.toHaveBeenCalled()
    })

    it('blokuje uszkodzoną wartość w storage i nie zapisuje UUID', () => {
      const storage = {
        getItem: vi.fn(() => 'invalid'),
        setItem: vi.fn(),
      }

      expect(() => activateProcessId(storage, validProcessId)).toThrow(
        'Zapisany identyfikator aktywnego procesu jest nieprawidłowy',
      )
      expect(storage.setItem).not.toHaveBeenCalled()
    })

    it('przekazuje błąd storage.getItem() i nie wykonuje zapisu', () => {
      const storageError = new Error('getItem failed')
      const storage = {
        getItem: vi.fn(() => {
          throw storageError
        }),
        setItem: vi.fn(),
      }

      expect(() => activateProcessId(storage, validProcessId)).toThrow(
        storageError,
      )
      expect(storage.setItem).not.toHaveBeenCalled()
    })

    it('przekazuje błąd storage.setItem()', () => {
      const storageError = new Error('setItem failed')
      const storage = {
        getItem: vi.fn(() => validProcessId),
        setItem: vi.fn(() => {
          throw storageError
        }),
      }

      expect(() => activateProcessId(storage, otherValidProcessId)).toThrow(
        storageError,
      )
      expect(storage.setItem).toHaveBeenCalledOnce()
      expect(storage.setItem).toHaveBeenCalledWith(
        CURRENT_PROCESS_ID_KEY,
        otherValidProcessId,
      )
    })

    it('nie zmienia chronionego zachowania saveCurrentProcessId()', () => {
      const storage = {
        getItem: vi.fn(() => validProcessId),
        setItem: vi.fn(),
      }

      expect(() =>
        saveCurrentProcessId(storage, otherValidProcessId),
      ).toThrow('Konflikt identyfikatora procesu')
      expect(storage.setItem).not.toHaveBeenCalled()
    })
  })

  describe('removeCurrentProcessId', () => {
    it('usuwa wyłącznie wskazany klucz', () => {
      const storage = { removeItem: vi.fn() }

      removeCurrentProcessId(storage)

      expect(storage.removeItem).toHaveBeenCalledOnce()
      expect(storage.removeItem).toHaveBeenCalledWith(CURRENT_PROCESS_ID_KEY)
    })

    it('przekazuje błąd storage.removeItem()', () => {
      const storageError = new Error('removeItem failed')
      const storage = {
        removeItem: vi.fn(() => {
          throw storageError
        }),
      }

      expect(() => removeCurrentProcessId(storage)).toThrow(storageError)
    })
  })
})
