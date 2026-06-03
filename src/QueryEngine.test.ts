import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { setIsInteractive } from './bootstrap/state.js'
import { drainSdkEvents, enqueueSdkEvent } from './utils/sdkEventQueue.js'

process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? 'test-key'

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(value => {
    resolve = value
  })
  return { promise, resolve }
}

const processUserInputMock = mock(async () => ({
  messages: [],
  shouldQuery: false,
  resultText: 'done',
}))

mock.module('./utils/processUserInput/processUserInput.js', () => ({
  processUserInput: processUserInputMock,
}))

mock.module('./utils/queryContext.js', () => ({
  fetchSystemPromptParts: mock(async () => ({
    defaultSystemPrompt: [],
    userContext: {},
    systemContext: {},
  })),
}))

mock.module('./utils/messages/systemInit.js', () => ({
  buildSystemInitMessage: mock(() => ({
    type: 'system',
    subtype: 'init',
    session_id: 'test-session',
    uuid: 'init-message',
    model: 'test-model',
  })),
  sdkCompatToolName: (name: string) => name,
}))

const { QueryEngine } = await import('./QueryEngine.js')

function makeEngine() {
  return new QueryEngine({
    cwd: process.cwd(),
    tools: [],
    commands: [],
    mcpClients: [],
    agents: [],
    canUseTool: async () => ({ behavior: 'allow' }) as never,
    getAppState: () => ({
      fastMode: false,
      mcp: { clients: [], tools: [] },
      toolPermissionContext: {
        mode: 'default',
        alwaysAllowRules: { command: [] },
        additionalWorkingDirectories: new Map(),
      },
    }) as never,
    setAppState: () => {},
    readFileCache: new Map() as never,
  })
}

function timeout<T>(ms: number, value: T): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(value), ms))
}

describe('QueryEngine slash command event streaming', () => {
  beforeEach(() => {
    processUserInputMock.mockClear()
    drainSdkEvents()
    setIsInteractive(false)
  })

  test('drains SDK task events while pre-query slash command processing is still pending', async () => {
    const deferred = createDeferred<{
      messages: []
      shouldQuery: false
      resultText: string
    }>()
    processUserInputMock.mockImplementationOnce(async () => {
      enqueueSdkEvent({
        type: 'system',
        subtype: 'task_started',
        task_id: 'slash-agent-task',
        description: 'Agent Explore',
        task_type: 'slash_agent',
        prompt: 'inspect recent changes',
      })
      return deferred.promise
    })

    const iterator = makeEngine().submitMessage('/agent Explore inspect recent changes')
    const first = await Promise.race([
      iterator.next(),
      timeout(350, null),
    ])

    expect(first).not.toBeNull()
    expect(first?.value).toMatchObject({
      type: 'system',
      subtype: 'task_started',
      task_id: 'slash-agent-task',
      description: 'Agent Explore',
    })

    deferred.resolve({
      messages: [],
      shouldQuery: false,
      resultText: 'done',
    })
    for await (const _message of iterator) {
      // Drain the generator after releasing the pending slash command.
    }
  })
})
