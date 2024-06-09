/** @type {import('next').NextConfig} */
const nextConfig = {
	webpack: (config) => {
		config.experiments ??= {};
		config.experiments.topLevelAwait = true; // Enable top-level await
		return config;
	},
};

export default nextConfig;
