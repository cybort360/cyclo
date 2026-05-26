import { Router } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { pool } from '../db.js'
import { buildMessage, verifySignature } from '../verify.js'

const router = Router()
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── Auth helpers ──────────────────────────────────────────────────────────────

const SIGNATURE_TTL_MS = 5 * 60 * 1000

/**
 * Verifies the wallet-signature proof supplied with every AI request.
 * Uses TTL-only verification (no replay prevention) because the chat
 * endpoint is called on every message and the frontend reuses a cached
 * signature. The tools are scoped to the authenticated wallet, so a
 * replayed signature within the TTL window can only access the same
 * merchant's own data — not another merchant's.
 * Returns false and writes the error response when auth fails.
 */
function verifyAiAuth(
  address: string,
  timestamp: number | undefined,
  signature: string | undefined,
  res: ReturnType<typeof router['use']> extends never ? never : Parameters<Parameters<typeof router['post']>[1]>[1]
): boolean {
  if (!timestamp || !signature) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(res as any).status(401).json({ error: 'timestamp and signature required' })
    return false
  }
  if (Date.now() - timestamp > SIGNATURE_TTL_MS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(res as any).status(401).json({ error: 'Signature expired' })
    return false
  }
  const message = buildMessage(address.toLowerCase(), timestamp)
  if (!verifySignature(address, message, signature)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(res as any).status(401).json({ error: 'Invalid signature' })
    return false
  }
  return true
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const tools: Anthropic.Tool[] = [
  {
    name: 'get_analytics',
    description: 'Get merchant analytics including MRR, total revenue, active subscribers, and per-plan breakdown.',
    input_schema: {
      type: 'object' as const,
      properties: {
        wallet_address: { type: 'string', description: 'Merchant wallet address' },
      },
      required: ['wallet_address'],
    },
  },
  {
    name: 'get_subscribers',
    description: 'Get list of active and past-due subscribers for the merchant.',
    input_schema: {
      type: 'object' as const,
      properties: {
        wallet_address: { type: 'string', description: 'Merchant wallet address' },
        status: { type: 'string', enum: ['active', 'past_due', 'suspended', 'cancelled', 'all'] },
      },
      required: ['wallet_address'],
    },
  },
  {
    name: 'get_execution_logs',
    description: 'Get recent payment execution logs including successes and failures.',
    input_schema: {
      type: 'object' as const,
      properties: {
        wallet_address: { type: 'string', description: 'Merchant wallet address' },
        limit: { type: 'number', description: 'Number of logs to return (default 20)' },
      },
      required: ['wallet_address'],
    },
  },
  {
    name: 'get_plan_details',
    description: 'Get details about a specific plan including price, interval, and subscriber count.',
    input_schema: {
      type: 'object' as const,
      properties: {
        wallet_address: { type: 'string', description: 'Merchant wallet address (ownership check)' },
        plan_id: { type: 'string' },
      },
      required: ['wallet_address', 'plan_id'],
    },
  },
]

// ─── Tool execution ───────────────────────────────────────────────────────────

/**
 * Executes an AI tool.
 * @param authenticatedWallet - The wallet address that was verified via signature.
 *   All queries are scoped to this address so one merchant cannot read another's data.
 */
