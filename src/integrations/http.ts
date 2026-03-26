import { execFileSync } from "node:child_process";

export function fetchTextSync(
  url: string,
  options?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  }
): string {
  const script = `
    const [url, optionsJson] = process.argv.slice(1);
    const options = optionsJson ? JSON.parse(optionsJson) : {};
    fetch(url, options).then(async (response) => {
      const text = await response.text();
      if (!response.ok) {
        console.error(text || response.statusText);
        process.exit(1);
      }
      process.stdout.write(text);
    }).catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
  `;
  return execFileSync(process.execPath, ["-e", script, url, JSON.stringify(options ?? {})], { encoding: "utf8" });
}
