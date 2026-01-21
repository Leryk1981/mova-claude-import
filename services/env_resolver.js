#!/usr/bin/env node
import fs from "node:fs/promises";

const SENSITIVE_PATTERNS = [/password/i, /secret/i, /key/i, /token/i, /auth/i];

export function maskSensitiveValue(value, varName) {
  if (!SENSITIVE_PATTERNS.some((pattern) => pattern.test(varName))) return value;
  const str = String(value ?? "");
  if (str.length <= 4) return "*".repeat(str.length);
  return `${str.slice(0, 2)}${"*".repeat(Math.max(0, str.length - 4))}${str.slice(-2)}`;
}

export function parseEnvSyntax(str) {
  if (typeof str !== "string") return null;
  const match = str.match(/^\$\{([A-Za-z0-9_]+)(?::(.+))?\}$/);
  if (!match) return null;
  const [, varName, defaultRaw] = match;
  return { varName, defaultRaw };
}

function inferType(defaultRaw) {
  if (defaultRaw === undefined) return "string";
  if (/^(true|false)$/i.test(defaultRaw)) return "boolean";
  if (/^-?\d+(\.\d+)?$/.test(defaultRaw)) return "number";
  if (/^\s*[\[{]/.test(defaultRaw)) return "json";
  return "string";
}

export function validateAndConvert(value, type) {
  if (value === undefined) return value;
  const str = String(value);
  switch (type) {
    case "boolean": {
      if (/^(true|1)$/i.test(str)) return true;
      if (/^(false|0)$/i.test(str)) return false;
      throw new Error(`Invalid boolean value: ${str}`);
    }
    case "number": {
      const num = Number(str);
      if (!Number.isFinite(num)) throw new Error(`Invalid number value: ${str}`);
      return num;
    }
    case "json": {
      try {
        return JSON.parse(str);
      } catch (error) {
        throw new Error(`Invalid JSON value: ${str}`);
      }
    }
    default:
      return str;
  }
}

function resolveString(str, options) {
  const parsed = parseEnvSyntax(str);
  if (!parsed) return str;
  const { varName, defaultRaw } = parsed;
  const envValue = options.env?.[varName] ?? process.env[varName];
  const type = inferType(defaultRaw);
  const source = envValue !== undefined ? envValue : defaultRaw;
  if (options.validateTypes) {
    return validateAndConvert(source, type);
  }
  return source ?? "";
}

function resolveEmbedded(str, options) {
  return str.replace(/\$\{([A-Za-z0-9_]+)(?::([^}]+))?\}/g, (match, varName, defaultRaw) => {
    const envValue = options.env?.[varName] ?? process.env[varName];
    if (envValue !== undefined) return envValue;
    return defaultRaw ?? match;
  });
}

export function resolveEnvironmentConfig(config, options = {}) {
  if (Array.isArray(config)) {
    return config.map((value) => resolveEnvironmentConfig(value, options));
  }
  if (config && typeof config === "object") {
    const out = {};
    for (const [key, value] of Object.entries(config)) {
      out[key] = resolveEnvironmentConfig(value, options);
    }
    return out;
  }
  if (typeof config === "string") {
    if (parseEnvSyntax(config)) return resolveString(config, options);
    if (config.includes("${")) return resolveEmbedded(config, options);
  }
  return config;
}

export async function loadConfigWithEnv(filePath, options = {}) {
  const raw = await fs.readFile(filePath, "utf8");
  const data = JSON.parse(raw);
  const resolved = resolveEnvironmentConfig(data, options);
  if (options.maskSensitive) {
    const masked = resolveEnvironmentConfig(data, {
      ...options,
      validateTypes: false,
      env: Object.fromEntries(
        Object.keys(process.env).map((key) => [key, maskSensitiveValue(process.env[key], key)])
      ),
    });
    return { resolved, masked };
  }
  return { resolved };
}

async function cmdResolve(filePath) {
  const { resolved } = await loadConfigWithEnv(filePath, { validateTypes: true });
  process.stdout.write(JSON.stringify(resolved, null, 2));
}

async function cmdValidate(filePath) {
  await loadConfigWithEnv(filePath, { validateTypes: true });
  process.stdout.write("ok\n");
}

async function runTests() {
  const tests = [];
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };

  tests.push(() => {
    process.env.MOVA_BOOL = "true";
    const out = resolveEnvironmentConfig({ flag: "${MOVA_BOOL:false}" }, { validateTypes: true });
    assert(out.flag === true, "boolean conversion failed");
  });

  tests.push(() => {
    const out = resolveEnvironmentConfig({ num: "${MOVA_NUM:42}" }, { validateTypes: true });
    assert(out.num === 42, "number conversion failed");
  });

  tests.push(() => {
    const out = resolveEnvironmentConfig({ arr: "${MOVA_ARR:[1,2]}" }, { validateTypes: true });
    assert(Array.isArray(out.arr) && out.arr.length === 2, "json conversion failed");
  });

  tests.push(() => {
    const masked = maskSensitiveValue("secretvalue", "API_TOKEN");
    assert(masked.startsWith("se") && masked.endsWith("ue"), "masking failed");
  });

  for (const test of tests) test();
  process.stdout.write("env_resolver tests: ok\n");
}

async function main() {
  const [command, filePath] = process.argv.slice(2);
  if (command === "resolve" && filePath) return cmdResolve(filePath);
  if (command === "validate" && filePath) return cmdValidate(filePath);
  if (command === "test") return runTests();
  process.stderr.write("Usage: node services/env_resolver.js <resolve|validate|test> [file.json]\n");
  process.exit(1);
}

if (process.argv[1]?.endsWith("env_resolver.js")) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
}
