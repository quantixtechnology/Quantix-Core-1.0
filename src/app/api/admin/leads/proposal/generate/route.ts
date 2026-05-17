// ============================================================================
// POST /api/admin/leads/proposal/generate
// Uses the Anthropic API to enhance proposal content based on form data.
// Requires ANTHROPIC_API_KEY in the environment.
// ============================================================================

import { NextResponse } from 'next/server'
import { withMiddleware, createErrorResponse } from '@/lib/middleware'
import { PROPOSAL_DESIGN_PROMPT } from '@/components/admin/leads/quote-proposal-view'

export const POST = withMiddleware({
  requireAuth: true,
  requiredPermission: 'proposals:create',
})(async (req) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return createErrorResponse('AI generation is not configured (ANTHROPIC_API_KEY missing)', 503)
    }

    const { formData } = await req.json()
    if (!formData) {
      return createErrorResponse('Missing formData', 400)
    }

    const userMessage = `Based on the following SaaS onboarding proposal details, generate professional content.

Proposal details:
- Client: ${formData.clientName || 'N/A'} at ${formData.businessName || 'N/A'}
- Plan: ${formData.planTier} plan, ${formData.storeCount} store(s)
- Services: Subscription ₹${formData.subscriptionAmount || 0}, Implementation ₹${formData.implementationAmount || 0}, iOS App ₹${formData.iosAppAmount || 0}, Add-ons ₹${formData.addOnsAmount || 0}
- Discount: ₹${formData.discountAmount || 0}
- Workflows: ${(formData.enabledWorkflows ?? []).join(', ') || 'None'}
- Modules: ${(formData.includedModules ?? []).join(', ') || 'None'}

Return a JSON object with this exact structure:
{
  "executiveSummary": "2-3 sentence professional summary of what the client gets",
  "serviceDescriptions": {
    "subscription": "one line describing the subscription service value",
    "implementation": "one line describing the implementation scope",
    "ios": "one line describing the iOS app deliverable",
    "addons": "one line describing the add-ons included"
  },
  "notes": {
    "onboarding": "brief onboarding process description (2-3 sentences)",
    "timeline": "estimated go-live timeline (1-2 sentences)",
    "support": "post-launch support details (1-2 sentences)"
  }
}

Return only valid JSON, no markdown, no explanation.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: PROPOSAL_DESIGN_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      return createErrorResponse(`Anthropic API error: ${err}`, 502)
    }

    const result = await response.json()
    const text = result.content?.[0]?.text ?? ''

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(text)
    } catch {
      return createErrorResponse('AI returned invalid JSON', 502)
    }

    return NextResponse.json({ success: true, data: parsed })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate proposal content'
    return createErrorResponse(message, 500)
  }
})