async function executeTool(
  name: string,
  input: Record<string, unknown>,
  authenticatedWallet: string
): Promise<string> {
  // Ensure the tool's wallet_address matches the authenticated caller.
  // This guards against a prompt-injection scenario where Claude is tricked
  // into passing a different address to a tool.
  const toolWallet = (input.wallet_address as string | undefined)?.toLowerCase()
  if (toolWallet && toolWallet !== authenticatedWallet) {
    return JSON.stringify({ error: 'wallet_address mismatch — access denied' })
  }
  const wallet = authenticatedWallet

  switch (name) {
    case 'get_analytics': {
      // Scoped to this merchant's plans only
      const subs = await pool.query(
        `SELECT s.plan_id, COUNT(*) as count, s.status
         FROM subscriptions s
         JOIN plans p ON s.plan_id = p.plan_id
         WHERE s.status IN ('active', 'past_due')
           AND p.merchant = $1
         GROUP BY s.plan_id, s.status`,
        [wallet]
      )
      const revenue = await pool.query(
        `SELECT el.plan_id, SUM(CAST(el.amount AS NUMERIC)) as total, COUNT(*) as charges
         FROM execution_logs el
         JOIN plans p ON el.plan_id = p.plan_id
         WHERE el.status = 'success'
           AND el.amount IS NOT NULL
           AND p.merchant = $1
         GROUP BY el.plan_id`,
        [wallet]
      )
      return JSON.stringify({ subscribers: subs.rows, revenue: revenue.rows })
    }

    case 'get_subscribers': {
      const status = input.status === 'all' ? null : (input.status ?? 'active')
      const result = await pool.query(
        status
          ? `SELECT s.plan_id, s.subscriber, s.status, s.retry_count, s.failed_at, s.next_charge_timestamp
             FROM subscriptions s
             JOIN plans p ON s.plan_id = p.plan_id
             WHERE p.merchant = $1 AND s.status = $2
             ORDER BY s.created_at DESC LIMIT 50`
          : `SELECT s.plan_id, s.subscriber, s.status, s.retry_count, s.failed_at, s.next_charge_timestamp
             FROM subscriptions s
             JOIN plans p ON s.plan_id = p.plan_id
             WHERE p.merchant = $1
             ORDER BY s.created_at DESC LIMIT 50`,
        status ? [wallet, status] : [wallet]
      )
      return JSON.stringify(result.rows)
    }

    case 'get_execution_logs': {
      const limit = Math.min((input.limit as number | undefined) ?? 20, 100)
      const result = await pool.query(
        `SELECT el.plan_id, el.subscriber, el.status, el.amount, el.error, el.created_at
         FROM execution_logs el
         JOIN plans p ON el.plan_id = p.plan_id
         WHERE p.merchant = $1
         ORDER BY el.created_at DESC
         LIMIT $2`,
        [wallet, limit]
      )
      return JSON.stringify(result.rows)
    }

    case 'get_plan_details': {
      // Verify merchant owns the plan before returning details
      const ownership = await pool.query(
        `SELECT 1 FROM plans WHERE plan_id = $1 AND merchant = $2`,
        [input.plan_id, wallet]
      )
      if (ownership.rows.length === 0) {
        return JSON.stringify({ error: 'Plan not found or not owned by this merchant' })
      }

      const result = await pool.query(
        `SELECT s.plan_id,
                COUNT(*) FILTER (WHERE s.status = 'active') as active_subscribers,
                COUNT(*) FILTER (WHERE s.status = 'past_due') as past_due,
                SUM(CAST(e.amount AS NUMERIC)) as total_revenue
         FROM subscriptions s
         LEFT JOIN execution_logs e ON e.plan_id = s.plan_id AND e.status = 'success'
         WHERE s.plan_id = $1
         GROUP BY s.plan_id`,
        [input.plan_id]
      )
      return JSON.stringify(result.rows[0] ?? {})
    }

    default:
      return JSON.stringify({ error: 'Unknown tool' })
  }
}

// ─── Chat endpoint ────────────────────────────────────────────────────────────

router.post('/chat', async (req, res) => {
  const { messages, walletAddress, timestamp, signature } = req.body

  if (!messages || !walletAddress) {
    res.status(400).json({ error: 'messages and walletAddress required' })
    return
  }

  // Require signature proof that the caller controls walletAddress.
  // Without this any user could query any merchant's billing data.
  if (!verifyAiAuth(walletAddress, timestamp, signature, res as never)) return

  const authenticatedWallet = (walletAddress as string).toLowerCase()

  const systemPrompt = `You are Cyclo AI, an intelligent billing assistant for the Cyclo on-chain subscription protocol.
You help merchants understand their revenue, subscribers, and payment performance.
The merchant's wallet address is ${authenticatedWallet}.
All payments are in USDC with 6 decimal places (divide raw amounts by 1,000,000 to get USD).
Be concise, specific, and data-driven. When you have numbers, use them.
You can read data using tools. Always fetch data before answering questions about metrics.
Format currency as USD. Format dates as human-readable.`

  try {
    let currentMessages = [...messages]
    let response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      tools,
      messages: currentMessages,
    })

    while (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[]

      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUseBlocks.map(async block => ({
          type: 'tool_result' as const,
          tool_use_id: block.id,
          content: await executeTool(
            block.name,
            block.input as Record<string, unknown>,
            authenticatedWallet
          ),
        }))
      )

      currentMessages = [
        ...currentMessages,
        { role: 'assistant' as const, content: response.content },
        { role: 'user' as const, content: toolResults },
      ]

      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        tools,
        messages: currentMessages,
      })
    }

    const textBlock = response.content.find(b => b.type === 'text') as Anthropic.TextBlock | undefined
    res.json({ reply: textBlock?.text ?? 'No response generated.' })

  } catch (err) {
    console.error('AI chat error:', err)
    res.status(500).json({ error: String(err) })
  }
})

