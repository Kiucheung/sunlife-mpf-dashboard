const repo = "sunlife-mpf-dashboard";
const isPages = process.env.GITHUB_PAGES === "true";
/** @type {import('next').NextConfig} */
export default {
  output: "export",
  basePath: isPages ? `/${repo}` : "",
  images: { unoptimized: true },
  trailingSlash: true,
};
