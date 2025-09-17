import { GenerateRequest } from './schemas'

export const SYSTEM_PROMPT = `You are a senior QA engineer with expertise in creating comprehensive test cases from user stories. Your task is to analyze user stories and generate detailed test cases.

CRITICAL: You must return ONLY valid JSON matching this exact schema:

{
  "cases": [
    {
      "id": "TC-001",
      "title": "string",
      "steps": ["string", "..."],
      "testData": "string (optional)",
      "expectedResult": "string",
      "category": "string (e.g., Positive|Negative|Edge|Authorization|Non-Functional)"
    }
  ],
  "model": "string (optional)",
  "promptTokens": 0,
  "completionTokens": 0
}

Guidelines:
- Generate test case IDs like TC-001, TC-002, etc.
- Write concise, imperative steps (e.g., "Click login button", "Enter valid email")
- Include Positive, Negative, and Edge test cases where relevant
- Categories: Positive, Negative, Edge, Authorization, Non-Functional
- Steps should be actionable and specific
- Expected results should be clear and measurable

Return ONLY the JSON object, no additional text or formatting.`

export function buildPrompt(request: GenerateRequest): string {
  const { storyTitle, acceptanceCriteria, description, additionalInfo } = request
  const categories = (request as any).categories as string[] | undefined
  
  let userPrompt = `Generate comprehensive test cases for the following user story:

Story Title: ${storyTitle}

Acceptance Criteria:
${acceptanceCriteria}
`

  if (description) {
    userPrompt += `\nDescription:
${description}
`
  }

  if (additionalInfo) {
    userPrompt += `\nAdditional Information:
${additionalInfo}
`
  }

  if (categories && categories.length > 0) {
    userPrompt += `\nOnly generate test cases for the following categories: ${categories.join(', ')}.`
  } else {
    userPrompt += `\nGenerate test cases covering positive scenarios, negative scenarios, edge cases, and any authorization or non-functional requirements as applicable.`
  }

  userPrompt += ` Return only the JSON response.`

  return userPrompt
}

export function buildTestDataPrompt(testCase: { id: string; title: string; steps: string[]; testData?: string; expectedResult: string; category: string }, count: number = 5): string {
  const stepsText = (testCase.steps || []).map((s, i) => `${i + 1}. ${s}`).join('\n')
  return `You are a Test Data Manager.
Given the following test case, generate up to ${count} rows of test data that include both valid and invalid inputs.
Ensure the data covers positive (valid), negative (invalid), and edge cases.
Keep the data simple, realistic, and easy to understand.
Present the output in a table format with the following columns separated by a tab or pipe:
Test Data ID | Input Field(s) | Valid/Invalid | Sample Value

Test Case ID: ${testCase.id}
Title: ${testCase.title}
Category: ${testCase.category}
Expected Result: ${testCase.expectedResult}
Steps:
${stepsText}

Return only the tabular rows (one per line).` }