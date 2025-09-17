import express from 'express'
import { GroqClient } from '../llm/groqClient'
import { GenerateRequestSchema, GenerateResponseSchema } from '../schemas'
import { buildPrompt, buildTestDataPrompt, SYSTEM_PROMPT } from '../prompt'

export const testdataRouter = express.Router()

// POST /api/testdata
// body: { request: GenerateRequest, count?: number }
testdataRouter.post('/', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const body = req.body || {}
    const request = body.request

    if (!request) {
      res.status(400).json({ error: 'Missing request in body' })
      return
    }

    // Validate the GenerateRequest shape (reusing same schema)
    const validationResult = GenerateRequestSchema.safeParse(request)
    if (!validationResult.success) {
      res.status(400).json({ error: `Validation error: ${validationResult.error.message}` })
      return
    }

    const validatedRequest = validationResult.data

    // Determine desired count (default 5, enforce max 5)
    let count = Number(body.count || 5)
    if (isNaN(count) || count <= 0) count = 5
    count = Math.min(5, count)

    const groqClient = new GroqClient()

    // First, generate test cases using existing logic (reusing buildPrompt)
    const userPrompt = buildPrompt(validatedRequest)

    let groqResp
    try {
      groqResp = await groqClient.generateTests(SYSTEM_PROMPT, userPrompt)
    } catch (err) {
      console.error('LLM error while generating test cases:', err)
      res.status(502).json({ error: 'Failed to generate test cases from LLM' })
      return
    }

    // Parse generated test cases
    let parsed
    try {
      parsed = JSON.parse(groqResp.content)
    } catch (err) {
      res.status(502).json({ error: 'LLM returned invalid JSON for test cases' })
      return
    }

    const schemaCheck = GenerateResponseSchema.safeParse(parsed)
    if (!schemaCheck.success) {
      res.status(502).json({ error: 'Generated test cases do not match expected schema' })
      return
    }

    const testCases = schemaCheck.data.cases

    // For each test case, call LLM to produce test data rows
    const results: Array<{ id: string; title: string; testData: Array<any> | string }> = []

    for (const tc of testCases) {
      try {
        const tdPrompt = buildTestDataPrompt(tc, count)
  const tdResp = await groqClient.generateText('', tdPrompt)
  const text = tdResp.content

        // Try to parse the tabular rows into structured arrays (best-effort)
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
        const rows: Array<{ id: string; inputFields: string; valid: string; sampleValue: string }> = []
        for (let i = 0; i < lines.length && rows.length < count; i++) {
          const line = lines[i]
          // Split by pipe or tab
          const parts = line.split(/\|/).map(p => p.trim())
          if (parts.length < 4) {
            const partsTab = line.split(/\t/).map(p => p.trim())
            if (partsTab.length >= 4) {
              parts.splice(0, parts.length, ...partsTab)
            }
          }

          if (parts.length >= 4) {
            rows.push({ id: parts[0], inputFields: parts[1], valid: parts[2], sampleValue: parts[3] })
          } else {
            // If parsing fails, store raw line
            rows.push({ id: `TD-${tc.id}-${i + 1}`, inputFields: '', valid: '', sampleValue: line })
          }
        }

        results.push({ id: tc.id, title: tc.title, testData: rows })
      } catch (err) {
        console.error('Error generating test data for', tc.id, err)
        results.push({ id: tc.id, title: tc.title, testData: 'Failed to generate test data' })
      }
    }

    res.json({ cases: results })
  } catch (err) {
    console.error('Error in testdata route:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default testdataRouter
