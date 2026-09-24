// Minimal stream-json stand-in for the Claude CLI so structured-session specs can run a real
// turn without credentials: answers control requests, proves init for the provider session the
// host named, replays each user message (Orca's send acknowledgement), and answers it.
const { randomUUID } = require('node:crypto')
const { createInterface } = require('node:readline')

const argv = process.argv.slice(2)
// Opt-in invocation record so a spec can prove WHICH executable Orca launched (the wrapper that
// exec'd this file names itself in CLAUDE_STUB_ENTRY) and in which working directory.
if (process.env.CLAUDE_STUB_LOG) {
  const entry = process.env.CLAUDE_STUB_ENTRY ?? __filename
  const record = { entry, cwd: process.cwd(), argv }
  require('node:fs').appendFileSync(process.env.CLAUDE_STUB_LOG, `${JSON.stringify(record)}\n`)
}
if (argv.includes('--version') || argv.includes('-v')) {
  process.stdout.write('2.1.280 (Claude Code)\n')
  process.exit(0)
}
// The SDK passes `--flag=value`; accept the spaced form too.
const flagValue = (flag) => {
  const joined = argv.find((arg) => arg.startsWith(`${flag}=`))
  if (joined) {
    return joined.slice(flag.length + 1)
  }
  const index = argv.indexOf(flag)
  return index === -1 ? undefined : argv[index + 1]
}
const sessionId = flagValue('--session-id') ?? flagValue('--resume') ?? randomUUID()
// What the stub answers every turn with; a spec can set CLAUDE_STUB_REPLY to shape the transcript.
const reply = process.env.CLAUDE_STUB_REPLY || 'Ready when you are.'
const emit = (frame) => process.stdout.write(`${JSON.stringify(frame)}\n`)
const init = () =>
  emit({
    type: 'system',
    subtype: 'init',
    session_id: sessionId,
    uuid: randomUUID(),
    model: 'claude-e2e-stub',
    cwd: process.cwd(),
    tools: [],
    mcp_servers: [],
    slash_commands: [],
    permissionMode: 'default',
    apiKeySource: 'none'
  })

createInterface({ input: process.stdin }).on('line', (line) => {
  let frame
  try {
    frame = JSON.parse(line)
  } catch {
    return
  }
  if (frame.type === 'control_request') {
    emit({
      type: 'control_response',
      response: {
        subtype: 'success',
        request_id: frame.request_id,
        response: { commands: [], models: [], account: { tokenSource: 'e2e-stub' } }
      }
    })
    if (frame.request?.subtype === 'initialize') {
      init()
    }
    return
  }
  if (frame.type !== 'user') {
    return
  }
  init()
  emit({
    ...frame,
    session_id: sessionId,
    uuid: frame.uuid ?? randomUUID(),
    parent_tool_use_id: null
  })
  emit({
    type: 'assistant',
    session_id: sessionId,
    uuid: randomUUID(),
    parent_tool_use_id: null,
    message: {
      id: `msg-${randomUUID()}`,
      type: 'message',
      role: 'assistant',
      model: 'claude-e2e-stub',
      content: [{ type: 'text', text: reply }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 }
    }
  })
  emit({
    type: 'result',
    subtype: 'success',
    is_error: false,
    duration_ms: 1,
    duration_api_ms: 1,
    num_turns: 1,
    result: reply,
    session_id: sessionId,
    total_cost_usd: 0,
    usage: { input_tokens: 1, output_tokens: 1 },
    uuid: randomUUID()
  })
})
process.stdin.on('end', () => process.exit(0))
