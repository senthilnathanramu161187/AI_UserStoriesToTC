import express from 'express'
import fetch from 'node-fetch'
import dotenv from 'dotenv'
import path from 'path'

// Load .env same as server does (safe to call again)
const envPath = path.join(__dirname, '../../.env')
dotenv.config({ path: envPath })

export const jiraRouter = express.Router()

jiraRouter.get('/story', async (req: express.Request, res: express.Response) => {
  try {
    const issueId = String(req.query.issueId || '')
    if (!issueId) {
      res.status(400).json({ error: 'issueId query parameter is required' })
      return
    }

    const jiraUser = process.env.JIRA_USER || 'userid'
    const jiraApiKey = process.env.JIRA_API_KEY || 'apikey'
    const baseUrl = process.env.JIRA_BASE || 'https://my-manual-test-demo-sn.atlassian.net'

    const endpoint = `${baseUrl}/rest/api/2/issue/${encodeURIComponent(issueId)}`

    const auth = Buffer.from(`${jiraUser}:${jiraApiKey}`).toString('base64')

    console.log('📡 Fetching Jira issue')
    console.log(`🔍 Endpoint: ${endpoint}`)

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    })

    console.log(`📊 Jira response status: ${response.status} ${response.statusText}`)

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      console.error('❌ Jira error response:', text)
      res.status(502).json({ error: `Jira API error: ${response.status} ${response.statusText}` })
      return
    }

    const data: any = await response.json().catch(() => null)

    if (!data) {
      res.status(502).json({ error: 'Invalid JSON from Jira API' })
      return
    }

    // Extract summary and description
    const title = data.fields?.summary ?? ''
    const description = data.fields?.description ?? ''

    res.json({ title, description })
  } catch (err) {
    console.error('Error fetching Jira issue:', err)
    res.status(500).json({ error: (err as Error).message || 'Internal server error' })
  }
})

export default jiraRouter
