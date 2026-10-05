const SQUARE_VERSION = '2026-09-16';
const PAGE_LIMIT = 100;
const PAYMENTS_OBJECT = 'payments.json';

export type SavedPayment = {
	createdAt: string;
	amount: number;
	currency: string;
};

export type SavedPayments = {
	savedAt: string;
	payments: SavedPayment[];
};

type SquareMoney = {
	amount?: number;
	currency?: string;
};

type SquarePayment = {
	created_at?: string;
	status?: string;
	amount_money?: SquareMoney;
	total_money?: SquareMoney;
};

type SquareListResponse = {
	payments?: SquarePayment[];
	errors?: { detail?: string; code?: string }[];
};

type SquareClientOptions = {
	token: string;
	apiBase: string;
	locationId?: string;
};

function toSavedPayment(payment: SquarePayment): SavedPayment | null {
	if (payment.status === 'CANCELED') {
		return null;
	}
	const money = payment.total_money ?? payment.amount_money;
	if (!payment.created_at || money?.amount == null || !money.currency) {
		return null;
	}
	return {
		createdAt: payment.created_at,
		amount: money.amount,
		currency: money.currency,
	};
}

async function fetchLatestPayments(options: SquareClientOptions): Promise<SavedPayment[]> {
	const url = new URL('/v2/payments', options.apiBase);
	url.searchParams.set('limit', String(PAGE_LIMIT));
	url.searchParams.set('sort_order', 'DESC');
	url.searchParams.set('sort_field', 'CREATED_AT');
	if (options.locationId) {
		url.searchParams.set('location_id', options.locationId);
	}

	const response = await fetch(url, {
		headers: {
			Authorization: `Bearer ${options.token}`,
			'Square-Version': SQUARE_VERSION,
			Accept: 'application/json',
		},
	});
	const body = (await response.json()) as SquareListResponse;
	if (!response.ok) {
		const detail = body.errors?.map((error) => error.detail).find(Boolean);
		throw new Error(detail ?? `Square API returned ${response.status}`);
	}

	return (body.payments ?? []).flatMap((payment) => {
		const saved = toSavedPayment(payment);
		return saved ? [saved] : [];
	});
}

export async function saveLatestPayments(bucket: R2Bucket, options: SquareClientOptions): Promise<SavedPayments> {
	const saved: SavedPayments = {
		savedAt: new Date().toISOString(),
		payments: await fetchLatestPayments(options),
	};
	await bucket.put(PAYMENTS_OBJECT, JSON.stringify(saved), {
		httpMetadata: {
			contentType: 'application/json; charset=utf-8',
			cacheControl: 'public, max-age=10',
		},
	});

	return saved;
}
