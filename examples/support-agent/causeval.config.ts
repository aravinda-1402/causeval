// Bundled example: a realistic support-agent contract with deliberately weak
// evals, so the causal stage has something real to reveal. The fixture provider
// needs no API key.
export default {
  prompt: "./prompts/system.md",
  evals: ["./evals/*.json"],
  provider: { type: "fixture" },
  thresholds: {
    minimumTraceCoverage: 0.7,
    minimumCausalCoverage: 0.4,
    // The example ships with known gaps; a real project should drive this to 0.
    maximumHighRiskUncovered: 5,
  },
};
