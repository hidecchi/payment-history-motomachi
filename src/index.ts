import { WebhooksHelper } from 'square';
import { saveLatestPayments } from './payments';

export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);
		if (url.pathname !== '/webhooks/square') {
			return Response.json({ error: 'Not found' }, { status: 404 });
		}
		if (request.method !== 'POST') {
			return Response.json({ error: 'Method not allowed' }, { status: 405 });
		}
		if (!env.SQUARE_ACCESS_TOKEN || !env.SQUARE_WEBHOOK_SIGNATURE_KEY || !env.SQUARE_WEBHOOK_URL) {
			return Response.json({ error: 'Square webhook is not configured' }, { status: 500 });
		}

		const body = await request.text();
		const valid = await WebhooksHelper.verifySignature({
			requestBody: body,
			signatureHeader: request.headers.get('x-square-hmacsha256-signature') ?? '',
			signatureKey: env.SQUARE_WEBHOOK_SIGNATURE_KEY,
			notificationUrl: env.SQUARE_WEBHOOK_URL,
		});
		if (!valid) {
			return new Response(null, { status: 403 });
		}

		try {
			await saveLatestPayments(env.PAYMENT_HISTORY, {
				token: env.SQUARE_ACCESS_TOKEN,
				apiBase: env.SQUARE_API_BASE,
				locationId: env.SQUARE_LOCATION_ID,
			});
			return new Response(null, { status: 200 });
		} catch {
			console.error(JSON.stringify({ message: 'square_payment_sync_failed' }));
			return Response.json({ error: 'Failed to update payments' }, { status: 500 });
		}
	},
} satisfies ExportedHandler<Env>;
