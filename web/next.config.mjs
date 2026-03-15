/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@pinescript-utils/core",
    "@pinescript-utils/data-feed",
    "@pinescript-utils/pine-runtime",
    "@pinescript-utils/backtester",
    "@pinescript-utils/reporter",
    "@pinescript-utils/ranker",
    "@pinescript-utils/venice",
    "@pinescript-utils/optimizer",
    "@pinescript-utils/walk-forward",
    "@pinescript-utils/alpha-lab",
  ],
};

export default nextConfig;
