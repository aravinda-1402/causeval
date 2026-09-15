export default {
  prompt: "./prompts/system.md",
  evals: ["./evals/*.json"],
  provider: {
    type: "compatible",
    model: process.env.CAUSEVAL_MODEL,
    baseURL: process.env.CAUSEVAL_BASE_URL,
  },
};
