import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
	test: {
		testTimeout: 15000,
		poolOptions: {
			workers: {
				wrangler: { configPath: './wrangler.test.jsonc' },
			},
		},
	},
});