// ─── Insights endpoint ────────────────────────────────────────────────────────

router.post('/insights', async (req, res) => {
  const { walletAddress, timestamp, signature } = req.body
  if (!walletAddress) { res.status(400).json({ error: 'walletAddress required' }); return }

  if (!verifyAiAuth(walletAddress, timestamp, signature, res as never)) return

  const wallet = (walletAddress as string).toLowerCase()

  try {
    const [subs, logs] = await Promise.all([
      pool.query(
        `SELECT s.status, COUNT(*) as count
         FROM subscriptions s
         JOIN plans p ON s.plan_id = p.plan_id
         WHERE p.merchant = $1
         GROUP BY s.status`,
        [wallet]
      ),
      pool.query(
        `SELECT el.status, COUNT(*) as count
         FROM execution_logs el
         JOIN plans p ON el.plan_id = p.plan_id
         WHERE p.merchant = $1
           AND el.created_at > NOW() - INTERVAL '7 days'
         GROUP BY el.status`,
        [wallet]
      ),
    ])

    const context = { subscribers: subs.rows, recentExecutions: logs.rows }

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `You are a billing analyst. Given this data from an on-chain subscription protocol, generate 3 short, specific, actionable insights. Each insight must be one sentence. Return a JSON array of strings.

Data: ${JSON.stringify(context)}

Return format: ["insight 1", "insight 2", "insight 3"]
Only return the JSON array, nothing else.`,
      }],
    })

    const text = (response.content[0] as Anthropic.TextBlock).text
    res.json({ insights: JSON.parse(text) })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// ─── Parse plan endpoint ──────────────────────────────────────────────────────

router.post('/parse-plan', async (req, res) => {
  const { input, walletAddress, timestamp, signature } = req.body
  if (!input) { res.status(400).json({ error: 'input required' }); return }
  if (!walletAddress) { res.status(400).json({ error: 'walletAddress required' }); return }

  if (!verifyAiAuth(walletAddress, timestamp, signature, res as never)) return

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `Parse this natural language subscription plan description into structured fields.
Return a JSON object with: price (number in USD), intervalDays (number), trialDays (number, default 0).

Input: "${input}"

Examples:
"monthly plan $9.99 with 7 day trial" → {"price": 9.99, "intervalDays": 30, "trialDays": 7}
"weekly $4.99" → {"price": 4.99, "intervalDays": 7, "trialDays": 0}
"annual plan $99" → {"price": 99, "intervalDays": 365, "trialDays": 0}

Return only the JSON object.`,
      }],
    })

    const text = (response.content[0] as Anthropic.TextBlock).text
    res.json(JSON.parse(text))
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// ─── Dunning email endpoint ───────────────────────────────────────────────────

router.post('/dunning', async (req, res) => {
  const { subscriber, planId, businessName, retryCount, walletAddress, timestamp, signature } = req.body
  if (!walletAddress) { res.status(400).json({ error: 'walletAddress required' }); return }

  if (!verifyAiAuth(walletAddress, timestamp, signature, res as never)) return

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `Write a short, friendly payment failure email from ${businessName} to a subscriber.
Their subscription to Plan ${planId} failed to charge. This is attempt ${retryCount + 1}.
The subscriber's wallet address is ${subscriber}.
Keep it under 100 words. Be helpful, not threatening. Include a clear call to action to top up their USDC wallet.
Return only the email body text.`,
      }],
    })

    const text = (response.content[0] as Anthropic.TextBlock).text
    res.json({ email: text })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// ─── Webhook code generator ───────────────────────────────────────────────────

router.post('/webhook-code', async (req, res) => {
  const { description, framework, walletAddress, timestamp, signature } = req.body
  if (!walletAddress) { res.status(400).json({ error: 'walletAddress required' }); return }

  if (!verifyAiAuth(walletAddress, timestamp, signature, res as never)) return

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Generate a webhook handler for the Cyclo billing protocol.

Developer's requirement: "${description}"
Framework: ${framework ?? 'Express.js'}

The webhook receives POST requests with:
- Header: X-Cyclo-Signature: sha256=<hmac>
- Body: { type: string, data: object }

Event types: payment.charged, subscription.created, subscription.cancelled, plan.created, plan.migrated

Include HMAC signature verification using the secret. Keep it concise and production-ready.
Return only the code, no explanation.`,
      }],
    })

    const text = (response.content[0] as Anthropic.TextBlock).text
    res.json({ code: text })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

export default router
