import {describe, it, expect, vi, beforeEach} from 'vitest'

// --- Mocks (hoisted so they're available in vi.mock factories) ---

const {mockGetInput, mockInfo, mockSetFailed, mockUpload, mockFetch, mockCreate, mockPatch, mockCommit} = vi.hoisted(() => ({
  mockGetInput: vi.fn(),
  mockInfo: vi.fn(),
  mockSetFailed: vi.fn(),
  mockUpload: vi.fn(),
  mockFetch: vi.fn(),
  mockCreate: vi.fn(),
  mockPatch: vi.fn(),
  mockCommit: vi.fn(),
}))

vi.mock('@actions/core', () => ({
  getInput: mockGetInput,
  info: mockInfo,
  setFailed: mockSetFailed,
}))

vi.mock('@sanity/client', () => ({
  createClient: () => ({
    assets: {upload: mockUpload},
    fetch: mockFetch,
    create: mockCreate,
    transaction: () => ({
      patch: mockPatch,
      commit: mockCommit,
    }),
  }),
}))

vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn().mockResolvedValue(Buffer.from('{"mock":"typedoc"}')),
  },
}))

vi.mock('groq', () => ({
  default: (strings: TemplateStringsArray, ...values: unknown[]) =>
    String.raw({raw: strings}, ...values),
}))

import {run} from './index'

// --- Helpers ---

const DEFAULT_INPUTS: Record<string, string> = {
  packageName: '@sanity/client',
  version: '7.0.0',
  typedocJsonPath: '/tmp/typedoc.json',
}

function setupInputs(overrides: Record<string, string> = {}) {
  const inputs = {...DEFAULT_INPUTS, ...overrides}
  mockGetInput.mockImplementation((name: string) => inputs[name] ?? '')
}

const UPLOADED_ASSET = {_id: 'file-abc123'}
const PLATFORM = {_id: 'platform-xyz'}

// --- Tests ---

describe('typedoc-upload action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupInputs()
    mockUpload.mockResolvedValue(UPLOADED_ASSET)
  })

  it('calls setFailed when platform is not found', async () => {
    mockFetch.mockResolvedValueOnce(null)

    await run()

    expect(mockSetFailed).toHaveBeenCalledWith(
      expect.stringContaining('Platform @sanity/client not found'),
    )
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('creates a new apiVersion document when no existing versions', async () => {
    mockFetch
      .mockResolvedValueOnce(PLATFORM)
      .mockResolvedValueOnce([])

    await run()

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        _type: 'apiVersion',
        semver: '7.0.0',
        platform: {_type: 'reference', _ref: PLATFORM._id},
        attachment: {
          _type: 'file',
          asset: {_type: 'reference', _ref: UPLOADED_ASSET._id},
        },
      }),
    )
    expect(mockSetFailed).not.toHaveBeenCalled()
  })

  it('patches existing apiVersion documents when versions exist', async () => {
    const existingDocs = [{_id: 'version-1'}, {_id: 'version-2'}]

    mockFetch
      .mockResolvedValueOnce(PLATFORM)
      .mockResolvedValueOnce(existingDocs)

    await run()

    expect(mockPatch).toHaveBeenCalledTimes(2)
    expect(mockPatch).toHaveBeenCalledWith('version-1', {
      set: {
        attachment: {
          _type: 'file',
          asset: {_type: 'reference', _ref: UPLOADED_ASSET._id},
        },
      },
    })
    expect(mockPatch).toHaveBeenCalledWith('version-2', {
      set: {
        attachment: {
          _type: 'file',
          asset: {_type: 'reference', _ref: UPLOADED_ASSET._id},
        },
      },
    })
    expect(mockCommit).toHaveBeenCalledOnce()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('uploads asset with correct filename and content type', async () => {
    mockFetch
      .mockResolvedValueOnce(PLATFORM)
      .mockResolvedValueOnce([])

    await run()

    expect(mockUpload).toHaveBeenCalledWith(
      'file',
      expect.any(Buffer),
      {
        filename: '@sanity/client-v7.0.0-typedoc.json',
        contentType: 'application/json',
      },
    )
  })
})
